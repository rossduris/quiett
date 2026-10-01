import { StyleSheet } from 'react-native';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { pressedStyle } from '@/components/home/home-styles';

/**
 * Shared Profile styles. Depth comes from card-on-background contrast, not borders:
 * cards are `bgCard` on `bg` with no outline, generous padding, and small uppercase
 * eyebrow labels above each section. Only the hero gets a sheen.
 */
export function createProfileStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { backgroundColor: colors.bgCard, borderRadius: radii.xl, padding: spacing.lg, gap: spacing.md },
    /** Card with edge-to-edge rows (links, account). */
    listCard: { backgroundColor: colors.bgCard, borderRadius: radii.xl, overflow: 'hidden' },
    section: { gap: spacing.sm },
    sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
    eyebrow: { ...typography.eyebrow, color: colors.textDim, fontSize: 11, letterSpacing: 1.1 },
    meta: { ...typography.caption, color: colors.textDim },
    link: { ...typography.caption, color: colors.calm, fontWeight: '600' },
    cardTitle: { ...typography.subtitle, color: colors.text, fontWeight: '600' },
    cardSub: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.lg },
    pressed: pressedStyle,
  });
}

export type ProfileStyles = ReturnType<typeof createProfileStyles>;
