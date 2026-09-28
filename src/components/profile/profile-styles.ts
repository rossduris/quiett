import { StyleSheet } from 'react-native';
import { spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { homeCard, pressedStyle } from '@/components/home/home-styles';

/** Shared Profile styles: same card surface as Home / Library (radii.xl, spacing.lg). */
export function createProfileStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { ...homeCard(colors), gap: spacing.md },
    /** Card with edge-to-edge rows (links, account). */
    listCard: { ...homeCard(colors), padding: 0, overflow: 'hidden' },
    cardTitle: { ...typography.subtitle, color: colors.text, fontWeight: '600' },
    cardSub: { ...typography.caption, color: colors.textDim, marginTop: spacing.xs },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.lg },
    pressed: pressedStyle,
  });
}

export type ProfileStyles = ReturnType<typeof createProfileStyles>;
