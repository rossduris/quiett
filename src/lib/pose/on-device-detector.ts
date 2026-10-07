import type { ElementRef, RefObject } from 'react';
import type { CameraView } from 'expo-camera';
import {
  analyzePoseImage,
  isNativePoseAvailable,
  subscribeToLivePoseFrames,
  type NativePoseResult,
  type PoseFrameListener,
} from 'quiett-pose';
import {
  classifyPresenceAndUpright,
  createHoldingHysteresis,
  isStill,
  stillnessTravel,
  toPoseStatus,
  type MotionSample,
} from './classify';
import {
  BRIGHTNESS_MIN,
  CAPTURE_INTERVAL_MS,
  CAPTURE_QUALITY,
  ENTER_HOLDING_FRAMES,
  FACE_PITCH_MAX,
  FACE_YAW_MAX,
  LEAVE_HOLDING_FRAMES,
  MIN_JOINT_CONFIDENCE,
  STILLNESS_MAX_MOTION,
  ARM_MOTION_MAX,
  HANDHELD_STILLNESS_MAX,
  SHOULDER_SQUARE_MAX,
  LOW_LIGHT_ENTER_LUMA,
  LOW_LIGHT_EXIT_LUMA,
} from './thresholds';
import { createArmMotionTracker } from './arm-motion';
import { createLowLightGate } from './low-light';
import { createProppedMonitor } from './device-propped';
import { distanceStatus, shoulderSpan, shoulderSquareOffset } from './distance';
import type {
  PoseCheck,
  PoseDetector,
  PoseDetectorListener,
  PoseDetectorMode,
  PoseDiagnostics,
  PoseLandmarks,
  PoseSample,
  PoseStatus,
} from './types';
import { notePoseFrameForFallback } from '@/lib/pose-dev-pref';

export type CaptureFn = () => Promise<string | null>;

export type LivePoseDetectorOptions = {
  mode: 'live';
  /**
   * Subscribe to native live frames `{ joints, faceCount, available, timestamp }`.
   * Defaults to quiett-pose `subscribeToLivePoseFrames` (fed by QuiettPoseCameraView).
   */
  subscribeToNativeEvents?: (listener: PoseFrameListener) => () => void;
  forceMock?: boolean;
  /**
   * Which gate logic to use. Must match the `detectorMode` prop given to
   * QuiettPoseCameraView (native runs the matching Vision requests). Default 'legacy'.
   * If a body mode is requested but the native frame has no `detector` block
   * (old native build), frames are classified with legacy logic.
   */
  detector?: PoseDetectorMode;
};

export type CapturePoseDetectorOptions = {
  mode?: 'capture';
  captureFrame: CaptureFn;
  forceMock?: boolean;
};

export type OnDevicePoseDetectorOptions =
  | LivePoseDetectorOptions
  | CapturePoseDetectorOptions;

export type OnDevicePoseDetector = PoseDetector & {
  clearSimulate: () => void;
  usingNative: boolean;
  mode: 'live' | 'capture';
  detector: PoseDetectorMode;
};

const CHECK_WEIGHTS: Record<string, number> = {
  lighting: 1,
  facing: 1.5,
  shoulderLevel: 1,
  headCentered: 1,
  torsoUpright: 1,
  handsLow: 1.5,
  handsAway: 1.5,
  stillness: 1.5,
  armStillness: 1.5,
};

function softScore(c: PoseCheck): number {
  if (c.pass) return 1;
  if (c.value == null || !Number.isFinite(c.value) || c.limit <= 0) return 0;
  if (c.kind === 'max') return Math.max(0, Math.min(1, 1 - (c.value - c.limit) / c.limit)) * 0.8;
  if (c.kind === 'min') return Math.max(0, Math.min(1, c.value / c.limit)) * 0.8;
  return 0;
}

/** Weighted 0–100 score over available checks (mirrors native QuiettPoseBody.summarize). */
function scoreChecks(checks: PoseCheck[], personFound: boolean): number {
  let total = 0;
  let weight = 0;
  for (const c of checks) {
    if (!c.available) continue;
    const w = CHECK_WEIGHTS[c.name] ?? 1;
    total += softScore(c) * w;
    weight += w;
  }
  const score = weight > 0 ? Math.round((total / weight) * 100) : 0;
  return personFound ? score : Math.min(score, 20);
}

