import {
  dayKey,
  displayWeekdayIndex,
  getIsoWeekday,
  type ScheduleResolver,
  type Weekday,
} from '@/lib/storage';

/** A fixed weekday list, or a resolver over the schedule history (see `scheduleResolver`). */
export type Schedule = readonly Weekday[] | ScheduleResolver;

function toResolver(schedule: Schedule): ScheduleResolver {
  if (typeof schedule === 'function') return schedule;
  const set: ReadonlySet<Weekday> = new Set(schedule);
  return () => set;
}

const STREAK_GOALS = [3, 7, 14, 21, 30, 60, 100] as const;

export type CalendarCell = {
  key: string;
  day: number;
  completed: boolean;
  isToday: boolean;
  scheduled: boolean;
  isFuture: boolean;
  missed: boolean;
};

export type MonthGrid = {
  year: number;
  month: number;
  title: string;
  leadingBlanks: number;
  cells: CalendarCell[];
};

export type NextStreakGoal = {
  target: number;
  remaining: number;
  label: string;
};


/** Locale month title, e.g. "September 2026". */
export function monthTitle(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Locale spoken date for a day key, e.g. "Sunday, September 27". */
export function dayKeyLabel(key: string): string {
  return parseDayKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Year/month of the earliest completed day, or null with no history. */
export function firstTrackedMonth(completedDays: readonly string[]): { year: number; month: number } | null {
  if (completedDays.length === 0) return null;
  let min = completedDays[0]!;
  for (const k of completedDays) if (k < min) min = k;
  const d = parseDayKey(min);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function isCurrentMonth(year: number, month: number, now: Date = new Date()): boolean {
  return year === now.getFullYear() && month === now.getMonth();
}

export function buildMonthGrid(
  year: number,
  month: number,
  completedDays: readonly string[],
  schedule: Schedule,
  now: Date = new Date(),
): MonthGrid {
  const completed = new Set(completedDays);
  const scheduledOn = toResolver(schedule);
  const firstTrackedDay = completedDays.length > 0 ? [...completedDays].sort()[0] : null;
  const todayKey = dayKey(0, now);
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Sunday-first grid (columns follow WEEKDAY_DISPLAY_ORDER).
  const leadingBlanks = displayWeekdayIndex(first);
  const cells: CalendarCell[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const key = dayKey(0, date);
    const isToday = key === todayKey;
    const isFuture = key > todayKey;
    const isScheduled = scheduledOn(key).has(getIsoWeekday(date));
    const didComplete = completed.has(key);
    cells.push({
      key,
      day,
      completed: didComplete,
      isToday,
      scheduled: isScheduled,
      isFuture,
      missed:
        isScheduled &&
        !didComplete &&
        !isFuture &&
        !isToday &&
        firstTrackedDay !== null &&
        key >= firstTrackedDay,
    });
  }

  return {
    year,
    month,
    title: monthTitle(year, month),
    leadingBlanks,
    cells,
  };
}

export function morningsInMonth(
  year: number,
  month: number,
  completedDays: readonly string[],
): number {
  const prefix = `${year}-${`${month + 1}`.padStart(2, '0')}-`;
  return completedDays.filter((key) => key.startsWith(prefix)).length;
}

/** Longest run of completed scheduled mornings; unscheduled days do not break the run. */
export function longestScheduledStreak(
  completedDays: readonly string[],
  schedule: Schedule,
): number {
  if (completedDays.length === 0) return 0;
  if (typeof schedule !== 'function' && schedule.length === 0) return 0;
  const completed = new Set(completedDays);
  const scheduledOn = toResolver(schedule);
  const sorted = [...completedDays].sort();
  const start = parseDayKey(sorted[0]!);
  const end = parseDayKey(sorted[sorted.length - 1]!);

  let best = 0;
  let run = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (cursor.getTime() <= last.getTime()) {
    const iso = getIsoWeekday(cursor);
    const key = dayKey(0, cursor);
    if (scheduledOn(key).has(iso)) {
      if (completed.has(key)) {
        run += 1;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return best;
}

export function nextStreakGoal(current: number): NextStreakGoal | null {
  const target = STREAK_GOALS.find((g) => g > current);
  if (!target) return null;
  const remaining = target - current;
  return {
    target,
    remaining,
    label:
      remaining === 1
        ? `1 more scheduled morning to hit ${target}`
        : `${remaining} more scheduled mornings to hit ${target}`,
  };
}
