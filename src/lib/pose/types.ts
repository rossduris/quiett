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
  | 'holding';

export type PoseSample = {
  status: PoseStatus;
  confidence: number;
  timestamp: number;
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
};
