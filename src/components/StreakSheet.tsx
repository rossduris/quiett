import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WeekStreakStrip, weekDayKeys } from '@/components/WeekStreakStrip';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { longestScheduledStreak, nextStreakGoal } from '@/lib/streak-calendar';
import {
  getIsoWeekday,
  loadStreakDeadlinePrefs,
  nextAlarmDate,
  type AlarmPrefs,
  type StreakData,
  type StreakDeadlinePrefs,
  type Weekday,
} from '@/lib/storage';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Close the sheet and open the full history (Profile). Omit to hide the link (e.g. on Profile). */
  onSeeHistory?: () => void;
  streak: StreakData;
  completedDays: readonly string[];
  alarm: AlarmPrefs;
  unlockedToday: boolean;
  now: Date;
};

type StreakDue = {
  headline: string;
  detail: string;
  note?: string;
};

function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "Today" / "Tomorrow" / "Friday" relative to now. */
function dayWord(target: Date, now: Date): string {
  const diff = Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return target.toLocaleDateString(undefined, { weekday: 'long' });
}

/** Today's ring time, parsed the same way as nextAlarmDate in storage. */
function todayRingAt(time: string, now: Date): Date {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  const d = new Date(now);
  d.setHours(h || 7, m || 0, 0, 0);
  return d;
}

function deadlineFor(ring: Date, deadline: StreakDeadlinePrefs): Date {
  return new Date(ring.getTime() + deadline.minutes * 60_000);
}

function describeRing(ring: Date, deadline: StreakDeadlinePrefs): string {
  const base = `Alarm at ${formatClock(ring)}`;
  if (!deadline.enabled) return base;
  return `${base} · unlock by ${formatClock(deadlineFor(ring, deadline))} to count`;
}

/**
 * When the next streak-counting morning is due. Mirrors recordSuccessfulSit:
 * scheduled weekdays only, and the optional streak deadline (minutes after the ring).
 */
function getStreakDue(
  alarm: AlarmPrefs,
  deadline: StreakDeadlinePrefs,
  unlockedToday: boolean,
  hasStreak: boolean,
  now: Date,
): StreakDue {
  if (!alarm.enabled) {
    return {
      headline: 'Alarm off',
      detail: 'Turn it on from Home so your next morning counts.',
    };
  }
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const noneScheduled: StreakDue = {
    headline: 'No mornings scheduled',
    detail: 'Pick your alarm days on Home.',
  };

  if (unlockedToday) {
    const next = nextAlarmDate(alarm.time, alarm.weekdays, endOfToday);
    if (!next) return noneScheduled;
    return {
      headline: dayWord(next, now),
      detail: describeRing(next, deadline),
      note: "Today's morning is done.",
    };
  }

  if (alarm.weekdays.includes(getIsoWeekday(now))) {
    const ring = todayRingAt(alarm.time, now);
    if (now.getTime() < ring.getTime()) {
      return { headline: 'This morning', detail: describeRing(ring, deadline) };
    }
    if (!deadline.enabled) {
      return {
        headline: 'Today',
        detail: hasStreak
          ? "Finish today's morning to keep it going."
          : "Finish today's morning to start your streak.",
      };
    }
    const cutoff = deadlineFor(ring, deadline);
    if (now.getTime() <= cutoff.getTime()) {
      return { headline: 'Now', detail: `Unlock by ${formatClock(cutoff)} to count` };
    }
    const next = nextAlarmDate(alarm.time, alarm.weekdays, endOfToday);
    if (!next) return noneScheduled;
    return {
      headline: dayWord(next, now),
      detail: describeRing(next, deadline),
      note: "This morning's window has passed.",
    };
  }

  const next = nextAlarmDate(alarm.time, alarm.weekdays, now);
  if (!next) return noneScheduled;
  return { headline: dayWord(next, now), detail: describeRing(next, deadline) };
}

