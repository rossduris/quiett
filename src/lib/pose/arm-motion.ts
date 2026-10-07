import {
  ARM_FAIL_HOLD_MS,
  ARM_GLITCH_JUMP,
  ARM_JITTER_FLOOR,
  ARM_MIN_JOINT_CONFIDENCE,
  ARM_MOTION_MAX,
  ARM_MOTION_MIN_SAMPLES,
  ARM_MOTION_PERSIST_GAP_MS,
  ARM_MOTION_PERSIST_MS,
  ARM_MOTION_RECOVER_RATIO,
  ARM_MOTION_WINDOW_MS,
  ARM_SMOOTHING,
} from './thresholds';
import type { ArmMotionDiagnostics, PoseLandmarks } from './types';

/**
 * Arm stillness: are the wrists / elbows moving relative to the shoulders?
 *
 * Uses the metric 3D arm joints from quiett-pose (`detector.extra.arm3D`, body3d) when present,
 * else the 2D Vision joints (skipping low-confidence ones). Positions are shoulder-relative and
 * scaled by shoulder width, so leaning or swaying the whole body doesn't count as arm motion
 * (the whole-body `stillness` check owns that).
 */

type Vec = number[];
type JointKey = 'leftWrist' | 'rightWrist' | 'leftElbow' | 'rightElbow';

const ARM_JOINTS: { key: JointKey; shoulder: 'leftShoulder' | 'rightShoulder'; label: string }[] = [
  { key: 'leftWrist', shoulder: 'leftShoulder', label: 'LW' },
  { key: 'rightWrist', shoulder: 'rightShoulder', label: 'RW' },
  { key: 'leftElbow', shoulder: 'leftShoulder', label: 'LE' },
  { key: 'rightElbow', shoulder: 'rightShoulder', label: 'RE' },
];

type Sample = { t: number; joints: Partial<Record<JointKey, Vec>> };

export type ArmMotionResult = ArmMotionDiagnostics & {
  /** Measurable this frame (enough samples for at least one joint). */
  available: boolean;
};

const sub = (a: Vec, b: Vec) => a.map((v, i) => v - (b[i] ?? 0));
const len = (a: Vec) => Math.sqrt(a.reduce((s, v) => s + v * v, 0));
const scale = (a: Vec, k: number) => a.map((v) => v * k);

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function readArm3D(landmarks: PoseLandmarks): Record<string, Vec> | null {
  const raw = landmarks.detector?.extra?.arm3D;
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, Vec> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      out[k] = v as number[];
    }
  }
  return out.leftShoulder && out.rightShoulder ? out : null;
}

function read2D(landmarks: PoseLandmarks): Record<string, Vec> | null {
  const w = landmarks.imageWidth && landmarks.imageWidth > 0 ? landmarks.imageWidth : 1;
  const h = landmarks.imageHeight && landmarks.imageHeight > 0 ? landmarks.imageHeight : 1;
  const out: Record<string, Vec> = {};
  for (const k of ['leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftWrist', 'rightWrist']) {
    const j = landmarks.joints?.[k];
    if (!j || !(j.confidence >= ARM_MIN_JOINT_CONFIDENCE)) continue;
    if (!Number.isFinite(j.x) || !Number.isFinite(j.y)) continue;
    out[k] = [j.x * w, j.y * h];
  }
  return out.leftShoulder && out.rightShoulder ? out : null;
}

type Window = {
  samples: Sample[];
  smoothed: Partial<Record<JointKey, Vec>>;
  glitches: Partial<Record<JointKey, number>>;
};
const emptyWindow = (): Window => ({ samples: [], smoothed: {}, glitches: {} });

