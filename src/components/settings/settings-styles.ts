import { StyleSheet } from 'react-native';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { homeCard, pressedStyle } from '@/components/home/home-styles';

/** Shared Settings styles: same card surface as Home / Library / Profile. */
export function createSettingsStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { ...homeCard(colors), gap: spacing.sm },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardLabel: { ...typography.eyebrow, color: colors.textDim },
    hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: radii.md,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    rowText: { ...typography.body, fontSize: 15, fontWeight: '500', color: colors.text },
    rowValue: { ...typography.body, fontSize: 15, fontWeight: '500', color: colors.textMuted },
    pressed: pressedStyle,
  });
}

export type SettingsStyles = ReturnType<typeof createSettingsStyles>;
