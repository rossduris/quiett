import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/lib/theme-provider';
import { createSettingsStyles } from './settings-styles';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** Optional right-side value (e.g. "Active"). */
  value?: string;
  valueColor?: string;
  /** 'link' rows open outside the app and show an external icon. */
  kind?: 'button' | 'link';
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function SettingsLinkRow({
  icon,
  label,
  onPress,
  value,
  valueColor,
  kind = 'button',
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={kind}
      accessibilityLabel={accessibilityLabel ?? (value ? `${label}, ${value}` : label)}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={colors.text} />
        <Text style={styles.rowText}>{label}</Text>
      </View>
      {value ? <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]}>{value}</Text> : null}
      <Ionicons
        name={kind === 'link' ? 'open-outline' : 'chevron-forward'}
        size={kind === 'link' ? 18 : 20}
        color={colors.textDim}
      />
    </Pressable>
  );
}
