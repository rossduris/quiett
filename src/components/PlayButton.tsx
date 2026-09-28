import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { ColorTokens } from '@/constants/themes';
import { hapticTap } from '@/lib/haptics';
import { DURATION, EASE, EASE_IN_OUT, SPRING_BOUNCY } from '@/lib/motion';
import { usePressScale } from '@/lib/use-press-scale';
import { useReduceMotion } from '@/lib/use-reduce-motion';

type Props = Omit<PressableProps, 'style' | 'children' | 'onPress'> & {
  playing: boolean;
  onPress: () => void;
  colors: ColorTokens;
  /** Diameter in pt. */
  size: number;
  iconSize?: number;
  /** Resting look (background, border, position). */
  style?: StyleProp<ViewStyle>;
  /** Extra look while playing. */
  activeStyle?: StyleProp<ViewStyle>;
};

/**
 * Preview play/stop: springy press, icons morph (play spins out, stop pops in), and a soft halo
 * breathes outward while the preview plays. Reduce Motion: icons cross-fade, halo stays still.
 */
export const PlayButton = memo(function PlayButton({
  playing,
  onPress,
  colors,
  size,
  iconSize = Math.round(size * 0.42),
  style,
  activeStyle,
  ...rest
}: Props) {
  const reduce = useReduceMotion();
  const press = usePressScale(0.9);
  const on = useSharedValue(playing ? 1 : 0);
  const halo = useSharedValue(0);

  useEffect(() => {
    on.value = reduce ? withTiming(playing ? 1 : 0, { duration: DURATION.fast }) : withSpring(playing ? 1 : 0, SPRING_BOUNCY);
    cancelAnimation(halo);
    if (playing && !reduce) {
      halo.value = 0;
      halo.value = withRepeat(withSequence(withTiming(1, { duration: 1600, easing: EASE_IN_OUT }), withTiming(0, { duration: 0 })), -1, false);
    } else {
      halo.value = withTiming(0, { duration: DURATION.base, easing: EASE });
    }
  }, [playing, reduce, on, halo]);

  const playIcon = useAnimatedStyle(() => ({
    opacity: 1 - on.value,
    transform: reduce ? [] : [{ scale: 1 - 0.5 * on.value }, { rotate: `${-90 * on.value}deg` }],
  }));
  const stopIcon = useAnimatedStyle(() => ({
    opacity: on.value,
    transform: reduce ? [] : [{ scale: 0.5 + 0.5 * on.value }, { rotate: `${90 * (1 - on.value)}deg` }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: reduce ? 0.35 * on.value : (1 - halo.value) * 0.55 * Math.min(1, on.value),
    transform: [{ scale: reduce ? 1.18 : 1 + 0.55 * halo.value }],
  }));
  // A second, slower ring half a beat behind reads as sound radiating.
  const halo2 = useAnimatedStyle(() => {
    const v = (halo.value + 0.5) % 1;
    return {
      opacity: reduce ? 0 : (1 - v) * 0.35 * Math.min(1, on.value),
      transform: [{ scale: 1 + 0.55 * v }],
    };
  });

  const ring = { width: size, height: size, borderRadius: size / 2, borderColor: colors.calm };

  return (
    <View style={[styles.wrap, style, { width: size, height: size, borderWidth: 0, backgroundColor: 'transparent' }]}>
      <Animated.View pointerEvents="none" style={[styles.halo, ring, haloStyle]} />
      <Animated.View pointerEvents="none" style={[styles.halo, ring, halo2]} />
      <Pressable
        {...rest}
        hitSlop={rest.hitSlop ?? 8}
        onPressIn={press.handlers.onPressIn}
        onPressOut={press.handlers.onPressOut}
        onPress={() => {
          hapticTap();
          onPress();
        }}
      >
        <Animated.View style={[styles.face, flatFace(style), { width: size, height: size, borderRadius: size / 2 }, playing && activeStyle, press.style]}>
          <Animated.View style={[styles.icon, playIcon]}>
            <Ionicons name="play" size={iconSize} color={colors.text} style={{ marginLeft: iconSize * 0.1 }} />
          </Animated.View>
          <Animated.View style={[styles.icon, stopIcon]}>
            <Ionicons name="stop" size={iconSize} color={colors.calm} />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
});

/** Keep only the look (colours / border) from the caller's style for the face; position stays on the wrapper. */
function flatFace(style: StyleProp<ViewStyle>): ViewStyle {
  const s = StyleSheet.flatten(style) ?? {};
  return {
    backgroundColor: s.backgroundColor,
    borderWidth: s.borderWidth,
    borderColor: s.borderColor,
    shadowColor: s.shadowColor,
    shadowOpacity: s.shadowOpacity,
    shadowRadius: s.shadowRadius,
    shadowOffset: s.shadowOffset,
  };
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', borderWidth: 1.5 },
  face: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  icon: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
