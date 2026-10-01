import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { EASE_IN_OUT } from '@/lib/motion';

/** One inhale (or exhale). */
export const BREATH_HALF_MS = 5000;

type Props = {
  size: number;
  color: string;
  core: string;
  /** Breathing light on (Settings). Off: a still, faint glow so the ring keeps a centre. */
  breathing: boolean;
  /** Loop runs only while meditating and on screen. */
  playing: boolean;
  reduceMotion: boolean;
  /** 0–1: final-seconds warmth (shared with the ring). */
  finale: SharedValue<number>;
};

/**
 * Soft light that swells ~5 s in and ~5 s out. Static radial-gradient SVG; only scale and
 * opacity animate on the UI thread. Reduce Motion: no scaling — the light gently brightens and
 * dims instead.
 */
export const BreathingOrb = memo(function BreathingOrb({ size, color, core, breathing, playing, reduceMotion, finale }: Props) {
  const b = useSharedValue(0.5);
  useEffect(() => {
    cancelAnimation(b);
    if (!breathing || !playing) {
      b.value = withTiming(0.5, { duration: 1200, easing: EASE_IN_OUT });
      return;
    }
    b.value = withTiming(0, { duration: BREATH_HALF_MS / 2, easing: EASE_IN_OUT }, (done) => {
      if (done) b.value = withRepeat(withTiming(1, { duration: BREATH_HALF_MS, easing: EASE_IN_OUT }), -1, true);
    });
    return () => cancelAnimation(b);
  }, [breathing, playing, b]);

  const style = useAnimatedStyle(() => {
    const v = b.value;
    const warm = finale.value;
    if (!breathing) return { opacity: 0.45 + 0.1 * warm, transform: [{ scale: 0.86 }] };
    if (reduceMotion) return { opacity: 0.4 + 0.3 * v + 0.05 * warm, transform: [{ scale: 0.9 }] };
    return { opacity: 0.55 + 0.2 * v + 0.05 * warm, transform: [{ scale: 0.8 + 0.2 * v }] };
  });
  const coreStyle = useAnimatedStyle(() => ({ opacity: 0.4 + 0.15 * finale.value }));

  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="sessionOrb" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={core} stopOpacity={0.55} />
              <Stop offset={0.3} stopColor={color} stopOpacity={0.4} />
              <Stop offset={0.65} stopColor={color} stopOpacity={0.1} />
              <Stop offset={1} stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#sessionOrb)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, coreStyle]}>
        <View style={{ width: size * 0.16, height: size * 0.16, borderRadius: size * 0.08, backgroundColor: core, opacity: 0.3 }} />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
