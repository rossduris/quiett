import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { DEFAULT_ALARM_SOUND_ID } from '@/constants/sounds';
import { DEFAULT_UNLOCK_TRACK_ID, pickSurpriseTrack, type UnlockTrack } from '@/constants/unlock-tracks';
import { showGuided } from '@/lib/dev-flags';
import { isUnlockedForToday } from '@/lib/home-status';
import { syncEveningReminder } from '@/lib/notifications';
import { openOsAlarmSettings, syncOsAlarm } from '@/lib/os-alarm';
import { stopPreview } from '@/lib/audio';
import { usePremium } from '@/lib/premium-provider';
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
  loadReliabilityCheckCompleted,
  loadStreak,
  loadSurpriseMe,
  loadSurpriseTrackDate,
  loadTestMorningCompleted,
  loadUnlockTrackId,
  loadWakeIntention,
  nextAlarmDate,
  saveAlarmPrefs,
  saveAlarmSoundId,
  saveGetStartedDismissed,
  saveSurpriseMe,
  saveSurpriseTrackDate,
  saveUnlockTrackId,
  type AlarmPrefs,
  type StreakData,
  type Weekday,
} from '@/lib/storage';

/** Stable key for "has the OS alarm already been synced with these settings?" */
const syncKey = (a: AlarmPrefs, soundId: string) => JSON.stringify([a.time, a.enabled, a.weekdays, soundId]);

/**
 * All Home tab state + actions: storage loading on focus / foreground, the daily Surprise me
 * rotation, alarm persistence + OS sync. The screen and its cards stay presentational.
 */
export function useHomeState() {
  const { isPremium, loading: premiumLoading, trackResetVersion } = usePremium();
  // Async callbacks read Premium through a ref so they are never stale.
  const isPremiumRef = useRef(isPremium);
  isPremiumRef.current = isPremium;

  const [alarm, setAlarm] = useState<AlarmPrefs>(() => ({ ...DEFAULT_ALARM, weekdays: [...DEFAULT_ALARM.weekdays] }));
  const [alarmSavedAt, setAlarmSavedAt] = useState<number | null>(null);
  const [streak, setStreak] = useState<StreakData>({ count: 0, lastCompletedDate: null });
  const [completedDays, setCompletedDays] = useState<string[]>([]);
  const [wakeResolved, setWakeResolved] = useState(false);
  const [dayOpenDismissed, setDayOpenDismissed] = useState(false);
  const [alarmSoundId, setAlarmSoundId] = useState(DEFAULT_ALARM_SOUND_ID);
  const [unlockTrackId, setUnlockTrackId] = useState(DEFAULT_UNLOCK_TRACK_ID);
  const [surpriseMe, setSurpriseMe] = useState(false);
  const [reliabilityChecked, setReliabilityChecked] = useState(false);
  const [getStartedDismissed, setGetStartedDismissed] = useState(false);
  const [wakeIntention, setWakeIntention] = useState('');
  const [testMorningDone, setTestMorningDone] = useState(false);
  /** Refreshed on focus / foreground / local-day rollover (not every minute). */
  const [now, setNow] = useState(() => new Date());
  const [loaded, setLoaded] = useState(false);
  const [focusTick, setFocusTick] = useState(0);

  const alarmSoundIdRef = useRef(alarmSoundId);
  alarmSoundIdRef.current = alarmSoundId;
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
        setDayOpenDismissed(heroDismissed);
        setAlarmSoundId(soundId);
        setSurpriseMe(surprise);
        setNow(new Date());
        setReliabilityChecked(reliabilityDone);
        setGetStartedDismissed(getStartedDone);
        setWakeIntention(intention);
        setTestMorningDone(testDone);
        setUnlockTrackId(unlockId);
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
    }, []),
  );

  // Surprise me rotates once per local day. Waits for Premium to settle so a paying user is
  // never rotated onto the free-only pool during a cold start.
  const rotating = useRef(false);
  useEffect(() => {
    if (!loaded || premiumLoading || !surpriseMe || rotating.current) return;
    rotating.current = true;
    void (async () => {
      try {
        if ((await loadSurpriseTrackDate()) === dayKey(0)) return;
        const premium = isPremiumRef.current;
        const current = await loadUnlockTrackId();
        const picked = pickSurpriseTrack(current, premium, showGuided());
        const id = await saveUnlockTrackId(picked.id, { premium });
        await saveSurpriseTrackDate();
        setUnlockTrackId(id);
      } finally {
        rotating.current = false;
      }
    })();
  }, [loaded, premiumLoading, surpriseMe, focusTick]);

  // Premium lapsed → the provider saved the default free track; reflect it here.
  useEffect(() => {
    if (trackResetVersion === 0) return;
    void loadUnlockTrackId().then(setUnlockTrackId);
  }, [trackResetVersion]);

  // Local-day rollover while Home stays open (the minute countdown lives in AlarmCard).
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNow((prev) => (dayKey(0, prev) === dayKey(0, d) ? prev : d));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Re-derive the streak when the app returns to the foreground (e.g. the next day),
  // so a missed scheduled morning resets the pill without needing a tab switch.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void (async () => {
        const [s, days, resolved] = await Promise.all([loadStreak(), loadCompletedDays(), isWakeResolvedToday()]);
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
    const id = await saveUnlockTrackId(track.id, { premium: isPremium });
    setUnlockTrackId(id);
    if (surpriseMe) {
      setSurpriseMe(false);
      await saveSurpriseMe(false);
    }
    void syncEveningReminder();
  };

  const selectAlarmSound = async (id: string) => {
    setAlarmSoundId(id);
    await saveAlarmSoundId(id);
    lastSynced.current = syncKey(alarm, id);
    void syncOsAlarm(alarm);
  };

  const toggleSurprise = async () => {
    const next = !surpriseMe;
    if (next) {
      // Pick + stamp today's date before flipping the flag so the daily rotation doesn't re-pick.
      const picked = pickSurpriseTrack(unlockTrackId, isPremium, showGuided());
      const id = await saveUnlockTrackId(picked.id, { premium: isPremium });
      await saveSurpriseTrackDate();
      setUnlockTrackId(id);
    }
    setSurpriseMe(next);
    await saveSurpriseMe(next);
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
    isPremium,
    alarm,
    alarmSavedAt,
    streak,
    completedDays,
    now,
    unlockedToday,
    showDayOpen: unlockedToday && !dayOpenDismissed,
    alarmSoundId,
    unlockTrackId,
    surpriseMe,
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
    toggleWeekday,
  };
}
