import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_ALARM_SOUND_ID,
  DEFAULT_MEDITATION_SOUND_ID,
} from '@/constants/sounds';
import { DEFAULT_UNLOCK_TRACK_ID, unlockTrackById } from '@/constants/unlock-tracks';
import { DEFAULT_THEME_ID, type ThemeId } from '@/constants/themes';

const KEYS = {
  alarmTime: 'quiett.alarmTime',
  alarmEnabled: 'quiett.alarmEnabled',
  alarmWeekdays: 'quiett.alarmWeekdays',
  sitMinutes: 'quiett.sitMinutes.v2',
  alarmSoundId: 'quiett.alarmSoundId',
  meditationSoundId: 'quiett.meditationSoundId',
  unlockTrackId: 'quiett.unlockTrackId',
  surpriseMe: 'quiett.surpriseMe',
  streak: 'quiett.streak',
  lastCompletedDate: 'quiett.lastCompletedDate',
  completedDays: 'quiett.completedDays',
  account: 'quiett.account',
  nativeAlarmId: 'quiett.nativeAlarmId',
  wakeResolvedDate: 'quiett.wakeResolvedDate',
  pendingSitWake: 'quiett.pendingSitWake',
  bailAlarmId: 'quiett.bailAlarmId',
  bailTimerIds: 'quiett.bailTimerIds',
  bailCarrierIds: 'quiett.bailCarrierIds',
  themeId: 'quiett.themeId',
  dayOpenHeroDismissedDate: 'quiett.dayOpenHeroDismissedDate',
  reliabilityCheckCompleted: 'quiett.reliabilityCheckCompleted',
  getStartedDismissed: 'quiett.getStartedDismissed',
  wakeIntention: 'quiett.wakeIntention',
  wakeIntentionByDay: 'quiett.wakeIntentionByDay',
  eveningReminderEnabled: 'quiett.eveningReminderEnabled',
  eveningReminderTime: 'quiett.eveningReminderTime',
  streakDeadlineEnabled: 'quiett.streakDeadlineEnabled',
  streakDeadlineMinutes: 'quiett.streakDeadlineMinutes',
  earnedBadges: 'quiett.earnedBadges',
  unlockTimestamps: 'quiett.unlockTimestamps',
  testMorningCompleted: 'quiett.testMorningCompleted',
  libraryUsage: 'quiett.libraryUsage',
} as const;

/** ISO weekday: 1=Monday … 7=Sunday (react-native-alarm-scheduler format) */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type AlarmPrefs = { time: string; enabled: boolean; weekdays: Weekday[] };
export type StreakData = { count: number; lastCompletedDate: string | null };
/** Sit length in minutes. `0.5` = 30 seconds (dev / quick test). */
export type SitMinutes = 0.5 | 2 | 3 | 5 | 10;
export type AccountProvider = 'apple' | null;
export type AccountData = {
  signedIn: boolean;
  provider: AccountProvider;
  displayName: string | null;
  email: string | null;
};

/** Every meditation is a fixed 2 minutes. 30s exists only in dev builds for quick testing. */
export const DEFAULT_SIT_MINUTES: SitMinutes = 2;
export const SIT_MINUTE_OPTIONS: readonly SitMinutes[] = __DEV__ ? [0.5, 2] : [2];

const DEFAULT_ALARM: AlarmPrefs = { time: '07:00', enabled: true, weekdays: [1, 2, 3, 4, 5] };

export const SIGNED_OUT_ACCOUNT: AccountData = {
  signedIn: false,
  provider: null,
  displayName: null,
  email: null,
};

const STUB_APPLE_ACCOUNT: AccountData = {
  signedIn: true,
  provider: 'apple',
  displayName: 'Ross',
  email: 'r••••@icloud.com',
};

function parseSitMinutes(raw: string | null): SitMinutes {
  const n = raw ? parseFloat(raw) : NaN;
  // Locked to 2 minutes; the 30s quick-test option only applies in dev builds.
  if (__DEV__ && n === 0.5) return 0.5;
  return DEFAULT_SIT_MINUTES;
}

