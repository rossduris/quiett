import { useMemo, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useThemeColors } from '@/lib/theme-provider';
import { createSettingsStyles } from './settings-styles';

type Props = {
  /** Uppercase eyebrow above the card. */
  label?: string;
  /** Optional trailing element on the eyebrow row. */
  right?: ReactNode;
  /** Small explanatory text under the card. */
  footnote?: string;
  children?: ReactNode;
};

/** Settings section: eyebrow label, borderless card of rows, optional footnote (Profile style). */
export function SettingsCard({ label, right, footnote, children }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      {label ? (
        <View style={styles.sectionHead}>
          <Text style={styles.eyebrow} accessibilityRole="header">
            {label}
          </Text>
          {right}
        </View>
      ) : null}
      <View style={styles.card}>
        <View style={styles.cardInner}>{children}</View>
      </View>
      {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
    </View>
  );
}
