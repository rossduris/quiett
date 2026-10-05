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
  peekPendingSitWakeMeta,
  saveBailCarrierIds,
  saveBailTimerIds,
  saveNativeAlarmId,
  loadAlarmSoundId,
  loadAlarmPrefs,
  loadScheduledAlarmSound,
  saveScheduledAlarmSound,
  type AlarmPrefs,
} from '@/lib/storage';
import { isWithinMorningWakeGrace, MORNING_MISS_GRACE_MS } from '@/lib/home-status';
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
  // openApp: Stop records handoff + foregrounds into /session. Do NOT use
  // rescheduleImmediate here — its ~0.1s native backup races handoff and can
  // look like silence-and-miss. Safe backup is JS rearmOsAlarmAfterBail on bail.
  stopIntentBehavior: 'openApp' as const,
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
  stopIntentBehavior: 'openApp' as const,
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


/** Dev-only breadcrumb for every route-to-session decision. */
function logWakeRoute(decision: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  if (detail) console.log(`[quiett wake] ${decision}`, detail);
  else console.log(`[quiett wake] ${decision}`);
}

function isTimestampFresh(ts: number | undefined | null, maxAgeMs = MORNING_MISS_GRACE_MS): boolean {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return false;
  const age = Date.now() - ts;
  return age >= 0 && age < maxAgeMs;
}

/**
 * Fresh sticky sit flag, or null if missing/stale. Stale sticky is cleared.
 * Legacy plain-string sticky (at=0) is only kept while still inside morning grace.
 */
async function freshStickyReason(prefs?: AlarmPrefs | null): Promise<string | null> {
  const meta = await peekPendingSitWakeMeta();
  if (!meta) return null;
  if (meta.at > 0) {
    if (isTimestampFresh(meta.at)) return meta.reason;
    await clearPendingSitWake();
    logWakeRoute('clear-stale-sticky', { reason: meta.reason, at: meta.at, ageMs: Date.now() - meta.at });
    return null;
  }
  // Legacy sticky without a stamp: honor only inside today's post-ring grace.
  const p = prefs ?? (await loadAlarmPrefs().catch(() => null));
  if (p && isWithinMorningWakeGrace(p)) return meta.reason;
  await clearPendingSitWake();
  logWakeRoute('clear-legacy-sticky', { reason: meta.reason });
  return null;
}

type NativeWakeSignals = {
  handoff: { alarmId?: string; action?: string; timestamp?: number } | null;
  context: { id?: string; state?: string } | null;
  actions: { id: string; alarmId?: string; action?: string; timestamp?: number }[];
};

async function readNativeWakeSignals(): Promise<NativeWakeSignals> {
  try {
    const [handoff, context, actions] = await Promise.all([
      AlarmScheduler.getPendingNativeAlarmHandoffAsync().catch(() => null),
      AlarmScheduler.getCurrentAlarmContextAsync().catch(() => null),
      AlarmScheduler.getPendingAlarmActionsAsync().catch(() => []),
    ]);
    return {
      handoff: handoff ?? null,
      context: context ?? null,
      actions: Array.isArray(actions) ? actions : [],
    };
  } catch {
    return { handoff: null, context: null, actions: [] };
  }
}

const OPEN_ACTIONS = new Set(['nativeStop', 'secondaryOpen', 'dismiss']);

/**
 * Genuine live OS wake worth opening /session for.
 * - Alerting right now always counts (AlarmKit is ringing).
 * - Handoff / pending actions only count when their timestamp is within the grace window
 *   (or they have no timestamp *and* we are still inside morning grace — legacy).
 * Stale handoff/actions are scrubbed so they cannot revive a finished morning.
 */
