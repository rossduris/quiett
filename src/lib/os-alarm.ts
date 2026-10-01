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
  saveBailCarrierIds,
  saveBailTimerIds,
  saveNativeAlarmId,
  loadAlarmSoundId,
  loadAlarmPrefs,
  loadScheduledAlarmSound,
  saveScheduledAlarmSound,
  type AlarmPrefs,
} from '@/lib/storage';
import {
  alarmKitSoundName,
  clearAlarmSoundUriCache,
  resolveAlarmSoundUri,
} from '@/lib/harsh-alarm-asset';

/**
 * Lock-screen / AlarmKit copy. Calm and short (the alert truncates long titles); never "sit".
 * Tint comes from the AccentColor asset (plugins/withAccentColor.js) — native, needs a rebuild.
 */
const ALARM_TITLE = 'Good morning. Time to settle in';
/** Bail / backup one-shots ring when the morning wasn't finished. */
const BAIL_TITLE = 'Your quiet minute is waiting';
const STOP_TITLE = 'Stop';
/** Opens Quiett straight into the morning session (handoff treats it as a live wake). */
const SECONDARY_TITLE = 'Settle in';
const COUNTDOWN_TITLE = 'Ringing again soon';

/**
 * iOS sound options for an AlarmKit alarm.
 *
 * Bundled tones (iosAlarmSounds plugin) are referenced by their own file name — unique per tone.
 * We used to also pass `soundUri`, which makes the scheduler copy the file to
 * Library/Sounds/alarm-scheduler-<alarmId>.caf: the SAME name for every tone on a given alarm
 * id. iOS caches alert sounds by name, so after switching tones the daily alarm and its bail
 * backups kept ringing the previously chosen tone. `soundUri` is now only a fallback for a tone
 * without a bundled file (Android keeps getting the resolved URI, as before).
 */
async function iosAlarmSoundFor(alarmSoundId: string): Promise<{ soundName?: string; soundUri?: string }> {
  const soundName = alarmKitSoundName(alarmSoundId);
  if (soundName && Platform.OS === 'ios') return { soundName };
  try {
    const soundUri = (await resolveAlarmSoundUri(alarmSoundId)) ?? undefined;
    return soundUri ? { soundUri } : {};
  } catch (e) {
    console.warn('[quiett os-alarm] alarm asset', e);
    return {};
  }
}

/** Stored with each schedule; a mismatch with the current selection means the alarm is stale. */
function soundKey(alarmSoundId: string): string {
  return `v2:${alarmSoundId}`;
}

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

/**
 * Stop + a calm "Settle in" button that opens the session (secondaryOpen handoff). The old
 * secondary button was removed for inconsistent behaviour; it now uses openApp explicitly.
 */
const iosButtons = {
  stopButtonTitle: STOP_TITLE,
  secondaryButtonTitle: SECONDARY_TITLE,
  secondaryButtonBehavior: 'openApp' as const,
  countdownTitle: COUNTDOWN_TITLE,
};

const iosGate = {
  alertTitle: ALARM_TITLE,
  ...iosButtons,
  alertActionMode: 'default' as const,
  stopIntentBehavior: 'rescheduleImmediate' as const,
  metadata: { source: 'quiett-home' },
};

/** Carriers / bail one-shots — no rescheduleImmediate cascade. */
const bailIosGate = {
  alertTitle: BAIL_TITLE,
  ...iosButtons,
  alertActionMode: 'default' as const,
  stopIntentBehavior: 'openApp' as const,
  metadata: { source: 'quiett-bail' },
};

