import type { PoseFrameEvent, PoseFrameListener } from './types';

/**
 * In-process fan-out for live pose frames.
 * QuiettPoseCameraView notifies here; createOnDevicePoseDetector(mode:'live') can subscribe
 * via subscribeToLivePoseFrames or a custom subscribeToNativeEvents.
 */
const listeners = new Set<PoseFrameListener>();

export function subscribeToLivePoseFrames(listener: PoseFrameListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyLivePoseFrame(frame: PoseFrameEvent): void {
  listeners.forEach((l) => {
    try {
      l(frame);
    } catch (e) {
      console.warn('[quiett-pose] live listener', e);
    }
  });
}

export function livePoseListenerCount(): number {
  return listeners.size;
}
