import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  loadAlarmPrefs,
  loadEveningReminderPrefs,
  loadUnlockTrackId,
  nextAlarmDate,
  type AlarmPrefs,
  type Weekday,
} from '@/lib/storage';
import { unlockTrackById } from '@/constants/unlock-tracks';

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
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getTomorrowWeekday(): Weekday {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dow = tomorrow.getDay();
  return (dow === 0 ? 7 : dow) as Weekday;
}

export async function scheduleEveningReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  
  await Notifications.cancelScheduledNotificationAsync(EVENING_REMINDER_ID).catch(() => {});
  
  const [reminderPrefs, alarmPrefs, unlockTrackId] = await Promise.all([
    loadEveningReminderPrefs(),
    loadAlarmPrefs(),
    loadUnlockTrackId(),
  ]);
  
  if (!reminderPrefs.enabled || !alarmPrefs.enabled) return;
  
  const { hour, minute } = await parseReminderTime(reminderPrefs.time);
  const unlockTrack = unlockTrackById(unlockTrackId);
  
  const scheduledDays = new Set(alarmPrefs.weekdays);
  const tomorrow = getTomorrowWeekday();
  
  if (!scheduledDays.has(tomorrow)) {
    return;
  }
  
  const nextAlarm = nextAlarmDate(alarmPrefs.time, alarmPrefs.weekdays);
  if (!nextAlarm) return;
  
  const now = new Date();
  const todayReminder = new Date(now);
  todayReminder.setHours(hour, minute, 0, 0);
  
  if (todayReminder < now) {
    todayReminder.setDate(todayReminder.getDate() + 1);
  }
  
  const trigger: Notifications.DailyTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour,
    minute,
  };
  
  await Notifications.scheduleNotificationAsync({
    identifier: EVENING_REMINDER_ID,
    content: {
      title: 'Quiett',
      body: `Tomorrow's wake-up is set for ${formatAlarmTime(alarmPrefs.time)} · ${unlockTrack.title}`,
      data: { source: 'evening-reminder' },
    },
    trigger,
  });
}

export async function cancelEveningReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(EVENING_REMINDER_ID).catch(() => {});
}

export async function syncEveningReminder(): Promise<void> {
  const prefs = await loadEveningReminderPrefs();
  if (prefs.enabled) {
    await scheduleEveningReminder();
  } else {
    await cancelEveningReminder();
  }
}
