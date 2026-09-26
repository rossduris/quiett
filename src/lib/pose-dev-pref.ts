import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PoseDetectorMode } from '@/lib/pose/types';

/**
 * Dev-only pose detector prefs (Settings → dev section):
 *  - detector: 'legacy' (original face/hands/stillness gates), 'body2d' (Vision 2D body pose
 *    posture checks), 'body3d' (Vision 3D body pose, iOS 17+, falls back to 2D).
 *    Default 'body2d' in dev; release builds always use 'legacy'.
 *  - debugOverlay: draw joints/skeleton + per-check readout over the camera circle.
 */
export const POSE_DETECTOR_MODES: readonly PoseDetectorMode[] = ['legacy', 'body2d', 'body3d'];

export const POSE_DETECTOR_LABELS: Record<PoseDetectorMode, string> = {
  legacy: 'Legacy',
  body2d: '2D body',
  body3d: '3D body',
};

const MODE_KEY = 'quiett.devPoseDetector';
const OVERLAY_KEY = 'quiett.devPoseDebugOverlay';

export const DEV_DEFAULT_POSE_DETECTOR: PoseDetectorMode = 'body2d';
export const RELEASE_POSE_DETECTOR: PoseDetectorMode = 'legacy';

type State = { detector: PoseDetectorMode; debugOverlay: boolean };

let state: State = { detector: DEV_DEFAULT_POSE_DETECTOR, debugOverlay: false };
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function isMode(v: unknown): v is PoseDetectorMode {
  return v === 'legacy' || v === 'body2d' || v === 'body3d';
}

function ensureLoaded() {
  if (loaded || !__DEV__) return;
  loaded = true;
  void AsyncStorage.multiGet([MODE_KEY, OVERLAY_KEY]).then(([[, rawMode], [, rawOverlay]]) => {
    const next: State = {
      detector: isMode(rawMode) ? rawMode : state.detector,
      debugOverlay: rawOverlay === '1' ? true : rawOverlay === '0' ? false : state.debugOverlay,
    };
    if (next.detector !== state.detector || next.debugOverlay !== state.debugOverlay) {
      state = next;
      emit();
    }
  });
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getDetector = (): PoseDetectorMode => (__DEV__ ? state.detector : RELEASE_POSE_DETECTOR);
const getOverlay = (): boolean => (__DEV__ ? state.debugOverlay : false);

export function usePoseDetectorMode(): PoseDetectorMode {
  return useSyncExternalStore(subscribe, getDetector, getDetector);
}

export function usePoseDebugOverlay(): boolean {
  return useSyncExternalStore(subscribe, getOverlay, getOverlay);
}

export async function setPoseDetectorMode(mode: PoseDetectorMode): Promise<void> {
  if (!__DEV__) return;
  loaded = true;
  state = { ...state, detector: mode };
  emit();
  await AsyncStorage.setItem(MODE_KEY, mode);
}

export async function setPoseDebugOverlay(on: boolean): Promise<void> {
  if (!__DEV__) return;
  loaded = true;
  state = { ...state, debugOverlay: on };
  emit();
  await AsyncStorage.setItem(OVERLAY_KEY, on ? '1' : '0');
}
