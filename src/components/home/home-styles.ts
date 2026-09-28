import type { ViewStyle } from 'react-native';
import { radii, spacing } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';

/** Shared Home card surface (every Home card uses the same fill, border, radius and padding). */
export function homeCard(colors: ColorTokens): ViewStyle {
  return {
    backgroundColor: colors.bgCard,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  };
}

/** Round 32pt close button pinned to a card's top-right corner. */
export const cardDismiss: ViewStyle = {
  position: 'absolute',
  top: spacing.sm,
  right: spacing.sm,
  width: 32,
  height: 32,
  borderRadius: radii.full,
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2,
};

export const pressedStyle: ViewStyle = { opacity: 0.75 };
