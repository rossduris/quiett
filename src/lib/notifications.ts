import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  loadAlarmPrefs,
  loadEveningReminderPrefs,
  loadUnlockTrackId,
  type Weekday,
} from '@/lib/storage';
import { unlockTrackById } from '@/constants/unlock-tracks';
import { formatClock } from '@/lib/time-format';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const EVENING_REMINDER_ID = 'quiett-evening-reminder';

/** 'granted' | 'denied' | 'undetermined' without prompting. */
export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
}

async function parseReminderTime(time: string): Promise<{ hour: number; minute: number }> {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  return {
    hour: Number.isFinite(h) ? h : 20,
    minute: Number.isFinite(m) ? m : 0,
  };
}

function formatAlarmTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const hour = Number.isFinite(h) ? h : 7;
  const minute = Number.isFinite(m) ? m : 0;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return formatClock(date);
}

/** How many upcoming evenings are queued at once (one-shot notifications). */
const REMINDER_QUEUE = 7;

function reminderId(i: number): string {
  return `${EVENING_REMINDER_ID}-${i}`;
}

function isoWeekday(d: Date): Weekday {
  const dow = d.getDay();
  return (dow === 0 ? 7 : dow) as Weekday;
}

async function cancelAllEveningReminders(): Promise<void> {
  // Legacy id (the old repeating DAILY trigger) plus the queued one-shots.
  const ids = [EVENING_REMINDER_ID, ...Array.from({ length: REMINDER_QUEUE }, (_, i) => reminderId(i))];
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

/**
 * Queues one-shot reminders for the next evenings that come before a scheduled alarm day
 * (never before a day off). Re-run whenever the alarm, sound or reminder changes and on
 * every foreground (see syncEveningReminder) so the message never goes stale.
 */
export async function scheduleEveningReminder(): Promise<void> {
  if (Platform.OS === 'web') return;

  await cancelAllEveningReminders();

  const [reminderPrefs, alarmPrefs, unlockTrackId] = await Promise.all([
    loadEveningReminderPrefs(),
    loadAlarmPrefs(),
    loadUnlockTrackId(),
  ]);

  if (!reminderPrefs.enabled || !alarmPrefs.enabled || alarmPrefs.weekdays.length === 0) return;

  const { hour, minute } = await parseReminderTime(reminderPrefs.time);
  const unlockTrack = unlockTrackById(unlockTrackId);
  const scheduledDays = new Set(alarmPrefs.weekdays);
  const body = `Tomorrow’s wake-up is set for ${formatAlarmTime(alarmPrefs.time)} · ${unlockTrack.title}`;
  const now = new Date();

  let queued = 0;
  for (let offset = 0; offset < 14 && queued < REMINDER_QUEUE; offset++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute, 0, 0);
    if (at.getTime() <= now.getTime()) continue;
    const nextDay = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1);
    if (!scheduledDays.has(isoWeekday(nextDay))) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: reminderId(queued),
      content: {
        title: 'Quiett',
        body,
        data: { source: 'evening-reminder' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
    queued += 1;
  }
}

export async function cancelEveningReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelAllEveningReminders();
}

/** The body the evening reminder will use (for the in-app example). */
export async function previewEveningReminder(): Promise<{ time: string; track: string }> {
  const [alarmPrefs, unlockTrackId] = await Promise.all([loadAlarmPrefs(), loadUnlockTrackId()]);
  return { time: formatAlarmTime(alarmPrefs.time), track: unlockTrackById(unlockTrackId).title };
}

export async function syncEveningReminder(): Promise<void> {
  const prefs = await loadEveningReminderPrefs();
  if (prefs.enabled) {
    await scheduleEveningReminder();
  } else {
    await cancelEveningReminder();
  }
}
