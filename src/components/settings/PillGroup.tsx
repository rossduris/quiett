import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { SpringPill } from '@/components/SpringPill';

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
          <SpringPill
            key={String(o.value)}
            selected={on}
            label={o.label}
            onPress={() => onSelect(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.accessibilityLabel ?? o.label}
            accessibilityState={{ checked: on }}
            style={styles.pill}
            selectedStyle={styles.pillOn}
            textStyle={styles.text}
            selectedTextStyle={styles.textOn}
          />
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
