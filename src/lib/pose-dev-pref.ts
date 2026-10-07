import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isBody3DPoseAvailable } from 'quiett-pose';
import type { PoseDetectorMode, PoseLandmarks } from '@/lib/pose/types';

/**
 * Pose detector selection.
 *  - detector: 'legacy' (original face/hands/stillness gates), 'body2d' (Vision 2D body pose
 *    posture checks), 'body3d' (Vision 3D body pose, iOS 17+, falls back to 2D per frame in native).
 *    Default everywhere is 'body2d'. Hand and arm motion are not a gate. 3D is dev-only.
 *  - Dev builds keep the Settings switch (stored override). Release builds never read the stored
 *    dev override, so an old saved 'legacy' can't pin a release install to legacy.
 *  - Runtime fallback (this launch only): body2d → legacy (body3d → body2d for a dev pick) when a mode isn't supported
 *    or keeps failing (see `notePoseFrameForFallback`). An explicit dev pick is never demoted.
 *  - debugOverlay: draw joints/skeleton + per-check readout over the camera circle (dev only).
 */
export const POSE_DETECTOR_MODES: readonly PoseDetectorMode[] = ['legacy', 'body2d', 'body3d'];

export const POSE_DETECTOR_LABELS: Record<PoseDetectorMode, string> = {
  legacy: 'Legacy',
  body2d: '2D body',
  body3d: '3D body',
};

const MODE_KEY = 'quiett.devPoseDetector';
const OVERLAY_KEY = 'quiett.devPoseDebugOverlay';

/** 2D tested better than 3D on device; release never runs 3D (dev switch can still pick it). */
export const DEFAULT_POSE_DETECTOR: PoseDetectorMode = 'body2d';
/** @deprecated same as DEFAULT_POSE_DETECTOR (dev and release share the default now). */
export const DEV_DEFAULT_POSE_DETECTOR: PoseDetectorMode = DEFAULT_POSE_DETECTOR;
/** @deprecated same as DEFAULT_POSE_DETECTOR (dev and release share the default now). */
export const RELEASE_POSE_DETECTOR: PoseDetectorMode = DEFAULT_POSE_DETECTOR;

type State = {
  /** Explicit dev pick (dev builds only); null = use the default chain. */
  devPick: PoseDetectorMode | null;
  /** Best mode still allowed this launch (lowered by runtime fallback). */
  ceiling: PoseDetectorMode;
  debugOverlay: boolean;
  detector: PoseDetectorMode;
};

const RANK: Record<PoseDetectorMode, number> = { legacy: 0, body2d: 1, body3d: 2 };
const lower = (m: PoseDetectorMode): PoseDetectorMode =>
  m === 'body3d' ? 'body2d' : 'legacy';

function initialCeiling(): PoseDetectorMode {
  // 3D needs iOS 17 + a native build that exposes it; otherwise start on 2D.
  return isBody3DPoseAvailable() ? 'body3d' : 'body2d';
}

function resolve(s: Omit<State, 'detector'>): PoseDetectorMode {
  if (__DEV__ && s.devPick) return s.devPick;
  return RANK[s.ceiling] < RANK[DEFAULT_POSE_DETECTOR] ? s.ceiling : DEFAULT_POSE_DETECTOR;
}

function make(s: Omit<State, 'detector'>): State {
  return { ...s, detector: resolve(s) };
}

let state: State = make({ devPick: null, ceiling: initialCeiling(), debugOverlay: false });
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setState(next: Omit<State, 'detector'>) {
  const s = make(next);
  const changed =
    s.detector !== state.detector ||
    s.debugOverlay !== state.debugOverlay ||
    s.devPick !== state.devPick ||
    s.ceiling !== state.ceiling;
  state = s;
  if (changed) emit();
}

function isMode(v: unknown): v is PoseDetectorMode {
  return v === 'legacy' || v === 'body2d' || v === 'body3d';
}