/**
 * Statuses a dim room replaces with `low_light`. Phone not upright, "Can't see you",
 * and nobody in view stay on top. Everything below (distance, posture, stillness,
 * and the all-good "holding") gives way to the light. "Absent" with someone visible
 * means the face check failed, which dim light causes, so light wins there too.
 */
const LOW_LIGHT_OUTRANKS: ReadonlySet<PoseStatus> = new Set<PoseStatus>([
  'too_close',
  'too_far',
  'posture',
  'fidgeting',
  'hands_near',
  'arms_moving',
  'holding',
]);

function applyLowLight(raw: PoseStatus, dim: boolean, personVisible: boolean): PoseStatus {
  if (!dim) return raw;
  if (LOW_LIGHT_OUTRANKS.has(raw)) return 'low_light';
  if (raw === 'absent' && personVisible) return 'low_light';
  return raw;
}

/** Debug readout: show the threshold that would flip the dim state next. */
function lowLightLimit(dim: boolean): number {
  return dim ? LOW_LIGHT_EXIT_LUMA : LOW_LIGHT_ENTER_LUMA;
}

function detectedJointNames(joints: PoseLandmarks['joints']): string[] {
  return Object.keys(joints)
    .filter((k) => (joints[k]?.confidence ?? 0) >= MIN_JOINT_CONFIDENCE)
    .sort();
}

let lastLightLogAt = 0;
/** Dev-only, ~1/sec: luma + auto-exposure so the low-light thresholds can be tuned on device. */
function logLight(l: PoseLandmarks, dim: boolean) {
  if (!__DEV__) return;
  const now = Date.now();
  if (now - lastLightLogAt < 1000) return;
  lastLightLogAt = now;
  const f = (n: number | undefined, d = 3) => (n == null || !Number.isFinite(n) ? '-' : n.toFixed(d));
  console.log(
    `[quiett light] luma=${f(l.brightness)} dim=${dim} enter=${LOW_LIGHT_ENTER_LUMA} exit=${LOW_LIGHT_EXIT_LUMA}` +
      ` iso=${f(l.iso, 0)}/${f(l.maxIso, 0)} shutterMs=${f(l.exposureDurationMs, 1)}`,
  );
}

function landmarksFromNative(raw: NativePoseResult): PoseLandmarks {
  const r = raw as NativePoseResult & {
    brightness?: number;
    brightEnough?: boolean;
    iso?: number;
    maxIso?: number;
    exposureDurationMs?: number;
  };
  return {
    available: !!r.available,
    faceCount: r.faceCount ?? 0,
    joints: (r.joints ?? {}) as PoseLandmarks['joints'],
    faceLooking: r.faceLooking,
    bothEyesVisible: r.bothEyesVisible,
    mouthVisible: r.mouthVisible,
    handNearFace: r.handNearFace ?? r.handsVisible,
    handsVisible: r.handsVisible ?? r.handNearFace,
    handCount: r.handCount,
    faceYaw: r.faceYaw,
    facePitch: r.facePitch,
    detectorMode: r.detectorMode,
    detector: r.detector as PoseLandmarks['detector'],
    processingMs: r.processingMs,
    imageWidth: r.imageWidth,
    imageHeight: r.imageHeight,
    orientation: r.orientation,
    targetFps: r.targetFps,
    brightness: r.brightness,
    iso: r.iso,
    maxIso: r.maxIso,
    exposureDurationMs: r.exposureDurationMs,
    // Missing flag (old native binary) → fail open until rebuild.
    brightEnough: r.brightEnough === undefined ? true : r.brightEnough === true,
  };
}

/**
 * On-device meditation-pose / in-frame detector (iOS Apple Vision via QuiettPose).
 *
 * Gate: light + facing + shoulders in view + upright enough + still. Holding the phone is allowed.
 * Light has two states: "Can't see you" (no one visible + near-black frame) and low light
 * (a dim room, even with someone visible; hysteresis + debounce in ./low-light).
 */

