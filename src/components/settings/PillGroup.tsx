import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';

export type PillOption<T> = { value: T; label: string; accessibilityLabel?: string };

type Props<T> = {
  options: readonly PillOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
};

/** Single-choice pill row (radio semantics). */
export function PillGroup<T extends string | number>({ options, selected, onSelect }: Props<T>) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === selected;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onSelect(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.accessibilityLabel ?? o.label}
            accessibilityState={{ checked: on }}
            style={({ pressed }) => [styles.pill, on && styles.pillOn, pressed && styles.pressed]}
          >
            <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    pill: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: radii.full,
      borderWidth: 1,
      backgroundColor: colors.bgElevated,
      borderColor: colors.border,
    },
    pillOn: { backgroundColor: colors.calmSoft, borderColor: colors.calm },
    text: { ...typography.body, fontSize: 15, fontWeight: '600', color: colors.textMuted },
    textOn: { color: colors.calm },
    pressed: { opacity: 0.75 },
  });
}
