import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useThemeColors } from '@/lib/theme-provider';
import { artPalette } from './art/art-palette';
import { HillLayer } from './art/scenes';

type Props = { step: number; count: number; visible: boolean; reduceMotion: boolean };

const HEIGHT = 170;

/**
 * Soft hills behind the whole flow. Each step slides the two bands by different amounts
 * (gentle parallax between screens). Only transforms / opacity animate.
 */
export const ParallaxHills = memo(function ParallaxHills({ step, count, visible, reduceMotion }: Props) {
  const colors = useThemeColors();
  const p = useMemo(() => artPalette(colors), [colors]);
  const { width } = useWindowDimensions();
  const farW = width * 1.4;
  const nearW = width * 1.8;
  const progress = useSharedValue(step / Math.max(1, count - 1));
  const shown = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    const t = step / Math.max(1, count - 1);
    progress.value = reduceMotion ? t : withTiming(t, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [step, count, reduceMotion, progress]);
  useEffect(() => {
    shown.value = withTiming(visible ? 1 : 0, { duration: 400 });
  }, [visible, shown]);

  const farStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -progress.value * (farW - width) }] }));
  const nearStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -progress.value * (nearW - width) }] }));
  const wrapStyle = useAnimatedStyle(() => ({ opacity: shown.value * 0.55 }));

  return (
    <Animated.View style={[styles.wrap, wrapStyle]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.band, { width: farW }, farStyle]}>
        <HillLayer w={farW} h={HEIGHT} fill={p.hillFar} crest={0.35} phase={1} amp={0.1} />
      </Animated.View>
      <Animated.View style={[styles.band, { width: nearW }, nearStyle]}>
        <HillLayer w={nearW} h={HEIGHT} fill={p.hillMid} crest={0.6} phase={3} amp={0.08} />
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, height: HEIGHT },
  band: { position: 'absolute', left: 0, bottom: 0, height: HEIGHT },
});