export function dayKey(offset = 0, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

export async function loadSitMinutes(): Promise<SitMinutes> {
  const raw = await AsyncStorage.getItem(KEYS.sitMinutes);
  return parseSitMinutes(raw);
}

export async function saveSitMinutes(minutes: SitMinutes): Promise<void> {
  await AsyncStorage.setItem(KEYS.sitMinutes, String(minutes));
}
export async function loadAlarmSoundId(): Promise<string> {
  const raw = await AsyncStorage.getItem(KEYS.alarmSoundId);
  return raw || DEFAULT_ALARM_SOUND_ID;
}

export async function saveAlarmSoundId(id: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.alarmSoundId, id);
}

export async function loadMeditationSoundId(): Promise<string> {
  const raw = await AsyncStorage.getItem(KEYS.meditationSoundId);
  return raw || DEFAULT_MEDITATION_SOUND_ID;
}

export async function saveMeditationSoundId(id: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.meditationSoundId, id);
}

export async function loadUnlockTrackId(): Promise<string> {
  const raw = await AsyncStorage.getItem(KEYS.unlockTrackId);
  if (!raw) return DEFAULT_UNLOCK_TRACK_ID;
  return unlockTrackById(raw).id;
}

/** Persist next-morning unlock selection and keep session calm audio in sync. */
export async function saveUnlockTrackId(id: string): Promise<string> {
  const track = unlockTrackById(id);
  if (track.locked) return loadUnlockTrackId();
  await AsyncStorage.setItem(KEYS.unlockTrackId, track.id);
  await saveMeditationSoundId(track.playbackSoundId);
  return track.id;
}

export async function loadSurpriseMe(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEYS.surpriseMe);
  return raw === '1';
}

export async function saveSurpriseMe(on: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.surpriseMe, on ? '1' : '0');
}




/** Calendar day the morning wake was finished (sit) or emergency-dismissed. */

/** OS Slide-to-stop / Watch stop / Sit open → must land in /session until sit or emergency. */
export async function markPendingSitWake(reason: string = 'os'): Promise<void> {
  await AsyncStorage.setItem(KEYS.pendingSitWake, reason);
}

export async function peekPendingSitWake(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.pendingSitWake);
}

export async function clearPendingSitWake(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.pendingSitWake);
}

export async function loadBailAlarmId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.bailAlarmId);
}

export async function saveBailAlarmId(id: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.bailAlarmId, id);
}

export async function clearBailAlarmId(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.bailAlarmId);
}

export async function loadBailTimerIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEYS.bailTimerIds);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function saveBailTimerIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.bailTimerIds, JSON.stringify(ids));
}

export async function clearBailTimerIds(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.bailTimerIds);
}

export async function loadBailCarrierIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEYS.bailCarrierIds);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function saveBailCarrierIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.bailCarrierIds, JSON.stringify(ids));
}

export async function clearBailCarrierIds(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.bailCarrierIds);
}

export async function markWakeResolvedToday(): Promise<void> {
  await AsyncStorage.setItem(KEYS.wakeResolvedDate, dayKey(0));
}

export async function isWakeResolvedToday(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEYS.wakeResolvedDate);
  return raw === dayKey(0);
}

export async function clearWakeResolved(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.wakeResolvedDate);
}


export async function dismissDayOpenHeroToday(): Promise<void> {
  await AsyncStorage.setItem(KEYS.dayOpenHeroDismissedDate, dayKey(0));
}

export async function isDayOpenHeroDismissedToday(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEYS.dayOpenHeroDismissedDate);
  return raw === dayKey(0);
}

export async function loadNativeAlarmId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.nativeAlarmId);
}

export async function saveNativeAlarmId(id: string | null): Promise<void> {
  if (id) await AsyncStorage.setItem(KEYS.nativeAlarmId, id);
  else await AsyncStorage.removeItem(KEYS.nativeAlarmId);
}

function parseWeekdays(raw: string | null): Weekday[] {
  if (!raw) return DEFAULT_ALARM.weekdays;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_ALARM.weekdays;
    const valid = parsed.filter((d): d is Weekday => 
      typeof d === 'number' && d >= 1 && d <= 7
    );
    return valid.length > 0 ? valid : DEFAULT_ALARM.weekdays;
  } catch {
    return DEFAULT_ALARM.weekdays;
  }
}

export async function loadAlarmPrefs(): Promise<AlarmPrefs> {
  const [time, enabled, weekdays] = await Promise.all([
    AsyncStorage.getItem(KEYS.alarmTime),
    AsyncStorage.getItem(KEYS.alarmEnabled),
    AsyncStorage.getItem(KEYS.alarmWeekdays),
  ]);
  return {
    time: time ?? DEFAULT_ALARM.time,
    enabled: enabled === null ? DEFAULT_ALARM.enabled : enabled === '1',
    weekdays: weekdays === null ? [1, 2, 3, 4, 5, 6, 7] : parseWeekdays(weekdays),
  };
}

