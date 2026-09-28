import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { groupJournal, type JournalEntry } from '@/lib/profile-insights';
import { useThemeColors } from '@/lib/theme-provider';
import { createProfileStyles } from './profile-styles';
import { SectionHeader } from './SectionHeader';

const INITIAL = 3;
const PAGE = 30;

type Props = {
  /** Counted day keys, newest first. */
  days: readonly string[];
  unlockTimes: Record<string, number>;
  intentionsByDay: Record<string, string>;
  onChangeIntention: () => void;
};

function formatDay(key: string): string {
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "8:02" + "AM" (split so the time can be large and the period small). */
function splitTime(ts: number): { time: string; period: string } {
  const s = new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const m = /^(.*?)\s*([AaPp]\.?[Mm]\.?)$/.exec(s);
  return m ? { time: m[1]!, period: m[2]!.toUpperCase() } : { time: s, period: '' };
}

/**
 * Recent mornings as a journal: unlock time large, the intention as a pull quote, and
 * consecutive mornings with the same intention collapsed under one quote ("3 mornings").
 */
export function MorningJournal({ days, unlockTimes, intentionsByDay, onChangeIntention }: Props) {
  const colors = useThemeColors();
  const shared = useMemo(() => createProfileStyles(colors), [colors]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [limit, setLimit] = useState(INITIAL);
  const expanded = limit > INITIAL;
  const entries: JournalEntry[] = useMemo(
    () => days.slice(0, limit).map((day) => ({ day, at: unlockTimes[day], intention: intentionsByDay[day] })),
    [days, limit, unlockTimes, intentionsByDay],
  );
  const groups = useMemo(() => groupJournal(entries), [entries]);
  const remaining = days.length - entries.length;

  return (
    <View style={shared.section}>
      <SectionHeader
        label="Recent mornings"
        action={{ label: 'Change intention', onPress: onChangeIntention, accessibilityLabel: 'Change your wake-up intention' }}
      />
      <View style={[shared.card, styles.card]}>
        {days.length === 0 ? (
          <Text style={styles.empty}>Your first quiet morning will show up here.</Text>
        ) : (
          groups.map((g, gi) => (
            <View key={`${g.entries[0]!.day}-${gi}`} style={styles.group}>
              {g.intention ? (
                <View
                  style={styles.quote}
                  accessible
                  accessibilityLabel={`Intention: ${g.intention}${g.entries.length > 1 ? `, ${g.entries.length} mornings` : ''}`}
                >
                  <View style={styles.quoteBar} />
                  <View style={styles.quoteBody}>
                    <Text style={styles.quoteText}>{`\u201C${g.intention}\u201D`}</Text>
                    {g.entries.length > 1 ? <Text style={styles.quoteMeta}>{`${g.entries.length} mornings`}</Text> : null}
                  </View>
                </View>
              ) : null}
              {g.entries.map((e) => {
                const t = e.at != null ? splitTime(e.at) : null;
                return (
                  <View
                    key={e.day}
                    style={styles.entry}
                    accessible
                    accessibilityLabel={`${formatDay(e.day)}, unlocked${t ? ` at ${t.time} ${t.period}` : ''}`}
                  >
                    <Text style={styles.time}>
                      {t ? t.time : '—'}
                      {t?.period ? <Text style={styles.period}>{` ${t.period}`}</Text> : null}
                    </Text>
                    <Text style={styles.date}>{formatDay(e.day)}</Text>
                  </View>
                );
              })}
            </View>
          ))
        )}
        {days.length > INITIAL ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={remaining > 0 ? (expanded ? `Show ${Math.min(PAGE, remaining)} more mornings` : `See all ${days.length} mornings`) : 'Show fewer mornings'}
            onPress={() => setLimit((n) => (remaining > 0 ? (expanded ? n + PAGE : Math.max(n, PAGE)) : INITIAL))}
            hitSlop={8}
            style={({ pressed }) => [styles.more, pressed && shared.pressed]}
          >
            <Text style={styles.moreText}>{remaining > 0 ? (expanded ? 'Show more' : `See all ${days.length}`) : 'Show less'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { gap: spacing.lg },
    empty: { ...typography.body, fontSize: 14, lineHeight: 20, color: colors.textMuted },
    group: { gap: spacing.sm },
    quote: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xs },
    quoteBar: { width: 3, borderRadius: 2, backgroundColor: colors.calm, opacity: 0.8 },
    quoteBody: { flex: 1, gap: 4 },
    quoteText: { fontSize: 19, lineHeight: 26, fontWeight: '400', fontStyle: 'italic', color: colors.text, letterSpacing: -0.2 },
    quoteMeta: { ...typography.eyebrow, fontSize: 10, color: colors.calm, letterSpacing: 1 },
    entry: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingLeft: spacing.md + 3 },
    time: { fontSize: 28, fontWeight: '300', letterSpacing: -0.8, color: colors.text, fontVariant: ['tabular-nums'] },
    period: { fontSize: 13, fontWeight: '600', letterSpacing: 0.4, color: colors.textMuted },
    date: { ...typography.caption, color: colors.textDim },
    more: {
      alignSelf: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.full,
      backgroundColor: colors.bg,
    },
    moreText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  });
}
