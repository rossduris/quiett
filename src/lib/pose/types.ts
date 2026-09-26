/**
 * Quiett session gates:
 * - absent:       no face in frame (looking away / missing)
 * - not_upright:  phone not propped
 * - too_dark:     insufficient lighting (softer than original gate)
 * - fidgeting:    face present but moving too much
 * - hands_near:   hand overlapping / near the face
 * - holding:      propped + bright enough + face looking + both eyes + mouth + no hands near + still
 */

export type PoseStatus =
  | 'absent'
  | 'not_upright'
  | 'too_dark'
  | 'fidgeting'
  | 'hands_near'
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
  /** True when any hand/wrist/elbow is in frame (zero-hands gate). */
  handsVisible?: boolean;
  /** 0–1 mean luma of face (or center crop). */
  brightness?: number;
  /** False when frame/face is too dark for a real sit. */
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
  };
  processingMs?: number;
  imageWidth?: number;
  imageHeight?: number;
  orientation?: string;
  targetFps?: number;
};
