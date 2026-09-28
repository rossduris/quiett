import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useReduceMotion } from '@/lib/use-reduce-motion';

/** True while the app is in the foreground. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
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
