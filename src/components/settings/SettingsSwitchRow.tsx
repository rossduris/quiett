import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { createSettingsStyles } from './settings-styles';

/** Small visual switch (the Pressable around it owns the accessibility role). */
export function MiniSwitch({ on }: { on: boolean }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createSwitchStyles(colors), [colors]);
  return (
    <View style={[styles.track, on && styles.trackOn]}>
      <View style={[styles.thumb, on && styles.thumbOn]} />
    </View>
  );
}

/** Standalone labelled switch (e.g. in a card header). */
export function SwitchButton({ on, label, onChange }: { on: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onChange(!on)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      hitSlop={8}
      style={{ padding: spacing.xs }}
    >
      <MiniSwitch on={on} />
    </Pressable>
  );
}

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
};

export function SettingsSwitchRow({ icon, label, value, onChange }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={colors.text} />
        <Text style={styles.rowText}>{label}</Text>
      </View>
      <MiniSwitch on={value} />
    </Pressable>
  );
}

function createSwitchStyles(colors: ColorTokens) {
  return StyleSheet.create({
    track: {
      width: 42,
      height: 26,
      borderRadius: radii.full,
      backgroundColor: colors.border,
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    trackOn: { backgroundColor: colors.calm },
    thumb: { width: 22, height: 22, borderRadius: radii.full, backgroundColor: colors.bg },
    thumbOn: { alignSelf: 'flex-end' },
  });
}
