import { StyleSheet } from 'react-native';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { pressedStyle } from '@/components/home/home-styles';

/**
 * Shared Settings styles, matching Profile: borderless `bgCard` cards on `bg`, a small
 * uppercase eyebrow above each section (outside the card), edge-to-edge rows split by
 * hairline dividers, and an optional footnote under the card.
 */
export function createSettingsStyles(colors: ColorTokens) {
  return StyleSheet.create({
    section: { gap: spacing.sm },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
    eyebrow: { ...typography.eyebrow, color: colors.textDim, fontSize: 11, letterSpacing: 1.1 },
    card: { backgroundColor: colors.bgCard, borderRadius: radii.xl, overflow: 'hidden' },
    /** Pulls the first row's top divider under the card's clipped edge. */
    cardInner: { marginTop: -StyleSheet.hairlineWidth },
    footnote: { ...typography.caption, color: colors.textDim, lineHeight: 18, paddingHorizontal: spacing.xs },
    hint: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
    /** Padded, non-row content inside a card (hints, pill groups). */
    block: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 52,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
    rowText: { ...typography.body, fontSize: 15, fontWeight: '500', color: colors.text, flexShrink: 1 },
    rowValue: { ...typography.body, fontSize: 15, fontWeight: '500', color: colors.textMuted },
    pressed: pressedStyle,
  });
}

export type SettingsStyles = ReturnType<typeof createSettingsStyles>;
