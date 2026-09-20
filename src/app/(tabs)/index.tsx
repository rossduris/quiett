import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { WeekStreakStrip } from '@/components/WeekStreakStrip';
import { colors, radii, spacing, typography } from '@/constants/theme';
import { TAB_BAR_CLEARANCE } from '@/components/QuiettTabBar';
import {
  dayKey,
  loadAlarmPrefs,
  loadCompletedDays,
  loadStreak,
  saveAlarmPrefs,
  type AlarmPrefs,
  type AlarmWeekday,
  type StreakData,
  clearWakeResolved,
  isoWeekday,
  isScheduledDay,
} from '@/lib/storage';
import { openOsAlarmSettings, syncOsAlarm } from '@/lib/os-alarm';

function parseTime(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(h || 7, m || 0, 0, 0);
  return d;
}

function toHhMm(d: Date): string {
  return `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
}

function displayTime(hhmm: string): string {
  return parseTime(hhmm).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const WEEKDAY_VALUES: AlarmWeekday[] = [1, 2, 3, 4, 5, 6, 7];

/** Format weekdays for hint text. */
function formatWeekdaysHint(weekdays: readonly AlarmWeekday[]): string {
  const sorted = [...weekdays].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Every day';
  if (sorted.length === 5 && sorted[0] === 1 && sorted[4] === 5) return 'Weekdays only';
  if (sorted.length === 2 && sorted[0] === 6 && sorted[1] === 7) return 'Weekends only';
  const labels = sorted.map((w) => WEEKDAY_LABELS[w - 1]);
  return labels.join(' · ');
}

/** Compute next alarm date that falls on a scheduled weekday. */
function nextAlarmDate(time: string, weekdays: readonly AlarmWeekday[]): Date | null {
  if (weekdays.length === 0) return null;
  const parsed = parseTime(time);
  const now = new Date();
  let candidate = new Date(parsed);
  candidate.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
  
  if (candidate <= now) {
    candidate.setDate(candidate.getDate() + 1);
  }
  
  for (let i = 0; i < 8; i++) {
    if (isScheduledDay(candidate, weekdays)) {
      return candidate;
    }
    candidate.setDate(candidate.getDate() + 1);
  }
  
  return null;
}

/** Format countdown string for next alarm. */
function formatNextAlarm(time: string, weekdays: readonly AlarmWeekday[]): string {
  const next = nextAlarmDate(time, weekdays);
  if (!next) return '';
  
  const now = new Date();
  const msUntil = next.getTime() - now.getTime();
  const hoursUntil = Math.floor(msUntil / (1000 * 60 * 60));
  const minutesUntil = Math.floor((msUntil % (1000 * 60 * 60)) / (1000 * 60));
  
  const today = isoWeekday(now);
  const nextDay = isoWeekday(next);
  const isTomorrow = nextDay === (today % 7) + 1;
  const isToday = nextDay === today;
  
  if (isToday && hoursUntil < 24) {
    if (hoursUntil > 0) return `Rings in ${hoursUntil}h ${minutesUntil}m`;
    return `Rings in ${minutesUntil}m`;
  }
  
  if (isTomorrow) return 'Rings tomorrow';
  
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return `Rings ${dayNames[nextDay - 1]}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [alarm, setAlarm] = useState<AlarmPrefs>({ time: '07:00', enabled: true, weekdays: [1, 2, 3, 4, 5] });
  const [streak, setStreak] = useState<StreakData>({ count: 0, lastCompletedDate: null });
  const [completedDays, setCompletedDays] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [a, s, days] = await Promise.all([
          loadAlarmPrefs(),
          loadStreak(),
          loadCompletedDays(),
        ]);
        if (!alive) return;
        setAlarm(a);
        setStreak(s);
        setCompletedDays(days);
        // Reconcile native schedule (e.g. after rebuild / permission grant)
        void syncOsAlarm(a);
      })();
      return () => {
        alive = false;
      };
    }, []),
  );


  const persistAlarm = async (next: AlarmPrefs) => {
    setAlarm(next);
    await saveAlarmPrefs(next);
    // New / changed alarm after a finished sit must be allowed to force /session again.
    await clearWakeResolved();
    const result = await syncOsAlarm(next);
    if (!result.ok && next.enabled) {
      Alert.alert(
        'Alarm permission needed',
        result.message,
        result.reason === 'denied'
          ? [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => void openOsAlarmSettings() },
            ]
          : [{ text: 'OK' }],
      );
    }
  };

  const onTimeValueChange = async (_event: unknown, date: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    const next = { ...alarm, time: toHhMm(date) };
    await persistAlarm(next);
  };

  const toggleEnabled = async () => {
    const next = { ...alarm, enabled: !alarm.enabled };
    await persistAlarm(next);
  };

  const toggleWeekday = async (day: AlarmWeekday) => {
    const current = new Set(alarm.weekdays);
    
    if (current.has(day)) {
      if (current.size === 1) {
        return;
      }
      current.delete(day);
    } else {
      current.add(day);
    }
    
    const next = { ...alarm, weekdays: Array.from(current).sort((a, b) => a - b) };
    await persistAlarm(next);
  };

  const streakSub =
    streak.lastCompletedDate === dayKey(0)
      ? 'Last sit today'
      : streak.count > 0
        ? 'Sit this morning to keep it'
        : 'Finish a sit to start your streak';

  const nextAlarmHint = alarm.enabled ? formatNextAlarm(alarm.time, alarm.weekdays) : '';
  const weekdaysHint = formatWeekdaysHint(alarm.weekdays);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.topBar}>
        <View style={styles.header}>
          <Text style={styles.brand}>Quiett</Text>
          <Text style={styles.tagline}>Sit still. Then the morning begins.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.gearBtn, pressed && styles.pressed]}
          hitSlop={12}
        >
          <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Morning alarm</Text>
            <Pressable
              onPress={toggleEnabled}
              style={({ pressed }) => [
                styles.statusChip,
                alarm.enabled && styles.statusChipOn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={alarm.enabled ? 'Alarm on, tap to turn off' : 'Alarm off, tap to turn on'}
            >
              <Text style={[styles.statusText, alarm.enabled && styles.statusTextOn]}>
                {alarm.enabled ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
          </View>
          
          <Pressable onPress={() => setShowPicker(true)} style={styles.timeHit}>
            <Text style={styles.time}>{displayTime(alarm.time)}</Text>
          </Pressable>
          
          <View style={styles.weekdayRow}>
            {WEEKDAY_VALUES.map((day, i) => {
              const selected = alarm.weekdays.includes(day);
              return (
                <Pressable
                  key={day}
                  onPress={() => void toggleWeekday(day)}
                  style={({ pressed }) => [
                    styles.dayPill,
                    selected && styles.dayPillSelected,
                    pressed && styles.dayPillPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${WEEKDAY_LABELS[i]}, ${selected ? 'selected' : 'not selected'}`}
                >
                  <Text style={[styles.dayLabel, selected && styles.dayLabelSelected]}>
                    {WEEKDAY_LABELS[i]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          
          <Text style={styles.hint}>
            {weekdaysHint}
            {nextAlarmHint ? ` · ${nextAlarmHint}` : ''}
          </Text>

          {showPicker && (
            <DateTimePicker
              value={parseTime(alarm.time)}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={onTimeValueChange}
              onDismiss={() => setShowPicker(false)}
              themeVariant="dark"
            />
          )}
          {Platform.OS === 'ios' && showPicker && (
            <PrimaryButton label="Done" variant="secondary" onPress={() => setShowPicker(false)} />
          )}

          {!alarm.enabled && (
            <PrimaryButton
              label="Turn alarm on"
              variant="primary"
              onPress={toggleEnabled}
              style={{ marginTop: spacing.md }}
            />
          )}
        </View>

        <View style={styles.streakCard}>
          <Text style={styles.streakNum}>{streak.count}</Text>
          <Text style={styles.streakLabel}>day streak</Text>
          <Text style={styles.streakSub}>{streakSub}</Text>
          <WeekStreakStrip completedDays={completedDays} scheduledWeekdays={alarm.weekdays} />
        </View>

        <PrimaryButton label="Start demo session" onPress={() => router.push('/session')} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  header: { flex: 1, gap: spacing.xs },
  brand: { ...typography.title, color: colors.text },
  tagline: { ...typography.body, color: colors.textMuted },
  gearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.75 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardHeader: {
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
  statusChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusChipOn: {
    backgroundColor: colors.calmSoft,
    borderColor: colors.calm,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusTextOn: {
    color: colors.calm,
  },
  timeHit: { paddingVertical: spacing.sm },
  time: { ...typography.hero, color: colors.text },
  weekdayRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  dayPill: {
    flex: 1,
    height: 28,
    borderRadius: radii.sm - 2,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillSelected: {
    backgroundColor: colors.calm,
    borderColor: colors.calm,
  },
  dayPillPressed: {
    opacity: 0.75,
  },
  dayLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  dayLabelSelected: {
    color: colors.bg,
    fontWeight: '700',
  },
  hint: { color: colors.textMuted, fontSize: 13 },
  streakCard: {
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  streakNum: { fontSize: 56, fontWeight: '200', color: colors.calm },
  streakLabel: { color: colors.textMuted, fontSize: 16 },
  streakSub: {
    color: colors.textDim,
    fontSize: 13,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
});
