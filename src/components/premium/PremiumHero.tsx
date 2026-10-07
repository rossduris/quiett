import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SceneCover } from '@/components/SceneCover';
import { sceneSpecFor } from '@/constants/scene-covers';
import { radii } from '@/constants/theme';
import { artPalette } from '@/components/onboarding/art/art-palette';
import { AnimatedScene } from '@/components/onboarding/art/AnimatedScene';
import { premiumLayout } from '@/components/onboarding/art/scene-layouts';
import { useThemeColors } from '@/lib/theme-provider';

type Props = {
  width: number;
  height: number;
  /** Sound track ids to fan out (up to 5; the middle one is the largest). */
  trackIds: readonly string[];
  reduceMotion: boolean;
  /** False pauses every loop (screen not focused, app in the background). Defaults to true. */
  playing?: boolean;
};

/** Slot geometry for up to five covers, centre first in z-order. */
const SLOTS = [
  { dx: -0.34, dy: 0.1, rot: -14, scale: 0.7 },
  { dx: -0.18, dy: 0.03, rot: -7, scale: 0.84 },
  { dx: 0, dy: 0, rot: 0, scale: 1 },
  { dx: 0.18, dy: 0.03, rot: 7, scale: 0.84 },
  { dx: 0.34, dy: 0.1, rot: 14, scale: 0.7 },
] as const;

/**
 * Premium hero: an animated vector backdrop (glow, rays, breathing rings, drifting motes, hills)
 * with real sound covers fanning out on top and then floating gently. Only transform and
 * opacity animate. Reduce Motion shows the finished fan without movement; `playing` false
 * pauses the loops (the backdrop rests, the covers hold still) until it turns true again.
 */
export const PremiumHero = memo(function PremiumHero({ width, height, trackIds, reduceMotion, playing = true }: Props) {
  const colors = useThemeColors();
  const palette = useMemo(() => artPalette(colors), [colors]);
  const layout = useMemo(() => premiumLayout(width, height, palette), [width, height, palette]);
  const ids = trackIds.slice(0, 5);
  const offset = Math.floor((5 - ids.length) / 2);
  const base = Math.min(104, height * 0.46);
  // Draw centre last so it sits on top.
  const order = ids.map((id, i) => ({ id, slot: SLOTS[i + offset]!, i })).sort((a, b) => a.slot.scale - b.slot.scale);
  return (
    <View
      style={[styles.wrap, { width, height }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <AnimatedScene layout={layout} reduceMotion={reduceMotion} playing={playing} radius={radii.xl} />
      {order.map(({ id, slot, i }) => (
        <FanCover
          key={id}
          id={id}
          index={i}
          size={Math.round(base * slot.scale)}
          left={width / 2 + slot.dx * width - (base * slot.scale) / 2}
          top={height * 0.42 + slot.dy * height - (base * slot.scale) / 2}
          rot={slot.rot}
          ring={colors.bg}
          reduceMotion={reduceMotion}
          playing={playing}
        />
      ))}
    </View>
  );
});

function FanCover({
  id,
  index,
  size,
  left,
  top,
  rot,
  ring,
  reduceMotion,
  playing,
}: {
  id: string;
  index: number;
  size: number;
  left: number;
  top: number;
  rot: number;
  ring: string;
  reduceMotion: boolean;
  playing: boolean;
}) {
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  const bob = useSharedValue(0.5);
  // Fan-in once (again if Reduce Motion is switched off).
  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = 0;
    enter.value = withDelay(150 + index * 90, withSpring(1, { damping: 14, stiffness: 120 }));
  }, [reduceMotion, index, enter]);
  // Gentle float, only while playing; paused it holds where it is and resumes from there.
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(bob);
      bob.value = 0.5;
      return;
    }
    if (!playing) {
      cancelAnimation(bob);
      return;
    }
    bob.value = withDelay(
      900 + index * 260,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2600 + index * 240, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2600 + index * 240, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(bob);
  }, [reduceMotion, playing, index, bob]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.4),
    transform: [
      { translateY: (1 - enter.value) * 28 + (bob.value - 0.5) * 6 },
      { rotate: `${rot * enter.value}deg` },
      { scale: 0.9 + 0.1 * enter.value },
    ],
  }));
  const r = Math.round(size * 0.22);
  return (
    <Animated.View style={[styles.cover, { left, top, width: size, height: size, borderRadius: r + 3, borderColor: ring }, style]}>
      <SceneCover scene={sceneSpecFor(id)} size={size - 6} radius={r} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center' },
  cover: {
    position: 'absolute',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});
