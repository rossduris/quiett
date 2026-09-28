import type { TextStyle, ViewStyle } from 'react-native';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';

/** Shelf card geometry (shared by the card, the shelf's FlatList layout and snapping). */
export const CARD_W = 156;
export const CARD_H = 196;
/** Scene-cover art height inside a shelf card (card border is 1pt). */
export const SCENE_ART_H = 108;
export const CARD_GAP = spacing.sm;

export const pressedStyle: ViewStyle = { opacity: 0.85 };

/** Small frosted pill that sits on top of a scene cover (Selected / Premium). */
export function frostPill(colors: ColorTokens): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.frostBg,
    borderWidth: 1,
    borderColor: colors.frostBorder,
  };
}

export const pillText: TextStyle = { ...typography.eyebrow, letterSpacing: 0.4 };

/** Round play / stop button used on cards and the featured card. */
export function playFab(colors: ColorTokens, size: number): ViewStyle {
  return {
    width: size,
    height: size,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  };
}

/** Selectable chip (filters, dev voice picker, Surprise me). */
export function chip(colors: ColorTokens): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  };
}

export function chipActive(colors: ColorTokens): ViewStyle {
  return { backgroundColor: colors.calmSoft, borderColor: colors.calm };
}
