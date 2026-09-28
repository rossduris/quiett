import { useCallback } from 'react';
import { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { DURATION, SPRING } from '@/lib/motion';
import { useReduceMotion } from '@/lib/use-reduce-motion';

/**
 * Spring press feedback: scales down a touch on press-in and springs back on release.
 * With Reduce Motion it dims slightly instead of scaling. Spread `handlers` onto a Pressable and
 * put `style` on an Animated.View (or Animated Pressable) that wraps the content.
 */
export function usePressScale(scaleTo = 0.97) {
  const reduce = useReduceMotion();
  const p = useSharedValue(0);

  const onPressIn = useCallback(() => {
    p.value = reduce ? withTiming(1, { duration: DURATION.fast }) : withSpring(1, SPRING);
  }, [p, reduce]);
  const onPressOut = useCallback(() => {
    p.value = reduce ? withTiming(0, { duration: DURATION.fast }) : withSpring(0, SPRING);
  }, [p, reduce]);

  const style = useAnimatedStyle(() =>
    reduce ? { opacity: 1 - 0.18 * p.value } : { transform: [{ scale: 1 - (1 - scaleTo) * p.value }] },
  );

  return { style, handlers: { onPressIn, onPressOut } };
}