export async function saveAlarmPrefs(prefs: AlarmPrefs): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.alarmTime, prefs.time),
    AsyncStorage.setItem(KEYS.alarmEnabled, prefs.enabled ? '1' : '0'),
    AsyncStorage.setItem(KEYS.alarmWeekdays, JSON.stringify(prefs.weekdays)),
  ]);
}

async function loadStoredStreak(): Promise<StreakData> {
  const [count, last] = await Promise.all([
    AsyncStorage.getItem(KEYS.streak),
    AsyncStorage.getItem(KEYS.lastCompletedDate),
  ]);
  return {
    count: count ? parseInt(count, 10) || 0 : 0,
    lastCompletedDate: last,
  };
}

/** Local-midnight Date for a YYYY-MM-DD key (avoids UTC parsing of `new Date('YYYY-MM-DD')`). */
function dateFromDayKey(key: string): Date | null {
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Pure check: has a scheduled morning been fully missed since the last counted morning?
 * - Any scheduled weekday strictly between lastCompletedDate and today breaks it.
 * - Today only breaks it when the streak deadline is on and today's window has closed
 *   without a counted unlock. Without a deadline, today stays open all day
 *   (a completion any time today still counts in recordSuccessfulSit).
 * - Unscheduled days never break it.
 */
export function isStreakBroken(
  streak: StreakData,
  alarm: Pick<AlarmPrefs, 'time' | 'weekdays'>,
  deadline: StreakDeadlinePrefs,
  now: Date = new Date(),
): boolean {
  if (streak.count <= 0 || !streak.lastCompletedDate) return false;
  const today = dayKey(0, now);
  if (streak.lastCompletedDate >= today) return false;
  const last = dateFromDayKey(streak.lastCompletedDate);
  if (!last) return false;
  const scheduled = new Set(alarm.weekdays);

  // Seven consecutive days cover every weekday, so a longer gap needs no further scanning.
  for (let i = 1; i <= 7; i++) {
    const day = new Date(last.getFullYear(), last.getMonth(), last.getDate() + i);
    if (dayKey(0, day) >= today) break;
    if (scheduled.has(getIsoWeekday(day))) return true;
  }

  if (deadline.enabled && scheduled.has(getIsoWeekday(now))) {
    const [h, m] = alarm.time.split(':').map((n) => parseInt(n, 10));
    const ring = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 7, m || 0, 0, 0);
    if (now.getTime() > ring.getTime() + deadline.minutes * 60_000) return true;
  }
  return false;
}

/**
 * Single source of truth for the current streak. Validates the stored count against
 * completed history rules (scheduled weekdays + streak deadline) and persists a reset
 * when a scheduled morning was missed, so every reader (Home pill, streak sheet,
 * Profile, Milestones) sees the same corrected value.
 */
export async function loadStreak(now: Date = new Date()): Promise<StreakData> {
  const [stored, alarm, deadline] = await Promise.all([
    loadStoredStreak(),
    loadAlarmPrefs(),
    loadStreakDeadlinePrefs(),
  ]);
  if (!isStreakBroken(stored, alarm, deadline, now)) return stored;
  await Promise.all([
    AsyncStorage.setItem(KEYS.streak, '0'),
    AsyncStorage.removeItem(KEYS.lastCompletedDate),
  ]);
  return { count: 0, lastCompletedDate: null };
}

async function loadCompletedDaysRaw(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEYS.completedDays);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
  } catch {
    return [];
  }
}

export async function loadCompletedDays(): Promise<string[]> {
  return loadCompletedDaysRaw();
}

async function addCompletedDay(key: string): Promise<string[]> {
  const existing = await loadCompletedDaysRaw();
  if (existing.includes(key)) return existing;
  const next = [...existing, key].sort();
  // Keep a rolling year of history — enough for week strip + future calendars
  const trimmed = next.length > 400 ? next.slice(next.length - 400) : next;
  await AsyncStorage.setItem(KEYS.completedDays, JSON.stringify(trimmed));
  return trimmed;
}

