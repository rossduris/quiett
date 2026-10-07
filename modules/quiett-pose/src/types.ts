/** Live detector: original gates, 2D body pose posture, or 3D body pose posture (iOS 17+, falls back to 2D). */
export type PoseDetectorMode = 'legacy' | 'body2d' | 'body3d';

/** One posture check from native (`value` compared against `limit` per `kind`). */
export type NativePoseCheck = {
  name: string;
  value?: number;
  limit: number;
  pass: boolean;
  /** False when the check couldn't be measured this frame (e.g. hips out of frame) — doesn't block. */
  available: boolean;
  unit: string;
  /** 'max' = value ≤ limit, 'min' = value ≥ limit, 'bool' = pass flag only. */
  kind?: 'max' | 'min' | 'bool';
  note?: string;
};

/** Common result block for body modes (native). */
export type NativePoseDetectorResult = {
  mode: PoseDetectorMode;
  modeUsed: PoseDetectorMode;
  /** Why body3d ran as body2d this frame. */
  fallback?: string;
  pass: boolean;
  /** 0–100 */
  score: number;
  personFound: boolean;
  checks: Record<string, NativePoseCheck>;
  checkOrder?: string[];
  jointsDetected: string[];
  jointCount: number;
  processingMs?: number;
  extra?: Record<string, unknown>;
};

export type NativePoseJoint = {
  x: number;
  y: number;
  confidence: number;
};

export type NativePoseResult = {
  available: boolean;
  faceCount: number;
  joints: Record<string, NativePoseJoint>;
  /** True when a face is facing the camera (yaw/pitch) and both eyes are visible. */
  faceLooking?: boolean;
  /** Both left + right eye landmarks present (blocks profile). */
  bothEyesVisible?: boolean;
  /** Outer lips landmarks visible (blocks hand-over-mouth). */
  mouthVisible?: boolean;
  /** Hand joints overlap expanded face box. */
  handNearFace?: boolean;
  /** True when any hand/wrist/elbow is in frame (zero-hands gate). */
  handsVisible?: boolean;
  handCount?: number;
  faceYaw?: number;
  faceRoll?: number;
  facePitch?: number;
  /** 0–1 mean luma (face region preferred). */
  brightness?: number;
  /** Front camera auto-exposure ISO (new native builds only). */
  iso?: number;
  maxIso?: number;
  /** Front camera auto-exposure shutter time (ms). */
  exposureDurationMs?: number;
  /** False when too dark for sit. */
  brightEnough?: boolean;
  timestamp?: number;
  /** Mode that actually ran this frame. */
  detectorMode?: PoseDetectorMode;
  /** Body-mode checks (absent in legacy mode / old native builds). */
  detector?: NativePoseDetectorResult;
  /** Native Vision time for this frame (ms). */
  processingMs?: number;
  /** Oriented image size the normalized joints refer to (origin bottom-left). */
  imageWidth?: number;
  imageHeight?: number;
  orientation?: 'up' | 'leftMirrored';
  bufferWidth?: number;
  bufferHeight?: number;
  targetFps?: number;
};

export type PoseFrameEvent = NativePoseResult;

export type PoseFrameListener = (frame: PoseFrameEvent) => void;
