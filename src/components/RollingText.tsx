import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutUp } from 'react-native-reanimated';
import { DURATION, EASE } from '@/lib/motion';

type Props = {
  text: string;
  style: StyleProp<TextStyle>;
  reduceMotion: boolean;
};

/**
 * Text whose changed characters roll: the old glyph lifts out, the new one rises in
 * (e.g. alarm time digits while spinning the picker). Unchanged characters stay put.
 * Nothing animates on first mount. Reduce Motion: quick cross-fade.
 */
export function RollingText({ text, style, reduceMotion }: Props) {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const live = mounted.current;
  const enter = !live
    ? undefined
    : reduceMotion
      ? FadeIn.duration(DURATION.fast)
      : FadeInDown.duration(DURATION.base).easing(EASE).withInitialValues({ opacity: 0, transform: [{ translateY: 18 }] });
  // Shrink-to-fit (replaces adjustsFontSizeToFit, which can't span separate glyph Texts).
  const [boxW, setBoxW] = useState(0);
  const [rowW, setRowW] = useState(0);
  const scale = boxW > 0 && rowW > boxW ? Math.max(0.6, boxW / rowW) : 1;
  const exit = !live ? undefined : reduceMotion ? FadeOut.duration(DURATION.fast) : FadeOutUp.duration(DURATION.fast + 40);
  return (
    <View style={styles.box} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
    <View
      style={[styles.row, scale !== 1 && { transform: [{ scale }] }]}
      onLayout={(e) => setRowW(e.nativeEvent.layout.width)}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from(text).map((ch, i) => (
        <Animated.Text key={`${i}:${ch}`} entering={enter} exiting={exit} style={style} allowFontScaling={false}>
          {ch === ' ' ? '\u00A0' : ch}
        </Animated.Text>
      ))}
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', flexDirection: 'row' },
  // Row keeps its natural width (so it can be measured) and scales from its left edge.
  row: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 0, transformOrigin: 'left center' },
});
