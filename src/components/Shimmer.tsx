import { useEffect, useState } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { radii, spacing } from '@/constants/theme';
import { EASE_IN_OUT, enterFade } from '@/lib/motion';
import { useThemeColors } from '@/lib/theme-provider';
import { useReduceMotion } from '@/lib/use-reduce-motion';

/** A placeholder block that softly pulses (opacity only). Static with Reduce Motion. */
export function ShimmerBlock({ width = '100%', height, radius = radii.md, style }: { width?: DimensionValue; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const colors = useThemeColors();
  const reduce = useReduceMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    v.value = withRepeat(withTiming(1, { duration: 900, easing: EASE_IN_OUT }), -1, true);
    return () => cancelAnimation(v);
  }, [reduce, v]);
  const a = useAnimatedStyle(() => ({ opacity: 0.55 + 0.45 * v.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.border }, style, a]} />;
}

/**
 * Library featured-card placeholder. Waits 180 ms before showing so a fast load never flashes
 * a skeleton; real content fades in over it when ready.
 */
export function FeaturedSkeleton({ artHeight }: { artHeight: number }) {
  const colors = useThemeColors();
  const reduce = useReduceMotion();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 180);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={styles.wrap} accessibilityLabel="Loading" accessible>
      {show ? (
        <Animated.View entering={enterFade(reduce)} style={styles.inner}>
          <ShimmerBlock width={120} height={12} radius={6} />
          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            <ShimmerBlock height={artHeight} radius={0} />
            <View style={styles.lines}>
              <ShimmerBlock width="60%" height={18} radius={6} />
              <ShimmerBlock width="85%" height={12} radius={6} />
            </View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, minHeight: 12 },
  inner: { gap: spacing.sm },
  card: { borderWidth: 1, borderRadius: radii.lg, overflow: 'hidden' },
  lines: { padding: spacing.md, gap: spacing.sm },
});
