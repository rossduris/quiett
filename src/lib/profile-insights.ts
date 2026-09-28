/**
 * Pure Profile helpers (no React / storage): which mornings count, journal grouping, the
 * current run, and insights computed only from real recorded data.
 */
import {
  dayKey,
  isInMorningWindow,
  type MorningLog,
} from '@/lib/storage';
import type { Schedule } from '@/lib/streak-calendar';
import { getIsoWeekday, type ScheduleResolver, type Weekday } from '@/lib/storage';

function toResolver(schedule: Schedule): ScheduleResolver {
  if (typeof schedule === 'function') return schedule;
  const set: ReadonlySet<Weekday> = new Set(schedule);
  return () => set;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

/**
 * True for mornings that shouldn't appear in history / calendar / stats:
 * - tagged entries: anything that isn't a real alarm wake ('dev', 'practice');
 * - older, untagged entries: an unlock outside the morning window (03:00–13:00 local),
 *   e.g. a 6 PM test run. Untagged entries without a timestamp stay visible.
 */
export function isHiddenMorning(day: string, log: MorningLog, unlockTimes: Record<string, number>): boolean {
  const tagged = log[day];
  if (tagged) return tagged.source !== 'alarm';
  const ts = unlockTimes[day];
  return ts != null && !isInMorningWindow(ts);
}

export function visibleMornings(
  days: readonly string[],
  log: MorningLog,
  unlockTimes: Record<string, number>,
): { visible: string[]; hidden: string[] } {
  const visible: string[] = [];
  const hidden: string[] = [];
  for (const d of days) (isHiddenMorning(d, log, unlockTimes) ? hidden : visible).push(d);
  return { visible, hidden };
}

/**
 * Length of the run ending at `lastDay` over counted mornings: walk back day by day; scheduled
 * days must be completed, unscheduled days are skipped (same rules as the streak engine).
 */
export function runEndingAt(completed: readonly string[], schedule: Schedule, lastDay: string | null): number {
  if (!lastDay) return 0;
  const done = new Set(completed);
  if (!done.has(lastDay)) return 0;
  const scheduledOn = toResolver(schedule);
  const cursor = parseKey(lastDay);
  let run = 0;
  for (let i = 0; i < 800; i++) {
    const key = dayKey(0, cursor);
    const scheduled = scheduledOn(key).has(getIsoWeekday(cursor));
    if (done.has(key)) {
      if (scheduled) run += 1;
    } else if (scheduled) {
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return run;
}

// ── Journal ─────────────────────────────────────────────────────────────────

export type JournalEntry = { day: string; at?: number; intention?: string };
export type JournalGroup = { intention?: string; entries: JournalEntry[] };

/** Collapse consecutive mornings (newest first) that share the same intention. */
export function groupJournal(entries: readonly JournalEntry[]): JournalGroup[] {
  const groups: JournalGroup[] = [];
  for (const e of entries) {
    const text = e.intention?.trim() || undefined;
    const last = groups[groups.length - 1];
    if (last && last.intention === text) last.entries.push(e);
    else groups.push({ intention: text, entries: [e] });
  }
  return groups;
}

// ── Insights ────────────────────────────────────────────────────────────────

export type Insight = { id: string; title: string; detail: string };

/** Minutes after midnight. */
function minutesOf(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

export function formatClock(mins: number): string {
  const d = new Date(2000, 0, 1, Math.floor(mins / 60), Math.round(mins % 60));
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Min mornings in each week before the week-over-week insight shows. */
export const INSIGHT_MIN_PER_WEEK = 2;
/** Min tagged mornings (with a known sound) before "most-used sound" shows. */
export const INSIGHT_MIN_SOUND_MORNINGS = 3;

export function computeInsights(input: {
  visibleDays: readonly string[];
  unlockTimes: Record<string, number>;
  log: MorningLog;
  now: Date;
  soundLabel: (id: string) => string | null;
}): Insight[] {
  const { visibleDays, unlockTimes, log, now, soundLabel } = input;
  const out: Insight[] = [];

  // Average unlock time: this week (Sun–Sat) vs last week.
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const lastStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7);
  const thisKey = dayKey(0, weekStart);
  const lastKey = dayKey(0, lastStart);
  const thisWeek: number[] = [];
  const lastWeek: number[] = [];
  for (const d of visibleDays) {
    const ts = unlockTimes[d];
    if (ts == null) continue;
    if (d >= thisKey) thisWeek.push(minutesOf(ts));
    else if (d >= lastKey) lastWeek.push(minutesOf(ts));
  }
  if (thisWeek.length >= INSIGHT_MIN_PER_WEEK && lastWeek.length >= INSIGHT_MIN_PER_WEEK) {
    const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const a = avg(thisWeek);
    const b = avg(lastWeek);
    const diff = Math.round(b - a);
    const title =
      Math.abs(diff) < 5
        ? 'Steady wake time'
        : diff > 0
          ? `${diff} min earlier than last week`
          : `${-diff} min later than last week`;
    out.push({
      id: 'avg-unlock',
      title,
      detail: `Average unlock ${formatClock(a)} this week, ${formatClock(b)} last week.`,
    });
  }

  // Most-used sound (tagged mornings only — the sound wasn't recorded before).
  const visible = new Set(visibleDays);
  const counts = new Map<string, number>();
  let withSound = 0;
  for (const [day, e] of Object.entries(log)) {
    if (!visible.has(day) || !e.soundId) continue;
    withSound += 1;
    counts.set(e.soundId, (counts.get(e.soundId) ?? 0) + 1);
  }
  if (withSound >= INSIGHT_MIN_SOUND_MORNINGS) {
    const [topId, topN] = [...counts.entries()].sort((x, y) => y[1] - x[1])[0] ?? [null, 0];
    const label = topId ? soundLabel(topId) : null;
    if (label && topN >= 2) {
      out.push({ id: 'top-sound', title: `Most mornings: ${label}`, detail: `Played on ${topN} of ${withSound} recorded mornings.` });
    }
  }
  return out;
}
