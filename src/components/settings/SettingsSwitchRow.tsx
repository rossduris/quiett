import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { hapticSelect } from '@/lib/haptics';
import { DURATION, SPRING } from '@/lib/motion';
import { useReduceMotion } from '@/lib/use-reduce-motion';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { createSettingsStyles } from './settings-styles';
import { PressableScale } from '@/components/PressableScale';

/** Small visual switch (the Pressable around it owns the accessibility role). */
export function MiniSwitch({ on, size = 'md' }: { on: boolean; size?: 'md' | 'lg' }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createSwitchStyles(colors), [colors]);
  const reduce = useReduceMotion();
  const v = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    v.value = reduce ? withTiming(on ? 1 : 0, { duration: DURATION.fast }) : withSpring(on ? 1 : 0, SPRING);
  }, [on, reduce, v]);
  const lg = size === 'lg';
  const travel = lg ? 20 : 16;
  const off = colors.border;
  const onC = colors.calm;
  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(Math.min(1, Math.max(0, v.value)), [0, 1], [off, onC]),
  }));
  // Thumb slides 16pt and briefly stretches mid-travel, like the system switch.
  const thumb = useAnimatedStyle(() => {
    const mid = 1 - Math.abs(v.value * 2 - 1);
    return { transform: [{ translateX: travel * v.value }, { scaleX: reduce ? 1 : 1 + 0.18 * Math.max(0, mid) }] };
  });
  return (
    <Animated.View style={[styles.track, lg && styles.trackLg, track]}>
      <Animated.View style={[styles.thumb, lg && styles.thumbLg, thumb]} />
    </Animated.View>
  );
}

/** Standalone labelled switch (e.g. in a card header). */
export function SwitchButton({ on, label, onChange }: { on: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <Pressable
      onPress={() => {
        hapticSelect();
        onChange(!on);
      }}
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
    <PressableScale
      scaleTo={0.98}
      onPress={() => {
        hapticSelect();
        onChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={styles.row}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={colors.textMuted} />
        <Text style={styles.rowText}>{label}</Text>
      </View>
      <MiniSwitch on={value} />
    </PressableScale>
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
    thumb: { width: 22, height: 22, borderRadius: radii.full, backgroundColor: colors.bg },
    trackLg: { width: 51, height: 31 },
    thumbLg: { width: 27, height: 27 },
  });
}
