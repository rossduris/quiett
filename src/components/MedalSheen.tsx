import { memo, useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { EASE } from '@/lib/motion';
import { useReduceMotion } from '@/lib/use-reduce-motion';

type Props = {
  size: number;
  /** Sweep plays when this turns true (and on mount if already true). */
  play: boolean;
  delay?: number;
  /** Unique gradient id. */
  id: string;
  children: ReactNode;
};

const SWEEP_MS = 900;

/**
 * One diagonal glint that sweeps across a circular medallion (earned badges). Only a
 * translateX animates; the band is a static SVG gradient clipped to the circle.
 * Reduce Motion: no sweep.
 */
export const MedalSheen = memo(function MedalSheen({ size, play, delay = 0, id, children }: Props) {
  const reduce = useReduceMotion();
  const x = useSharedValue(-1);

  useEffect(() => {
    cancelAnimation(x);
    x.value = -1;
    if (!play || reduce) return;
    x.value = withDelay(delay, withTiming(1, { duration: SWEEP_MS, easing: EASE }));
  }, [play, reduce, delay, x]);

  const band = size * 0.7;
  const style = useAnimatedStyle(() => ({
    opacity: x.value <= -1 || x.value >= 1 ? 0 : 1,
    transform: [{ translateX: x.value * (size + band) * 0.75 }, { rotate: '20deg' }],
  }));

  return (
    <View style={{ width: size, height: size }}>
      {children}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: size / 2, overflow: 'hidden' }]}>
        <Animated.View style={[styles.band, { width: band, height: size * 1.6, left: (size - band) / 2, top: -size * 0.3 }, style]}>
          <Svg width={band} height={size * 1.6}>
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.55} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={band} height={size * 1.6} fill={`url(#${id})`} />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({ band: { position: 'absolute' } });