export async function recordSuccessfulSit(): Promise<StreakData> {
  const current = await loadStreak();
  const today = dayKey(0);
  const unlockTime = Date.now();
  
  await addCompletedDay(today);
  await recordUnlockTimestamp();
  await snapshotWakeIntentionForDay(today);
  
  if (current.lastCompletedDate === today) return current;
  
  const prefs = await loadAlarmPrefs();
  const deadlinePrefs = await loadStreakDeadlinePrefs();
  
  let countsForStreak = true;
  
  if (deadlinePrefs.enabled) {
    const timestamps = await loadUnlockTimestamps();
    const todayTimestamp = timestamps.find((t) => t.day === today);
    
    if (todayTimestamp) {
      const nextAlarm = nextAlarmDate(prefs.time, prefs.weekdays, new Date(todayTimestamp.timestamp - 24 * 60 * 60 * 1000));
      if (nextAlarm) {
        const deadlineMs = deadlinePrefs.minutes * 60 * 1000;
        const timeSinceAlarm = todayTimestamp.timestamp - nextAlarm.getTime();
        
        if (timeSinceAlarm > deadlineMs) {
          countsForStreak = false;
        }
      }
    }
  }
  
  if (!countsForStreak) {
    await checkAndAwardBadges(current.count, await loadCompletedDays());
    return current;
  }
  
  // `current` comes from loadStreak(), which already reset the count if a scheduled
  // morning was missed since lastCompletedDate. So a surviving lastCompletedDate means
  // the run is intact and today extends it; otherwise today starts a new run.
  const next = current.lastCompletedDate && current.count > 0 ? current.count + 1 : 1;
  await Promise.all([
    AsyncStorage.setItem(KEYS.streak, String(next)),
    AsyncStorage.setItem(KEYS.lastCompletedDate, today),
  ]);
  await checkAndAwardBadges(next, await loadCompletedDays());
  return { count: next, lastCompletedDate: today };
}

export async function isUnlockLate(): Promise<boolean> {
  const deadlinePrefs = await loadStreakDeadlinePrefs();
  if (!deadlinePrefs.enabled) return false;
  
  const today = dayKey(0);
  const timestamps = await loadUnlockTimestamps();
  const todayTimestamp = timestamps.find((t) => t.day === today);
  
  if (!todayTimestamp) return false;
  
  const prefs = await loadAlarmPrefs();
  const nextAlarm = nextAlarmDate(prefs.time, prefs.weekdays, new Date(todayTimestamp.timestamp - 24 * 60 * 60 * 1000));
  
  if (!nextAlarm) return false;
  
  const deadlineMs = deadlinePrefs.minutes * 60 * 1000;
  const timeSinceAlarm = todayTimestamp.timestamp - nextAlarm.getTime();
  
  return timeSinceAlarm > deadlineMs;
}

async function checkAndAwardBadges(streakCount: number, completedDays: string[]): Promise<void> {
  const totalMornings = completedDays.length;
  
  if (totalMornings === 1) await awardBadge('first-unlock');
  if (totalMornings >= 10) await awardBadge('mornings-10');
  if (totalMornings >= 50) await awardBadge('mornings-50');
  
  if (streakCount >= 3) await awardBadge('streak-3');
  if (streakCount >= 7) await awardBadge('streak-7');
  if (streakCount >= 14) await awardBadge('streak-14');
  if (streakCount >= 21) await awardBadge('streak-21');
  if (streakCount >= 30) await awardBadge('streak-30');
  if (streakCount >= 60) await awardBadge('streak-60');
  if (streakCount >= 100) await awardBadge('streak-100');
}

/** Emergency: reset streak count / last date, keep completed-day history for week strip. */
export async function breakStreak(): Promise<StreakData> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.streak, '0'),
    AsyncStorage.removeItem(KEYS.lastCompletedDate),
  ]);
  return { count: 0, lastCompletedDate: null };
}

export function getIsoWeekday(date: Date): Weekday {
  const dow = date.getDay();
  return ((dow + 6) % 7) + 1 as Weekday;
}

export function formatWeekdayHint(weekdays: Weekday[]): string {
  const sorted = [...weekdays].sort((a, b) => a - b);
  if (sorted.length === 7) return 'every day';
  if (sorted.length === 5 && sorted.every(d => d >= 1 && d <= 5)) return 'weekdays';
  if (sorted.length === 2 && sorted[0] === 6 && sorted[1] === 7) return 'weekends';
  
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  if (sorted.length <= 3) {
    return sorted.map(d => names[d - 1]).join(', ');
  }
  
  return `${sorted.length} days`;
}

