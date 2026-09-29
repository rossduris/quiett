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

/** "Today", "Tomorrow", or a short weekday ("Mon") for a date relative to `now`. */
export function relativeDayLabel(date: Date, now: Date = new Date()): string {
  const key = dayKey(0, date);
  if (key === dayKey(0, now)) return 'Today';
  if (key === dayKey(1, now)) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'short' });
}

/**
 * Derive the single Home status chip (shown only while the day is still locked).
 * - Unlocked for today: wake resolved / morning completed today
 * - Missed this morning: alarm enabled, today is scheduled, today's ring passed, not unlocked,
 *   and that ring was due AFTER the alarm was last saved (so a new install or a fresh edit at
 *   10am never shows "missed" for a 7:00 ring that was never armed). `savedAt` null = legacy
 *   install without the timestamp, treated as saved long ago.
 * - Set for …: alarm enabled, still waiting on the next ring ("Set for tomorrow").
 * Returns null when alarm is off and day is not unlocked (nothing to show).
 */
export function getTodayStatusChip(
  alarm: AlarmPrefs,
  unlockedToday: boolean,
  now: Date = new Date(),
  savedAt: number | null = null,
): TodayStatusChip | null {
  if (unlockedToday) {
    return { status: 'unlocked_today', label: 'Unlocked for today' };
  }
  if (!alarm.enabled) return null;

  const todayScheduled = alarm.weekdays.includes(isoWeekday(now));
  const todayRing = parseAlarmToday(alarm.time, now);
  const ringWasArmed = savedAt == null || savedAt <= todayRing.getTime();
  if (todayScheduled && now.getTime() >= todayRing.getTime() && ringWasArmed) {
    return { status: 'missed_morning', label: 'Missed this morning' };
  }
  const next = nextAlarmDate(alarm.time, alarm.weekdays, now);
  const day = next ? relativeDayLabel(next, now) : null;
  return {
    status: 'locked_tonight',
    label: day ? `Set for ${day === 'Today' || day === 'Tomorrow' ? day.toLowerCase() : day}` : 'Alarm set',
  };
}

/** Local hour after which Home switches to the night-before prep card. */
export const EVENING_HOUR = 18;

export type HomeStatusMode = 'unlocked' | 'off' | 'firstDay' | 'evening';

/**
 * Which status card leads Home (null = none):
 * - off: alarm disabled or no days picked;
 * - unlocked: today is unlocked and the card isn't dismissed (yields to evening prep after 6 PM);
 * - firstDay: no morning recorded yet → "Your first morning is tomorrow at …";
 * - evening: after 6 PM with the next ring tomorrow → "Tomorrow, 7:00 AM" + prep tips.
 */
export function homeStatusMode(input: {
  alarm: AlarmPrefs;
  unlockedToday: boolean;
  dayOpenDismissed: boolean;
  hasAnyMorning: boolean;
  now: Date;
}): { mode: HomeStatusMode | null; nextRing: Date | null; evening: boolean } {
  const { alarm, unlockedToday, dayOpenDismissed, hasAnyMorning, now } = input;
  const armed = alarm.enabled && alarm.weekdays.length > 0;
  const nextRing = armed ? nextAlarmDate(alarm.time, alarm.weekdays, now) : null;
  const evening = !!nextRing && now.getHours() >= EVENING_HOUR && dayKey(0, nextRing) === dayKey(1, now);
  if (unlockedToday && !dayOpenDismissed && !evening) return { mode: 'unlocked', nextRing, evening };
  if (!armed || !nextRing) return { mode: 'off', nextRing: null, evening: false };
  if (!hasAnyMorning) return { mode: 'firstDay', nextRing, evening };
  if (evening) return { mode: 'evening', nextRing, evening };
  return { mode: null, nextRing, evening };
}

/** "tomorrow at 7:00 AM" / "today at 6:30 AM" / "on Monday at 7:00 AM" (lower-case day words). */
export function ringPhrase(next: Date, now: Date, clock: string): string {
  const key = dayKey(0, next);
  if (key === dayKey(0, now)) return `today at ${clock}`;
  if (key === dayKey(1, now)) return `tomorrow at ${clock}`;
  return `on ${next.toLocaleDateString([], { weekday: 'long' })} at ${clock}`;
}
