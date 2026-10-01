import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Live "Reduce Motion" setting, shared app-wide: one native query and one listener for the whole
 * app instead of one per component (a Library screen full of covers used to fire dozens of
 * AccessibilityInfo calls on first mount).
 */
let reduceMotion = false;
let started = false;
const listeners = new Set<() => void>();

function start() {
  if (started) return;
  started = true;
  const set = (on: boolean) => {
    if (on === reduceMotion) return;
    reduceMotion = on;
    listeners.forEach((l) => l());
  };
  void AccessibilityInfo.isReduceMotionEnabled().then(set).catch(() => {});
  AccessibilityInfo.addEventListener('reduceMotionChanged', set);
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => reduceMotion;

/** Current Reduce Motion value outside React (e.g. schedulers). */
export function isReduceMotionOn(): boolean {
  start();
  return reduceMotion;
}

/** Live "Reduce Motion" setting (AccessibilityInfo). Animations fall back to simple fades. */
export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
