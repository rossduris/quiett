import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_ALARM_SOUND_ID,
  DEFAULT_MEDITATION_SOUND_ID,
} from '@/constants/sounds';

const KEYS = {
  alarmTime: 'quiett.alarmTime',
  alarmEnabled: 'quiett.alarmEnabled',
  sitMinutes: 'quiett.sitMinutes.v2',
  alarmSoundId: 'quiett.alarmSoundId',
  meditationSoundId: 'quiett.meditationSoundId',
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
} as const;

export type AlarmPrefs = { time: string; enabled: boolean };
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

export const DEFAULT_SIT_MINUTES: SitMinutes = 0.5;
export const SIT_MINUTE_OPTIONS: readonly SitMinutes[] = [0.5, 2, 3, 5, 10];

const DEFAULT_ALARM: AlarmPrefs = { time: '07:00', enabled: true };

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
  if (n === 0.5 || n === 2 || n === 3 || n === 5 || n === 10) return n;
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

export async function loadNativeAlarmId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.nativeAlarmId);
}

export async function saveNativeAlarmId(id: string | null): Promise<void> {
  if (id) await AsyncStorage.setItem(KEYS.nativeAlarmId, id);
  else await AsyncStorage.removeItem(KEYS.nativeAlarmId);
}

export async function loadAlarmPrefs(): Promise<AlarmPrefs> {
  const [time, enabled] = await Promise.all([
    AsyncStorage.getItem(KEYS.alarmTime),
    AsyncStorage.getItem(KEYS.alarmEnabled),
  ]);
  return {
    time: time ?? DEFAULT_ALARM.time,
    enabled: enabled === null ? DEFAULT_ALARM.enabled : enabled === '1',
  };
}

export async function saveAlarmPrefs(prefs: AlarmPrefs): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.alarmTime, prefs.time),
    AsyncStorage.setItem(KEYS.alarmEnabled, prefs.enabled ? '1' : '0'),
  ]);
}

export async function loadStreak(): Promise<StreakData> {
  const [count, last] = await Promise.all([
    AsyncStorage.getItem(KEYS.streak),
    AsyncStorage.getItem(KEYS.lastCompletedDate),
  ]);
  return {
    count: count ? parseInt(count, 10) || 0 : 0,
    lastCompletedDate: last,
  };
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
  await addCompletedDay(today);
  if (current.lastCompletedDate === today) return current;
  const next = current.lastCompletedDate === dayKey(-1) ? current.count + 1 : 1;
  await Promise.all([
    AsyncStorage.setItem(KEYS.streak, String(next)),
    AsyncStorage.setItem(KEYS.lastCompletedDate, today),
  ]);
  return { count: next, lastCompletedDate: today };
}

/** Emergency: reset streak count / last date, keep completed-day history for week strip. */
export async function breakStreak(): Promise<StreakData> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.streak, '0'),
    AsyncStorage.removeItem(KEYS.lastCompletedDate),
  ]);
  return { count: 0, lastCompletedDate: null };
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