export function nextAlarmDate(time: string, weekdays: Weekday[], from = new Date()): Date | null {
  if (weekdays.length === 0) return null;
  
  const [h, m] = time.split(':').map(n => parseInt(n, 10));
  const now = from;
  const scheduledDays = new Set(weekdays);
  
  for (let offset = 0; offset < 14; offset++) {
    const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    candidate.setHours(h || 7, m || 0, 0, 0);
    
    const isoWeekday = getIsoWeekday(candidate);
    if (scheduledDays.has(isoWeekday) && candidate > now) {
      return candidate;
    }
  }
  
  return null;
}

export async function loadAccount(): Promise<AccountData> {
  const raw = await AsyncStorage.getItem(KEYS.account);
  if (!raw) return { ...SIGNED_OUT_ACCOUNT };
  try {
    const parsed = JSON.parse(raw) as Partial<AccountData>;
    return {
      signedIn: Boolean(parsed.signedIn),
      provider: parsed.provider === 'apple' ? 'apple' : null,
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : null,
      email: typeof parsed.email === 'string' ? parsed.email : null,
    };
  } catch {
    return { ...SIGNED_OUT_ACCOUNT };
  }
}

async function saveAccount(account: AccountData): Promise<void> {
  await AsyncStorage.setItem(KEYS.account, JSON.stringify(account));
}

/** Local UI stub — no real Apple SDK this pass. */
export async function signInWithAppleStub(): Promise<AccountData> {
  const account = { ...STUB_APPLE_ACCOUNT };
  await saveAccount(account);
  return account;
}

export async function signOut(): Promise<AccountData> {
  const account = { ...SIGNED_OUT_ACCOUNT };
  await saveAccount(account);
  return account;
}

export async function loadThemeId(): Promise<ThemeId> {
  const raw = await AsyncStorage.getItem(KEYS.themeId);
  if (raw === 'peachCream' || raw === 'nightTeal') return raw;
  return DEFAULT_THEME_ID;
}

export async function saveThemeId(id: ThemeId): Promise<void> {
  await AsyncStorage.setItem(KEYS.themeId, id);
}

export async function loadReliabilityCheckCompleted(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEYS.reliabilityCheckCompleted);
  return raw === '1';
}

export async function saveReliabilityCheckCompleted(completed: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.reliabilityCheckCompleted, completed ? '1' : '0');
}

export async function loadGetStartedDismissed(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEYS.getStartedDismissed);
  return raw === '1';
}

export async function saveGetStartedDismissed(dismissed: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.getStartedDismissed, dismissed ? '1' : '0');
}

export async function loadWakeIntention(): Promise<string> {
  const raw = await AsyncStorage.getItem(KEYS.wakeIntention);
  return raw || '';
}

export async function saveWakeIntention(text: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.wakeIntention, text);
}

/** Per-morning intention history: { 'YYYY-MM-DD': intention }. Only mornings completed after this shipped have entries. */
export async function loadWakeIntentionsByDay(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(KEYS.wakeIntentionByDay);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && typeof value === 'string' && value.trim()) {
        out[key] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Record the current wake intention against a completed morning (no-op when none is set). */
async function snapshotWakeIntentionForDay(day: string): Promise<void> {
  const text = (await loadWakeIntention()).trim();
  if (!text) return;
  const existing = await loadWakeIntentionsByDay();
  existing[day] = text;
  const keys = Object.keys(existing).sort();
  const kept = keys.slice(Math.max(0, keys.length - 400));
  const trimmed: Record<string, string> = {};
  for (const key of kept) trimmed[key] = existing[key]!;
  await AsyncStorage.setItem(KEYS.wakeIntentionByDay, JSON.stringify(trimmed));
}

export type EveningReminderPrefs = {
  enabled: boolean;
  time: string;
};

export async function loadEveningReminderPrefs(): Promise<EveningReminderPrefs> {
  const [enabled, time] = await Promise.all([
    AsyncStorage.getItem(KEYS.eveningReminderEnabled),
    AsyncStorage.getItem(KEYS.eveningReminderTime),
  ]);
  return {
    enabled: enabled === '1',
    time: time || '20:00',
  };
}

export async function saveEveningReminderPrefs(prefs: EveningReminderPrefs): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.eveningReminderEnabled, prefs.enabled ? '1' : '0'),
    AsyncStorage.setItem(KEYS.eveningReminderTime, prefs.time),
  ]);
}

