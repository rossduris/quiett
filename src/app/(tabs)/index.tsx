import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { LibraryTrackMark } from '@/components/LibraryTrackMark';
import { TrackCover } from '@/components/TrackCover';
import { useCoverStyle } from '@/lib/scene-cover-pref';
import { PrimaryButton } from '@/components/PrimaryButton';
import { WeekStreakStrip } from '@/components/WeekStreakStrip';
import { radii, spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';
import { usePremium } from '@/lib/premium-provider';
import { TAB_BAR_CLEARANCE } from '@/components/QuiettTabBar';
import { AlarmSoundPicker } from '@/components/AlarmSoundPicker';
import { UnlockTrackPicker } from '@/components/UnlockTrackPicker';
import { StreakSheet } from '@/components/StreakSheet';
import { alarmSoundById, DEFAULT_ALARM_SOUND_ID, meditationSoundById } from '@/constants/sounds';
import {
  kindLabel,
  pickSurpriseTrack,
  unlockTrackById,
  type UnlockTrack,
} from '@/constants/unlock-tracks';
import {
  getRingsCountdown,
  getTodayStatusChip,
  isUnlockedForToday,
  type TodayStatus,
} from '@/lib/home-status';
import {
  loadAlarmPrefs,
  loadCompletedDays,
  loadStreak,
  saveAlarmPrefs,
  formatWeekdayHint,
  type AlarmPrefs,
  type StreakData,
  type Weekday,
  clearWakeResolved,
  dismissDayOpenHeroToday,
  isDayOpenHeroDismissedToday,
  isWakeResolvedToday,
  loadUnlockTrackId,
  saveUnlockTrackId,
  loadAlarmSoundId,
  saveAlarmSoundId,
  dayKey,
  loadSurpriseMe,
  loadSurpriseTrackDate,
  saveSurpriseMe,
  saveSurpriseTrackDate,
  loadReliabilityCheckCompleted,
  loadGetStartedDismissed,
  saveGetStartedDismissed,
  loadWakeIntention,
  loadTestMorningCompleted,
} from '@/lib/storage';
import { previewIds, stopPreview, usePreviewPlayer } from '@/lib/audio';
import { openOsAlarmSettings, syncOsAlarm } from '@/lib/os-alarm';
import { syncEveningReminder } from '@/lib/notifications';
import type { ColorTokens } from '@/constants/themes';

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
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isPremium, trackResetVersion } = usePremium();
  const coverStyle = useCoverStyle();
  // The focus effect below is memoized once; read Premium through a ref so it is never stale.
  const isPremiumRef = useRef(isPremium);
  isPremiumRef.current = isPremium;

  const chipTone = (status: TodayStatus): string => {
    switch (status) {
      case 'unlocked_today':
        return colors.calm;
      case 'missed_morning':
        return colors.warning;
      default:
        return colors.mist;
    }
  };
  const [alarm, setAlarm] = useState<AlarmPrefs>({ time: '07:00', enabled: true, weekdays: [1, 2, 3, 4, 5] });
  const [streak, setStreak] = useState<StreakData>({ count: 0, lastCompletedDate: null });
  const [completedDays, setCompletedDays] = useState<string[]>([]);
  const [wakeResolved, setWakeResolved] = useState(false);
  const [dayOpenDismissed, setDayOpenDismissed] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showMeditationPicker, setShowMeditationPicker] = useState(false);
  const [showAlarmSoundPicker, setShowAlarmSoundPicker] = useState(false);
  const [showStreakSheet, setShowStreakSheet] = useState(false);
  const [alarmSoundId, setAlarmSoundId] = useState(DEFAULT_ALARM_SOUND_ID);
  const [unlockTrackId, setUnlockTrackId] = useState(() => unlockTrackById('guided:first-light').id);
  const [surpriseMe, setSurpriseMe] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [reliabilityChecked, setReliabilityChecked] = useState(false);
  const [getStartedDismissed, setGetStartedDismissed] = useState(false);
  const [wakeIntention, setWakeIntention] = useState('');
  const [testMorningDone, setTestMorningDone] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [a, s, days, resolved, unlockId, soundId, surprise, heroDismissed, reliabilityDone, getStartedDone, intention, testDone] = await Promise.all([
          loadAlarmPrefs(),
          loadStreak(),
          loadCompletedDays(),
          isWakeResolvedToday(),
          loadUnlockTrackId(),
          loadAlarmSoundId(),
          loadSurpriseMe(),
          isDayOpenHeroDismissedToday(),
          loadReliabilityCheckCompleted(),
          loadGetStartedDismissed(),
          loadWakeIntention(),
          loadTestMorningCompleted(),
        ]);
        if (!alive) return;
        setAlarm(a);
        setStreak(s);
        setCompletedDays(days);
        setWakeResolved(resolved);
        setDayOpenDismissed(heroDismissed);
        setAlarmSoundId(soundId);
        setSurpriseMe(surprise);
        setNow(new Date());
        setReliabilityChecked(reliabilityDone);
        setGetStartedDismissed(getStartedDone);
        setWakeIntention(intention);
        setTestMorningDone(testDone);

        // Surprise me rotates once per local day, not on every Home focus.
        let nextUnlock = unlockId;
        if (surprise && (await loadSurpriseTrackDate()) !== dayKey(0)) {
          const premium = isPremiumRef.current;
          const picked = pickSurpriseTrack(unlockId, premium);
          nextUnlock = await saveUnlockTrackId(picked.id, { premium });
          await saveSurpriseTrackDate();
        }
        setUnlockTrackId(nextUnlock);
        void syncOsAlarm(a);
      })();
      return () => {
        alive = false;
        // Leaving Home (tab switch, Settings, session) ends any preview.
        stopPreview();
      };
    }, []),
  );

  // Premium lapsed → the provider saved the default free track; reflect it here.
  useEffect(() => {
    if (trackResetVersion === 0) return;
    void loadUnlockTrackId().then(setUnlockTrackId);
  }, [trackResetVersion]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Re-derive the streak when the app returns to the foreground (e.g. the next day),
  // so a missed scheduled morning resets the pill without needing a tab switch.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void (async () => {
        const [s, days, resolved] = await Promise.all([
          loadStreak(),
          loadCompletedDays(),
          isWakeResolvedToday(),
        ]);
        setStreak(s);
        setCompletedDays(days);
        setWakeResolved(resolved);
        setNow(new Date());
      })();
    });
    return () => sub.remove();
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
  const showDayOpenHero = unlockedToday && !dayOpenDismissed;

  const hasSetAlarm = alarm.enabled;
  const hasTriedTest = testMorningDone;
  const hasIntention = wakeIntention.length > 0;
  const getStartedProgress = [hasSetAlarm, reliabilityChecked, hasTriedTest, hasIntention].filter(Boolean).length;
  const showGetStarted = !getStartedDismissed && getStartedProgress < 4;
  const showReliabilityCard = !reliabilityChecked && !showGetStarted;

  const onDismissGetStarted = async () => {
    setGetStartedDismissed(true);
    await saveGetStartedDismissed(true);
  };

  const onDismissDayOpen = async () => {
    setDayOpenDismissed(true);
    await dismissDayOpenHeroToday();
  };

  const onSelectUnlockTrack = async (track: UnlockTrack) => {
    const id = await saveUnlockTrackId(track.id, { premium: isPremium });
    setUnlockTrackId(id);
    if (surpriseMe) {
      setSurpriseMe(false);
      await saveSurpriseMe(false);
    }
    setShowMeditationPicker(false);
    void syncEveningReminder();
  };

  const onSelectAlarmSound = async (id: string) => {
    setAlarmSoundId(id);
    await saveAlarmSoundId(id);
    void syncOsAlarm(alarm);
  };

  const alarmPreviewUrl = alarmSound.url;
  const meditationPreviewUrl = unlockTrack.locked && !isPremium
    ? null
    : meditationSoundById(unlockTrack.playbackSoundId).url;

  const preview = usePreviewPlayer();
  const alarmPreviewId = previewIds.alarm(alarmSound.id);
  const meditationPreviewId = previewIds.track(unlockTrack.id);
  const alarmPlaying = preview.playingId === alarmPreviewId;
  const meditationPlaying = preview.playingId === meditationPreviewId;

  /** Play/stop toggle for either step (one preview at a time, app-wide). */
  const onPreview = (which: 'alarm' | 'meditation') => {
    if (which === 'alarm') {
      if (alarmPreviewUrl != null) preview.toggle(alarmPreviewId, alarmPreviewUrl, 'alarm');
    } else if (meditationPreviewUrl != null) {
      preview.toggle(meditationPreviewId, meditationPreviewUrl, 'track');
    }
  };

  const onToggleSurprise = async () => {
    const next = !surpriseMe;
    setSurpriseMe(next);
    await saveSurpriseMe(next);
    if (next) {
      const picked = pickSurpriseTrack(unlockTrackId, isPremium);
      const id = await saveUnlockTrackId(picked.id, { premium: isPremium });
      await saveSurpriseTrackDate();
      setUnlockTrackId(id);
    }
  };

  const persistAlarm = async (next: AlarmPrefs) => {
    setAlarm(next);
    await saveAlarmPrefs(next);
    await clearWakeResolved();
    setWakeResolved(false);
    const result = await syncOsAlarm(next);
    void syncEveningReminder();
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

  const onTimeValueChange = async (_event: unknown, date?: Date) => {
    if (!date) return;
    if (Platform.OS === 'android') setShowPicker(false);
    await persistAlarm({ ...alarm, time: toHhMm(date) });
  };

  const toggleEnabled = async () => {
    await persistAlarm({ ...alarm, enabled: !alarm.enabled });
  };

  const toggleWeekday = async (day: Weekday) => {
    const current = new Set(alarm.weekdays);
    if (current.has(day)) {
      if (current.size === 1) return;
      current.delete(day);
    } else {
      current.add(day);
    }
    await persistAlarm({
      ...alarm,
      weekdays: Array.from(current).sort((a, b) => a - b) as Weekday[],
    });
  };

  const tagline = unlockedToday
    ? `Day open · streak ${streak.count}`
    : 'Stay still. Then the morning begins.';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.topBar}>
        <View style={styles.header}>
          <Text style={styles.brand}>Quiett</Text>
          <Text style={[styles.tagline, unlockedToday && styles.taglineOpen]}>{tagline}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Streak, ${streak.count} ${streak.count === 1 ? 'day' : 'days'}. Opens streak details`}
          hitSlop={8}
          onPress={() => setShowStreakSheet(true)}
          style={({ pressed }) => [
            styles.streakPill,
            streak.count === 0 && styles.streakPillEmpty,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name={streak.count > 0 ? 'flame' : 'flame-outline'}
            size={18}
            color={streak.count > 0 ? colors.calm : colors.textDim}
          />
          <Text style={[styles.streakPillText, streak.count === 0 && styles.streakPillTextEmpty]}>
            {streak.count}
          </Text>
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
        {showDayOpenHero ? (
          <View style={styles.dayOpenHero}>
            <Pressable
              onPress={() => void onDismissDayOpen()}
              style={styles.dayOpenDismiss}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Dismiss morning unlocked"
            >
              <Ionicons name="close" size={20} color={colors.textDim} />
            </Pressable>
            <Ionicons name="sunny-outline" size={28} color={colors.calm} />
            <Text style={styles.dayOpenTitle}>Morning unlocked</Text>
            <Text style={styles.dayOpenBody}>
              Your day is open. Alarm prep for tomorrow stays below when you need it.
            </Text>
            {wakeIntention && (
              <View style={styles.intentionPill}>
                <Ionicons name="bulb-outline" size={14} color={colors.calm} />
                <Text style={styles.intentionText}>{wakeIntention}</Text>
              </View>
            )}
            {statusChip ? (
              <View style={[styles.statusChip, { borderColor: chipTone(statusChip.status) }]}>
                <View style={[styles.statusDot, { backgroundColor: chipTone(statusChip.status) }]} />
                <Text style={[styles.statusLabel, { color: chipTone(statusChip.status) }]}>
                  {statusChip.label}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {showGetStarted && (
          <View style={styles.getStartedCard}>
            <Pressable
              onPress={() => void onDismissGetStarted()}
              style={styles.getStartedDismiss}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Dismiss get started"
            >
              <Ionicons name="close" size={20} color={colors.textDim} />
            </Pressable>
            <View style={styles.getStartedTop}>
              <Ionicons name="flag-outline" size={24} color={colors.calm} />
              <View style={styles.getStartedTitleRow}>
                <Text style={styles.getStartedTitle}>Get started</Text>
                <Text style={styles.getStartedProgress}>{getStartedProgress}/4</Text>
              </View>
            </View>
            <View style={styles.getStartedList}>
              <Pressable
                onPress={() => setShowPicker(true)}
                style={({ pressed }) => [
                  styles.getStartedRow,
                  hasSetAlarm && styles.getStartedRowDone,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <View style={[styles.getStartedCheck, hasSetAlarm && styles.getStartedCheckDone]}>
                  {hasSetAlarm && <Ionicons name="checkmark" size={14} color={colors.bg} />}
                </View>
                <Text style={[styles.getStartedText, hasSetAlarm && styles.getStartedTextDone]}>
                  Set your alarm
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/reliability-check')}
                style={({ pressed }) => [
                  styles.getStartedRow,
                  reliabilityChecked && styles.getStartedRowDone,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <View style={[styles.getStartedCheck, reliabilityChecked && styles.getStartedCheckDone]}>
                  {reliabilityChecked && <Ionicons name="checkmark" size={14} color={colors.bg} />}
                </View>
                <Text style={[styles.getStartedText, reliabilityChecked && styles.getStartedTextDone]}>
                  Make sure it can wake you
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/test-morning')}
                style={({ pressed }) => [
                  styles.getStartedRow,
                  hasTriedTest && styles.getStartedRowDone,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <View style={[styles.getStartedCheck, hasTriedTest && styles.getStartedCheckDone]}>
                  {hasTriedTest && <Ionicons name="checkmark" size={14} color={colors.bg} />}
                </View>
                <Text style={[styles.getStartedText, hasTriedTest && styles.getStartedTextDone]}>
                  Try a test morning
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/wake-intention')}
                style={({ pressed }) => [
                  styles.getStartedRow,
                  hasIntention && styles.getStartedRowDone,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <View style={[styles.getStartedCheck, hasIntention && styles.getStartedCheckDone]}>
                  {hasIntention && <Ionicons name="checkmark" size={14} color={colors.bg} />}
                </View>
                <Text style={[styles.getStartedText, hasIntention && styles.getStartedTextDone]}>
                  Set your intention
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {showReliabilityCard && (
          <Pressable
            onPress={() => router.push('/reliability-check')}
            style={({ pressed }) => [styles.reliabilityCard, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <View style={styles.reliabilityIcon}>
              <Ionicons name="alarm-outline" size={20} color={colors.calm} />
            </View>
            <View style={styles.reliabilityBody}>
              <Text style={styles.reliabilityTitle}>Check your alarm reliability</Text>
              <Text style={styles.reliabilityText}>
                Three iPhone settings that matter for waking up
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </Pressable>
        )}

        <View style={[styles.card, styles.heroCard, unlockedToday && styles.cardDimmed]}>
          {!unlockedToday ? (
            <>
              <View pointerEvents="none" style={styles.sunriseWashTop} />
              <View pointerEvents="none" style={styles.sunriseWashEdge} />
            </>
          ) : null}
          <View style={styles.cardTop}>
            <Text style={styles.cardLabel}>
              {unlockedToday ? 'Tomorrow alarm' : 'Morning alarm'}
            </Text>
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

          {!unlockedToday && rings ? (
            <View style={styles.ringsRow}>
              <Ionicons name="sunny-outline" size={18} color={colors.sunrise} />
              <Text style={styles.ringsText}>{rings.label}</Text>
            </View>
          ) : null}

          <Text style={styles.hint}>Tap time to change · {formatWeekdayHint(alarm.weekdays)}</Text>

          {showPicker && (
            <>
              <View style={styles.timePickerWrap}>
                <DateTimePicker
                  value={parseTime(alarm.time)}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                  // Morning alarms: always show 12-hour clock with AM/PM.
                  locale="en_US"
                  is24Hour={false}
                  minuteInterval={1}
                  onValueChange={onTimeValueChange}
                  onDismiss={() => setShowPicker(false)}
                  themeVariant={colors.statusBarStyle === 'dark' ? 'light' : 'dark'}
                  textColor={colors.text}
                />
              </View>
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

          {!unlockedToday && statusChip && statusChip.status !== 'unlocked_today' ? (
            <View style={[styles.statusChip, { borderColor: chipTone(statusChip.status) }]}>
              <View style={[styles.statusDot, { backgroundColor: chipTone(statusChip.status) }]} />
              <Text style={[styles.statusLabel, { color: chipTone(statusChip.status) }]}>
                {statusChip.label}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.morningCard, unlockedToday && styles.cardDimmed]}>
          <Text style={styles.cardLabel}>Your morning</Text>

          <View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Step 1, wake-up alarm: ${alarmSound.label}. Rings until you're still.`}
              accessibilityHint="Choose your wake-up alarm"
              onPress={() => setShowAlarmSoundPicker(true)}
              style={({ pressed }) => [styles.stepRow, pressed && styles.pressed]}
            >
              <View style={styles.stepArtWrap}>
                <View style={[styles.stepArt, styles.stepArtAlarm]}>
                  <Ionicons name="alarm-outline" size={24} color={colors.sunrise} />
                </View>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>1</Text>
                </View>
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepEyebrow}>Wake-up alarm</Text>
                <Text style={styles.stepTitle} numberOfLines={1}>
                  {alarmSound.label}
                </Text>
                <Text style={styles.stepMeta} numberOfLines={1}>
                  Rings until you're still
                </Text>
              </View>
              {alarmPreviewUrl != null ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={alarmPlaying ? 'Stop preview' : `Preview ${alarmSound.label}`}
                  accessibilityState={{ selected: alarmPlaying }}
                  hitSlop={8}
                  onPress={() => onPreview('alarm')}
                  style={({ pressed }) => [
                    styles.previewBtn,
                    alarmPlaying && styles.previewBtnActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={alarmPlaying ? 'stop' : 'play'}
                    size={14}
                    color={alarmPlaying ? colors.calm : colors.text}
                  />
                </Pressable>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
            </Pressable>

            <View style={styles.stepConnector} />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Step 2, meditation: ${unlockTrack.title}. ${kindLabel(unlockTrack.kind)}, 2 minutes${surpriseMe ? ', rotating' : ''}.`}
              accessibilityHint="Choose your meditation"
              onPress={() => setShowMeditationPicker(true)}
              style={({ pressed }) => [styles.stepRow, pressed && styles.pressed]}
            >
              <View style={styles.stepArtWrap}>
                {coverStyle !== 'classic' ? (
                  <View style={[styles.stepArt, { borderColor: colors.border }]}>
                    <TrackCover trackId={unlockTrack.id} size={46} radius={13} />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.stepArt,
                      { backgroundColor: unlockTrack.accentSoft, borderColor: unlockTrack.accent },
                    ]}
                  >
                    <LibraryTrackMark
                      trackId={unlockTrack.id}
                      kind={unlockTrack.kind}
                      color={unlockTrack.accent}
                      size={30}
                    />
                  </View>
                )}
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>2</Text>
                </View>
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepEyebrow}>Meditation</Text>
                <Text style={styles.stepTitle} numberOfLines={1}>
                  {unlockTrack.title}
                </Text>
                <Text style={styles.stepMeta} numberOfLines={1}>
                  {kindLabel(unlockTrack.kind)}
                  {surpriseMe ? ' · rotating' : ''}
                  {' · 2 min'}
                </Text>
              </View>
              {meditationPreviewUrl != null ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={meditationPlaying ? 'Stop preview' : `Preview ${unlockTrack.title}`}
                  accessibilityState={{ selected: meditationPlaying }}
                  hitSlop={8}
                  onPress={() => onPreview('meditation')}
                  style={({ pressed }) => [
                    styles.previewBtn,
                    meditationPlaying && styles.previewBtnActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={meditationPlaying ? 'stop' : 'play'}
                    size={14}
                    color={meditationPlaying ? colors.calm : colors.text}
                  />
                </Pressable>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
            </Pressable>
          </View>

          <View style={styles.surpriseRow}>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Surprise me"
              accessibilityHint="Picks a different meditation each morning"
              accessibilityState={{ checked: surpriseMe }}
              onPress={() => void onToggleSurprise()}
              style={({ pressed }) => [styles.surprisePill, surpriseMe && styles.surprisePillOn, pressed && styles.pressed]}
            >
              <Ionicons
                name="shuffle-outline"
                size={14}
                color={surpriseMe ? colors.calm : colors.textDim}
              />
              <Text style={[styles.surpriseText, surpriseMe && styles.surpriseTextOn]}>
                Surprise me
              </Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="This week's mornings"
          accessibilityHint="Opens streak details"
          onPress={() => setShowStreakSheet(true)}
          style={({ pressed }) => [
            styles.streakCard,
            unlockedToday && styles.streakCardOpen,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.streakCardTop}>
            <Text style={styles.cardLabel}>This week</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          </View>
          <WeekStreakStrip completedDays={completedDays} scheduledWeekdays={alarm.weekdays} />
        </Pressable>
      </ScrollView>

      <UnlockTrackPicker
        visible={showMeditationPicker}
        selectedId={unlockTrackId}
        onClose={() => setShowMeditationPicker(false)}
        onSelect={(track) => void onSelectUnlockTrack(track)}
      />

      <AlarmSoundPicker
        visible={showAlarmSoundPicker}
        selectedId={alarmSoundId}
        onClose={() => setShowAlarmSoundPicker(false)}
        onSelect={(id) => void onSelectAlarmSound(id)}
      />

      <StreakSheet
        visible={showStreakSheet}
        onClose={() => setShowStreakSheet(false)}
        onSeeHistory={() => {
          setShowStreakSheet(false);
          router.push('/profile');
        }}
        streak={streak}
        completedDays={completedDays}
        alarm={alarm}
        unlockedToday={unlockedToday}
        now={now}
      />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  header: { flex: 1, gap: spacing.xs },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.calmSoft,
    marginTop: 4,
  },
  streakPillEmpty: { backgroundColor: colors.bgCard },
  streakPillText: { color: colors.calm, fontSize: 16, fontWeight: '700' },
  streakPillTextEmpty: { color: colors.textDim },
  brand: { ...typography.title, color: colors.text },
  tagline: { ...typography.body, color: colors.textMuted },
  taglineOpen: { color: colors.calm, fontWeight: '600' },
  pressed: { opacity: 0.75 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  dayOpenHero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.calmSoft,
    borderWidth: 1,
    borderColor: colors.calm,
    position: 'relative',
  },
  dayOpenDismiss: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  dayOpenTitle: { color: colors.calm, fontSize: 22, fontWeight: '700' },
  dayOpenBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  intentionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.calm,
    marginTop: spacing.xs,
  },
  intentionText: {
    color: colors.calm,
    fontSize: 13,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  getStartedCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    position: 'relative',
  },
  getStartedDismiss: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  getStartedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  getStartedTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  getStartedTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  getStartedProgress: {
    color: colors.calm,
    fontSize: 16,
    fontWeight: '700',
  },
  getStartedList: {
    gap: spacing.sm,
  },
  getStartedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  getStartedRowDone: {
    opacity: 0.6,
  },
  getStartedCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedCheckDone: {
    backgroundColor: colors.calm,
    borderColor: colors.calm,
  },
  getStartedText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  getStartedTextDone: {
    color: colors.textMuted,
  },
  reliabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reliabilityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.calmSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reliabilityBody: {
    flex: 1,
    gap: 2,
  },
  reliabilityTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  reliabilityText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  heroCard: {
    paddingVertical: spacing.xl,
    overflow: 'hidden',
  },
  sunriseWashTop: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 220,
    height: 160,
    borderRadius: 110,
    backgroundColor: colors.sunriseDeep,
    opacity: 0.55,
  },
  sunriseWashEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: colors.sunriseSoft,
    opacity: 0.7,
  },
  cardDimmed: { opacity: 0.88 },
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
  switchRow: { paddingVertical: 4, paddingHorizontal: 4 },
  switch: {
    width: 51,
    height: 31,
    borderRadius: 16,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchOn: { backgroundColor: colors.calm },
  thumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: colors.bg,
  },
  thumbOn: { alignSelf: 'flex-end' },
  timeHit: { paddingVertical: spacing.sm },
  timePickerWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingVertical: spacing.sm,
  },
  time: { ...typography.hero, color: colors.text, fontSize: 72 },
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
  pillSelected: { backgroundColor: colors.calm, borderColor: colors.calm },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  pillTextSelected: { color: colors.bg },
  ringsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.sunriseSoft,
    borderWidth: 1,
    borderColor: 'rgba(232,160,106,0.28)',
  },
  ringsText: {
    color: colors.sunrise,
    fontSize: 17,
    fontWeight: '700',
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
  morningCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepArtWrap: { width: 48, height: 48 },
  stepArt: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  stepArtAlarm: {
    backgroundColor: colors.sunriseSoft,
    borderColor: colors.sunrise,
  },
  stepBadge: {
    position: 'absolute',
    left: -6,
    bottom: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.calm,
    borderWidth: 2,
    borderColor: colors.bgCard,
  },
  stepBadgeText: { color: colors.bg, fontSize: 11, fontWeight: '800' },
  stepBody: { flex: 1, gap: 1 },
  stepEyebrow: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  stepTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  stepMeta: { color: colors.textMuted, fontSize: 13 },
  stepConnector: {
    width: 2,
    height: 18,
    borderRadius: 1,
    marginLeft: 23,
    marginVertical: 6,
    backgroundColor: colors.border,
  },
  previewBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewBtnActive: {
    backgroundColor: colors.calmSoft,
    borderColor: colors.calm,
  },
  surpriseRow: {
    flexDirection: 'row',
    paddingLeft: 48 + spacing.md,
  },
  surprisePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  surprisePillOn: {
    backgroundColor: colors.calmSoft,
    borderColor: colors.calm,
  },
  surpriseText: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  surpriseTextOn: { color: colors.calm },
  streakCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  streakCardOpen: {
    borderColor: colors.calm,
  },
  streakCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
}
