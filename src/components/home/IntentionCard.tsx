import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { homeCard, pressedStyle } from './home-styles';

type Props = {
  intention: string;
  onPress: () => void;
  /** Tighter variant for Profile's identity card. */
  compact?: boolean;
};

/** Tappable wake-up intention line (Home + Profile). Opens the intention editor. */
function IntentionCardBase({ intention, onPress, compact }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const text = intention.trim();
  const has = text.length > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={has ? `Wake-up intention: ${text}` : 'Set a wake-up intention'}
      accessibilityHint={has ? 'Opens the intention editor' : undefined}
      style={({ pressed }) => [compact ? styles.compact : styles.card, pressed && pressedStyle]}
    >
      <View style={[styles.icon, compact && styles.iconCompact]}>
        <Ionicons name="bulb-outline" size={18} color={colors.calm} />
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{has ? 'Your intention' : 'Wake-up intention'}</Text>
        <Text style={has ? styles.text : styles.empty} numberOfLines={2}>
          {has ? text : 'Add a few words to wake up for'}
        </Text>
      </View>
      <Ionicons name={has ? 'create-outline' : 'add'} size={20} color={colors.textDim} />
    </Pressable>
  );
}

export const IntentionCard = memo(IntentionCardBase);

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { ...homeCard(colors), flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
    compact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.frostBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.frostBorder,
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: radii.full,
      backgroundColor: colors.calmSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconCompact: { backgroundColor: colors.calmSoft, width: 32, height: 32 },
    body: { flex: 1, gap: 2 },
    label: { ...typography.caption, color: colors.textDim, fontWeight: '600' },
    text: { ...typography.body, color: colors.text, fontStyle: 'italic' },
    empty: { ...typography.body, color: colors.textMuted },
  });
}