const BODY_STILL_WINDOW_MS = 1000;

type BodyStillSample = { t: number; sw: number; pts: { x: number; y: number }[] };

/** Median joint std-dev in shoulder-widths. Warmup (under 4 samples) is undefined, not a fail. */
function medianBodyTravel(samples: BodyStillSample[]): number | undefined {
  if (samples.length < 4) return undefined;
  const sw = samples[samples.length - 1]!.sw;
  if (!(sw > 0)) return undefined;
  const nPts = samples[samples.length - 1]!.pts.length;
  const rows = samples.filter((s) => s.pts.length === nPts);
  if (rows.length < 4) return undefined;
  const stds: number[] = [];
  for (let i = 0; i < nPts; i++) {
    const n = rows.length;
    let mx = 0;
    let my = 0;
    for (const s of rows) {
      mx += s.pts[i]!.x;
      my += s.pts[i]!.y;
    }
    mx /= n;
    my /= n;
    let v = 0;
    for (const s of rows) {
      const dx = s.pts[i]!.x - mx;
      const dy = s.pts[i]!.y - my;
      v += dx * dx + dy * dy;
    }
    stds.push(Math.sqrt(v / n) / sw);
  }
  stds.sort((a, b) => a - b);
  const mid = stds[Math.floor(stds.length / 2)];
  return mid != null && Number.isFinite(mid) ? mid : undefined;
}

/**
 * Nose + shoulder midpoint only. A wrist, elbow, or cup is not part of the sample,
 * so it cannot reset the hold.
 */
function pushBodyStill(
  history: BodyStillSample[],
  joints: PoseLandmarks['joints'],
  now: number,
): { history: BodyStillSample[]; travel: number | undefined } {
  const kept = history.filter((s) => now - s.t <= BODY_STILL_WINDOW_MS);
  const ls = joints.leftShoulder;
  const rs = joints.rightShoulder;
  if (
    !ls ||
    !rs ||
    ls.confidence < MIN_JOINT_CONFIDENCE ||
    rs.confidence < MIN_JOINT_CONFIDENCE
  ) {
    return { history: kept, travel: medianBodyTravel(kept) };
  }
  const sw = Math.hypot(ls.x - rs.x, ls.y - rs.y);
  if (!Number.isFinite(sw) || sw <= 0.02) {
    return { history: kept, travel: medianBodyTravel(kept) };
  }
  const pts = [{ x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 }];
  const nose = joints.nose;
  if (nose && nose.confidence >= MIN_JOINT_CONFIDENCE) pts.push({ x: nose.x, y: nose.y });
  kept.push({ t: now, sw, pts });
  return { history: kept, travel: medianBodyTravel(kept) };
}

