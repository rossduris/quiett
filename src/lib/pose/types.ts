/**
 * Quiett session gates:
 * - absent:       no face in frame (looking away / missing)
 * - not_upright:  phone not roughly vertical (flat or sideways)
 * - too_dark:     no one visible, and the frame is near black ("Can't see you")
 * - low_light:    someone visible, but the room is too dim (luma hysteresis + debounce)
 * - too_close:    shoulders fill the frame, or a face is in frame with the body cropped out
 * - too_far:      shoulders are a small sliver of the frame
 * - fidgeting:    face present but moving too much
 * - hands_near:   unused. Hand position is not a gate.
 * - arms_moving:  unused. Wrist, elbow, and arm motion are not a gate.
 * - holding:      bright enough + facing + shoulders in view + upright enough + still
 */

export type PoseStatus =
  | 'absent'
  | 'not_upright'
  | 'too_dark'
  /** Person visible but the room is too dim. Outranks framing/stillness, not absent/upright. */
  | 'low_light'
  | 'too_close'
  | 'too_far'
  | 'fidgeting'
  | 'hands_near'
  /** Unused. Arm motion does not change the session. */
  | 'arms_moving'
  /** Body modes: shoulders / head / torso alignment off. */
  | 'posture'
  | 'holding';

export type PoseDetectorMode = 'legacy' | 'body2d' | 'body3d';

/** One check in the common detector result (all modes). */
export type PoseCheck = {
  name: string;
  value?: number;
  limit: number;
  pass: boolean;
  /** False when not measurable this frame — does not block. */
  available: boolean;
  unit: string;
  kind?: 'max' | 'min' | 'bool';
  note?: string;
};

/** Arm-stillness tracker readout (body modes; dev debug panel). */
export type ArmMotionDiagnostics = {
  /** 3d = metric joints from native body3d; 2d = Vision image joints. */
  source: '3d' | '2d' | 'none';
  /** Worst joint travel (×shoulder width, jitter floor removed). */
  value?: number;
  /** Per joint travel: LW / RW / LE / RE. */
  perJoint: Record<string, number>;
  samples: number;
  failing: boolean;
  limit: number;
};

/** Common per-frame detector result — same shape for legacy / body2d / body3d. */
export type PoseDiagnostics = {
  /** Requested mode. */
  mode: PoseDetectorMode;
  /** Mode that actually ran (body3d → body2d fallback). */
  modeUsed: PoseDetectorMode;
  fallback?: string;
  /** Raw (pre-hysteresis) pass for this frame. */
  pass: boolean;
  /** 0–100 */
  score: number;
  /** Raw status for this frame (before hysteresis). */
  rawStatus: PoseStatus;
  phonePropped: boolean;
  checks: PoseCheck[];
  /** Body modes: arm-stillness values. */
  armMotion?: ArmMotionDiagnostics;
  jointsDetected: string[];
  /** Normalized joints (Vision coords, origin bottom-left) for the debug overlay. */
  joints: Record<string, PoseJoint>;
  processingMs?: number;
  imageWidth?: number;
  imageHeight?: number;
  orientation?: string;
  targetFps?: number;
  timestamp: number;
};

export type PoseSample = {
  status: PoseStatus;
  confidence: number;
  timestamp: number;
  /** Present on live native frames (debug overlay / dev readout). */
  diagnostics?: PoseDiagnostics;
};

export type PoseDetectorListener = (sample: PoseSample) => void;

export interface PoseDetector {
  start(): void;
  stop(): void;
  simulate?(status: PoseStatus): void;
  subscribe(listener: PoseDetectorListener): () => void;
}

export type PoseJoint = {
  x: number;
  y: number;
  confidence: number;
};

export type PoseLandmarks = {
  available: boolean;
  faceCount: number;
  joints: Record<string, PoseJoint>;
  /** Apple Vision: face roughly facing camera. */
  faceLooking?: boolean;
  /** Both left + right eye landmarks visible. */
  bothEyesVisible?: boolean;
  mouthVisible?: boolean;
  handNearFace?: boolean;
  /** True when a hand or wrist is in frame. Not a session gate. */
  handsVisible?: boolean;
  /** 0–1 mean luma of face (or center crop). */
  brightness?: number;
  /** Camera auto-exposure (dev calibration; missing on old native builds). */
  iso?: number;
  maxIso?: number;
  exposureDurationMs?: number;
  /** False only when the frame is near black. A visible person is bright enough. */
  brightEnough?: boolean;
  handCount?: number;
  faceYaw?: number;
  facePitch?: number;
  detectorMode?: PoseDetectorMode;
  /** Native body-mode result (body2d / body3d). */
  detector?: {
    mode: PoseDetectorMode;
    modeUsed: PoseDetectorMode;
    fallback?: string;
    pass: boolean;
    score: number;
    personFound: boolean;
    checks: Record<string, PoseCheck>;
    checkOrder?: string[];
    jointsDetected: string[];
    jointCount: number;
    processingMs?: number;
    /** Mode-specific native values (e.g. `arm3D`: root-relative arm joints in metres). */
    extra?: Record<string, unknown>;
  };
  processingMs?: number;
  imageWidth?: number;
  imageHeight?: number;
  orientation?: string;
  targetFps?: number;
};
