import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/lib/theme-provider';
import { THEMES, type ThemeId } from '@/constants/themes';
import { spacing } from '@/constants/theme';

type Props = {
  label?: string;
};

export function ThemePicker({ label = 'Appearance' }: Props) {
  const { themeId, setTheme, colors } = useTheme();

  const handlePress = async (id: ThemeId) => {
    await setTheme(id);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={styles.options}>
        {Object.values(THEMES).map((theme) => {
          const isActive = theme.id === themeId;
          return (
            <TouchableOpacity
              key={theme.id}
              style={[
                styles.option,
                {
                  backgroundColor: isActive ? colors.calmSoft : colors.bgCard,
                  borderColor: isActive ? colors.calm : colors.border,
                },
              ]}
              onPress={() => handlePress(theme.id)}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionLabel,
                    { color: isActive ? colors.text : colors.textMuted },
                  ]}
                >
                  {theme.name}
                </Text>
                {isActive && (
                  <View style={[styles.check, { backgroundColor: colors.calm }]}>
                    <Text style={styles.checkmark}>✓</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  options: {
    gap: spacing.xs,
  },
  option: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: spacing.md,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
