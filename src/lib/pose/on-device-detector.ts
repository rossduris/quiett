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
  toPoseStatus,
  type MotionSample,
} from './classify';
import {
  CAPTURE_INTERVAL_MS,
  CAPTURE_QUALITY,
  ENTER_HOLDING_FRAMES,
  FACE_PITCH_MAX,
  FACE_YAW_MAX,
  LEAVE_HOLDING_FRAMES,
} from './thresholds';
import { createProppedMonitor } from './device-propped';
import type {
  PoseDetector,
  PoseDetectorListener,
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
};

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
    brightness: r.brightness,
    // Missing flag (old native binary) → fail open until rebuild.
    brightEnough: r.brightEnough === undefined ? true : r.brightEnough === true,
  };
}

/**
 * On-device sit / in-frame detector (iOS Apple Vision via QuiettPose).
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
  const hysteresis = createHoldingHysteresis(
    ENTER_HOLDING_FRAMES,
    LEAVE_HOLDING_FRAMES,
  );

  const mode: 'live' | 'capture' =
    options.mode === 'live' ? 'live' : 'capture';
  const usingNative = !options.forceMock && isNativePoseAvailable();

  const emit = (status: PoseStatus, confidence: number) => {
    lastStatus = status;
    lastConfidence = confidence;
    const sample: PoseSample = { status, confidence, timestamp: Date.now() };
    listeners.forEach((l) => l(sample));
  };

  const processLandmarks = (landmarks: PoseLandmarks) => {
    const phonePropped = proppedMonitor.isPropped();

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

    const still = facePresent ? isStill(motion, now) : false;
    // Holding only if faceLooking AND zero hands AND still (toPoseStatus enforces).
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
    const published = hysteresis.push(raw);
    emit(published, classified.confidence);
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
    start() {
      if (!stopped && (timer || unsubLive)) return;
      stopped = false;
      hysteresis.reset();
      motion = [];
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
      hysteresis.reset();
    },
    simulate(status: PoseStatus) {
      simulated = status;
      emit(status, 1);
    },
    clearSimulate() {
      simulated = null;
      motion = [];
      hysteresis.reset();
    },
    subscribe(listener: PoseDetectorListener) {
      listeners.add(listener);
      listener({
        status: lastStatus,
        confidence: simulated != null ? 1 : lastConfidence,
        timestamp: Date.now(),
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
