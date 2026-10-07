import type { PoseJoint, PoseLandmarks } from './types';

/**
 * Free-hand motion for 2D body pose.
 *
 * Body2d does not run a separate hand detector. The arm check also refuses to
 * run unless both shoulders are found, so a normal head view (phone in one
 * hand, shoulders often missing) treated every wave as still.
 *
 * This watches whichever wrists and elbows Vision actually returns, measured
 * from the nose so a steady phone does not look like a moving hand. The hand
 * holding the phone is usually out of frame or still. A wave, or a hand that
 * stays on the face, fails.
 *
 * A closer handheld crop makes the face large and often drops the wrists out
 * of the pose. Thresholds that were a fixed slice of the image (5% travel,
 * 12% from the nose) then miss a wave and a hand on the cheek. Travel stays
 * in image space for a wrist that is actually visible. The "on the face"
 * radius grows with the face, and a missing wrist falls back to that side's
 * elbow so the wave is still seen.
 */

const JOINTS = ['leftWrist', 'rightWrist', 'leftElbow', 'rightElbow'] as const;
type JointKey = (typeof JOINTS)[number];
const CONF = 0.06;
const WINDOW_MS = 900;
const MIN_SAMPLES = 3;
/** Nose-relative travel (fraction of the image) above this is a wave, when the wrist is in frame. */
const TRAVEL_MAX = 0.05;
/**
 * Elbow-only travel limit used when that side's wrist is cropped out.
 * A close wave mostly moves the hand; the elbow still shifts, but less than 5%.
 */
const ELBOW_CROP_MAX = 0.028;
/** Subtracted so a steady hold's jitter does not count. */
const FLOOR = 0.016;
/** A wrist this close to the nose is on the face when the face is small in frame. */
const NEAR_NOSE = 0.12;
/** Eye span (image fraction) at which NEAR_NOSE matches a hand on the cheek. */
const NOMINAL_FACE = 0.1;
/** Do not let a large face treat a hand resting on the phone as "on the face". */
const NEAR_CAP = 0.3;
const PERSIST_MS = 280;
const PERSIST_GAP_MS = 400;

type Pt = { x: number; y: number };
type Sample = { t: number; joints: Partial<Record<JointKey, Pt>> };

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function ok(j: PoseJoint | undefined): j is PoseJoint {
  return !!j && j.confidence >= CONF && Number.isFinite(j.x) && Number.isFinite(j.y);
}

/** How big the face is in the image. Null when we cannot tell. */
function faceScale(joints: PoseLandmarks['joints']): number | null {
  const le = joints?.leftEye;
  const re = joints?.rightEye;
  if (ok(le) && ok(re)) {
    const span = dist(le, re);
    if (span > 0.02) return span;
  }
  const nose = joints?.nose;
  const neck = joints?.neck;
  if (ok(nose) && ok(neck)) {
    const span = dist(nose, neck);
    // Nose-to-neck runs a bit longer than the eyes on a front view.
    if (span > 0.02) return span * 0.72;
  }
  return null;
}

function nearRadius(scale: number | null): number {
  if (scale == null) return NEAR_NOSE;
  return Math.min(NEAR_CAP, Math.max(NEAR_NOSE, scale * (NEAR_NOSE / NOMINAL_FACE)));
}

function sideOf(key: JointKey): 'left' | 'right' {
  return key.startsWith('left') ? 'left' : 'right';
}

export type HandMotionResult = {
  available: boolean;
  failing: boolean;
  /** Worst nose-relative travel this window, fraction of the image. */
  value?: number;
  /** A hand is parked on the face. */
  nearFace: boolean;
};

export function createHandMotionTracker() {
  let samples: Sample[] = [];
  let failing = false;
  let overSince: number | null = null;
  let lastOverAt = 0;
  let nearSince: number | null = null;
  let lastNearAt = 0;

  const reset = () => {
    samples = [];
    failing = false;
    overSince = null;
    lastOverAt = 0;
    nearSince = null;
    lastNearAt = 0;
  };

  const push = (landmarks: PoseLandmarks, now: number = Date.now()): HandMotionResult => {
    const joints = landmarks.joints;
    const nose = joints?.nose;
    const noseOk = ok(nose);
    const radius = nearRadius(faceScale(joints));
    const frame: Sample = { t: now, joints: {} };
    const wristInFrame = { left: false, right: false };
    let near = false;
    for (const key of JOINTS) {
      const j = joints?.[key];
      if (!ok(j)) continue;
      const pt = noseOk ? { x: j.x - nose.x, y: j.y - nose.y } : { x: j.x, y: j.y };
      frame.joints[key] = pt;
      const side = sideOf(key);
      if (key.endsWith('Wrist')) wristInFrame[side] = true;
    }
    if (noseOk) {
      for (const key of JOINTS) {
        const j = joints?.[key];
        if (!ok(j)) continue;
        const onFace = dist(j, nose) <= radius;
        if (!onFace) continue;
        if (key.endsWith('Wrist')) near = true;
        // Wrist cropped by a close hold: the elbow up by the cheek is the hand.
        else if (!wristInFrame[sideOf(key)]) near = true;
      }
    }
    if (Object.keys(frame.joints).length) samples.push(frame);
    samples = samples.filter((s) => now - s.t <= WINDOW_MS);

    let worst: number | undefined;
    let moving = false;
    for (const key of JOINTS) {
      const series = samples.map((s) => s.joints[key]).filter((v): v is Pt => !!v);
      if (series.length < MIN_SAMPLES) continue;
      const mx = series.reduce((s, p) => s + p.x, 0) / series.length;
      const my = series.reduce((s, p) => s + p.y, 0) / series.length;
      const devs = series.map((p) => Math.hypot(p.x - mx, p.y - my)).sort((a, b) => b - a);
      const travel = Math.max(0, (devs[1] ?? devs[0]) - FLOOR);
      worst = worst == null ? travel : Math.max(worst, travel);
      const wristSamples = samples.filter((s) => s.joints[sideOf(key) === 'left' ? 'leftWrist' : 'rightWrist']).length;
      const cropped = key.endsWith('Elbow') && wristSamples < MIN_SAMPLES;
      const limit = cropped ? ELBOW_CROP_MAX : TRAVEL_MAX;
      if (travel > limit) moving = true;
    }

    if (moving) {
      if (overSince == null || now - lastOverAt > PERSIST_GAP_MS) overSince = now;
      lastOverAt = now;
    } else if (overSince != null && now - lastOverAt > PERSIST_GAP_MS) {
      overSince = null;
    }
    if (near) {
      if (nearSince == null || now - lastNearAt > PERSIST_GAP_MS) nearSince = now;
      lastNearAt = now;
    } else if (nearSince != null && now - lastNearAt > PERSIST_GAP_MS) {
      nearSince = null;
    }
    const wave = overSince != null && now - overSince >= PERSIST_MS;
    const onFace = nearSince != null && now - nearSince >= PERSIST_MS;
    failing = wave || onFace;

    return {
      available: worst != null || near,
      failing,
      value: worst,
      nearFace: onFace,
    };
  };

  return { push, reset };
}
