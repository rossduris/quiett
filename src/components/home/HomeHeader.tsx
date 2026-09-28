import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { pressedStyle } from './home-styles';

type Props = {
  streakCount: number;
  /** Today is unlocked and the Morning unlocked card has been dismissed. */
  dayOpenQuiet: boolean;
  onOpenStreak: () => void;
};

export function HomeHeader({ streakCount, dayOpenQuiet, onOpenStreak }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const empty = streakCount === 0;

  return (
    <View style={styles.topBar}>
      <View style={styles.header}>
        <Text style={styles.brand}>Quiett</Text>
        <Text style={[styles.tagline, dayOpenQuiet && styles.taglineOpen]}>
          {dayOpenQuiet ? 'Your day is open' : 'Stay still. Then the morning begins.'}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Streak, ${streakCount} ${streakCount === 1 ? 'day' : 'days'}. Opens streak details`}
        hitSlop={8}
        onPress={onOpenStreak}
        style={({ pressed }) => [styles.streakPill, empty && styles.streakPillEmpty, pressed && pressedStyle]}
      >
        <Ionicons name={empty ? 'flame-outline' : 'flame'} size={18} color={empty ? colors.textDim : colors.calm} />
        <Text style={[styles.streakPillText, empty && styles.streakPillTextEmpty]}>{streakCount}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    topBar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    header: { flex: 1, gap: spacing.xs },
    brand: { ...typography.title, color: colors.text },
    tagline: { ...typography.body, color: colors.textMuted },
    taglineOpen: { color: colors.calm, fontWeight: '600' },
    streakPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radii.full,
      backgroundColor: colors.calmSoft,
      marginTop: spacing.xs,
    },
    streakPillEmpty: { backgroundColor: colors.bgCard },
    streakPillText: { ...typography.body, color: colors.calm, fontWeight: '700' },
    streakPillTextEmpty: { color: colors.textDim },
  });
}
