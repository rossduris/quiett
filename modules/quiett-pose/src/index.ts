import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import type { NativePoseResult } from './types';
import { isQuiettPoseCameraViewAvailable } from './QuiettPoseCameraView';

export type { NativePoseJoint, NativePoseResult, PoseFrameEvent, PoseFrameListener } from './types';
export {
  subscribeToLivePoseFrames,
  notifyLivePoseFrame,
  livePoseListenerCount,
} from './liveBridge';
export {
  QuiettPoseCameraView,
  isQuiettPoseCameraViewAvailable,
} from './QuiettPoseCameraView';

type QuiettPoseNativeModule = {
  isAvailable(): boolean;
  isLiveCameraAvailable?(): boolean;
  analyzeImage(uri: string): Promise<NativePoseResult>;
  analyzeBase64?(base64: string): Promise<NativePoseResult>;
};

let native: QuiettPoseNativeModule | null = null;

try {
  native = requireNativeModule<QuiettPoseNativeModule>('QuiettPose');
} catch {
  native = null;
}

export function isNativePoseAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return !!native?.isAvailable?.();
  } catch {
    return false;
  }
}

/**
 * True when live AVCapture + Vision view is expected to work.
 * Returns false for thin modules without the camera view / live API → capture fallback.
 */
export function isLivePoseCameraAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  if (!isQuiettPoseCameraViewAvailable()) return false;
  try {
    if (typeof native?.isLiveCameraAvailable === 'function') {
      return !!native.isLiveCameraAvailable();
    }
    // New module should always expose isLiveCameraAvailable; without it, don't claim live.
    return false;
  } catch {
    return false;
  }
}

export async function analyzePoseImage(uri: string): Promise<NativePoseResult> {
  if (!native?.analyzeImage) {
    return { available: false, faceCount: 0, joints: {}, timestamp: Date.now() };
  }
  return native.analyzeImage(uri);
}

export async function analyzePoseBase64(base64: string): Promise<NativePoseResult> {
  if (!native?.analyzeBase64) {
    return { available: false, faceCount: 0, joints: {}, timestamp: Date.now() };
  }
  return native.analyzeBase64(base64);
}

/** Aliases matching native names for TypeScript-friendly imports. */
export const analyzeImage = analyzePoseImage;
export const analyzeBase64 = analyzePoseBase64;
