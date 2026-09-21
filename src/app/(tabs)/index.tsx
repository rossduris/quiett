import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { WeekStreakStrip } from '@/components/WeekStreakStrip';
import { colors, spacing, typography } from '@/constants/theme';
import { TAB_BAR_CLEARANCE } from '@/components/QuiettTabBar';
import {
  dayKey,
  loadAlarmPrefs,
  loadCompletedDays,
  loadStreak,
  saveAlarmPrefs,
  formatWeekdayHint,
  type AlarmPrefs,
  type StreakData,
  type Weekday,
  clearWakeResolved,
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

  const toggleWeekday = async (day: Weekday) => {
    const current = new Set(alarm.weekdays);
    if (current.has(day)) {
      if (current.size === 1) return;
      current.delete(day);
    } else {
      current.add(day);
    }
    const next = { ...alarm, weekdays: Array.from(current).sort((a, b) => a - b) as Weekday[] };
    await persistAlarm(next);
  };

  const streakSub =
    streak.lastCompletedDate === dayKey(0)
      ? 'Last sit today'
      : streak.count > 0
        ? 'Sit this morning to keep it'
        : 'Finish a sit to start your streak';

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
          <View style={styles.cardTop}>
            <Text style={styles.cardLabel}>Morning alarm</Text>
            <Pressable
              onPress={toggleEnabled}
              style={styles.switchRow}
              accessibilityRole="switch"
              accessibilityState={{ checked: alarm.enabled }}
            >
              <View style={[styles.switch, alarm.enabled && styles.switchOn]}>
                <View style={[styles.thumb, alarm.enabled && styles.thumbOn]} />
              </View>
            </Pressable>
          </View>

          <Pressable onPress={() => setShowPicker(true)} style={styles.timeHit}>
            <Text style={styles.time}>{displayTime(alarm.time)}</Text>
          </Pressable>
          <Text style={styles.hint}>Tap to change · {formatWeekdayHint(alarm.weekdays)}</Text>

          {showPicker && (
            <>
              <DateTimePicker
                value={parseTime(alarm.time)}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onValueChange={onTimeValueChange}
                onDismiss={() => setShowPicker(false)}
                themeVariant="dark"
              />
              <View style={styles.dayPills}>
                {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map((label, i) => {
                  const day = (i + 1) as Weekday;
                  const selected = alarm.weekdays.includes(day);
                  return (
                    <Pressable
                      key={day}
                      onPress={() => toggleWeekday(day)}
                      style={[styles.pill, selected && styles.pillSelected]}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {Platform.OS === 'ios' && (
                <PrimaryButton label="Done" variant="secondary" onPress={() => setShowPicker(false)} />
              )}
            </>
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
  switchRow: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  switch: {
    width: 51,
    height: 31,
    borderRadius: 16,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchOn: {
    backgroundColor: colors.calm,
  },
  thumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: colors.bg,
  },
  thumbOn: {
    alignSelf: 'flex-end',
  },
  timeHit: { paddingVertical: spacing.sm },
  time: { ...typography.hero, color: colors.text },
  hint: { color: colors.textMuted, fontSize: 13 },
  dayPills: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 44,
    alignItems: 'center',
  },
  pillSelected: {
    backgroundColor: colors.calm,
    borderColor: colors.calm,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  pillTextSelected: {
    color: colors.bg,
  },
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
