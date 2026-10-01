import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { pressedStyle } from './library-styles';

export function LibraryHeader({ isPremium, onOpenPaywall }: { isPremium: boolean; onOpenPaywall: () => void }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <Text style={styles.title} accessibilityRole="header">
          Library
        </Text>
        {!isPremium ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quiett Premium"
            accessibilityHint="Opens Premium plans"
            onPress={onOpenPaywall}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            style={({ pressed }) => [styles.premiumPill, pressed && pressedStyle]}
          >
            <Ionicons name="sparkles-outline" size={13} color={colors.calm} />
            <Text style={styles.premiumText}>Premium</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.lead}>Choose what plays after you&apos;re still.</Text>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    header: { paddingHorizontal: spacing.lg, gap: spacing.xs, marginBottom: spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    title: { ...typography.title, color: colors.text },
    lead: { ...typography.body, color: colors.textMuted },
    premiumPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: 28,
      paddingHorizontal: 12,
      borderRadius: radii.full,
      backgroundColor: colors.calmSoft,
    },
    premiumText: { ...typography.caption, color: colors.calm, fontWeight: '700' },
  });
}
