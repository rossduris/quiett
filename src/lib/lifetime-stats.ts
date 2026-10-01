import {
  loadCompletedDays,
  loadScheduleHistory,
  loadStoredLifetimeStats,
  loadStreak,
  saveLifetimeStats,
  scheduleResolver,
} from '@/lib/storage';
import { longestScheduledStreak } from '@/lib/streak-calendar';

export type LifetimeStats = { mornings: number; bestStreak: number };

/**
 * Lifetime mornings + best streak. Stored so they survive the 400-day history trim and a
 * broken current streak; backfilled once from the existing history on first read.
 * Kept out of storage.ts to avoid a storage ↔ streak-calendar import cycle.
 */
export async function loadLifetimeStats(): Promise<LifetimeStats> {
  const [stored, streak] = await Promise.all([loadStoredLifetimeStats(), loadStreak()]);
  if (stored.mornings !== null && stored.bestStreak !== null) {
    return { mornings: stored.mornings, bestStreak: Math.max(stored.bestStreak, streak.count) };
  }
  const [days, history] = await Promise.all([loadCompletedDays(), loadScheduleHistory()]);
  const mornings = stored.mornings ?? days.length;
  const bestStreak = Math.max(
    stored.bestStreak ?? 0,
    longestScheduledStreak(days, scheduleResolver(history)),
    streak.count,
  );
  await saveLifetimeStats({ mornings, bestStreak });
  return { mornings, bestStreak };
}