export type StreakDeadlinePrefs = {
  enabled: boolean;
  minutes: number;
};

export async function loadStreakDeadlinePrefs(): Promise<StreakDeadlinePrefs> {
  const [enabled, minutes] = await Promise.all([
    AsyncStorage.getItem(KEYS.streakDeadlineEnabled),
    AsyncStorage.getItem(KEYS.streakDeadlineMinutes),
  ]);
  return {
    enabled: enabled === '1',
    minutes: minutes ? parseInt(minutes, 10) || 30 : 30,
  };
}

export async function saveStreakDeadlinePrefs(prefs: StreakDeadlinePrefs): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.streakDeadlineEnabled, prefs.enabled ? '1' : '0'),
    AsyncStorage.setItem(KEYS.streakDeadlineMinutes, String(prefs.minutes)),
  ]);
}

export type BadgeId = 
  | 'first-unlock'
  | 'streak-3'
  | 'streak-7'
  | 'streak-14'
  | 'streak-21'
  | 'streak-30'
  | 'streak-60'
  | 'streak-100'
  | 'mornings-10'
  | 'mornings-50'
  | 'perfect-week'
  | 'tried-guided'
  | 'tried-ambient'
  | 'tried-healing';

export async function loadEarnedBadges(): Promise<BadgeId[]> {
  const raw = await AsyncStorage.getItem(KEYS.earnedBadges);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((b): b is BadgeId => typeof b === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveEarnedBadges(badges: BadgeId[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.earnedBadges, JSON.stringify(badges));
}

export async function awardBadge(badge: BadgeId): Promise<BadgeId[]> {
  const current = await loadEarnedBadges();
  if (current.includes(badge)) return current;
  const next = [...current, badge];
  await saveEarnedBadges(next);
  return next;
}

export type UnlockTimestamp = {
  day: string;
  timestamp: number;
};

export async function loadUnlockTimestamps(): Promise<UnlockTimestamp[]> {
  const raw = await AsyncStorage.getItem(KEYS.unlockTimestamps);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is UnlockTimestamp => 
      typeof t === 'object' && 
      t !== null && 
      typeof (t as any).day === 'string' && 
      typeof (t as any).timestamp === 'number'
    );
  } catch {
    return [];
  }
}

async function saveUnlockTimestamps(timestamps: UnlockTimestamp[]): Promise<void> {
  const trimmed = timestamps.length > 400 ? timestamps.slice(timestamps.length - 400) : timestamps;
  await AsyncStorage.setItem(KEYS.unlockTimestamps, JSON.stringify(trimmed));
}

export async function recordUnlockTimestamp(): Promise<void> {
  const day = dayKey(0);
  const timestamp = Date.now();
  const existing = await loadUnlockTimestamps();
  const withoutToday = existing.filter((t) => t.day !== day);
  await saveUnlockTimestamps([...withoutToday, { day, timestamp }]);
}

export async function loadTestMorningCompleted(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEYS.testMorningCompleted);
  return raw === '1';
}

export async function saveTestMorningCompleted(completed: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.testMorningCompleted, completed ? '1' : '0');
}

export type LibraryUsage = {
  guided: boolean;
  ambient: boolean;
  healing: boolean;
};

export async function loadLibraryUsage(): Promise<LibraryUsage> {
  const raw = await AsyncStorage.getItem(KEYS.libraryUsage);
  if (!raw) return { guided: false, ambient: false, healing: false };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        guided: Boolean((parsed as any).guided),
        ambient: Boolean((parsed as any).ambient),
        healing: Boolean((parsed as any).healing),
      };
    }
  } catch {}
  return { guided: false, ambient: false, healing: false };
}

export async function saveLibraryUsage(usage: LibraryUsage): Promise<void> {
  await AsyncStorage.setItem(KEYS.libraryUsage, JSON.stringify(usage));
}

export async function markLibraryCategoryUsed(category: 'guided' | 'ambient' | 'healing'): Promise<void> {
  const current = await loadLibraryUsage();
  if (current[category]) return;
  
  const next = { ...current, [category]: true };
  await saveLibraryUsage(next);
  
  if (category === 'guided') await awardBadge('tried-guided');
  if (category === 'ambient') await awardBadge('tried-ambient');
  if (category === 'healing') await awardBadge('tried-healing');
}