export function createOnDevicePoseDetector(
  options: OnDevicePoseDetectorOptions,
): OnDevicePoseDetector {
  const listeners = new Set<PoseDetectorListener>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let busy = false;
  let stopped = true;
  let simulated: PoseStatus | null = null;
  let lastStatus: PoseStatus = 'absent';
  let lastConfidence = 0;
  let motion: MotionSample[] = [];
  let bodyStill: BodyStillSample[] = [];
  let unsubLive: (() => void) | null = null;
  let unsubUpright: (() => void) | null = null;
  let lastPresent = false;
  let lastFaceLooking = false;
  let lastBrightEnough = true;
  let lastConf = 0;
  const armTracker = createArmMotionTracker();
  const lowLight = createLowLightGate();
  const uprightMonitor = createProppedMonitor();
  const hysteresis = createHoldingHysteresis(
    ENTER_HOLDING_FRAMES,
    LEAVE_HOLDING_FRAMES,
  );

  const mode: 'live' | 'capture' =
    options.mode === 'live' ? 'live' : 'capture';
  // Stills (capture) only run the legacy native analyzer.
  const detector: PoseDetectorMode =
    mode === 'live' ? ((options as LivePoseDetectorOptions).detector ?? 'legacy') : 'legacy';
  const usingNative = !options.forceMock && isNativePoseAvailable();

  let lastDiagnostics: PoseDiagnostics | undefined;

  const emit = (status: PoseStatus, confidence: number, diagnostics?: PoseDiagnostics) => {
    lastStatus = status;
    lastConfidence = confidence;
    if (diagnostics) lastDiagnostics = diagnostics;
    const sample: PoseSample = {
      status,
      confidence,
      timestamp: Date.now(),
      diagnostics: diagnostics ?? lastDiagnostics,
    };
    listeners.forEach((l) => l(sample));
  };

  const baseDiagnostics = (
    landmarks: PoseLandmarks,
    phonePropped: boolean,
  ): Pick<
    PoseDiagnostics,
    | 'mode'
    | 'phonePropped'
    | 'joints'
    | 'processingMs'
    | 'imageWidth'
    | 'imageHeight'
    | 'orientation'
    | 'targetFps'
    | 'timestamp'
  > => ({
    mode: detector,
    phonePropped,
    joints: landmarks.joints ?? {},
    processingMs: landmarks.processingMs,
    imageWidth: landmarks.imageWidth,
    imageHeight: landmarks.imageHeight,
    orientation: landmarks.orientation,
    targetFps: landmarks.targetFps,
    timestamp: Date.now(),
  });

  /** body2d / body3d: native computed the checks; JS maps them to a status. */
  const processBody = (
    landmarks: PoseLandmarks,
    det: NonNullable<PoseLandmarks['detector']>,
    phonePropped: boolean,
  ) => {
    const order = det.checkOrder ?? Object.keys(det.checks ?? {});
    const checks: PoseCheck[] = order
      .map((k) => det.checks?.[k])
      .filter((c): c is PoseCheck => !!c);
    // Arm numbers stay on the dev readout. They do not change status.
    if (!phonePropped) {
      armTracker.reset();
    }
    const arm = phonePropped && det.personFound ? armTracker.push(landmarks) : undefined;
    const armMotion = arm
      ? {
          source: arm.source,
          value: arm.value,
          perJoint: arm.perJoint,
          samples: arm.samples,
          failing: false,
          limit: arm.limit,
        }
      : undefined;
    const handsLow = checks.find((c) => c.name === 'handsLow');
    if (handsLow) {
      handsLow.pass = true;
      handsLow.available = false;
      handsLow.note = 'not gated';
    }
    checks.push({
      name: 'armStillness',
      limit: ARM_MOTION_MAX,
      pass: true,
      available: false,
      unit: '×sw',
      kind: 'max',
      note: 'not gated',
    });
    const byName = (n: string) => checks.find((c) => c.name === n);
    const fails = (n: string) => {
      const c = byName(n);
      return !!c && c.available && !c.pass;
    };
    const span = shoulderSpan(landmarks.joints);
    const dist = distanceStatus(span);
    const faceSeen = (landmarks.faceCount ?? 0) > 0;
    // Missing shoulders is normal on a head view. Only a measured edge-to-edge span is "too close".
    const shouldersInView = det.personFound || (span != null && dist !== 'too_close');
    // Nose and shoulders only. The native value can still include wrists on an
    // older binary, so it is not what decides the hold.
    let bodyTravel: number | undefined;
    if (!phonePropped) {
      bodyStill = [];
    } else {
      const body = pushBodyStill(bodyStill, landmarks.joints, Date.now());
      bodyStill = body.history;
      bodyTravel = body.travel;
    }
    const stillCheck = byName('stillness');
    if (stillCheck) {
      stillCheck.limit = HANDHELD_STILLNESS_MAX;
      if (bodyTravel == null) {
        stillCheck.pass = true;
        stillCheck.available = false;
        stillCheck.note = 'warming up';
      } else {
        stillCheck.value = bodyTravel;
        stillCheck.available = true;
        stillCheck.pass = bodyTravel <= HANDHELD_STILLNESS_MAX;
        stillCheck.note = undefined;
      }
    }
    const lighting = byName('lighting');
    const personSeen = faceSeen || det.personFound;
    const frameLuma = landmarks.brightness ?? lighting?.value;
    const dim = lowLight.push(frameLuma);
    logLight(landmarks, dim);
    // "Can't see you": no one visible and a near-black frame. Separate from low light.
    let cantSee = false;
    if (lighting) {
      const luma = lighting.value;
      const lumaOk =
        luma == null || !Number.isFinite(luma) ? true : luma >= BRIGHTNESS_MIN;
      // Ordinary room light passes. A visible person is never "Can't see you".
      const ok = personSeen || lumaOk;
      cantSee = !ok;
      // Debug row: ✗ for either dark state; limit is the next low-light threshold.
      lighting.pass = ok && !dim;
      lighting.limit = ok ? lowLightLimit(dim) : BRIGHTNESS_MIN;
      lighting.available = !ok || (luma != null && Number.isFinite(luma));
      lighting.note = undefined;
    }
    // Facing only checks the face, so a phone held off to the side still looks
    // "at the camera". Square is the nose over the shoulders. Slight angle stays.
    const square = shoulderSquareOffset(landmarks.joints);
    if (square != null && square > SHOULDER_SQUARE_MAX) {
      const head = byName('headCentered');
      if (head) {
        head.value = square;
        head.limit = SHOULDER_SQUARE_MAX;
        head.pass = false;
        head.available = true;
        head.note = 'not square';
      } else {
        checks.push({
          name: 'headCentered',
          value: square,
          limit: SHOULDER_SQUARE_MAX,
          pass: false,
          available: true,
          unit: '×sw',
          kind: 'max',
          note: 'not square',
        });
      }
    }
    let raw: PoseStatus;
    // Hands on the phone are expected. They do not block.
    // Phone orientation first, then "Can't see you", then an extreme close crop, then facing, then square,
    // then still. Low light is applied after: below upright / "Can't see you" / nobody in view, above the rest.
    if (!phonePropped) raw = 'not_upright';
    else if (cantSee) raw = 'too_dark';
    else if (dist === 'too_close') raw = 'too_close';
    else if (dist === 'too_far') raw = 'too_far';
    else if ((!faceSeen && !shouldersInView) || fails('facing')) raw = 'absent';
    else if (shouldersInView && (fails('shoulderLevel') || fails('headCentered') || fails('torsoUpright')))
      raw = 'posture';
    else if (shouldersInView && fails('stillness')) raw = 'fidgeting';
    else if (shouldersInView || faceSeen) raw = 'holding';
    else raw = 'absent';
    // A dim room outranks framing, stillness, and the all-good line (see LOW_LIGHT_OUTRANKS).
    raw = applyLowLight(raw, dim, faceSeen || shouldersInView);

    const diagnostics: PoseDiagnostics = {
      ...baseDiagnostics(landmarks, phonePropped),
      modeUsed: det.modeUsed ?? detector,
      fallback: det.fallback,
      pass: raw === 'holding',
      score: phonePropped ? Math.round(det.score) : Math.min(Math.round(det.score), 20),
      rawStatus: raw,
      checks,
      armMotion,
      jointsDetected: det.jointsDetected ?? [],
      processingMs: det.processingMs ?? landmarks.processingMs,
    };
    lastPresent = det.personFound;
    lastFaceLooking = !fails('facing');
    lastBrightEnough = !cantSee && !dim;
    lastConf = det.score / 100;
    const published = hysteresis.push(raw);
    emit(published, det.score / 100, diagnostics);
  };

  const processLandmarks = (landmarks: PoseLandmarks) => {
    // Runtime fallback: steps body3d → body2d → legacy when a body mode isn't working here.
    if (mode === 'live' && usingNative) notePoseFrameForFallback(detector, landmarks);
    // Roughly vertical portrait. Missing sensor fails open inside the monitor (~3.5s).
    const phonePropped = uprightMonitor.isPropped();

    if (detector !== 'legacy' && landmarks.available && landmarks.detector) {
      motion = [];
      processBody(landmarks, landmarks.detector, phonePropped);
      return;
    }
    armTracker.reset();
    // Track light on every real frame so the dim state is current once the phone is upright.
    const dim = landmarks.available ? lowLight.push(landmarks.brightness) : lowLight.isDim();
    if (landmarks.available) logLight(landmarks, dim);

    if (!phonePropped) {
      motion = [];
      bodyStill = [];
      const published = hysteresis.push('not_upright');
      emit(published, lastConf);
      return;
    }

    if (!landmarks.available) {
      motion = [];
      bodyStill = [];
      hysteresis.reset();
      emit('absent', 0);
      return;
    }

    const classified = classifyPresenceAndUpright(landmarks);
    // Require a face (not body-only). Looking = face present and not clearly profile.
    const facePresent =
      landmarks.faceCount >= 1 || !!classified.faceOnly || !!landmarks.joints.nose;
    const yaw = landmarks.faceYaw;
    const pitch = landmarks.facePitch;
    // Missing yaw is NOT a free pass — profile often still has a face rect.
    // Require measured yaw within FACE_YAW_MAX, or native faceLooking when angles absent.
    let faceLooking = false;
    if (facePresent) {
      // Both eyeballs + mouth when Vision reports the flags (native rebuild).
      const eyesOk =
        landmarks.bothEyesVisible === undefined
          ? true
          : landmarks.bothEyesVisible === true;
      const mouthOk =
        landmarks.mouthVisible === undefined
          ? true
          : landmarks.mouthVisible === true;
      if (!eyesOk || !mouthOk) {
        faceLooking = false;
      } else if (yaw != null) {
        const pitchOk = pitch == null || Math.abs(pitch) <= FACE_PITCH_MAX;
        faceLooking = Math.abs(yaw) <= FACE_YAW_MAX && pitchOk;
      } else if (landmarks.faceLooking === true) {
        faceLooking = true;
      } else {
        faceLooking = false;
      }
    }
    const now = Date.now();
    if (facePresent && classified.stillnessPoints.length > 0) {
      motion.push({
        timestamp: now,
        points: classified.stillnessPoints,
      });
      motion = motion.filter((m) => now - m.timestamp <= 2000);
    } else if (facePresent && landmarks.joints.nose) {
      const n = landmarks.joints.nose;
      motion.push({ timestamp: now, points: [{ x: n.x, y: n.y }] });
      motion = motion.filter((m) => now - m.timestamp <= 2000);
    } else {
      motion = [];
      bodyStill = [];
    }

    const travel = facePresent ? stillnessTravel(motion, now) : undefined;
    const still = facePresent ? isStill(motion, now) : false;
    // Holding the phone is allowed, including hands on the device.
    const luma = landmarks.brightness;
    const lumaOk =
      luma == null || !Number.isFinite(luma) ? landmarks.brightEnough !== false : luma >= BRIGHTNESS_MIN;
    // A visible person is enough light. Only an empty, near-black frame warns.
    const brightEnough = lumaOk || facePresent;
    let raw = toPoseStatus(
      facePresent,
      classified.upright,
      still,
      classified.hasShoulders,
      true,
      faceLooking,
      false,
      brightEnough,
    );
    // Distance wins over facing, never over light. An unreadable span does not block.
    const dist = distanceStatus(shoulderSpan(landmarks.joints));
    if (dist && raw !== 'too_dark') raw = dist;
    raw = applyLowLight(raw, dim, facePresent);
    lastPresent = facePresent;
    lastFaceLooking = faceLooking;
    lastBrightEnough = brightEnough && !dim;
    lastConf = classified.confidence;

    const legacyChecks: PoseCheck[] = [
      {
        name: 'lighting',
        value: landmarks.brightness,
        limit: brightEnough ? lowLightLimit(dim) : BRIGHTNESS_MIN,
        pass: brightEnough && !dim,
        available: landmarks.brightness != null,
        unit: 'luma',
        kind: 'min',
      },
      {
        name: 'facing',
        value: yaw != null ? Math.abs(yaw) * (180 / Math.PI) : undefined,
        limit: FACE_YAW_MAX * (180 / Math.PI),
        pass: faceLooking,
        available: true,
        unit: '° yaw',
        kind: 'bool',
        note: facePresent ? undefined : 'no face',
      },
      {
        name: 'handsAway',
        value: landmarks.handCount ?? 0,
        limit: 0,
        pass: true,
        available: true,
        unit: 'hands',
        kind: 'bool',
      },
      {
        name: 'stillness',
        value: travel !== undefined && !Number.isNaN(travel) ? travel : undefined,
        limit: STILLNESS_MAX_MOTION,
        pass: still,
        available: facePresent && travel !== undefined && !Number.isNaN(travel),
        unit: 'travel',
        kind: 'max',
        note: travel === undefined ? 'warming up' : undefined,
      },
    ];
    const diagnostics: PoseDiagnostics = {
      ...baseDiagnostics(landmarks, phonePropped),
      modeUsed: 'legacy',
      fallback:
        detector !== 'legacy' ? 'native frame had no body-pose result (rebuild native?)' : undefined,
      pass: raw === 'holding',
      score: scoreChecks(legacyChecks, facePresent),
      rawStatus: raw,
      checks: legacyChecks,
      jointsDetected: detectedJointNames(landmarks.joints),
    };
    const published = hysteresis.push(raw);
    emit(published, classified.confidence, diagnostics);
  };

  const tickCapture = async (captureFrame: CaptureFn) => {
    if (stopped || busy) return;
    if (simulated != null) {
      emit(simulated, 1);
      return;
    }
    if (!usingNative) {
      emit('absent', 0);
      return;
    }

    busy = true;
    try {
      const uri = await captureFrame();
      if (!uri || stopped) return;
      const raw = await analyzePoseImage(uri);
      processLandmarks(landmarksFromNative(raw));
    } catch (e) {
      console.warn('[quiett pose] capture tick', e);
      emit('absent', 0);
    } finally {
      busy = false;
    }
  };

  const onLiveFrame: PoseFrameListener = (frame) => {
    if (stopped) return;
    if (simulated != null) {
      emit(simulated, 1);
      return;
    }
    if (!usingNative) {
      emit('absent', 0);
      return;
    }
    processLandmarks(landmarksFromNative(frame));
  };

  return {
    usingNative,
    mode,
    detector,
    start() {
      if (!stopped && (timer || unsubLive)) return;
      stopped = false;
      hysteresis.reset();
      motion = [];
      bodyStill = [];
      armTracker.reset();
      lowLight.reset();
      lastDiagnostics = undefined;
      uprightMonitor.start();
      unsubUpright = uprightMonitor.subscribe(() => {
        if (stopped || simulated != null) return;
        if (!uprightMonitor.isPropped()) {
          const published = hysteresis.push('not_upright');
          emit(published, lastConf);
        }
      });
      if (mode === 'live') {
        const liveOpts = options as LivePoseDetectorOptions;
        const subscribe =
          liveOpts.subscribeToNativeEvents ?? subscribeToLivePoseFrames;
        unsubLive = subscribe(onLiveFrame);
        return;
      }

      const captureOpts = options as CapturePoseDetectorOptions;
      void tickCapture(captureOpts.captureFrame);
      timer = setInterval(() => {
        void tickCapture(captureOpts.captureFrame);
      }, CAPTURE_INTERVAL_MS);
    },
    stop() {
      stopped = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (unsubLive) {
        unsubLive();
        unsubLive = null;
      }
      if (unsubUpright) {
        unsubUpright();
        unsubUpright = null;
      }
      uprightMonitor.stop();
      motion = [];
      bodyStill = [];
      armTracker.reset();
      lowLight.reset();
      hysteresis.reset();
    },
    simulate(status: PoseStatus) {
      simulated = status;
      emit(status, 1);
    },
    clearSimulate() {
      simulated = null;
      motion = [];
      bodyStill = [];
      armTracker.reset();
      lowLight.reset();
      hysteresis.reset();
    },
    subscribe(listener: PoseDetectorListener) {
      listeners.add(listener);
      listener({
        status: lastStatus,
        confidence: simulated != null ? 1 : lastConfidence,
        timestamp: Date.now(),
        diagnostics: lastDiagnostics,
      });
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function captureFromCameraRef(
  ref: RefObject<ElementRef<typeof CameraView> | null>,
): CaptureFn {
  return async () => {
    const cam = ref.current;
    if (!cam) return null;
    try {
      const photo = await cam.takePictureAsync({
        quality: CAPTURE_QUALITY,
        shutterSound: false,
        skipProcessing: true,
      });
      return photo?.uri ?? null;
    } catch (e) {
      console.warn('[quiett pose] capture', e);
      return null;
    }
  };
}
