import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WeekStreakStrip } from '@/components/WeekStreakStrip';
import { spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import type { Weekday } from '@/lib/storage';
import { useThemeColors } from '@/lib/theme-provider';
import { homeCard, pressedStyle } from './home-styles';

type Props = {
  completedDays: readonly string[];
  scheduledWeekdays: readonly Weekday[];
  unlockedToday: boolean;
  /** False before the first recorded morning (shows a gentle hint instead of an empty row). */
  hasAnyMorning?: boolean;
  onPress: () => void;
};

function WeekCardBase({ completedDays, scheduledWeekdays, unlockedToday, hasAnyMorning = true, onPress }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="This week's mornings"
      accessibilityHint="Opens streak details"
      onPress={onPress}
      style={({ pressed }) => [styles.card, unlockedToday && styles.cardOpen, pressed && pressedStyle]}
    >
      <View style={styles.top}>
        <Text style={styles.label}>This week</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
      </View>
      <WeekStreakStrip completedDays={completedDays} scheduledWeekdays={scheduledWeekdays} />
      {!hasAnyMorning ? <Text style={styles.hint}>Each morning you open lights up a day here.</Text> : null}
    </Pressable>
  );
}

export const WeekCard = memo(WeekCardBase);

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { ...homeCard(colors), gap: spacing.md },
    cardOpen: { borderColor: colors.calm },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    label: { ...typography.eyebrow, color: colors.textDim },
    hint: { ...typography.caption, color: colors.textMuted },
  });
}