async function evaluateFreshOsWake(
  prefs?: AlarmPrefs | null,
): Promise<{ live: boolean; reason: string | null; alarmId: string | null; signals: NativeWakeSignals }> {
  const signals = await readNativeWakeSignals();
  const { handoff, context, actions } = signals;
  const p = prefs ?? (await loadAlarmPrefs().catch(() => null));
  const inMorningGrace = Boolean(p && isWithinMorningWakeGrace(p));

  if (context?.state === 'alerting') {
    return {
      live: true,
      reason: 'alerting',
      alarmId: context.id ?? handoff?.alarmId ?? null,
      signals,
    };
  }

  const openActions = actions.filter((a) => a.action && OPEN_ACTIONS.has(a.action));
  const freshHandoff =
    handoff?.alarmId &&
    (isTimestampFresh(handoff.timestamp) || (handoff.timestamp == null && inMorningGrace))
      ? handoff
      : null;
  const freshAction =
    openActions.find((a) => isTimestampFresh(a.timestamp)) ||
    (inMorningGrace ? openActions.find((a) => a.timestamp == null || a.timestamp === 0) : undefined) ||
    null;

  // Scrub stale native debris so a finished morning cannot resurrect.
  const staleHandoff = Boolean(handoff?.alarmId) && !freshHandoff;
  const staleActionIds = openActions
    .filter((a) => a !== freshAction && !isTimestampFresh(a.timestamp) && !(inMorningGrace && (a.timestamp == null || a.timestamp === 0)))
    .map((a) => a.id);
  if (staleHandoff || staleActionIds.length) {
    try {
      if (staleHandoff) await AlarmScheduler.clearPendingNativeAlarmHandoffAsync();
      if (staleActionIds.length) await AlarmScheduler.clearPendingAlarmActionsAsync(staleActionIds);
      logWakeRoute('scrub-stale-native', {
        staleHandoff,
        staleActionIds,
        handoffTs: handoff?.timestamp,
      });
    } catch {
      /* best-effort */
    }
  }

  if (freshHandoff) {
    return {
      live: true,
      reason: freshHandoff.action || 'handoff',
      alarmId: freshHandoff.alarmId ?? null,
      signals,
    };
  }
  if (freshAction) {
    return {
      live: true,
      reason: freshAction.action || 'action',
      alarmId: freshAction.alarmId ?? null,
      signals,
    };
  }
  return { live: false, reason: null, alarmId: null, signals };
}

/**
 * True when a wake is in flight: fresh sticky sit flag, fresh native Stop/Settle-in handoff,
 * AlarmKit still alerting, or within the post-ring grace (and morning not resolved). Home's
 * cold-start syncOsAlarm must not cancel in that window — cancelAlarmAsync clears pending
 * handoff (native clearActions), which drops the route into /session.
 *
 * Stale sticky / handoff never counts: that was the hours-later /session reopen bug.
 */