export function createArmMotionTracker() {
  // One window per joint source. body3d falls back to 2D on frames where the 3D pose isn't
  // found (often exactly while the arms move); keeping separate windows means a 3D↔2D flip no
  // longer wipes the history and turns the check "unavailable" (which used to count as a pass).
  let windows: Record<'2d' | '3d', Window> = { '2d': emptyWindow(), '3d': emptyWindow() };
  let source: ArmMotionDiagnostics['source'] = 'none';
  let failing = false;
  let lastFailAt = 0;
  /** First / latest frame the travel was over the limit while not yet failing (arms-only grace). */
  let overSince: number | null = null;
  let lastOverAt = 0;

  const reset = () => {
    windows = { '2d': emptyWindow(), '3d': emptyWindow() };
    source = 'none';
    failing = false;
    lastFailAt = 0;
    overSince = null;
    lastOverAt = 0;
  };

  const push = (landmarks: PoseLandmarks, now: number = Date.now()): ArmMotionResult => {
    const pts3 = readArm3D(landmarks);
    const pts = pts3 ?? read2D(landmarks);
    const frameSource: ArmMotionDiagnostics['source'] = pts3 ? '3d' : pts ? '2d' : 'none';
    if (frameSource !== 'none') source = frameSource;

    if (pts && frameSource !== 'none') {
      const win = windows[frameSource];
      const sw = len(sub(pts.leftShoulder, pts.rightShoulder));
      const minSw = pts3 ? 0.12 : 8; // metres / pixels — shoulders must be resolvable
      if (sw >= minSw) {
        const frame: Sample = { t: now, joints: {} };
        for (const { key, shoulder } of ARM_JOINTS) {
          const p = pts[key];
          const s = pts[shoulder];
          if (!p || !s) {
            delete win.smoothed[key];
            continue;
          }
          const rel = scale(sub(p, s), 1 / sw);
          const prev = win.smoothed[key];
          if (!prev) {
            // The joint is back after a gap (low confidence / out of frame). Start its series
            // fresh: comparing against where it was before the gap would read the jump as motion,
            // so a joint that merely went missing could fake a break.
            for (const old of win.samples) delete old.joints[key];
            win.glitches[key] = 0;
          }
          if (prev && len(sub(rel, prev)) > ARM_GLITCH_JUMP && (win.glitches[key] ?? 0) < 2) {
            win.glitches[key] = (win.glitches[key] ?? 0) + 1;
            continue;
          }
          win.glitches[key] = 0;
          const next = prev && prev.length === rel.length
            ? rel.map((v, i) => prev[i] + (v - prev[i]) * ARM_SMOOTHING)
            : rel;
          win.smoothed[key] = next;
          frame.joints[key] = next;
        }
        win.samples.push(frame);
      }
    }
    for (const w of Object.values(windows)) w.samples = w.samples.filter((s) => now - s.t <= ARM_MOTION_WINDOW_MS);

    const samples = source === 'none' ? [] : windows[source].samples;
    const perJoint: Record<string, number> = {};
    let worst: number | undefined;
    for (const { key, label } of ARM_JOINTS) {
      const series = samples.map((s) => s.joints[key]).filter((v): v is Vec => !!v);
      if (series.length < ARM_MOTION_MIN_SAMPLES) continue;
      const dims = series[0].length;
      const med = Array.from({ length: dims }, (_, i) => median(series.map((v) => v[i] ?? 0)));
      const devs = series.map((v) => len(sub(v, med))).sort((a, b) => b - a);
      const travel = Math.max(0, (devs[1] ?? devs[0]) - ARM_JITTER_FLOOR);
      perJoint[label] = travel;
      worst = worst == null ? travel : Math.max(worst, travel);
    }

    let available = worst != null;
    if (available) {
      if (failing) {
        failing = worst! >= ARM_MOTION_MAX * ARM_MOTION_RECOVER_RATIO;
      } else if (worst! > ARM_MOTION_MAX) {
        // Arms-only grace: the motion has to persist before it counts.
        if (overSince == null || now - lastOverAt > ARM_MOTION_PERSIST_GAP_MS) overSince = now;
        lastOverAt = now;
        failing = now - overSince >= ARM_MOTION_PERSIST_MS;
      } else {
        overSince = null;
      }
      if (failing) {
        lastFailAt = now;
        overSince = null;
      }
    } else if (failing && now - lastFailAt < ARM_FAIL_HOLD_MS) {
      // Moving arms blur and Vision drops the wrists/elbows for a few frames. That gap used to
      // reset `failing` and read as a pass — so a waving arm never broke the hold. Hold the
      // failure until the arms are measurably still again (or we lose them for a while).
      available = true;
    } else {
      // Unmeasurable and not (recently) failing: missing joints are never a failure.
      failing = false;
      if (overSince != null && now - lastOverAt > ARM_MOTION_PERSIST_GAP_MS) overSince = null;
    }

    return {
      available,
      source: pts ? source : 'none',
      value: worst,
      perJoint,
      samples: samples.length,
      failing,
      limit: ARM_MOTION_MAX,
    };
  };

  return { push, reset };
}

/** Compact dev readout, e.g. "3D LW .04 RW .31 LE .00 RE .12". */
export function formatArmMotion(a: ArmMotionDiagnostics | undefined): string {
  if (!a) return 'arms –';
  const parts = ['LW', 'RW', 'LE', 'RE'].map((k) =>
    a.perJoint[k] == null ? `${k} –` : `${k} ${a.perJoint[k].toFixed(2).replace(/^0/, '')}`,
  );
  return `arms ${a.source === 'none' ? 'n/a' : a.source.toUpperCase()} · ${parts.join(' ')} · n=${a.samples}`;
}
