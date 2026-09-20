declare module 'quiett-pose' {
  import type { ComponentType } from 'react';
  import type { StyleProp, ViewStyle } from 'react-native';

  export type NativePoseJoint = {
    x: number;
    y: number;
    confidence: number;
  };

  export type NativePoseResult = {
    available: boolean;
    faceCount: number;
    joints: Record<string, NativePoseJoint>;
    /** True when a face is detected and roughly facing the camera (yaw/pitch). */
    faceLooking?: boolean;
    bothEyesVisible?: boolean;
    mouthVisible?: boolean;
    handNearFace?: boolean;
    /** True when any hand/wrist/elbow is in frame (zero-hands gate). */
  handsVisible?: boolean;
    handCount?: number;
    faceYaw?: number;
    faceRoll?: number;
    facePitch?: number;
    timestamp?: number;
  };

  export type PoseFrameEvent = NativePoseResult;
  export type PoseFrameListener = (frame: PoseFrameEvent) => void;

  export function isNativePoseAvailable(): boolean;
  export function isLivePoseCameraAvailable(): boolean;
  export function analyzePoseImage(uri: string): Promise<NativePoseResult>;
  export function analyzePoseBase64(base64: string): Promise<NativePoseResult>;
  export const analyzeImage: typeof analyzePoseImage;
  export const analyzeBase64: typeof analyzePoseBase64;

  export function subscribeToLivePoseFrames(listener: PoseFrameListener): () => void;
  export function notifyLivePoseFrame(frame: PoseFrameEvent): void;
  export function livePoseListenerCount(): number;

  export function isQuiettPoseCameraViewAvailable(): boolean;

  export const QuiettPoseCameraView: ComponentType<{
    style?: StyleProp<ViewStyle>;
    isActive?: boolean;
    mirror?: boolean;
    onPoseFrame?: (frame: NativePoseResult) => void;
    onCameraReady?: () => void;
    onMountError?: (message: string) => void;
  }>;
}
