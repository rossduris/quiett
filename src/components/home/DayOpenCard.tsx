import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { cardDismiss } from './home-styles';

type Props = {
  wakeIntention: string;
  alarmEnabled: boolean;
  onDismiss: () => void;
};

/** "Morning unlocked" card, shown once today is unlocked until dismissed for the day. */
export function DayOpenCard({ wakeIntention, alarmEnabled, onDismiss }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onDismiss}
        style={cardDismiss}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Dismiss morning unlocked"
      >
        <Ionicons name="close" size={20} color={colors.textDim} />
      </Pressable>
      <Ionicons name="sunny-outline" size={28} color={colors.calm} />
      <Text style={styles.title}>Morning unlocked</Text>
      <Text style={styles.body}>
        {alarmEnabled ? 'Your day is open. Your next alarm is below.' : 'Your day is open.'}
      </Text>
      {wakeIntention ? (
        <View style={styles.intentionPill}>
          <Ionicons name="bulb-outline" size={14} color={colors.calm} />
          <Text style={styles.intentionText}>{wakeIntention}</Text>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      borderRadius: radii.xl,
      backgroundColor: colors.calmSoft,
      borderWidth: 1,
      borderColor: colors.calm,
    },
    title: { ...typography.title, color: colors.calm },
    body: { ...typography.body, color: colors.textMuted, lineHeight: 22, textAlign: 'center' },
    intentionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: 12,
      paddingVertical: spacing.sm,
      borderRadius: radii.full,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.calm,
      marginTop: spacing.xs,
    },
    intentionText: { ...typography.caption, color: colors.calm, fontWeight: '500', fontStyle: 'italic', flexShrink: 1 },
  });
}
