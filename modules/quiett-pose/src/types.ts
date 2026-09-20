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
  /** False when too dark for sit. */
  brightEnough?: boolean;
  timestamp?: number;
};

export type PoseFrameEvent = NativePoseResult;

export type PoseFrameListener = (frame: PoseFrameEvent) => void;
