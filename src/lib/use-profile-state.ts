import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { isUnlockedForToday } from '@/lib/home-status';
import { loadLifetimeStats, type LifetimeStats } from '@/lib/lifetime-stats';
import { firstTrackedMonth } from '@/lib/streak-calendar';
import {
  DEFAULT_ALARM,
  SIGNED_OUT_ACCOUNT,
  isWakeResolvedToday,
  loadAccount,
  loadAlarmPrefs,
  loadCompletedDays,
  loadEarnedBadges,
  loadScheduleHistory,
  loadStreak,
  loadUnlockTimestamps,
  loadWakeIntentionsByDay,
  scheduleResolver,
  signInWithAppleStub,
  signOut,
  type AccountData,
  type AlarmPrefs,
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
  const [wakeResolved, setWakeResolved] = useState(false);
  const [earnedBadges, setEarnedBadges] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const focused = useRef(false);

  const load = useCallback(async (isAlive: () => boolean = () => true) => {
    // Streak first: loadLifetimeStats reads it too, so the reset (if any) happens once.
    const strk = await loadStreak();
    const [acct, days, alrm, sched, life, stamps, intentions, resolved, badges] = await Promise.all([
      loadAccount(),
      loadCompletedDays(),
      loadAlarmPrefs(),
      loadScheduleHistory(),
      loadLifetimeStats(),
      loadUnlockTimestamps(),
      loadWakeIntentionsByDay(),
      isWakeResolvedToday(),
      loadEarnedBadges(),
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
    setWakeResolved(resolved);
    setEarnedBadges(badges.length);
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
  const firstMonth = useMemo(() => firstTrackedMonth(completedDays), [completedDays]);
  const recentDays = useMemo(
    () => [...completedDays].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)),
    [completedDays],
  );
  // Stored lifetime values survive the 400-day history trim; never show less than we can see.
  const totalMornings = Math.max(lifetime.mornings, completedDays.length);
  const bestStreak = Math.max(lifetime.bestStreak, streak.count);
  const unlockedToday = isUnlockedForToday(streak, completedDays, wakeResolved, now);

  return {
    account,
    streak,
    completedDays,
    alarm,
    schedule,
    firstMonth,
    recentDays,
    unlockTimes,
    intentionsByDay,
    earnedBadges,
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
