import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { DEFAULT_ALARM_SOUND_ID } from '@/constants/sounds';
import { DEFAULT_UNLOCK_TRACK_ID, type UnlockTrack } from '@/constants/unlock-tracks';
import { homeStatusMode, isUnlockedForToday } from '@/lib/home-status';
import { refreshClockPreference } from '@/lib/time-format';
import { syncEveningReminder } from '@/lib/notifications';
import { applyAlarmSoundChange, isLiveAlarmWakePending, openOsAlarmSettings, syncOsAlarm } from '@/lib/os-alarm';
import { stopPreview } from '@/lib/audio';
import {
  clearWakeResolved,
  dayKey,
  DEFAULT_ALARM,
  dismissDayOpenHeroToday,
  isDayOpenHeroDismissedToday,
  isWakeResolvedToday,
  loadAlarmPrefs,
  loadAlarmPrefsSavedAt,
  loadAlarmSoundId,
  loadCompletedDays,
  loadGetStartedDismissed,
  loadMorningLog,
  loadReliabilityCheckCompleted,
  loadStreak,
  loadSurpriseMe,
  loadTestMorningCompleted,
  loadUnlockTrackId,
  loadWakeIntention,
  loadWakeIntentionsByDay,
  nextAlarmDate,
  saveAlarmPrefs,
  saveAlarmSoundId,
  saveGetStartedDismissed,
  saveSurpriseMe,
  saveUnlockTrackId,
  type AlarmPrefs,
  type StreakData,
  type Weekday,
} from '@/lib/storage';

/** Bump when schedule semantics change (e.g. Stop → openApp) so Home force-resyncs once. */
const OS_ALARM_SCHEDULE_REV = 'stop-openApp-1';

/** Stable key for "has the OS alarm already been synced with these settings?" */
const syncKey = (a: AlarmPrefs, soundId: string) =>
  JSON.stringify([OS_ALARM_SCHEDULE_REV, a.time, a.enabled, a.weekdays, soundId]);

/**
 * All Home tab state + actions: storage loading on focus / foreground, Surprise me
 * (mode only), alarm persistence + OS sync. The screen and its cards stay presentational.
 */
