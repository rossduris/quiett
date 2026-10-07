import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { hapticSelect } from '@/lib/haptics';
import { DURATION, SPRING } from '@/lib/motion';
import { usePressScale } from '@/lib/use-press-scale';
import { useReduceMotion } from '@/lib/use-reduce-motion';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  selected: boolean;
  label: string;
  /** Resting pill look (layout, radius, unselected colours). */
  style: StyleProp<ViewStyle>;
  /** Selected look — only backgroundColor / borderColor are used for the spring fill. */
  selectedStyle: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
  selectedTextStyle: StyleProp<TextStyle>;
  children?: ReactNode;
};

/**
 * Toggle / choice pill: on select the fill blooms from the centre with a spring (text colour
 * follows), with a selection tick haptic and a gentle press scale. Reduce Motion: plain fade.
 */
export function SpringPill({ selected, label, style, selectedStyle, textStyle, selectedTextStyle, onPress, ...rest }: Props) {
  const reduce = useReduceMotion();
  const press = usePressScale(0.94);
  const on = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    on.value = reduce ? withTiming(selected ? 1 : 0, { duration: DURATION.fast }) : withSpring(selected ? 1 : 0, SPRING);
  }, [selected, reduce, on]);

  const sel = StyleSheet.flatten(selectedStyle) ?? {};
  const base = StyleSheet.flatten(style) ?? {};
  const fromText = String((StyleSheet.flatten(textStyle) ?? {}).color ?? '#000');
  const toText = String((StyleSheet.flatten(selectedTextStyle) ?? {}).color ?? fromText);
  const fillBg = sel.backgroundColor ?? base.backgroundColor;
  const fillBorder = sel.borderColor ?? base.borderColor;

  const fill = useAnimatedStyle(() => ({
    opacity: Math.min(1, on.value * 1.4),
    transform: [{ scale: reduce ? 1 : 0.55 + 0.45 * on.value }],
  }));
  const text = useAnimatedStyle(() => ({ color: interpolateColor(Math.min(1, Math.max(0, on.value)), [0, 1], [fromText, toText]) }));

  return (
    <Pressable
      {...rest}
      onPress={(e) => {
        hapticSelect();
        onPress?.(e);
      }}
      onPressIn={press.handlers.onPressIn}
      onPressOut={press.handlers.onPressOut}
      style={base.flex != null ? { flex: base.flex } : undefined}
    >
      <Animated.View style={[style, { flex: undefined, overflow: 'hidden' }, base.flex != null && styles.stretch, press.style]}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: fillBg, borderColor: fillBorder, borderWidth: base.borderWidth ?? 0, borderRadius: base.borderRadius },
            fill,
          ]}
        />
        <Animated.Text style={[textStyle, selected && selectedTextStyle, text]} maxFontSizeMultiplier={1.3}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({ stretch: { alignSelf: 'stretch' } });
