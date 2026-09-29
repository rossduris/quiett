import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme-provider';
import { THEMES, type ColorTokens, type ThemeId } from '@/constants/themes';
import { radii, spacing, typography } from '@/constants/theme';
import { hapticSelect } from '@/lib/haptics';
import { PressableScale } from '@/components/PressableScale';

type Props = {
  label?: string;
  /** 'rows': edge-to-edge radio rows for a Settings card (the card supplies the label). */
  variant?: 'tiles' | 'rows';
};

export function ThemePicker({ label = 'Appearance', variant = 'tiles' }: Props) {
  const { themeId, setTheme, colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (variant === 'rows') {
    return (
      <View accessibilityRole="radiogroup" accessibilityLabel={label}>
        {Object.values(THEMES).map((theme) => {
          const isActive = theme.id === themeId;
          const t = theme.colors;
          return (
            <PressableScale
              key={theme.id}
              scaleTo={0.98}
              accessibilityRole="radio"
              accessibilityState={{ checked: isActive }}
              accessibilityLabel={theme.name}
              onPress={() => {
                hapticSelect();
                void setTheme(theme.id as ThemeId);
              }}
              style={styles.row}
            >
              {/* Tiny swatch of the theme itself (its own background + calm accent). */}
              <View style={[styles.swatch, { backgroundColor: t.bg, borderColor: t.border }]}>
                <View style={[styles.swatchDot, { backgroundColor: t.calm }]} />
              </View>
              <Text style={[styles.rowLabel, isActive && styles.optionLabelActive]}>{theme.name}</Text>
              {isActive ? (
                <View style={styles.check}>
                  <Ionicons name="checkmark" size={14} color={colors.onAccent} />
                </View>
              ) : (
                <View style={styles.checkEmpty} />
              )}
            </PressableScale>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label} accessibilityRole="header">
        {label}
      </Text>
      <View style={styles.options} accessibilityRole="radiogroup">
        {Object.values(THEMES).map((theme) => {
          const isActive = theme.id === themeId;
          return (
            <Pressable
              key={theme.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: isActive }}
              accessibilityLabel={theme.name}
              onPress={() => {
                hapticSelect();
                void setTheme(theme.id as ThemeId);
              }}
              style={({ pressed }) => [styles.option, isActive && styles.optionActive, pressed && styles.pressed]}
            >
              <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>{theme.name}</Text>
              {isActive ? (
                <View style={styles.check}>
                  <Ionicons name="checkmark" size={14} color={colors.onAccent} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { gap: spacing.sm },
    label: { ...typography.eyebrow, color: colors.textDim },
    options: { gap: spacing.xs },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: radii.md,
      borderWidth: 1.5,
      padding: spacing.md,
      backgroundColor: colors.bgElevated,
      borderColor: colors.border,
    },
    optionActive: { backgroundColor: colors.calmSoft, borderColor: colors.calm },
    optionLabel: { ...typography.body, fontWeight: '500', color: colors.textMuted },
    optionLabelActive: { color: colors.text },
    check: {
      width: 22,
      height: 22,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentStrong,
    },
    pressed: { opacity: 0.75 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 52,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    rowLabel: { ...typography.body, fontWeight: '500', color: colors.textMuted, flex: 1 },
    swatch: {
      width: 28,
      height: 28,
      borderRadius: radii.full,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatchDot: { width: 10, height: 10, borderRadius: radii.full },
    checkEmpty: { width: 22, height: 22, borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.border },
  });
}
