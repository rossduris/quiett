import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { homeCard, pressedStyle } from './home-styles';

/** Nudge to the reliability check once Get started is gone but the check isn't done. */
export function ReliabilityCard({ onPress }: { onPress: () => void }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && pressedStyle]}
      accessibilityRole="button"
      accessibilityLabel="Check your alarm reliability. Three iPhone settings that matter for waking up"
    >
      <View style={styles.icon}>
        <Ionicons name="alarm-outline" size={20} color={colors.calm} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Check your alarm reliability</Text>
        <Text style={styles.text}>Three iPhone settings that matter for waking up</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </Pressable>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { ...homeCard(colors), flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    icon: {
      width: 40,
      height: 40,
      borderRadius: radii.full,
      backgroundColor: colors.calmSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { flex: 1, gap: 2 },
    title: { ...typography.body, color: colors.text, fontWeight: '600' },
    text: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  });
}
