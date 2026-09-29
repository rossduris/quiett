import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { cardDismiss, homeCard, pressedStyle } from './home-styles';

export type GetStartedStep = { key: string; label: string; done: boolean; onPress: () => void };

type Props = {
  steps: readonly GetStartedStep[];
  onDismiss: () => void;
};

/** First-week checklist (alarm, reliability, test morning, intention). */
export function GetStartedCard({ steps, onDismiss }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const done = steps.filter((s) => s.done).length;

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onDismiss}
        style={cardDismiss}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Dismiss get started"
      >
        <Ionicons name="close" size={20} color={colors.textDim} />
      </Pressable>
      <View style={styles.top}>
        <Ionicons name="flag-outline" size={24} color={colors.calm} />
        <View style={styles.titleRow}>
          <Text style={styles.title}>Get started</Text>
          <Text style={styles.progress} accessibilityLabel={`${done} of ${steps.length} done`}>
            {done}/{steps.length}
          </Text>
        </View>
      </View>
      <View style={styles.list}>
        {steps.map((step) => (
          <Pressable
            key={step.key}
            onPress={step.onPress}
            style={({ pressed }) => [styles.row, step.done && styles.rowDone, pressed && pressedStyle]}
            accessibilityRole="button"
            accessibilityLabel={step.done ? `${step.label}, done` : step.label}
            accessibilityState={{ checked: step.done }}
          >
            <View style={[styles.check, step.done && styles.checkDone]}>
              {step.done ? <Ionicons name="checkmark" size={14} color={colors.onAccent} /> : null}
            </View>
            <Text style={[styles.text, step.done && styles.textDone]}>{step.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { ...homeCard(colors), gap: spacing.md },
    top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    // Right padding keeps the progress count clear of the dismiss button.
    titleRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingRight: spacing.xl,
    },
    title: { ...typography.subtitle, color: colors.text, fontWeight: '600' },
    progress: { ...typography.body, color: colors.calm, fontWeight: '700' },
    list: { gap: spacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 44,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowDone: { opacity: 0.6 },
    check: {
      width: 22,
      height: 22,
      borderRadius: radii.full,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkDone: { backgroundColor: colors.accentStrong, borderColor: colors.accentStrong },
    text: { ...typography.body, flex: 1, color: colors.text, fontWeight: '500' },
    textDone: { color: colors.textMuted },
  });
}
