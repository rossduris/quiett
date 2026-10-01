import { memo, useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { AnimSpec, Layer, SceneLayout } from './scene-layouts';

type Props = {
  layout: SceneLayout;
  /** Reduce Motion: every layer sits in its rest pose (the scene itself just fades in). */
  reduceMotion: boolean;
  /** False pauses loops (e.g. a "how it works" step that isn't highlighted). */
  playing?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

const sine = Easing.inOut(Easing.sin);

/**
 * Renders a SceneLayout. Each layer is a static SVG inside an Animated.View; only transform
 * and opacity animate, on the UI thread, so there is no per-frame JS or SVG re-render.
 */
export const AnimatedScene = memo(function AnimatedScene({ layout, reduceMotion, playing = true, radius = 0, style }: Props) {
  return (
    <View
      style={[{ width: layout.w, height: layout.h, borderRadius: radius, overflow: 'hidden' }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {layout.layers.map((layer) => (
        <LayerView key={layer.key} layer={layer} animate={!reduceMotion && playing} />
      ))}
    </View>
  );
});

function LayerView({ layer, animate }: { layer: Layer; animate: boolean }) {
  const p = useSharedValue(0);
  const spec = layer.anim;

  useEffect(() => {
    if (!spec) return;
    cancelAnimation(p);
    if (!animate) {
      p.value = restValue(spec);
      return;
    }
    p.value = startValue(spec);
    p.value = drive(spec);
    return () => cancelAnimation(p);
  }, [animate, spec, p]);

  const aStyle = useAnimatedStyle(() => {
    if (!spec) return {};
    const v = p.value;
    switch (spec.type) {
      case 'rise':
        return { transform: [{ translateY: interpolate(v, [0, 1], [spec.from, 0]) }], opacity: interpolate(v, [0, 0.25, 1], [0, 1, 1]) };
      case 'rotate':
        return { transform: [{ rotate: `${v * 360}deg` }] };
      case 'drift':
        return { transform: [{ translateX: interpolate(v, [0, 1], [-spec.dx, spec.dx]) }] };
      case 'bob':
        return { transform: [{ translateY: interpolate(v, [0, 1], [-spec.dy, spec.dy]) }] };
      case 'floatUp':
        return { transform: [{ translateY: -spec.dy * v }], opacity: Math.sin(Math.PI * v) };
      case 'pulse':
        return { transform: [{ scale: 0.55 + 0.5 * v }], opacity: (1 - v) * 0.7 };
      case 'breathe':
        return { transform: [{ scale: interpolate(v, [0, 1], [spec.min, spec.max]) }] };
      case 'fadeIn':
        return { opacity: v };
      case 'fadeOut':
        return { opacity: 1 - v };
      case 'pop':
        return { transform: [{ scale: v }], opacity: Math.min(1, v * 1.5) };
    }
  }, [spec]);

  return (
    <Animated.View style={[styles.layer, { left: layer.x, top: layer.y, width: layer.w, height: layer.h }, aStyle]}>
      {layer.node}
    </Animated.View>
  );
}

/** Rest pose for Reduce Motion / paused scenes (matches the box still frames). */
export function restValue(spec: AnimSpec): number {
  switch (spec.type) {
    case 'rise':
    case 'fadeIn':
    case 'pop':
    case 'fadeOut':
      return 1;
    case 'drift':
    case 'bob':
    case 'breathe':
      return 0.5;
    case 'floatUp':
      return 0.5;
    case 'pulse':
      return 0.6;
    case 'rotate':
      return 0;
  }
}

function startValue(spec: AnimSpec): number {
  switch (spec.type) {
    case 'drift':
    case 'bob':
    case 'breathe':
      return 0.5;
    default:
      return 0;
  }
}

function drive(spec: AnimSpec): number {
  switch (spec.type) {
    case 'rise':
      return withDelay(spec.delay ?? 0, withTiming(1, { duration: spec.duration, easing: Easing.out(Easing.cubic) }));
    case 'rotate':
      return withRepeat(withTiming(1, { duration: spec.period, easing: Easing.linear }), -1, false);
    case 'drift':
    case 'bob':
    case 'breathe': {
      const half = spec.period / 2;
      const delay = spec.type === 'drift' ? 0 : spec.delay ?? 0;
      return withDelay(
        delay,
        withSequence(
          withTiming(1, { duration: half / 2, easing: sine }),
          withRepeat(withTiming(0, { duration: half, easing: sine }), -1, true),
        ),
      );
    }
    case 'floatUp':
      return withDelay(spec.delay ?? 0, withRepeat(withTiming(1, { duration: spec.period, easing: Easing.out(Easing.quad) }), -1, false));
    case 'pulse': {
      const loop = withRepeat(withTiming(1, { duration: spec.period, easing: Easing.out(Easing.quad) }), -1, false);
      // settleFrom: start fast (ringing) for three beats, then slow down into the calm loop.
      const body = spec.settleFrom
        ? withSequence(
            withRepeat(withTiming(1, { duration: spec.settleFrom, easing: Easing.out(Easing.quad) }), 3, false),
            // Reset to 0 so the slow loop repeats 0 → 1 (withRepeat restarts from its start value).
            withTiming(0, { duration: 0 }),
            loop,
          )
        : loop;
      return withDelay(spec.delay ?? 0, body);
    }
    case 'fadeIn':
    case 'fadeOut':
      return withDelay(spec.delay, withTiming(1, { duration: spec.duration ?? 600 }));
    case 'pop':
      return withDelay(spec.delay, withSpring(1, { damping: 12, stiffness: 180 }));
  }
}

const styles = StyleSheet.create({
  layer: { position: 'absolute' },
});
