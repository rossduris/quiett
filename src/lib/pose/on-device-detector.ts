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
} from './thresholds';
import { createProppedMonitor } from './device-propped';
import { createArmMotionTracker } from './arm-motion';
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

function detectedJointNames(joints: PoseLandmarks['joints']): string[] {
  return Object.keys(joints)
    .filter((k) => (joints[k]?.confidence ?? 0) >= MIN_JOINT_CONFIDENCE)
    .sort();
}

function landmarksFromNative(raw: NativePoseResult): PoseLandmarks {
  const r = raw as NativePoseResult & {
    brightness?: number;
    brightEnough?: boolean;
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
    // Missing flag (old native binary) → fail open until rebuild.
    brightEnough: r.brightEnough === undefined ? true : r.brightEnough === true,
  };
}

/**
 * On-device meditation-pose / in-frame detector (iOS Apple Vision via QuiettPose).
 *
 * Gate: propped + face looking at camera + still → holding. Live Vision preferred; capture fallback.
 */
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
  let unsubLive: (() => void) | null = null;
  let unsubPropped: (() => void) | null = null;
  let lastPresent = false;
  let lastFaceLooking = false;
  let lastBrightEnough = true;
  let lastConf = 0;
  const proppedMonitor = createProppedMonitor();
  const armTracker = createArmMotionTracker();
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
    // Arm stillness (JS): wrists / elbows vs shoulders over a short window.
    if (!phonePropped || !det.personFound) armTracker.reset();
    const arm = phonePropped && det.personFound ? armTracker.push(landmarks) : undefined;
    const armMotion = arm
      ? {
          source: arm.source,
          value: arm.value,
          perJoint: arm.perJoint,
          samples: arm.samples,
          failing: arm.failing,
          limit: arm.limit,
        }
      : undefined;
    checks.push({
      name: 'armStillness',
      value: arm?.value,
      limit: ARM_MOTION_MAX,
      pass: !arm?.failing,
      available: !!arm?.available,
      unit: '×sw',
      kind: 'max',
      note: arm?.available ? undefined : arm && arm.source !== 'none' ? 'warming up' : 'no arms',
    });
    const byName = (n: string) => checks.find((c) => c.name === n);
    const fails = (n: string) => {
      const c = byName(n);
      return !!c && c.available && !c.pass;
    };
    let raw: PoseStatus;
    if (!phonePropped) raw = 'not_upright';
    else if (fails('lighting')) raw = 'too_dark';
    else if (!det.personFound || fails('facing')) raw = 'absent';
    else if (fails('handsLow')) raw = 'hands_near';
    else if (fails('shoulderLevel') || fails('headCentered') || fails('torsoUpright'))
      raw = 'posture';
    else if (fails('armStillness')) raw = 'arms_moving';
    else if (fails('stillness')) raw = 'fidgeting';
    else raw = 'holding';

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
    lastBrightEnough = !fails('lighting');
    lastConf = det.score / 100;
    const published = hysteresis.push(raw);
    emit(published, det.score / 100, diagnostics);
  };

  const processLandmarks = (landmarks: PoseLandmarks) => {
    const phonePropped = proppedMonitor.isPropped();

    if (detector !== 'legacy' && landmarks.available && landmarks.detector) {
      motion = [];
      processBody(landmarks, landmarks.detector, phonePropped);
      return;
    }
    armTracker.reset();

    if (!phonePropped) {
      motion = [];
      // Keep hysteresis from sticking on holding while phone goes flat.
      const published = hysteresis.push('not_upright');
      emit(published, 0);
      return;
    }

    if (!landmarks.available) {
      motion = [];
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
    }

    // ZERO HANDS is independent of eyes/face — both must pass at once.
    const handsFromFlag =
      landmarks.handsVisible === true || landmarks.handNearFace === true;
    const j = landmarks.joints;
    const wristOrElbow = (key: string) => {
      const pt = j[key];
      return !!pt && pt.confidence >= 0.12;
    };
    const handsFromBody =
      wristOrElbow('leftWrist') || wristOrElbow('rightWrist');
    const handsVisible = handsFromFlag || handsFromBody || (landmarks.handCount ?? 0) > 0;

    const travel = facePresent ? stillnessTravel(motion, now) : undefined;
    const still = facePresent ? isStill(motion, now) : false;
    // Holding only if brightEnough AND faceLooking AND zero hands AND still (toPoseStatus enforces).
    const brightEnough =
      landmarks.brightEnough === undefined ? true : landmarks.brightEnough === true;
    const raw = toPoseStatus(
      facePresent,
      classified.upright,
      still,
      classified.hasShoulders,
      true,
      faceLooking,
      handsVisible,
      brightEnough,
    );
    lastPresent = facePresent;
    lastFaceLooking = faceLooking;
    lastBrightEnough = brightEnough;
    lastConf = classified.confidence;

    const legacyChecks: PoseCheck[] = [
      {
        name: 'lighting',
        value: landmarks.brightness,
        limit: BRIGHTNESS_MIN,
        pass: brightEnough,
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
        value: landmarks.handCount ?? (handsVisible ? 1 : 0),
        limit: 0,
        pass: !handsVisible,
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

  const onProppedChange = () => {
    if (stopped || simulated != null) return;
    if (!proppedMonitor.isPropped()) {
      const published = hysteresis.push('not_upright');
      emit(published, lastConf);
      return;
    }
    // Phone became propped again — publish from last known presence until next Vision frame.
    const raw = toPoseStatus(
      lastPresent,
      undefined,
      true,
      undefined,
      true,
      lastFaceLooking,
      false,
      lastBrightEnough,
    );
    const published = hysteresis.push(raw);
    emit(published, lastConf);
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
      armTracker.reset();
      lastDiagnostics = undefined;
      proppedMonitor.start();
      unsubPropped = proppedMonitor.subscribe(() => onProppedChange());

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
      if (unsubPropped) {
        unsubPropped();
        unsubPropped = null;
      }
      proppedMonitor.stop();
      motion = [];
      armTracker.reset();
      hysteresis.reset();
    },
    simulate(status: PoseStatus) {
      simulated = status;
      emit(status, 1);
    },
    clearSimulate() {
      simulated = null;
      motion = [];
      armTracker.reset();
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
