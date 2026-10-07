import { useEffect, useRef } from 'react';
import { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { DURATION, EASE, SPRING_BOUNCY } from '@/lib/motion';
import { useReduceMotion } from '@/lib/use-reduce-motion';

/**
 * Pops (scale up, spring back) when `value` increases after first render — e.g. a streak that
 * ticked up while the screen was away. Never animates on first mount, so nothing fakes a change.
 * Returns an animated style plus whether a bump just happened (for haptics).
 */
export function useBump(value: number, amount = 0.14, onBump?: () => void) {
  const reduce = useReduceMotion();
  const s = useSharedValue(1);
  const prev = useRef<number | null>(null);
  useEffect(() => {
    const was = prev.current;
    prev.current = value;
    if (was == null || !(value > was)) return;
    onBump?.();
    if (reduce) return;
    s.value = withSequence(withTiming(1 + amount, { duration: DURATION.fast, easing: EASE }), withSpring(1, SPRING_BOUNCY));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
}