const androidGate = {
  alertTitle: ALARM_TITLE,
  alertBody: 'A quiet start to your day',
  stopButtonTitle: STOP_TITLE,
  secondaryButtonTitle: SECONDARY_TITLE,
  secondaryButtonBehavior: 'openApp' as const,
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

  // No days picked means the alarm is off (Home shows it that way); scheduling with an empty
  // weekday list could otherwise leave a one-off ring behind.
  if (!prefs.enabled || prefs.weekdays.length === 0) {
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
    // Always read the live selection (never a cached pref) right before scheduling.
    const alarmSoundId = await loadAlarmSoundId();
    const iosSound = await iosAlarmSoundFor(alarmSoundId);
    const scheduled = await AlarmScheduler.scheduleAlarmAsync({
      id,
      hour,
      minute,
      title: ALARM_TITLE,
      weekdays: prefs.weekdays as AlarmWeekday[],
      soundUri: iosSound.soundUri,
      ios: {
        ...iosGate,
        ...(iosSound.soundName ? { soundName: iosSound.soundName } : {}),
        soundUri: iosSound.soundUri,
      },
      android: {
        ...androidGate,
        soundName: alarmSoundId,
      },
    });

    await saveNativeAlarmId(scheduled.id);
    await saveScheduledAlarmSound('daily', soundKey(alarmSoundId));
    return { ok: true, scheduled: true, id: scheduled.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not schedule the OS alarm.';
    return { ok: false, reason: 'error', message };
  }
}

export type OsAlarmPermissionState = 'authorized' | 'denied' | 'notDetermined' | 'unavailable';

function toPermissionState(p: AlarmPermissionResponse): OsAlarmPermissionState {
  if (p.canScheduleExactAlarms || p.status === 'authorized') return 'authorized';
  if (p.status === 'denied') return 'denied';
  if (p.status === 'unavailable') return 'unavailable';
  return 'notDetermined';
}

/** Current alarm (AlarmKit / exact-alarm) permission without prompting. */
export async function getOsAlarmPermission(): Promise<OsAlarmPermissionState> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    return toPermissionState(await AlarmScheduler.getPermissionsAsync());
  } catch {
    return 'unavailable';
  }
}

/** Show the system alarm permission prompt (once; later calls just report status). */
export async function requestOsAlarmPermission(): Promise<OsAlarmPermissionState> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    return toPermissionState(await AlarmScheduler.requestPermissionsAsync());
  } catch {
    return 'unavailable';
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
 * Foreground-only: register AlarmKit ids that already carry the chosen tone in storage.
 * We complete them immediately so they do not ring as `.alarm`; bail only uses their
 * timer backups (works after lock mutes an unlocked ring).
 */
export async function prepareBailSoundCarriers(): Promise<void> {
  if (Platform.OS === 'web') return;
  const alarmSoundId = await loadAlarmSoundId();
  const key = soundKey(alarmSoundId);
  // The daily alarm's timer backup is the first bail ring (it reuses the sound stored with that
  // alarm), so make sure it carries the current tone before anything can bail.
  await refreshDailyAlarmSoundIfStale(key);
  const existing = await loadBailCarrierIds();
  // Carriers keep the sound they were created with — reuse them only if it's still the selection.
  if (existing.length >= 2 && (await loadScheduledAlarmSound('carrier')) === key) {
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

  clearAlarmSoundUriCache();
  const iosSound = await iosAlarmSoundFor(alarmSoundId);

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
        soundUri: iosSound.soundUri,
        ios: {
          ...bailIosGate,
          ...(iosSound.soundName ? { soundName: iosSound.soundName } : {}),
          soundUri: iosSound.soundUri,
        },
        android: {
          ...androidGate,
          stopIntentBehavior: 'openApp',
          soundName: alarmSoundId,
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
  if (ids.length) {
    await saveBailCarrierIds(ids);
    await saveScheduledAlarmSound('carrier', key);
  }
}

/** Reschedule the daily alarm if it was scheduled with a different (or pre-fix) sound. */
async function refreshDailyAlarmSoundIfStale(key: string): Promise<void> {
  try {
    if ((await loadScheduledAlarmSound('daily')) === key) return;
    const prefs = await loadAlarmPrefs();
    if (!prefs.enabled) return;
    const res = await syncOsAlarm(prefs);
    if (!res.ok) console.warn('[quiett os-alarm] refresh daily sound', res.message);
  } catch (e) {
    console.warn('[quiett os-alarm] refresh daily sound', e);
  }
}

/**
 * The alarm sound changed: reschedule the daily alarm (and so its backups) with the new tone and
 * drop the bail carriers so the next session recreates them with it.
 */
export async function applyAlarmSoundChange(prefs: AlarmPrefs): Promise<SyncOsAlarmResult | undefined> {
  if (Platform.OS === 'web') return undefined;
  await disposeBailSoundCarriers();
  return syncOsAlarm(prefs);
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
  await saveScheduledAlarmSound('carrier', null);
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