function ensureLoaded() {
  // Release never reads the stored dev override.
  if (loaded || !__DEV__) return;
  loaded = true;
  void AsyncStorage.multiGet([MODE_KEY, OVERLAY_KEY]).then(([[, rawMode], [, rawOverlay]]) => {
    setState({
      devPick: isMode(rawMode) ? rawMode : state.devPick,
      ceiling: state.ceiling,
      debugOverlay: rawOverlay === '1' ? true : rawOverlay === '0' ? false : state.debugOverlay,
    });
  });
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getDetector = (): PoseDetectorMode => state.detector;
const getOverlay = (): boolean => (__DEV__ ? state.debugOverlay : false);

/** Mode the live camera + detector should run right now. */
export function usePoseDetectorMode(): PoseDetectorMode {
  return useSyncExternalStore(subscribe, getDetector, getDetector);
}

export function usePoseDebugOverlay(): boolean {
  return useSyncExternalStore(subscribe, getOverlay, getOverlay);
}

export async function setPoseDetectorMode(mode: PoseDetectorMode): Promise<void> {
  if (!__DEV__) return;
  loaded = true;
  setState({ devPick: mode, ceiling: state.ceiling, debugOverlay: state.debugOverlay });
  await AsyncStorage.setItem(MODE_KEY, mode);
}

export async function setPoseDebugOverlay(on: boolean): Promise<void> {
  if (!__DEV__) return;
  loaded = true;
  setState({ devPick: state.devPick, ceiling: state.ceiling, debugOverlay: on });
  await AsyncStorage.setItem(OVERLAY_KEY, on ? '1' : '0');
}

// ── Runtime fallback ────────────────────────────────────────────────────────

/** Consecutive frames before stepping down a mode. */
const MISSING_BLOCK_FRAMES = 10; // body mode asked for, native sent no checks (old native build)
const UNAVAILABLE_FRAMES = 40; // Vision body request keeps erroring
const ERROR_3D_FRAMES = 15; // 3D request keeps throwing
const NO_3D_WITH_PERSON_FRAMES = 40; // 2D sees a person but 3D never does (~8 s at 5 fps)

let streak = { mode: null as PoseDetectorMode | null, missing: 0, unavailable: 0, err3d: 0, no3d: 0 };

function demote(from: PoseDetectorMode, why: string) {
  if (from === 'legacy' || state.detector !== from) return;
  // An explicit dev pick stays put (dev can watch the fallback in the overlay).
  if (__DEV__ && state.devPick) return;
  const next = lower(from);
  console.warn(`[quiett] pose detector ${from} → ${next}: ${why}`);
  streak = { mode: null, missing: 0, unavailable: 0, err3d: 0, no3d: 0 };
  setState({
    devPick: state.devPick,
    ceiling: RANK[next] < RANK[state.ceiling] ? next : state.ceiling,
    debugOverlay: state.debugOverlay,
  });
}

/**
 * Feed each live frame (from the on-device detector). Steps the detector down when the
 * requested body mode isn't actually working on this device/build.
 */
export function notePoseFrameForFallback(mode: PoseDetectorMode, frame: PoseLandmarks): void {
  if (mode === 'legacy') return;
  if (streak.mode !== mode) streak = { mode, missing: 0, unavailable: 0, err3d: 0, no3d: 0 };

  if (!frame.available) {
    streak.missing = 0;
    if (++streak.unavailable >= UNAVAILABLE_FRAMES) demote(mode, 'Vision body pose unavailable');
    return;
  }
  streak.unavailable = 0;

  const det = frame.detector;
  if (!det) {
    if (++streak.missing >= MISSING_BLOCK_FRAMES) demote(mode, 'native build has no body checks');
    return;
  }
  streak.missing = 0;

  if (mode !== 'body3d') return;
  const fb = det.fallback ?? '';
  if (det.modeUsed === 'body3d') {
    streak.err3d = 0;
    streak.no3d = 0;
    return;
  }
  if (fb.startsWith('3D needs')) return demote(mode, fb);
  if (fb.startsWith('3D error')) {
    if (++streak.err3d >= ERROR_3D_FRAMES) demote(mode, fb);
  } else {
    streak.err3d = 0;
  }
  if (det.personFound) {
    if (++streak.no3d >= NO_3D_WITH_PERSON_FRAMES) demote(mode, '3D never finds the body');
  } else {
    streak.no3d = 0;
  }
}
