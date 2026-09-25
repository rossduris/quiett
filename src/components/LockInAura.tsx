import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

/** One inhale or one exhale. A full breath is 2× this (~10s). */
const BREATH_HALF_MS = 5000;
/** How quickly the aura brightens when you lock in / dims when you drift. */
const LEVEL_FADE_MS = 900;
/** Aura diameter relative to the camera window. */
const AURA_SCALE = 1.8;

type Props = {
  /** Diameter of the camera window the aura surrounds. */
  size: number;
  /**
   * 0 = off, ~0.3 = faint ember (settling in), 1 = locked in (full glow).
   * Changes are eased, so flipping between phases fades rather than pops.
   */
  level: number;
  /** Glow color (use `colors.sessionGlow`). */
  color: string;
};

/**
 * Warm glowing aura that breathes around the camera window once you're locked in.
 *
 * Perf: the SVG radial gradient is static; only `opacity` + `transform: scale`
 * animate, on the UI thread via reanimated — no JS work per frame.
 * Respects Reduce Motion (glow stays, breathing loop stops).
 */
export function LockInAura({ size, level, color }: Props) {
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);
  const intensity = useSharedValue(level);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(breath);
      breath.value = withTiming(0.5, { duration: 400 });
      return;
    }
    breath.value = 0;
    breath.value = withRepeat(
      withTiming(1, { duration: BREATH_HALF_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, [breath, reduceMotion]);

  useEffect(() => {
    intensity.value = withTiming(level, {
      duration: LEVEL_FADE_MS,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [intensity, level]);

  const auraSize = Math.round(size * AURA_SCALE);
  const half = auraSize / 2;
  // Where the camera window's edge sits inside the gradient (0–1 of the radius).
  const edge = size / 2 / half;

  const glowStyle = useAnimatedStyle(() => {
    const i = intensity.value;
    const b = breath.value;
    return {
      opacity: i * (0.5 + 0.5 * b),
      transform: [{ scale: 0.94 + 0.1 * b * (0.35 + 0.65 * i) }],
    };
  });

  const rimStyle = useAnimatedStyle(() => {
    const i = intensity.value;
    const b = breath.value;
    return {
      opacity: i * (0.35 + 0.45 * b),
      transform: [{ scale: 1 + 0.025 * b }],
    };
  });

  return (
    <View
      pointerEvents="none"
      style={[
        styles.anchor,
        { width: auraSize, height: auraSize, marginLeft: -half, marginTop: -half },
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
        <Svg width={auraSize} height={auraSize}>
          <Defs>
            <RadialGradient id="quiettLockInAura" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={color} stopOpacity={0.9} />
              <Stop offset={edge * 0.98} stopColor={color} stopOpacity={0.75} />
              <Stop offset={edge + (1 - edge) * 0.3} stopColor={color} stopOpacity={0.32} />
              <Stop offset={edge + (1 - edge) * 0.65} stopColor={color} stopOpacity={0.1} />
              <Stop offset={1} stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={half} cy={half} r={half} fill="url(#quiettLockInAura)" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          styles.rim,
          rimStyle,
          {
            width: size + 20,
            height: size + 20,
            borderRadius: (size + 20) / 2,
            borderColor: color,
            left: half - (size + 20) / 2,
            top: half - (size + 20) / 2,
          },
        ]}
      />
    </View>
  );
}

// No colors here — color comes in via props.
const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  rim: {
    position: 'absolute',
    borderWidth: 1.5,
  },
});