export async function isLiveAlarmWakePending(prefs?: AlarmPrefs | null): Promise<boolean> {
  if (await isWakeResolvedToday()) {
    // Resolved mornings only stay "live" while AlarmKit is genuinely still alerting
    // (a brand-new ring the same day). Stale sticky must not block reschedule forever.
    const os = await evaluateFreshOsWake(prefs);
    if (os.live && os.reason === 'alerting') return true;
    // Drop leftover sticky so sync can reschedule tomorrow.
    if (await peekPendingSitWakeMeta()) {
      await clearPendingSitWake();
      logWakeRoute('clear-sticky-after-resolved');
    }
    return false;
  }
  if (await freshStickyReason(prefs)) return true;
  const os = await evaluateFreshOsWake(prefs);
  if (os.live) return true;
  const p = prefs ?? (await loadAlarmPrefs().catch(() => null));
  return Boolean(p && isWithinMorningWakeGrace(p));
}

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

  // Never cancel/re-schedule over a live wake / post-ring grace: that wipes the native handoff
  // AlarmHandoffGate needs (cancelAlarmAsync → native clearActions).
  if (await isLiveAlarmWakePending(prefs)) {
    return { ok: true, scheduled: true };
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
 * Read native handoff only when a real (fresh) wake is in progress.
 * Do not treat a merely *scheduled* daily alarm, a stale sticky, or a day already
 * resolved as a handoff — that re-opened /session hours after end-early.
 */
export async function consumeAlarmHandoff(): Promise<AlarmHandoff | null> {
  if (Platform.OS === 'web') return null;
  try {
    const prefs = await loadAlarmPrefs().catch(() => null);
    const resolved = await isWakeResolvedToday();
    const sticky = await freshStickyReason(prefs);
    const os = await evaluateFreshOsWake(prefs);

    // Morning already finished/skipped: only a brand-new OS ring may reopen /session.
    if (resolved) {
      if (!(os.live && os.reason === 'alerting')) {
        if (sticky) await clearPendingSitWake();
        // Scrub leftover handoff so Gate retries cannot revive it.
        if (os.signals.handoff?.alarmId || os.signals.actions.length) {
          await scrubNativeAlarmDebris(os.alarmId || (await loadNativeAlarmId()));
        }
        logWakeRoute('consume-skip-resolved', { sticky, osReason: os.reason });
        return null;
      }
      // Genuine new alert after an earlier finish — require another sit.
      await clearWakeResolved();
      logWakeRoute('consume-new-ring-after-resolved', { alarmId: os.alarmId });
    }

    if (!os.live && !sticky) {
      logWakeRoute('consume-none');
      return null;
    }

    const reason = os.reason || sticky || 'os';
    const alarmId = os.alarmId || (await loadNativeAlarmId()) || 'pending';

    // Sticky so Gate still routes if native handoff is cleared (sync race / body tap).
    if (reason === 'nativeStop' || sticky === 'nativeStop') {
      await markPendingSitWake('nativeStop');
      osRingHandedToSession = true;
    } else {
      await markPendingSitWake(reason);
    }

    const { actions, handoff } = os.signals;
    if (actions.length) {
      try {
        await AlarmScheduler.clearPendingAlarmActionsAsync(actions.map((a) => a.id));
      } catch {
        /* ignore */
      }
    }
    if (handoff?.alarmId) {
      try {
        await AlarmScheduler.clearPendingNativeAlarmHandoffAsync();
      } catch {
        /* ignore */
      }
    }

    logWakeRoute('consume-handoff', { alarmId, action: reason, hadSticky: Boolean(sticky), osLive: os.live });
    return { alarmId, action: reason };
  } catch (e) {
    logWakeRoute('consume-error', { error: String(e) });
    // Still honor a *fresh* sticky wake. Never clear wakeResolved for stale sticky.
    const sticky = await freshStickyReason();
    if (sticky) {
      if (await isWakeResolvedToday()) {
        await clearPendingSitWake();
        logWakeRoute('consume-error-skip-resolved-sticky');
        return null;
      }
      return { alarmId: (await loadNativeAlarmId()) || 'pending', action: sticky };
    }
    try {
      const ctx = await AlarmScheduler.getCurrentAlarmContextAsync();
      if (ctx?.state === 'alerting') {
        if (await isWakeResolvedToday()) await clearWakeResolved();
        await markPendingSitWake('alerting');
        return { alarmId: ctx.id || (await loadNativeAlarmId()) || 'pending', action: 'alerting' };
      }
    } catch {
      /* ignore */
    }
    return null;
  }
}

/**
 * True when OS wake requires /session (Stop, Settle in, LA body while alerting, fresh sticky).
 * Stale sticky / resolved mornings never force /session.
 */
export async function shouldForceSitSession(): Promise<boolean> {
  const prefs = await loadAlarmPrefs().catch(() => null);
  const resolved = await isWakeResolvedToday();
  const sticky = await freshStickyReason(prefs);
  const os = await evaluateFreshOsWake(prefs);

  if (resolved) {
    if (os.live && os.reason === 'alerting') {
      await clearWakeResolved();
      if (!(await peekPendingSitWake())) await markPendingSitWake('alerting');
      logWakeRoute('force-session', { reason: 'alerting-after-resolved' });
      return true;
    }
    if (sticky) await clearPendingSitWake();
    logWakeRoute('force-skip-resolved', { sticky: Boolean(sticky), osReason: os.reason });
    return false;
  }

  if (sticky) {
    logWakeRoute('force-session', { reason: `sticky:${sticky}` });
    return true;
  }

  if (os.live) {
    if (!(await peekPendingSitWake())) {
      await markPendingSitWake(os.reason || 'os');
    }
    logWakeRoute('force-session', { reason: os.reason || 'os' });
    return true;
  }

  logWakeRoute('force-skip-none');
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
 * Persist "morning resolved" + scrub every wake flag (JS sticky, native handoff,
 * AlarmKit alerting debris, bail timers/carriers). Does NOT reschedule — call
 * syncOsAlarm / completeOsAlarmAndReschedule for that.
 *
 * Session must await this BEFORE navigating to /emergency or /success so
 * AlarmHandoffGate cannot bounce back into /session on the pathname change.
 */
export async function finalizeWakeResolution(): Promise<void> {
  if (Platform.OS === 'web') {
    await clearPendingSitWake();
    await markWakeResolvedToday();
    return;
  }
  osRingHandedToSession = false;
  // Sticky + resolved first (AsyncStorage) so a concurrent Gate reconcile sees them.
  await clearPendingSitWake();
  await markWakeResolvedToday();
  const ringingId = await resolveRingingAlarmId();
  await scrubNativeAlarmDebris(ringingId);
  const storedId = await loadNativeAlarmId();
  if (storedId && storedId !== ringingId) {
    await scrubNativeAlarmDebris(storedId);
  }
  await cancelBailTimerWaves();
  await clearMeditationDeadMan();
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
  try {
    await disposeBailSoundCarriers();
  } catch (e) {
    console.warn('[quiett os-alarm] dispose carriers', e);
  }
  logWakeRoute('finalize-wake-resolution', { ringingId, storedId });
}

/**
 * Sit finished or emergency escape: mark done, clear handoff flag, restore tomorrow's daily alarm.
 */
export async function completeOsAlarmAndReschedule(
  prefs?: AlarmPrefs | null,
): Promise<void> {
  if (Platform.OS === 'web') {
    await finalizeWakeResolution();
    return;
  }
  await finalizeWakeResolution();
  if (prefs?.enabled) {
    await syncOsAlarm(prefs);
  }
}

export function didSessionTakeOverOsRing(): boolean {
  return osRingHandedToSession;
}
