import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { radii } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';

type Props = { count: number; index: number; reduceMotion: boolean };

/** Segmented progress bar; the current segment fills in as the step appears. */
export const ProgressSegments = memo(function ProgressSegments({ count, index, reduceMotion }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${index + 1} of ${count}`}
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Segment key={i} state={i < index ? 'done' : i === index ? 'active' : 'todo'} reduceMotion={reduceMotion} styles={styles} />
      ))}
    </View>
  );
});

function Segment({
  state,
  reduceMotion,
  styles,
}: {
  state: 'done' | 'active' | 'todo';
  reduceMotion: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const fill = useSharedValue(state === 'todo' ? 0 : state === 'done' ? 1 : 0);
  useEffect(() => {
    const target = state === 'todo' ? 0 : 1;
    fill.value = reduceMotion ? target : withTiming(target, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, [state, reduceMotion, fill]);
  const aStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, aStyle]} />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: { flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center' },
    track: { flex: 1, height: 4, borderRadius: radii.full, backgroundColor: colors.border, overflow: 'hidden' },
    fill: { height: 4, borderRadius: radii.full, backgroundColor: colors.calm },
  });
}
