import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { homeCard, pressedStyle } from '@/components/home/home-styles';

type Props = {
  current: number;
  best: number;
  mornings: number;
  /** False until the first morning: Best / Mornings show "—" instead of 0. */
  hasMornings: boolean;
  onOpenStreak: () => void;
};

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

export function StatsRow({ current, best, mornings, hasMornings, onOpenStreak }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const lit = current > 0;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Current streak, ${days(current)}`}
        accessibilityHint="Opens streak details"
        onPress={onOpenStreak}
        style={({ pressed }) => [styles.chip, lit && styles.chipLit, pressed && pressedStyle]}
      >
        <View style={styles.valueRow}>
          <Ionicons name={lit ? 'flame' : 'flame-outline'} size={16} color={lit ? colors.calm : colors.textDim} />
          <Text style={[styles.num, lit && styles.numLit]}>{current}</Text>
        </View>
        <Text style={styles.label}>Current</Text>
      </Pressable>
      <View
        style={styles.chip}
        accessible
        accessibilityLabel={hasMornings ? `Best streak, ${days(best)}` : 'Best streak, none yet'}
      >
        <View style={styles.valueRow}>
          <Ionicons name="trophy-outline" size={16} color={colors.textDim} />
          <Text style={styles.num}>{hasMornings ? best : '—'}</Text>
        </View>
        <Text style={styles.label}>Best</Text>
      </View>
      <View
        style={styles.chip}
        accessible
        accessibilityLabel={hasMornings ? `Total mornings, ${mornings}` : 'Total mornings, none yet'}
      >
        <View style={styles.valueRow}>
          <Ionicons name="sunny-outline" size={16} color={colors.textDim} />
          <Text style={styles.num}>{hasMornings ? mornings : '—'}</Text>
        </View>
        <Text style={styles.label}>Mornings</Text>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: spacing.sm },
    chip: {
      ...homeCard(colors),
      flex: 1,
      alignItems: 'center',
      gap: spacing.xs / 2,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.lg,
    },
    chipLit: { backgroundColor: colors.calmSoft, borderColor: colors.calm },
    valueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    num: { ...typography.subtitle, color: colors.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
    numLit: { color: colors.calm },
    label: { ...typography.eyebrow, color: colors.textDim, fontSize: 11, letterSpacing: 0.6 },
  });
}
