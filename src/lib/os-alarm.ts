import { Platform } from 'react-native';
import AlarmScheduler, {
  type AlarmPermissionResponse,
  type AlarmWeekday,
} from 'react-native-alarm-scheduler';
import {
  clearBailAlarmId,
  clearBailCarrierIds,
  clearBailTimerIds,
  clearPendingSitWake,
  clearWakeResolved,
  isWakeResolvedToday,
  loadBailAlarmId,
  loadBailCarrierIds,
  loadBailTimerIds,
  loadNativeAlarmId,
  markPendingSitWake,
  markWakeResolvedToday,
  peekPendingSitWake,
  saveBailAlarmId,
  saveBailCarrierIds,
  saveBailTimerIds,
  saveNativeAlarmId,
  type AlarmPrefs,
} from '@/lib/storage';
import {
  clearHarshAlarmSoundUriCache,
  HARSH_ALARM_SOUND_NAME,
  resolveHarshAlarmSoundUri,
} from '@/lib/harsh-alarm-asset';

const DAILY: AlarmWeekday[] = [1, 2, 3, 4, 5, 6, 7];
const ALARM_TITLE = 'Quiett — sit to begin';

/** True after session silenced the OS ring; cleared on sit success / emergency. */
let osRingHandedToSession = false;

function randomUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function parseHhMm(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  return {
    hour: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 7,
    minute: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0,
  };
}

async function ensureAlarmId(): Promise<string> {
  const existing = await loadNativeAlarmId();
  if (existing) return existing;
  const id = randomUuid();
  await saveNativeAlarmId(id);
  return id;
}

async function resolveRingingAlarmId(): Promise<string | null> {
  try {
    const ctx = await AlarmScheduler.getCurrentAlarmContextAsync();
    if (ctx?.id) return ctx.id;
  } catch {
    // ignore
  }
  return loadNativeAlarmId();
}

/** System swipe-to-stop only (no secondary Sit button — was clunky/inconsistent on iOS). */
const iosGate = {
  alertTitle: ALARM_TITLE,
  alertActionMode: 'default' as const,
  stopIntentBehavior: 'rescheduleImmediate' as const,
  metadata: { source: 'quiett-home' },
};

/** Carriers / bail one-shots — no rescheduleImmediate cascade. */
const bailIosGate = {
  alertTitle: ALARM_TITLE,
  alertActionMode: 'default' as const,
  stopIntentBehavior: 'openApp' as const,
  metadata: { source: 'quiett-bail' },
};

const androidGate = {
  alertTitle: ALARM_TITLE,
  alertBody: 'Sit to begin your morning',
  alertActionMode: 'default' as const,
  stopIntentBehavior: 'rescheduleImmediate' as const,
  launchUri: 'quiett://session',
  maxRingDurationSeconds: 0,
  enforceVolume: true,
  restoreVolume: true,
  volume: 1,
  metadata: { source: 'quiett-home' },
};

export type SyncOsAlarmResult =
  | { ok: true; scheduled: boolean; id?: string }
  | {
      ok: false;
      reason: 'unsupported' | 'denied' | 'error';
      message: string;
      permissions?: AlarmPermissionResponse;
    };

/** Cancel any stored native alarm. */
export async function cancelOsAlarm(): Promise<void> {
  if (Platform.OS === 'web') return;
  const id = await loadNativeAlarmId();
  if (!id) return;
  try {
    await AlarmScheduler.cancelAlarmAsync(id);
    await AlarmScheduler.cancelNativeAlarmBackupAsync(id);
  } catch {
    // best-effort
  }
}

/**
 * Keep the OS alarm in sync with Home prefs.
 * Enabled → request permission + schedule daily AlarmKit / setAlarmClock.
 * Disabled → cancel.
 */
