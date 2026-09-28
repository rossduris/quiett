import { useMemo, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useThemeColors } from '@/lib/theme-provider';
import { createSettingsStyles } from './settings-styles';

type Props = {
  label?: string;
  /** Optional control on the label row (e.g. a switch). */
  right?: ReactNode;
  children?: ReactNode;
};

export function SettingsCard({ label, right, children }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      {label ? (
        <View style={styles.cardTop}>
          <Text style={styles.cardLabel} accessibilityRole="header">
            {label}
          </Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}
