import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme-provider';
import { THEMES, type ColorTokens, type ThemeId } from '@/constants/themes';
import { radii, spacing, typography } from '@/constants/theme';
import { hapticSelect } from '@/lib/haptics';

type Props = {
  label?: string;
};

export function ThemePicker({ label = 'Appearance' }: Props) {
  const { themeId, setTheme, colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
                  <Ionicons name="checkmark" size={14} color={colors.bg} />
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
      backgroundColor: colors.calm,
    },
    pressed: { opacity: 0.75 },
  });
}