export async function syncOsAlarm(prefs: AlarmPrefs): Promise<SyncOsAlarmResult> {
  if (Platform.OS === 'web') {
    return { ok: false, reason: 'unsupported', message: 'Native alarms are not available on web.' };
  }

  if (!prefs.enabled) {
    await cancelOsAlarm();
    osRingHandedToSession = false;
    return { ok: true, scheduled: false };
  }

  try {
    const permissions = await AlarmScheduler.requestPermissionsAsync();
    if (!permissions.canScheduleExactAlarms) {
      return {
        ok: false,
        reason: 'denied',
        message:
          Platform.OS === 'ios'
            ? 'Allow Quiett alarms in Settings so it can wake you when the phone is locked.'
            : 'Allow exact alarms so Quiett can wake you on time.',
        permissions,
      };
    }

    const id = await ensureAlarmId();
    try {
      await AlarmScheduler.cancelAlarmAsync(id);
    } catch {
      // first schedule
    }

    const { hour, minute } = parseHhMm(prefs.time);
    let soundUri: string | undefined;
    try {
      soundUri = await resolveHarshAlarmSoundUri();
    } catch (e) {
      console.warn('[quiett os-alarm] harsh asset', e);
    }
    const scheduled = await AlarmScheduler.scheduleAlarmAsync({
      id,
      hour,
      minute,
      title: ALARM_TITLE,
      weekdays: DAILY,
      soundUri,
      ios: {
        ...iosGate,
        soundName: HARSH_ALARM_SOUND_NAME,
        soundUri,
      },
      android: {
        ...androidGate,
        soundName: 'quiett_harsh',
      },
    });

    await saveNativeAlarmId(scheduled.id);
    return { ok: true, scheduled: true, id: scheduled.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not schedule the OS alarm.';
    return { ok: false, reason: 'error', message };
  }
}

export async function openOsAlarmSettings(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await AlarmScheduler.openAlarmSettingsAsync();
  } catch {
    // ignore
  }
}

export type AlarmHandoff = {
  alarmId: string;
  action?: string;
};

