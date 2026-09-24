import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import {
  alarmSoundById,
  meditationSoundById,
  QUIETT_HARSH_SESSION,
} from '@/constants/sounds';
import { loadAlarmSoundId, loadMeditationSoundId } from '@/lib/storage';

let harsh: AudioPlayer | null = null;
let calm: AudioPlayer | null = null;
let modeReady = false;
let loadedAlarmId: string | null = null;
let loadedMeditationId: string | null = null;

/** Exclusive loudspeaker playback for in-app harsh (media stream; denser than AlarmKit file). */
async function ensureMode() {
  if (modeReady) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
      // Exclusive focus so the sit harsh is not ducked under other audio.
      interruptionMode: 'doNotMix',
    });
  } catch (e) {
    console.warn('[quiett audio] mode', e);
  }
  modeReady = true;
}

function rebuildHarsh(alarmId: string) {
  try {
    harsh?.remove();
  } catch {
    /* ignore */
  }
  // Use optimized session version for Quiett harsh; standard assets for others.
  const asset = alarmId === 'quiett_harsh' 
    ? QUIETT_HARSH_SESSION 
    : alarmSoundById(alarmId).url ?? QUIETT_HARSH_SESSION;
  harsh = createAudioPlayer(asset);
  harsh.loop = true;
  harsh.volume = 1;
  loadedAlarmId = alarmId;
}

async function ensurePlayers() {
  const [alarmId, meditationId] = await Promise.all([
    loadAlarmSoundId(),
    loadMeditationSoundId(),
  ]);

  if (!harsh || loadedAlarmId !== alarmId) {
    rebuildHarsh(alarmId);
  }

  if (!calm || loadedMeditationId !== meditationId) {
    try {
      calm?.remove();
    } catch {
      /* ignore */
    }
    calm = createAudioPlayer(meditationSoundById(meditationId).url);
    calm.loop = true;
    calm.volume = 0.7;
    loadedMeditationId = meditationId;
  }
}

/**
 * In-app alarm for /session while foreground.
 * Uses the user's selected alarm sound (same as lock-screen AlarmKit tone).
 * Skip when backgrounded — AlarmKit owns the nag there.
 */
export async function playHarshAlarm() {
  stopPreview();
  if (AppState.currentState !== 'active') {
    return;
  }
  modeReady = false; // re-assert doNotMix each sit open
  await ensureMode();
  await ensurePlayers();
  try {
    calm?.pause();
  } catch {
    /* ignore */
  }
  try {
    harsh!.volume = 1;
    harsh!.play();
  } catch (e) {
    console.warn('[quiett audio] alarm retry', e);
    try {
      const alarmId = await loadAlarmSoundId();
      rebuildHarsh(alarmId);
      harsh!.volume = 1;
      harsh!.play();
    } catch (e2) {
      console.warn('[quiett audio] alarm', e2);
    }
  }
}

export async function crossfadeToMeditation() {
  stopPreview();
  if (AppState.currentState !== 'active') {
    return;
  }
  await ensureMode();
  await ensurePlayers();
  try {
    harsh?.pause();
  } catch {
    /* ignore */
  }
  try {
    calm!.play();
  } catch (e) {
    console.warn('[quiett audio] calm', e);
  }
}

export async function stopAllAudio() {
  stopPreview();
  try {
    harsh?.pause();
  } catch {
    /* ignore */
  }
  try {
    calm?.pause();
  } catch {
    /* ignore */
  }
}

export function releaseAudio() {
  stopPreview();
  try {
    harsh?.remove();
  } catch {
    /* ignore */
  }
  try {
    calm?.remove();
  } catch {
    /* ignore */
  }
  harsh = null;
  calm = null;
  loadedAlarmId = null;
  loadedMeditationId = null;
  modeReady = false;
}

// ---------------------------------------------------------------------------
// Previews: one global play/stop preview player, separate from session audio.
// ---------------------------------------------------------------------------

/** 'alarm' = wake-up tones, 'track' = meditation / music / ambient. */
export type PreviewKind = 'alarm' | 'track';

const PREVIEW_CAP_MS: Record<PreviewKind, number> = { alarm: 6_000, track: 20_000 };
const PREVIEW_FADE_MS = 900;
const PREVIEW_FADE_STEPS = 12;
const PREVIEW_VOLUME = 0.85;

let previewPlayer: AudioPlayer | null = null;
let previewSub: { remove: () => void } | null = null;
let previewCapTimer: ReturnType<typeof setTimeout> | null = null;
let previewFadeTimer: ReturnType<typeof setInterval> | null = null;
/** Bumped on every start/stop so stale async work and callbacks can bail out. */
let previewToken = 0;
let previewPlayingId: string | null = null;
const previewListeners = new Set<() => void>();