export function StreakSheet({
  visible,
  onClose,
  onSeeHistory,
  streak,
  completedDays,
  alarm,
  unlockedToday,
  now,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [deadline, setDeadline] = useState<StreakDeadlinePrefs>({ enabled: false, minutes: 30 });

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void loadStreakDeadlinePrefs().then((prefs) => {
      if (alive) setDeadline(prefs);
    });
    return () => {
      alive = false;
    };
  }, [visible]);

  const count = streak.count;
  const hasStreak = count > 0;
  const best = useMemo(
    () => Math.max(longestScheduledStreak(completedDays, alarm.weekdays), count),
    [completedDays, alarm.weekdays, count],
  );
  const goal = nextStreakGoal(count);
  const due = getStreakDue(alarm, deadline, unlockedToday, hasStreak, now);

  const week = useMemo(() => {
    const keys = weekDayKeys(now);
    const done = new Set(completedDays);
    const scheduled = new Set(alarm.weekdays);
    let scheduledCount = 0;
    let doneCount = 0;
    keys.forEach((key, i) => {
      if (scheduled.has((i + 1) as Weekday)) {
        scheduledCount += 1;
        if (done.has(key)) doneCount += 1;
      }
    });
    return { scheduledCount, doneCount };
  }, [now, completedDays, alarm.weekdays]);

  const lead = hasStreak
    ? unlockedToday
      ? "Today's morning is done. Nicely kept."
      : 'Finish your next morning to add a day.'
    : 'Every streak starts with one morning. Finish your next one to light the flame.';

  const goalLabel = goal
    ? hasStreak
      ? `${goal.remaining} more ${goal.remaining === 1 ? 'morning' : 'mornings'} to ${goal.target}-day`
      : `${goal.remaining} mornings to your first ${goal.target}-day streak`
    : 'Every milestone reached. Beautiful consistency.';
  const goalProgress = goal ? Math.min(1, Math.max(0, count / goal.target)) : 1;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetEyebrow}>Streak</Text>
            <Text style={styles.sheetTitle}>{hasStreak ? 'Keep it lit' : 'Light the flame'}</Text>
            <Text style={styles.sheetLead}>{lead}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[styles.card, styles.heroCard, hasStreak && styles.heroCardLit]}
            accessible
            accessibilityLabel={`Current streak, ${count} ${count === 1 ? 'day' : 'days'}. Best streak, ${best} ${best === 1 ? 'day' : 'days'}.`}
          >
            <View style={styles.heroRow}>
              <Ionicons
                name={hasStreak ? 'flame' : 'flame-outline'}
                size={40}
                color={hasStreak ? colors.calm : colors.textDim}
              />
              <Text style={[styles.heroNum, !hasStreak && styles.heroNumEmpty]}>{count}</Text>
            </View>
            <Text style={styles.heroLabel}>day streak</Text>
            <View style={styles.bestPill}>
              <Ionicons name="trophy-outline" size={14} color={colors.textMuted} />
              <Text style={styles.bestText}>
                Best · {best} {best === 1 ? 'day' : 'days'}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardLabel}>This week</Text>
              <Text style={styles.cardMeta}>
                {week.doneCount} of {week.scheduledCount} mornings
              </Text>
            </View>
            <WeekStreakStrip completedDays={completedDays} scheduledWeekdays={alarm.weekdays} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>{hasStreak ? 'Streak due' : 'Your next morning'}</Text>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="alarm-outline" size={20} color={colors.calm} />
              </View>
              <View style={styles.infoBody}>
                {due.note ? <Text style={styles.infoNote}>{due.note}</Text> : null}
                <Text style={styles.infoTitle}>{due.headline}</Text>
                <Text style={styles.infoText}>{due.detail}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Next milestone</Text>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="flag-outline" size={20} color={colors.calm} />
              </View>
              <View style={styles.infoBody}>
                <Text style={styles.infoTitle}>{goalLabel}</Text>
                {goal ? (
                  <View
                    style={styles.progressTrack}
                    accessibilityRole="progressbar"
                    accessibilityValue={{ min: 0, max: goal.target, now: count }}
                  >
                    <View style={[styles.progressFill, { width: `${goalProgress * 100}%` }]} />
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {onSeeHistory ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="See full history"
            accessibilityHint="Opens your Profile with calendar and past mornings"
            onPress={onSeeHistory}
            style={({ pressed }) => [styles.historyLink, pressed && styles.pressed]}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.calm} />
            <Text style={styles.historyText}>See full history</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.calm} />
          </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    sheet: { flex: 1, backgroundColor: colors.bg },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    sheetEyebrow: {
      color: colors.calm,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    sheetTitle: { ...typography.title, color: colors.text, fontSize: 24 },
    sheetLead: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 4 },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
    },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.md,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardLabel: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    cardMeta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
    heroCard: {
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.lg,
    },
    heroCardLit: {
      backgroundColor: colors.calmSoft,
      borderColor: colors.calm,
    },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    heroNum: { ...typography.heroSm, color: colors.calm, fontSize: 56 },
    heroNumEmpty: { color: colors.textDim },
    heroLabel: { color: colors.textMuted, fontSize: 15, fontWeight: '500' },
    bestPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.sm,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radii.full,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bestText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    infoIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.calmSoft,
    },
    infoBody: { flex: 1, gap: 2 },
    infoNote: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
    infoTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
    infoText: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginTop: spacing.sm,
    },
    progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.calm },
    historyLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    historyText: { color: colors.calm, fontSize: 15, fontWeight: '700' },
    pressed: { opacity: 0.8 },
  });
}