/** Clear durable handoff/actions/backups for an alarm id (best-effort). */
async function scrubNativeAlarmDebris(alarmId: string | null): Promise<void> {
  if (!alarmId) return;
  try {
    await AlarmScheduler.cancelNativeAlarmBackupAsync(alarmId);
  } catch {
    /* ignore */
  }
  try {
    await AlarmScheduler.completeNativeAlarmAsync(alarmId);
  } catch {
    /* ignore */
  }
  try {
    await AlarmScheduler.clearPendingNativeAlarmHandoffAsync();
  } catch {
    /* ignore */
  }
  try {
    const actions = await AlarmScheduler.getPendingAlarmActionsAsync();
    if (actions.length) {
      await AlarmScheduler.clearPendingAlarmActionsAsync(actions.map((a) => a.id));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Read native handoff only when a real wake is in progress.
 * Do not treat a merely *scheduled* daily alarm as a handoff (that re-opened sit after dismiss).
 */
export async function consumeAlarmHandoff(): Promise<AlarmHandoff | null> {
  if (Platform.OS === 'web') return null;
  try {
    // Read live OS state FIRST. A second alarm the same day must not be wiped
    // by wakeResolvedDate (that flag only means the prior sit/dismiss finished).
    const handoff = await AlarmScheduler.getPendingNativeAlarmHandoffAsync();
    const context = await AlarmScheduler.getCurrentAlarmContextAsync();
    const actions = await AlarmScheduler.getPendingAlarmActionsAsync().catch(() => []);

    const stopAction =
      (handoff?.action === 'nativeStop' ? handoff : null) ||
      actions.find((a) => a.action === 'nativeStop') ||
      null;
    const openAction =
      (handoff && handoff.action !== 'nativeStop' ? handoff : null) ||
      actions.find((a) => a.action === 'secondaryOpen' || a.action === 'dismiss') ||
      null;

    const alerting = context?.state === 'alerting' ? context : null;
    const sticky = await peekPendingSitWake();
    const liveWake = Boolean(
      alerting ||
        handoff?.alarmId ||
        stopAction ||
        openAction ||
        sticky,
    );

    if (await isWakeResolvedToday()) {
      if (!liveWake) {
        // Merely scheduled daily alarm after a finished morning — do not reopen sit.
        return null;
      }
      // New ring / Slide-to-stop / Sit after an earlier finish — require another sit.
      await clearWakeResolved();
    }

    const alarmId =
      stopAction?.alarmId ||
      openAction?.alarmId ||
      handoff?.alarmId ||
      alerting?.id ||
      (sticky ? await loadNativeAlarmId() : null);

    if (!alarmId && !sticky) {
      if (handoff) await AlarmScheduler.clearPendingNativeAlarmHandoffAsync();
      return null;
    }

    const id = alarmId || (await loadNativeAlarmId());
    const action =
      stopAction?.action ||
      openAction?.action ||
      handoff?.action ||
      sticky ||
      'secondaryOpen';

    // Slide-to-stop / Watch stop: OS silenced — re-arm backup + force sit session.
    // Do not arm AlarmKit backup here — /session silences OS and plays Quiett audio only.
    // Backup is armed in rearmOsAlarmAfterBail when they leave without finishing the sit.
    if (action === 'nativeStop' || sticky === 'nativeStop') {
      await markPendingSitWake('nativeStop');
      osRingHandedToSession = true;
    } else {
      await markPendingSitWake(action || 'os');
    }

    if (actions.length) {
      try {
        await AlarmScheduler.clearPendingAlarmActionsAsync(actions.map((a) => a.id));
      } catch {
        /* ignore */
      }
    }
    try {
      await AlarmScheduler.clearPendingNativeAlarmHandoffAsync();
    } catch {
      /* ignore */
    }

    return { alarmId: id || 'pending', action };
  } catch {
    // Still honor sticky wake (including a second alarm after an earlier finish).
    const sticky = await peekPendingSitWake();
    if (sticky) {
      if (await isWakeResolvedToday()) await clearWakeResolved();
      return { alarmId: (await loadNativeAlarmId()) || 'pending', action: sticky };
    }
    return null;
  }
}

/** True when OS wake requires /session (Slide-to-stop, Sit button, sticky flag). */
export async function shouldForceSitSession(): Promise<boolean> {
  if (await peekPendingSitWake()) {
    if (await isWakeResolvedToday()) await clearWakeResolved();
    return true;
  }
  try {
    const handoff = await AlarmScheduler.getPendingNativeAlarmHandoffAsync();
    const ctx = await AlarmScheduler.getCurrentAlarmContextAsync();
    const actions = await AlarmScheduler.getPendingAlarmActionsAsync();
    const live =
      Boolean(handoff?.alarmId) ||
      ctx?.state === 'alerting' ||
      actions.some((a) => a.action === 'nativeStop' || a.action === 'secondaryOpen');
    if (live) {
      if (await isWakeResolvedToday()) await clearWakeResolved();
      return true;
    }
  } catch {
    /* ignore */
  }
  // Finished morning + no live OS wake → stay on Home.
  if (await isWakeResolvedToday()) return false;
  return false;
}

/**
 * While /session (camera) is active: AlarmKit must be fully silent so only Quiett audio plays.
 * Cancels backups too. Bail/unmount calls rearmOsAlarmAfterBail() to bring OS back.
 */
export async function silenceOsRingForSession(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  osRingHandedToSession = true;
  const ringingId = await resolveRingingAlarmId();
  const storedId = await loadNativeAlarmId();
  const primaryIds = [...new Set([ringingId, storedId].filter(Boolean) as string[])];
  let ok = false;
  for (const id of primaryIds) {
    try {
      await AlarmScheduler.cancelNativeAlarmBackupAsync(id);
    } catch {
      /* ignore */
    }
    try {
      await AlarmScheduler.completeNativeAlarmAsync(id);
      ok = true;
    } catch {
      /* ignore */
    }
  }
  // Staggered bail timer waves + loud one-shot (never cancel the daily id here).
  await cancelBailTimerWaves();
  const bailId = await loadBailAlarmId();
  if (bailId) {
    try {
      await AlarmScheduler.cancelAlarmAsync(bailId);
    } catch {
      /* ignore */
    }
    try {
      await AlarmScheduler.completeNativeAlarmAsync(bailId);
    } catch {
      /* ignore */
    }
    await clearBailAlarmId();
    ok = true;
  }
  return ok || primaryIds.length > 0;
}

/**
 * User left without finishing.
 *
 * AlarmKit timers that start ringing while unlocked often go silent when the phone
 * is then locked (alert UI remains, no audio). A *fresh* timer that fires already
 * on the lock screen stays loud.
 *
 * We arm: immediate backup on the daily id, plus staggered backups on pre-registered
 * carrier ids (custom harsh sound, created while /session was foreground).
 */
export async function rearmOsAlarmAfterBail(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (await isWakeResolvedToday()) {
    osRingHandedToSession = false;
    return;
  }

  void markPendingSitWake('bail');

  const primaryId = (await loadNativeAlarmId()) || (await ensureAlarmId());

  await cancelBailTimerWaves(primaryId);
  await cancelStoredBailOneShot();

  const waveIds: string[] = [primaryId];
  const ok = await armTimerBackup(primaryId, 0.5);

  // Staggered custom-sound carriers — new rings after lock mutes the first.
  const carriers = await loadBailCarrierIds();
  const delays = [10, 22];
  for (let i = 0; i < carriers.length; i++) {
    const id = carriers[i]!;
    waveIds.push(id);
    void armTimerBackup(id, delays[i] ?? 15);
  }

  void saveBailTimerIds(waveIds);
  osRingHandedToSession = false;

  if (!ok) {
    console.warn('[quiett os-alarm] bail timer did not schedule');
  }
}

async function armTimerBackup(alarmId: string, delaySeconds: number): Promise<boolean> {
  try {
    await AlarmScheduler.resetNativeAlarmCompletionAsync(alarmId);
  } catch {
    /* ignore */
  }
  try {
    const result = await AlarmScheduler.scheduleNativeAlarmBackupAsync(
      alarmId,
      delaySeconds,
    );
    return Boolean(result?.scheduled);
  } catch (e) {
    console.warn('[quiett os-alarm] timer backup failed', delaySeconds, e);
    return false;
  }
}

/**
 * Foreground dead-man while meditating: keep a custom-sound AlarmKit backup ~8s out.
 * Refreshed often from session so an active sit never reaches the fire time; force-quit
 * leaves that native timer armed. Bail rearm replaces with near-immediate delays.
 */
export async function armMeditationDeadMan(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (await isWakeResolvedToday()) return;
  void markPendingSitWake('meditating');
  const primaryId = (await loadNativeAlarmId()) || (await ensureAlarmId());
  const carriers = await loadBailCarrierIds();
  const waveIds = [primaryId, ...carriers];
  await armTimerBackup(primaryId, 8);
  if (carriers[0]) await armTimerBackup(carriers[0], 12);
  if (carriers[1]) await armTimerBackup(carriers[1], 16);
  await saveBailTimerIds(waveIds);
}

export async function clearMeditationDeadMan(): Promise<void> {
  if (Platform.OS === 'web') return;
  const primaryId = await loadNativeAlarmId();
  await cancelBailTimerWaves(primaryId);
}

async function cancelBailTimerWaves(preservePrimaryId?: string | null): Promise<void> {
  const ids = await loadBailTimerIds();
  const primary = preservePrimaryId ?? (await loadNativeAlarmId());
  const carriers = new Set(await loadBailCarrierIds());
  for (const id of ids) {
    try {
      await AlarmScheduler.cancelNativeAlarmBackupAsync(id);
    } catch {
      /* ignore */
    }
    // Keep daily primary + sound carriers (only their backups were cancelled).
    if ((primary && id === primary) || carriers.has(id)) continue;
    try {
      await AlarmScheduler.cancelAlarmAsync(id);
    } catch {
      /* ignore */
    }
    try {
      await AlarmScheduler.completeNativeAlarmAsync(id);
    } catch {
      /* ignore */
    }
  }
  if (ids.length) await clearBailTimerIds();
}


/**
 * Foreground-only: register AlarmKit ids that already carry quiett-harsh in storage.
 * We complete them immediately so they do not ring as `.alarm`; bail only uses their
 * timer backups (works after lock mutes an unlocked ring).
 */
export async function prepareBailSoundCarriers(): Promise<void> {
  if (Platform.OS === 'web') return;
  const existing = await loadBailCarrierIds();
  if (existing.length >= 2) {
    for (const id of existing) {
      try {
        await AlarmScheduler.completeNativeAlarmAsync(id);
      } catch {
        /* ignore */
      }
    }
    return;
  }

  await disposeBailSoundCarriers();

  let soundUri: string | undefined;
  try {
    clearHarshAlarmSoundUriCache();
    soundUri = await resolveHarshAlarmSoundUri();
  } catch (e) {
    console.warn('[quiett os-alarm] carrier sound', e);
  }

  const ids: string[] = [];
  for (let i = 0; i < 2; i++) {
    const id = randomUuid();
    const when = new Date(Date.now() + (3 + i) * 60 * 60 * 1000);
    try {
      await AlarmScheduler.scheduleAlarmAsync({
        id,
        hour: when.getHours(),
        minute: when.getMinutes(),
        weekdays: [],
        title: ALARM_TITLE,
        soundUri,
        ios: {
          ...bailIosGate,
          soundName: HARSH_ALARM_SOUND_NAME,
          soundUri,
        },
        android: {
          ...androidGate,
          stopIntentBehavior: 'openApp',
          soundName: 'quiett_harsh',
          volume: 1,
          enforceVolume: true,
        },
      });
      try {
        await AlarmScheduler.completeNativeAlarmAsync(id);
      } catch {
        /* keep store entry for backup sound */
      }
      ids.push(id);
    } catch (e) {
      console.warn('[quiett os-alarm] carrier schedule', e);
    }
  }
  if (ids.length) await saveBailCarrierIds(ids);
}

export async function disposeBailSoundCarriers(): Promise<void> {
  const ids = await loadBailCarrierIds();
  for (const id of ids) {
    try {
      await AlarmScheduler.cancelNativeAlarmBackupAsync(id);
    } catch {
      /* ignore */
    }
    try {
      await AlarmScheduler.cancelAlarmAsync(id);
    } catch {
      /* ignore */
    }
  }
  if (ids.length) await clearBailCarrierIds();
}

async function cancelStoredBailOneShot(): Promise<void> {
  const bailId = await loadBailAlarmId();
  if (!bailId) return;
  try {
    await AlarmScheduler.cancelAlarmAsync(bailId);
  } catch {
    /* ignore */
  }
  try {
    await AlarmScheduler.cancelNativeAlarmBackupAsync(bailId);
  } catch {
    /* ignore */
  }
  await clearBailAlarmId();
}

/**
 * Sit finished or emergency escape: mark done, clear handoff flag, restore tomorrow's daily alarm.
 */
export async function completeOsAlarmAndReschedule(
  prefs?: AlarmPrefs | null,
): Promise<void> {
  if (Platform.OS === 'web') return;
  osRingHandedToSession = false;
  await clearPendingSitWake();
  await markWakeResolvedToday();
  const ringingId = await resolveRingingAlarmId();
  await scrubNativeAlarmDebris(ringingId);
  // Also scrub the stable stored id (backups use that logical id).
  const storedId = await loadNativeAlarmId();
  if (storedId && storedId !== ringingId) {
    await scrubNativeAlarmDebris(storedId);
  }
  await cancelBailTimerWaves();
  const bailId = await loadBailAlarmId();
  if (bailId) {
    await scrubNativeAlarmDebris(bailId);
    try {
      await AlarmScheduler.cancelAlarmAsync(bailId);
    } catch {
      /* ignore */
    }
    await clearBailAlarmId();
  }
  if (prefs?.enabled) {
    await syncOsAlarm(prefs);
  }
}

export function didSessionTakeOverOsRing(): boolean {
  return osRingHandedToSession;
}
