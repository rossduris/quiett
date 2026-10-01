import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { appVersionLabel } from '@/lib/app-version';

/** Muted version + build line at the bottom of Settings. Long-press to select and copy. */
export function AppVersionFooter() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const label = useMemo(() => appVersionLabel(), []);
  return (
    <Text style={styles.text} selectable accessibilityLabel={label.replace('(build', ', build').replace(')', '')}>
      {label}
    </Text>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    text: { ...typography.caption, color: colors.textDim, textAlign: 'center', marginTop: spacing.xs },
  });
}
