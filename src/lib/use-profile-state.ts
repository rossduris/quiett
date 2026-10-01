import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { isUnlockedForToday } from '@/lib/home-status';
import { loadLifetimeStats, type LifetimeStats } from '@/lib/lifetime-stats';
import { firstTrackedMonth, longestScheduledStreak } from '@/lib/streak-calendar';
import { computeInsights, runEndingAt, visibleMornings } from '@/lib/profile-insights';
import { meditationSoundById } from '@/constants/sounds';
import {
  DEFAULT_ALARM,
  SIGNED_OUT_ACCOUNT,
  isWakeResolvedToday,
  loadAccount,
  loadAlarmPrefs,
  loadCompletedDays,
  loadEarnedBadges,
  loadMorningLog,
  loadScheduleHistory,
  loadStreak,
  loadUnlockTimestamps,
  loadWakeIntention,
  loadWakeIntentionsByDay,
  scheduleResolver,
  signInWithAppleStub,
  signOut,
  type AccountData,
  type AlarmPrefs,
  type BadgeId,
  type MorningLog,
  type ScheduleEntry,
  type StreakData,
} from '@/lib/storage';

/** All Profile data + derived values. Reloads on focus, and on foreground while focused. */
export function useProfileState() {
  const [account, setAccount] = useState<AccountData>({ ...SIGNED_OUT_ACCOUNT });
  const [streak, setStreak] = useState<StreakData>({ count: 0, lastCompletedDate: null });
  const [completedDays, setCompletedDays] = useState<string[]>([]);
  const [alarm, setAlarm] = useState<AlarmPrefs>(DEFAULT_ALARM);
  const [history, setHistory] = useState<ScheduleEntry[]>([{ from: '0000-01-01', weekdays: DEFAULT_ALARM.weekdays }]);
  const [lifetime, setLifetime] = useState<LifetimeStats>({ mornings: 0, bestStreak: 0 });
  const [unlockTimes, setUnlockTimes] = useState<Record<string, number>>({});
  const [intentionsByDay, setIntentionsByDay] = useState<Record<string, string>>({});
  const [wakeIntention, setWakeIntention] = useState('');
  const [wakeResolved, setWakeResolved] = useState(false);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<BadgeId[]>([]);
  const [morningLog, setMorningLog] = useState<MorningLog>({});
  const [now, setNow] = useState(() => new Date());
  const focused = useRef(false);

  const load = useCallback(async (isAlive: () => boolean = () => true) => {
    // Streak first: loadLifetimeStats reads it too, so the reset (if any) happens once.
    const strk = await loadStreak();
    const [acct, days, alrm, sched, life, stamps, intentions, resolved, badges, intention, log] = await Promise.all([
      loadAccount(),
      loadCompletedDays(),
      loadAlarmPrefs(),
      loadScheduleHistory(),
      loadLifetimeStats(),
      loadUnlockTimestamps(),
      loadWakeIntentionsByDay(),
      isWakeResolvedToday(),
      loadEarnedBadges(),
      loadWakeIntention(),
      loadMorningLog(),
    ]);
    if (!isAlive()) return;
    setAccount(acct);
    setStreak(strk);
    setCompletedDays(days);
    setAlarm(alrm);
    setHistory(sched);
    setLifetime(life);
    setUnlockTimes(Object.fromEntries(stamps.map((t) => [t.day, t.timestamp])));
    setIntentionsByDay(intentions);
    setWakeIntention(intention);
    setWakeResolved(resolved);
    setEarnedBadgeIds(badges);
    setMorningLog(log);
    setNow(new Date());
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      focused.current = true;
      void load(() => alive);
      return () => {
        alive = false;
        focused.current = false;
      };
    }, [load]),
  );

  // Foregrounding on a new day re-derives the streak (missed scheduled mornings reset it).
  // Only while Profile is the focused tab; otherwise the next focus reloads anyway.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && focused.current) void load();
    });
    return () => sub.remove();
  }, [load]);

  const onSignIn = useCallback(async () => setAccount(await signInWithAppleStub()), []);
  const onSignOut = useCallback(async () => setAccount(await signOut()), []);

  const schedule = useMemo(() => scheduleResolver(history), [history]);
  // Practice / dev-tool / evening-test runs stay out of history, the calendar and stats.
  const { visible: countedDays, hidden: hiddenDays } = useMemo(
    () => visibleMornings(completedDays, morningLog, unlockTimes),
    [completedDays, morningLog, unlockTimes],
  );
  const firstMonth = useMemo(() => firstTrackedMonth(countedDays), [countedDays]);
  const recentDays = useMemo(
    () => [...countedDays].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)),
    [countedDays],
  );
  // Stored lifetime values survive the 400-day history trim; never show less than we can see.
  // Hidden runs are subtracted (they were counted when recorded).
  const totalMornings = Math.max(lifetime.mornings - hiddenDays.length, countedDays.length);
  // With hidden runs in the history, recompute from counted mornings; otherwise trust the store.
  const displayStreak = useMemo(() => {
    if (hiddenDays.length === 0 || streak.count === 0) return streak.count;
    return Math.min(streak.count, runEndingAt(countedDays, schedule, streak.lastCompletedDate));
  }, [hiddenDays.length, streak, countedDays, schedule]);
  const bestStreak = useMemo(
    () =>
      hiddenDays.length === 0
        ? Math.max(lifetime.bestStreak, streak.count)
        : Math.max(longestScheduledStreak(countedDays, schedule), displayStreak),
    [hiddenDays.length, lifetime.bestStreak, streak.count, countedDays, schedule, displayStreak],
  );
  const unlockedToday = isUnlockedForToday(streak, completedDays, wakeResolved, now);
  const insights = useMemo(
    () =>
      computeInsights({
        visibleDays: countedDays,
        unlockTimes,
        log: morningLog,
        now,
        soundLabel: (id) => {
          const s = meditationSoundById(id);
          return s.id === id ? s.label : null;
        },
      }),
    [countedDays, unlockTimes, morningLog, now],
  );

  return {
    account,
    /** Streak engine value, with hidden test runs taken out for display. */
    streak: { ...streak, count: displayStreak },
    /** Counted mornings only (practice / dev / evening tests removed). */
    completedDays: countedDays,
    hiddenDays,
    alarm,
    schedule,
    firstMonth,
    recentDays,
    unlockTimes,
    intentionsByDay,
    wakeIntention,
    earnedBadges: earnedBadgeIds.length,
    earnedBadgeIds,
    insights,
    totalMornings,
    bestStreak,
    hasMornings: totalMornings > 0,
    unlockedToday,
    now,
    onSignIn,
    onSignOut,
  };
}

export type ProfileState = ReturnType<typeof useProfileState>;
