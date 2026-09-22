import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { WeekStreakStrip } from '@/components/WeekStreakStrip';
import { colors, radii, spacing, typography } from '@/constants/theme';
import { TAB_BAR_CLEARANCE } from '@/components/QuiettTabBar';
import { AlarmSoundPicker } from '@/components/AlarmSoundPicker';
import { UnlockTrackPicker } from '@/components/UnlockTrackPicker';
import { alarmSoundById, DEFAULT_ALARM_SOUND_ID } from '@/constants/sounds';
import { kindLabel, unlockTrackById, type UnlockTrack } from '@/constants/unlock-tracks';
import {
  getRingsCountdown,
  getTodayStatusChip,
  isUnlockedForToday,
  type TodayStatus,
} from '@/lib/home-status';
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
  isWakeResolvedToday,
  loadUnlockTrackId,
  saveUnlockTrackId,
  loadAlarmSoundId,
  saveAlarmSoundId,
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

function chipTone(status: TodayStatus): string {
  switch (status) {
    case 'unlocked_today':
      return colors.calm;
    case 'missed_morning':
      return colors.warning;
    default:
      return colors.mist;
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [alarm, setAlarm] = useState<AlarmPrefs>({ time: '07:00', enabled: true, weekdays: [1, 2, 3, 4, 5] });
  const [streak, setStreak] = useState<StreakData>({ count: 0, lastCompletedDate: null });
  const [completedDays, setCompletedDays] = useState<string[]>([]);
  const [wakeResolved, setWakeResolved] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showMorningSoundPicker, setShowMorningSoundPicker] = useState(false);
  const [showAlarmSoundPicker, setShowAlarmSoundPicker] = useState(false);
  const [alarmSoundId, setAlarmSoundId] = useState(DEFAULT_ALARM_SOUND_ID);
  const [unlockTrackId, setUnlockTrackId] = useState(() => unlockTrackById('guided:first-light').id);
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [a, s, days, resolved, unlockId, soundId] = await Promise.all([
          loadAlarmPrefs(),
          loadStreak(),
          loadCompletedDays(),
          isWakeResolvedToday(),
          loadUnlockTrackId(),
          loadAlarmSoundId(),
        ]);
        if (!alive) return;
        setAlarm(a);
        setStreak(s);
        setCompletedDays(days);
        setWakeResolved(resolved);
        setUnlockTrackId(unlockId);
        setAlarmSoundId(soundId);
        setNow(new Date());
        // Reconcile native schedule (e.g. after rebuild / permission grant)
        void syncOsAlarm(a);
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  // Live countdown — 1-minute tick is enough for "Rings in Xh Ym"
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const unlockedToday = useMemo(
    () => isUnlockedForToday(streak, completedDays, wakeResolved, now),
    [streak, completedDays, wakeResolved, now],
  );

  const rings = useMemo(
    () => getRingsCountdown(alarm, unlockedToday, now),
    [alarm, unlockedToday, now],
  );

  const statusChip = useMemo(
    () => getTodayStatusChip(alarm, unlockedToday, now),
    [alarm, unlockedToday, now],
  );

  const unlockTrack = useMemo(() => unlockTrackById(unlockTrackId), [unlockTrackId]);
  const alarmSound = useMemo(() => alarmSoundById(alarmSoundId), [alarmSoundId]);

  const onSelectUnlockTrack = async (track: UnlockTrack) => {
    const id = await saveUnlockTrackId(track.id);
    setUnlockTrackId(id);
    setShowMorningSoundPicker(false);
  };

  const onSelectAlarmSound = async (id: string) => {
    setAlarmSoundId(id);
    await saveAlarmSoundId(id);
    // Keep native schedule aligned with prefs after tone change.
    void syncOsAlarm(alarm);
  };

  const persistAlarm = async (next: AlarmPrefs) => {
    setAlarm(next);
    await saveAlarmPrefs(next);
    // New / changed alarm after a finished morning must be allowed to force /session again.
    await clearWakeResolved();
    setWakeResolved(false);
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

  const streakSub = unlockedToday
    ? 'Morning complete'
    : streak.lastCompletedDate === dayKey(0)
      ? 'Last unlock today'
      : streak.count > 0
        ? 'Complete this morning to keep it'
        : 'Finish a morning meditation to start your streak';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.topBar}>
        <View style={styles.header}>
          <Text style={styles.brand}>Quiett</Text>
          <Text style={styles.tagline}>Stay still. Then the morning begins.</Text>
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

          <Pressable onPress={() => setShowPicker((open) => !open)} style={styles.timeHit}>
            <Text style={styles.time}>{displayTime(alarm.time)}</Text>
          </Pressable>
          <Text style={styles.hint}>Tap to change · {formatWeekdayHint(alarm.weekdays)}</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Alarm sound, ${alarmSound.label}`}
            onPress={() => setShowAlarmSoundPicker(true)}
            style={({ pressed }) => [styles.alarmSoundRow, pressed && styles.pressed]}
          >
            <View style={styles.alarmSoundLeft}>
              <Ionicons name="volume-medium-outline" size={16} color={colors.textDim} />
              <Text style={styles.alarmSoundLabel}>Alarm sound</Text>
            </View>
            <View style={styles.alarmSoundRight}>
              <Text style={styles.alarmSoundValue} numberOfLines={1}>
                {alarmSound.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
            </View>
          </Pressable>

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

          {rings ? (
            <View style={styles.ringsRow}>
              <Ionicons name="moon-outline" size={16} color={colors.mist} />
              <Text style={styles.ringsText}>{rings.label}</Text>
            </View>
          ) : null}

          {statusChip ? (
            <View
              style={[
                styles.statusChip,
                { borderColor: chipTone(statusChip.status) },
              ]}
            >
              <View
                style={[styles.statusDot, { backgroundColor: chipTone(statusChip.status) }]}
              />
              <Text style={[styles.statusLabel, { color: chipTone(statusChip.status) }]}>
                {statusChip.label}
              </Text>
            </View>
          ) : null}

          {unlockedToday ? (
            <View style={styles.dayOpenStrip}>
              <Text style={styles.dayOpenText}>Day open · streak {streak.count}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.streakCard}>
          <Text style={styles.streakNum}>{streak.count}</Text>
          <Text style={styles.streakLabel}>day streak</Text>
          <Text style={styles.streakSub}>{streakSub}</Text>
          <WeekStreakStrip completedDays={completedDays} scheduledWeekdays={alarm.weekdays} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose morning sound"
          onPress={() => setShowMorningSoundPicker(true)}
          style={({ pressed }) => [styles.unlockCard, pressed && styles.pressed]}
        >
          <View
            style={[
              styles.unlockArt,
              { backgroundColor: unlockTrack.accentSoft, borderColor: unlockTrack.accent },
            ]}
          >
            <Ionicons
              name={
                unlockTrack.kind === 'guided'
                  ? 'mic-outline'
                  : unlockTrack.kind === 'music'
                    ? 'musical-notes-outline'
                    : 'rainy-outline'
              }
              size={18}
              color={colors.text}
            />
          </View>
          <View style={styles.unlockBody}>
            <Text style={styles.unlockLabel}>Morning sound</Text>
            <Text style={styles.unlockTitle} numberOfLines={1}>
              {unlockTrack.title}
            </Text>
            <Text style={styles.unlockMeta}>
              {kindLabel(unlockTrack.kind)} · {unlockTrack.durationLabel}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
        </Pressable>
      </ScrollView>

      <UnlockTrackPicker
        visible={showMorningSoundPicker}
        selectedId={unlockTrackId}
        onClose={() => setShowMorningSoundPicker(false)}
        onSelect={(track) => void onSelectUnlockTrack(track)}
      />

      <AlarmSoundPicker
        visible={showAlarmSoundPicker}
        selectedId={alarmSoundId}
        onClose={() => setShowAlarmSoundPicker(false)}
        onSelect={(id) => void onSelectAlarmSound(id)}
      />
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
  ringsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ringsText: {
    color: colors.mist,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  statusChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(11,15,20,0.55)',
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dayOpenStrip: {
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.calmSoft,
    borderWidth: 1,
    borderColor: 'rgba(61,207,176,0.28)',
  },
  dayOpenText: {
    color: colors.calm,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
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
  alarmSoundRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alarmSoundLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  alarmSoundLabel: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  alarmSoundRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  alarmSoundValue: { color: colors.textMuted, fontSize: 13, fontWeight: '600', maxWidth: 140 },
  unlockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unlockArt: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  unlockBody: { flex: 1, gap: 2 },
  unlockLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  unlockTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  unlockMeta: { color: colors.textMuted, fontSize: 13 },
});