export function useHomeState() {
  const [alarm, setAlarm] = useState<AlarmPrefs>(() => ({ ...DEFAULT_ALARM, weekdays: [...DEFAULT_ALARM.weekdays] }));
  const [alarmSavedAt, setAlarmSavedAt] = useState<number | null>(null);
  const [streak, setStreak] = useState<StreakData>({ count: 0, lastCompletedDate: null });
  const [completedDays, setCompletedDays] = useState<string[]>([]);
  const [wakeResolved, setWakeResolved] = useState(false);
  /** Stop/Settle-in/handoff/alerting/grace — suppress Missed chip. */
  const [liveWakePending, setLiveWakePending] = useState(false);
  const [dayOpenDismissed, setDayOpenDismissed] = useState(false);
  const [alarmSoundId, setAlarmSoundId] = useState(DEFAULT_ALARM_SOUND_ID);
  const [unlockTrackId, setUnlockTrackId] = useState(DEFAULT_UNLOCK_TRACK_ID);
  const [surpriseMe, setSurpriseMe] = useState(false);
  const [reliabilityChecked, setReliabilityChecked] = useState(false);
  const [getStartedDismissed, setGetStartedDismissed] = useState(false);
  const [wakeIntention, setWakeIntention] = useState('');
  const [testMorningDone, setTestMorningDone] = useState(false);
  /** Any real morning recorded yet (drives the first-day card). */
  const [hasAnyMorning, setHasAnyMorning] = useState(true);
  /** Today's unlock time from the morning log (null when unknown, e.g. an emergency end). */
  const [unlockAt, setUnlockAt] = useState<number | null>(null);
  /** The intention saved with today's morning (falls back to the current one). */
  const [todayIntention, setTodayIntention] = useState<string | null>(null);
  /** Refreshed on focus / foreground / local-day rollover (not every minute). */
  const [now, setNow] = useState(() => new Date());
  const [loaded, setLoaded] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  /** Bumps when picking a track turns Surprise me off (drives a brief note). */
  const [surpriseOffTick, setSurpriseOffTick] = useState(0);

  /** Morning log + per-day intention → first-day / unlocked-at state. */
  const loadMorningFacts = useCallback(async () => {
    const [log, intentions, days, s] = await Promise.all([loadMorningLog(), loadWakeIntentionsByDay(), loadCompletedDays(), loadStreak()]);
    const today = dayKey(0);
    setHasAnyMorning(Object.keys(log).length > 0 || days.length > 0 || s.count > 0);
    setUnlockAt(log[today]?.at ?? null);
    setTodayIntention(intentions[today] ?? null);
  }, []);

  const alarmSoundIdRef = useRef(alarmSoundId);
  useLayoutEffect(() => {
    alarmSoundIdRef.current = alarmSoundId;
  });
  const lastSynced = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [a, savedAt, s, days, resolved, unlockId, soundId, surprise, heroDismissed, reliabilityDone, getStartedDone, intention, testDone] =
          await Promise.all([
            loadAlarmPrefs(),
            loadAlarmPrefsSavedAt(),
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
        setAlarmSavedAt(savedAt);
        setStreak(s);
        setCompletedDays(days);
        setWakeResolved(resolved);
        setLiveWakePending(await isLiveAlarmWakePending(a));
        if (!alive) return;
        setDayOpenDismissed(heroDismissed);
        setAlarmSoundId(soundId);
        setSurpriseMe(surprise);
        setNow(new Date());
        setReliabilityChecked(reliabilityDone);
        setGetStartedDismissed(getStartedDone);
        setWakeIntention(intention);
        setTestMorningDone(testDone);
        setUnlockTrackId(unlockId);
        await loadMorningFacts();
        if (!alive) return;
        setLoaded(true);
        setFocusTick((t) => t + 1);
        // Re-sync the OS alarm only when the prefs or sound changed since the last sync
        // (first focus, or an edit made elsewhere such as onboarding / Settings).
        const key = syncKey(a, soundId);
        if (key !== lastSynced.current) {
          lastSynced.current = key;
          void syncOsAlarm(a);
        }
      })();
      return () => {
        alive = false;
        // Leaving Home (tab switch, Settings, session) ends any preview.
        stopPreview();
      };
    }, [loadMorningFacts]),
  );

  // Local-day / hour rollover while Home stays open (the minute countdown lives in AlarmCard).
  // Hourly granularity lets the evening prep card appear at 6 PM without a tab switch.
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNow((prev) => (dayKey(0, prev) === dayKey(0, d) && prev.getHours() === d.getHours() ? prev : d));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Re-derive the streak when the app returns to the foreground (e.g. the next day),
  // so a missed scheduled morning resets the pill without needing a tab switch.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      // The 12/24-hour switch may have changed while we were away.
      refreshClockPreference();
      void (async () => {
        const [s, days, resolved, prefs] = await Promise.all([
          loadStreak(),
          loadCompletedDays(),
          isWakeResolvedToday(),
          loadAlarmPrefs(),
        ]);
        setStreak(s);
        setCompletedDays(days);
        setWakeResolved(resolved);
        setLiveWakePending(await isLiveAlarmWakePending(prefs));
        await loadMorningFacts();
        setNow(new Date());
      })();
    });
    return () => sub.remove();
  }, [loadMorningFacts]);

  const unlockedToday = useMemo(
    () => isUnlockedForToday(streak, completedDays, wakeResolved, now),
    [streak, completedDays, wakeResolved, now],
  );

  const status = useMemo(
    () => homeStatusMode({ alarm, unlockedToday, dayOpenDismissed, hasAnyMorning, now }),
    [alarm, unlockedToday, dayOpenDismissed, hasAnyMorning, now],
  );

  const getStarted = {
    hasSetAlarm: alarm.enabled,
    reliabilityChecked,
    hasTriedTest: testMorningDone,
    hasIntention: wakeIntention.length > 0,
  };
  const getStartedProgress = Object.values(getStarted).filter(Boolean).length;
  const showGetStarted = !getStartedDismissed && getStartedProgress < 4;

  const dismissGetStarted = async () => {
    setGetStartedDismissed(true);
    await saveGetStartedDismissed(true);
  };

  const dismissDayOpen = async () => {
    setDayOpenDismissed(true);
    await dismissDayOpenHeroToday();
  };

  const selectUnlockTrack = async (track: UnlockTrack) => {
    const id = await saveUnlockTrackId(track.id);
    setUnlockTrackId(id);
    if (surpriseMe) {
      setSurpriseMe(false);
      setSurpriseOffTick((t) => t + 1);
      await saveSurpriseMe(false);
    }
    void syncEveningReminder();
  };

  const selectAlarmSound = async (id: string) => {
    setAlarmSoundId(id);
    await saveAlarmSoundId(id);
    lastSynced.current = syncKey(alarm, id);
    // New tone → reschedule the daily AlarmKit alarm (its bail backups reuse its sound) and
    // drop the bail carriers so they're rebuilt with it.
    void applyAlarmSoundChange(alarm);
  };

  const toggleSurprise = async () => {
    const next = !surpriseMe;
    // Mode only. A track is chosen when the morning meditation starts.
    setSurpriseMe(next);
    await saveSurpriseMe(next);
    void syncEveningReminder();
  };

  const persistAlarm = async (next: AlarmPrefs) => {
    setAlarm(next);
    await saveAlarmPrefs(next);
    setAlarmSavedAt(Date.now());
    // Only a ring still due later today re-locks the day (a second alarm needs its own morning).
    // Editing tomorrow's alarm after finishing this morning keeps today open.
    const nextRing = next.enabled ? nextAlarmDate(next.time, next.weekdays, new Date()) : null;
    if (nextRing && dayKey(0, nextRing) === dayKey(0)) {
      await clearWakeResolved();
      setWakeResolved(false);
    }
    lastSynced.current = syncKey(next, alarmSoundIdRef.current);
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

  const setAlarmTime = (hhmm: string) => persistAlarm({ ...alarm, time: hhmm });
  const toggleAlarmEnabled = () => persistAlarm({ ...alarm, enabled: !alarm.enabled });
  /** "No alarm set" → on (restores the default weekdays if none are picked). */
  const turnAlarmOn = () =>
    persistAlarm({ ...alarm, enabled: true, weekdays: alarm.weekdays.length ? alarm.weekdays : [...DEFAULT_ALARM.weekdays] });
  const toggleWeekday = async (day: Weekday) => {
    const current = new Set(alarm.weekdays);
    if (current.has(day)) {
      if (current.size === 1) return;
      current.delete(day);
    } else {
      current.add(day);
    }
    await persistAlarm({ ...alarm, weekdays: Array.from(current).sort((a, b) => a - b) as Weekday[] });
  };

  return {
    alarm,
    alarmSavedAt,
    streak,
    completedDays,
    now,
    unlockedToday,
    liveWakePending,
    showDayOpen: loaded && status.mode === 'unlocked',
    // Nothing until storage has loaded (avoids a flash of "No alarm set" from the defaults).
    statusMode: loaded ? status.mode : null,
    nextRing: status.nextRing,
    isEvening: status.evening,
    hasAnyMorning,
    unlockAt,
    todayIntention: todayIntention ?? wakeIntention,
    alarmSoundId,
    unlockTrackId,
    surpriseMe,
    surpriseOffTick,
    wakeIntention,
    getStarted,
    getStartedProgress,
    showGetStarted,
    showReliabilityCard: !reliabilityChecked && !showGetStarted,
    dismissGetStarted,
    dismissDayOpen,
    selectUnlockTrack,
    selectAlarmSound,
    toggleSurprise,
    setAlarmTime,
    toggleAlarmEnabled,
    turnAlarmOn,
    toggleWeekday,
  };
}
