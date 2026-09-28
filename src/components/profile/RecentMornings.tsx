import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { createProfileStyles } from './profile-styles';

const INITIAL = 10;
const PAGE = 30;

type Props = {
  /** Completed day keys, newest first. */
  days: readonly string[];
  unlockTimes: Record<string, number>;
  intentionsByDay: Record<string, string>;
};

function formatDay(key: string): string {
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function RecentMornings({ days, unlockTimes, intentionsByDay }: Props) {
  const colors = useThemeColors();
  const shared = useMemo(() => createProfileStyles(colors), [colors]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [limit, setLimit] = useState(INITIAL);
  const visible = days.slice(0, limit);
  const remaining = days.length - visible.length;

  return (
    <View style={shared.card}>
      <Text style={shared.cardTitle} accessibilityRole="header">
        Recent mornings
      </Text>
      {days.length === 0 ? (
        <Text style={styles.empty}>Your first quiet morning will show up here.</Text>
      ) : (
        <View style={styles.list}>
          {visible.map((key) => {
            const stamp = unlockTimes[key];
            const intention = intentionsByDay[key];
            const tag = stamp != null ? `Unlocked ${formatTime(stamp)}` : 'Unlocked';
            return (
              <View
                key={key}
                style={styles.row}
                accessible
                accessibilityLabel={`${formatDay(key)}, ${tag}${intention ? `. Intention: ${intention}` : ''}`}
              >
                <View style={styles.dot} />
                <View style={styles.body}>
                  <View style={styles.top}>
                    <Text style={styles.date}>{formatDay(key)}</Text>
                    <Text style={styles.tag}>{tag}</Text>
                  </View>
                  {intention ? (
                    <Text style={styles.intention} numberOfLines={2}>
                      {`\u201C${intention}\u201D`}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
          {remaining > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Show ${Math.min(PAGE, remaining)} more mornings`}
              onPress={() => setLimit((n) => n + PAGE)}
              style={({ pressed }) => [styles.more, pressed && shared.pressed]}
            >
              <Text style={styles.moreText}>Show more</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    empty: { ...typography.body, fontSize: 14, lineHeight: 20, color: colors.textMuted },
    list: { gap: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs },
    dot: { width: 8, height: 8, borderRadius: radii.full, marginTop: 7, backgroundColor: colors.calm },
    body: { flex: 1, gap: spacing.xs / 2 },
    top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    date: { ...typography.body, flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' },
    tag: { ...typography.eyebrow, color: colors.textDim, fontWeight: '600', letterSpacing: 0.4 },
    intention: { ...typography.caption, color: colors.textMuted, lineHeight: 18, fontStyle: 'italic' },
    more: {
      alignSelf: 'center',
      marginTop: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
    },
    moreText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  });
}
