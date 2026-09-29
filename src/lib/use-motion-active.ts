import { useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useReduceMotion } from '@/lib/use-reduce-motion';

// One shared AppState listener (every animatable cover used to add its own).
let appActive = AppState.currentState === 'active';
const listeners = new Set<() => void>();
AppState.addEventListener('change', (s: AppStateStatus) => {
  const next = s === 'active';
  if (next === appActive) return;
  appActive = next;
  listeners.forEach((l) => l());
});
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const getSnapshot = () => appActive;

/** True while the app is in the foreground. */
export function useAppActive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Whether ambient motion may run here: the screen is focused, the app is in the foreground and
 * Reduce Motion is off. Pass `wanted` for the component's own condition (e.g. "is previewing").
 */
export function useMotionActive(wanted = true): boolean {
  const focused = useIsFocused();
  const active = useAppActive();
  const reduce = useReduceMotion();
  return wanted && focused && active && !reduce;
}
