import type { PoseDetector, PoseDetectorListener, PoseSample, PoseStatus } from './types';

export function createMockPoseDetector(): PoseDetector {
  let current: PoseStatus = 'absent';
  const listeners = new Set<PoseDetectorListener>();
  let timer: ReturnType<typeof setInterval> | null = null;
  const emit = () => {
    const sample: PoseSample = { status: current, confidence: 1, timestamp: Date.now() };
    listeners.forEach((l) => l(sample));
  };
  return {
    start() {
      if (timer) return;
      emit();
      timer = setInterval(emit, 250);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    simulate(status: PoseStatus) {
      current = status;
      emit();
    },
    subscribe(listener: PoseDetectorListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
