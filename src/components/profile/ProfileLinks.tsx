import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { ALL_BADGES } from '@/constants/badges';
import { useThemeColors } from '@/lib/theme-provider';
import { createProfileStyles } from './profile-styles';

type Props = { isPremium: boolean; earnedBadges: number };

export function ProfileLinks({ isPremium, earnedBadges }: Props) {
  const router = useRouter();
  const colors = useThemeColors();
  const shared = useMemo(() => createProfileStyles(colors), [colors]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const total = ALL_BADGES.length;
  const earned = Math.min(earnedBadges, total);

  return (
    <View style={shared.listCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Milestones and badges, ${earned} of ${total} earned`}
        onPress={() => router.push('/milestones')}
        style={({ pressed }) => [styles.row, pressed && shared.pressed]}
      >
        <View style={styles.left}>
          <Ionicons name="ribbon-outline" size={20} color={colors.text} />
          <Text style={styles.label}>Milestones & badges</Text>
        </View>
        <Text style={styles.value}>{`${earned} of ${total}`}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
      </Pressable>
      <View style={shared.divider} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPremium ? 'Quiett Premium, active. Manage subscription' : 'Quiett Premium'}
        onPress={() => router.push(isPremium ? '/manage-subscription' : '/paywall')}
        style={({ pressed }) => [styles.row, pressed && shared.pressed]}
      >
        <View style={styles.left}>
          <Ionicons
            name={isPremium ? 'sunny' : 'sunny-outline'}
            size={20}
            color={isPremium ? colors.calm : colors.text}
          />
          <Text style={styles.label}>Quiett Premium</Text>
        </View>
        {isPremium ? <Text style={[styles.value, { color: colors.calm }]}>Active</Text> : null}
        <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
    left: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
    label: { ...typography.body, color: colors.text, fontWeight: '500' },
    value: { ...typography.body, fontSize: 15, color: colors.textMuted, fontWeight: '500' },
  });
}
