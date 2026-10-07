import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';

export function LibraryHeader() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.header}>
      <Text style={styles.title} accessibilityRole="header">
        Library
      </Text>
      <Text style={styles.lead}>Choose what plays after you&apos;re still.</Text>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    header: { paddingHorizontal: spacing.lg, gap: spacing.xs, marginBottom: spacing.xs },
    title: { ...typography.title, color: colors.text },
    lead: { ...typography.body, color: colors.textMuted },
  });
}
