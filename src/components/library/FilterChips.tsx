import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { chip, chipActive, pressedStyle } from './library-styles';

type Item<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  items: readonly Item<T>[];
  activeId: T;
  onChange: (id: T) => void;
  /** Screen-reader prefix, e.g. "Show" → "Show Ambient". */
  a11yPrefix?: string;
};

/** Horizontal row of single-select chips (Library filters, dev voice picker). */
export function FilterChips<T extends string>({ items, activeId, onChange, a11yPrefix }: Props<T>) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={a11yPrefix ? `${a11yPrefix} ${item.label}` : item.label}
            accessibilityState={{ selected: active }}
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => onChange(item.id)}
            style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && pressedStyle]}
          >
            <Text style={[styles.text, active && styles.textActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
    chip: chip(colors),
    chipActive: chipActive(colors),
    text: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
    textActive: { color: colors.calm },
  });
}
