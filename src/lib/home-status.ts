import { dayKey, nextAlarmDate, type AlarmPrefs, type StreakData, type Weekday } from '@/lib/storage';

export type TodayStatus = 'locked_tonight' | 'unlocked_today' | 'missed_morning';

export type TodayStatusChip = {
  status: TodayStatus;
  label: string;
};

export type RingsCountdown = {
  /** Whole minutes remaining until next alarm fire. */
  totalMinutes: number;
  label: string;
  /** Absolute Date of next scheduled ring. */
  nextRingAt: Date;
};

function parseAlarmToday(hhmm: string, from: Date): Date {
  const [hRaw, mRaw] = hhmm.split(':');
  const h = parseInt(hRaw ?? '7', 10);
  const m = parseInt(mRaw ?? '0', 10);
  const d = new Date(from);
  d.setHours(Number.isFinite(h) ? h : 7, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

/** ISO weekday 1=Mon … 7=Sun matching AlarmPrefs.weekdays. */
function isoWeekday(d: Date): Weekday {
  const js = d.getDay(); // 0=Sun
  return (js === 0 ? 7 : js) as Weekday;
}

export function formatRingsCountdown(totalMinutes: number): string {
  const mins = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `Rings in ${m}m`;
  return `Rings in ${h}h ${m}m`;
}

export function getRingsCountdown(
  alarm: AlarmPrefs,
  unlockedToday: boolean,
  now: Date = new Date(),
): RingsCountdown | null {
  if (!alarm.enabled || unlockedToday) return null;
  const next = nextAlarmDate(alarm.time, alarm.weekdays, now);
  if (!next) return null;
  const totalMinutes = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 60_000));
  if (totalMinutes <= 0) return null;
  return {
    totalMinutes,
    label: formatRingsCountdown(totalMinutes),
    nextRingAt: next,
  };
}

export function isUnlockedForToday(
  streak: StreakData,
  completedDays: string[],
  wakeResolvedToday: boolean,
  now: Date = new Date(),
): boolean {
  const today = dayKey(0, now);
  if (wakeResolvedToday) return true;
  if (streak.lastCompletedDate === today) return true;
  if (completedDays.includes(today)) return true;
  return false;
}

/**
 * Derive the single Home status chip.
 * - Unlocked for today: wake resolved / morning completed today
 * - Missed this morning: alarm enabled, today is scheduled, today's ring passed, not unlocked
 * - Locked tonight: alarm enabled, still waiting on the next ring
 * Returns null when alarm is off and day is not unlocked (nothing to show).
 */
export function getTodayStatusChip(
  alarm: AlarmPrefs,
  unlockedToday: boolean,
  now: Date = new Date(),
): TodayStatusChip | null {
  if (unlockedToday) {
    return { status: 'unlocked_today', label: 'Unlocked for today' };
  }
  if (!alarm.enabled) return null;

  const todayScheduled = alarm.weekdays.includes(isoWeekday(now));
  const todayRing = parseAlarmToday(alarm.time, now);
  if (todayScheduled && now.getTime() >= todayRing.getTime()) {
    return { status: 'missed_morning', label: 'Missed this morning' };
  }
  return { status: 'locked_tonight', label: 'Locked tonight' };
}