function setPreviewPlayingId(id: string | null) {
  if (previewPlayingId === id) return;
  previewPlayingId = id;
  previewListeners.forEach((listener) => listener());
}

/** Tear down the preview player, timers and listener. Never touches session players. */
function teardownPreview() {
  previewToken += 1;
  if (previewCapTimer) clearTimeout(previewCapTimer);
  if (previewFadeTimer) clearInterval(previewFadeTimer);
  previewCapTimer = null;
  previewFadeTimer = null;
  try {
    previewSub?.remove();
  } catch {
    /* ignore */
  }
  previewSub = null;
  const player = previewPlayer;
  previewPlayer = null;
  if (player) {
    try {
      player.pause();
    } catch {
      /* ignore */
    }
    try {
      player.remove();
    } catch {
      /* ignore */
    }
  }
}

/** Stop any preview immediately (sheet close, blur, background, session start). */
export function stopPreview() {
  if (!previewPlayer && previewPlayingId === null) return;
  teardownPreview();
  setPreviewPlayingId(null);
}

function fadeOutPreview(token: number) {
  const player = previewPlayer;
  if (!player || token !== previewToken) return;
  let startVolume = PREVIEW_VOLUME;
  try {
    startVolume = player.volume;
  } catch {
    /* ignore */
  }
  let step = 0;
  previewFadeTimer = setInterval(() => {
    if (token !== previewToken) return;
    step += 1;
    try {
      player.volume = Math.max(0, startVolume * (1 - step / PREVIEW_FADE_STEPS));
    } catch {
      /* ignore */
    }
    if (step >= PREVIEW_FADE_STEPS) stopPreview();
  }, PREVIEW_FADE_MS / PREVIEW_FADE_STEPS);
}

/**
 * Start a preview (stops whatever preview is playing). Plays up to the cap for its kind,
 * then fades out; shorter clips just end naturally.
 */
export async function startPreview(id: string, url: string | number, kind: PreviewKind) {
  teardownPreview();
  const token = previewToken;
  setPreviewPlayingId(id);
  await ensureMode();
  if (token !== previewToken) return; // stopped or superseded while awaiting
  let player: AudioPlayer;
  try {
    player = createAudioPlayer(url);
  } catch (e) {
    console.warn('[quiett audio] preview', e);
    stopPreview();
    return;
  }
  previewPlayer = player;
  try {
    player.loop = false;
    player.volume = PREVIEW_VOLUME;
  } catch {
    /* ignore */
  }
  previewSub = player.addListener('playbackStatusUpdate', (status) => {
    if (token !== previewToken) return;
    if (status.didJustFinish) stopPreview();
  });
  try {
    player.play();
  } catch (e) {
    console.warn('[quiett audio] preview play', e);
    stopPreview();
    return;
  }
  previewCapTimer = setTimeout(
    () => fadeOutPreview(token),
    PREVIEW_CAP_MS[kind] - PREVIEW_FADE_MS,
  );
}

/** Play/stop toggle: tapping the playing item stops it; anything else replaces it. */
export function togglePreview(id: string, url: string | number, kind: PreviewKind) {
  if (previewPlayingId === id) {
    stopPreview();
    return;
  }
  void startPreview(id, url, kind);
}

/** Stable preview ids so the same sound shows as playing everywhere (Home, sheets, Library). */
export const previewIds = {
  alarm: (soundId: string) => `alarm:${soundId}`,
  track: (trackId: string) => `track:${trackId}`,
};

function subscribePreview(listener: () => void) {
  previewListeners.add(listener);
  return () => {
    previewListeners.delete(listener);
  };
}

function getPreviewPlayingId() {
  return previewPlayingId;
}

/** React binding for the global preview player. */
export function usePreviewPlayer() {
  const playingId = useSyncExternalStore(subscribePreview, getPreviewPlayingId, getPreviewPlayingId);
  const toggle = useCallback(
    (id: string, url: string | number, kind: PreviewKind) => togglePreview(id, url, kind),
    [],
  );
  return { playingId, toggle, stop: stopPreview };
}

/** Sheets: stop the preview when `visible` flips to false, or on unmount while open. */
export function useStopPreviewWhenHidden(visible: boolean) {
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (wasVisible.current && !visible) stopPreview();
    wasVisible.current = visible;
  }, [visible]);
  useEffect(
    () => () => {
      if (wasVisible.current) stopPreview();
    },
    [],
  );
}

// Backgrounding (or the system alarm UI taking over) always ends a preview.
AppState.addEventListener('change', (state) => {
  if (state !== 'active') stopPreview();
});
