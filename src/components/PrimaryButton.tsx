import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { radii, spacing } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import Animated from 'react-native-reanimated';
import { hapticTap } from '@/lib/haptics';
import { usePressScale } from '@/lib/use-press-scale';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  style,
  disabled,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const press = usePressScale(0.97);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        if (variant === 'primary') hapticTap();
        onPress();
      }}
      onPressIn={press.handlers.onPressIn}
      onPressOut={press.handlers.onPressOut}
      style={style}
    >
      <Animated.View style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        press.style,
      ]}>
        <Text style={[styles.label, variant === 'primary' && styles.labelOnAccent]} maxFontSizeMultiplier={1.5}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  primary: { backgroundColor: colors.accentStrong },
  secondary: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.alarmSoft,
    borderWidth: 1,
    borderColor: colors.alarm,
  },
  ghost: { backgroundColor: 'transparent' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
  label: { color: colors.text, fontSize: 16, fontWeight: '600' },
  // Filled primary: always the theme's on-accent colour (was colors.text → near-black on peach).
  labelOnAccent: { color: colors.onAccent },
});
}
