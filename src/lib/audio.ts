import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import {
  alarmSoundById,
  isToneSound,
  meditationSoundById,
  QUIETT_HARSH_SESSION,
} from '@/constants/sounds';
import { voiceClipFor } from '@/constants/voices';
import { loadDevFlags, voiceGuidesEnabled } from '@/lib/dev-flags';
import { loadAlarmSoundId, loadMeditationSoundId, loadVoiceGuideId } from '@/lib/storage';

// ---------------------------------------------------------------------------
// Session audio: harsh alarm → backtrack (selected tone / ambient) + optional voice layer.
// ---------------------------------------------------------------------------

/** Backtrack level during the meditation. */
const BACKTRACK_VOLUME = 0.7;
/** Backtrack is ducked by this much while the voice guide speaks. */
const VOICE_DUCK_DB = 7;
const BACKTRACK_DUCKED = BACKTRACK_VOLUME * Math.pow(10, -VOICE_DUCK_DB / 20);
const DUCK_DOWN_MS = 600;
const DUCK_UP_MS = 1400;
/** Let the backtrack settle in before the voice starts. */
const VOICE_LEAD_MS = 2500;
const VOICE_VOLUME = 1;
/** Backtrack fades in over this on the first play of a session (clips have no file-level fade). */
const FIRST_PLAY_FADE_MS = 3000;
/** Tone clips are 5-min seamless loops; fallback if the player has not reported a duration. */
const TONE_CLIP_SECONDS = 300;
/**
 * Tone sessions start somewhere in the first 60% of the clip (ambient loops start at 0), so at
 * least 2:00 plays before the clip end. Clips are cut as seamless loops (tail crossfaded into
 * the head), and the backtrack player loops, so a session that runs on (or the /success tail)
 * wraps with no dip.
 */
const TONE_START_WINDOW = 0.6;
/** Backtrack carried into /success fades out on its own after this long. */
const TAIL_MAX_MS = 5 * 60_000;

let harsh: AudioPlayer | null = null;
let calm: AudioPlayer | null = null;
let modeReady = false;
let loadedAlarmId: string | null = null;
let loadedMeditationId: string | null = null;
/** First play of this backtrack player already chose its start offset. */
let calmStarted = false;

let voice: AudioPlayer | null = null;
let voiceSub: { remove: () => void } | null = null;
let loadedVoiceClip: number | null = null;
/** idle = not started yet; playing = started (may be paused with the session); done = finished. */
let voiceState: 'idle' | 'playing' | 'done' = 'idle';
let voiceLeadTimer: ReturnType<typeof setTimeout> | null = null;

/** Backtrack handed to /success after the unlock (keeps playing until the user leaves). */
let tail: AudioPlayer | null = null;
let tailTimer: ReturnType<typeof setTimeout> | null = null;

/** Exclusive loudspeaker playback for in-app harsh (media stream; denser than AlarmKit file). */
async function ensureMode() {
  if (modeReady) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
      // Exclusive focus so the session harsh is not ducked under other audio.
      interruptionMode: 'doNotMix',
    });
  } catch (e) {
    console.warn('[quiett audio] mode', e);
  }
  modeReady = true;
}

// ── Volume ramps (simple ducking / fades) ──────────────────────────────────

const RAMP_STEP_MS = 50;
const ramps = new WeakMap<AudioPlayer, ReturnType<typeof setInterval>>();

function cancelRamp(player: AudioPlayer) {
  const id = ramps.get(player);
  if (id) clearInterval(id);
  ramps.delete(player);
}

/** Linear volume ramp; replaces any ramp already running on this player. */
function rampVolume(player: AudioPlayer, to: number, ms: number, onDone?: () => void) {
  cancelRamp(player);
  let from = to;
  try {
    from = player.volume;
  } catch {
    /* ignore */
  }
  const steps = Math.max(1, Math.round(ms / RAMP_STEP_MS));
  let step = 0;
  const id = setInterval(() => {
    step += 1;
    try {
      player.volume = from + (to - from) * Math.min(1, step / steps);
    } catch {
      /* ignore */
    }
    if (step >= steps) {
      cancelRamp(player);
      onDone?.();
    }
  }, RAMP_STEP_MS);
  ramps.set(player, id);
}

function setVolumeNow(player: AudioPlayer | null, v: number) {
  if (!player) return;
  cancelRamp(player);
  try {
    player.volume = v;
  } catch {
    /* ignore */
  }
}

function removePlayer(player: AudioPlayer | null) {
  if (!player) return;
  cancelRamp(player);
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

// ── Players ─────────────────────────────────────────────────────────────────

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

function clearVoiceLead() {
  if (voiceLeadTimer) clearTimeout(voiceLeadTimer);
  voiceLeadTimer = null;
}

function releaseVoice() {
  clearVoiceLead();
  try {
    voiceSub?.remove();
  } catch {
    /* ignore */
  }
  voiceSub = null;
  removePlayer(voice);
  voice = null;
  loadedVoiceClip = null;
  voiceState = 'idle';
}

/** Voice layer for this session: only with "Voice guides" on and a voice picked. */
async function ensureVoice() {
  await loadDevFlags();
  const clip = voiceGuidesEnabled() ? voiceClipFor(await loadVoiceGuideId()) : null;
  if (clip === loadedVoiceClip && (clip == null || voice)) return;
  releaseVoice();
  if (clip == null) return;
  try {
    const player = createAudioPlayer(clip);
    player.loop = false;
    player.volume = VOICE_VOLUME;
    voiceSub = player.addListener('playbackStatusUpdate', (status) => {
      if (voice !== player || !status.didJustFinish) return;
      voiceState = 'done';
      if (calm) rampVolume(calm, BACKTRACK_VOLUME, DUCK_UP_MS);
    });
    voice = player;
    loadedVoiceClip = clip;
  } catch (e) {
    console.warn('[quiett audio] voice', e);
  }
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
    removePlayer(calm);
    calm = createAudioPlayer(meditationSoundById(meditationId).url);
    calm.loop = true;
    calm.volume = BACKTRACK_VOLUME;
    loadedMeditationId = meditationId;
    calmStarted = false;
  }

  await ensureVoice();
}

/** Wait briefly for a freshly created player to load (duration / seeking need it). */
async function waitLoaded(player: AudioPlayer, ms = 1500) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if (player.isLoaded) return;
    } catch {
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** Start point: random within the first ~60% of a tone clip; 0 for ambient loops. */
async function seekToSessionStart(player: AudioPlayer, soundId: string) {
  if (!isToneSound(soundId)) return;
  await waitLoaded(player);
  let duration = 0;
  try {
    duration = player.duration;
  } catch {
    /* ignore */
  }
  const len = duration > 30 ? duration : TONE_CLIP_SECONDS;
  const offset = Math.floor(Math.random() * len * TONE_START_WINDOW);
  if (offset <= 0) return;
  try {
    await player.seekTo(offset);
  } catch (e) {
    console.warn('[quiett audio] seek', e);
  }
}

/** Stop the backtrack carried into /success right away (a new session or preview starts). */
function stopTail() {
  if (tailTimer) clearTimeout(tailTimer);
  tailTimer = null;
  const player = tail;
  tail = null;
  removePlayer(player);
}

/**
 * In-app alarm for /session while foreground.
 * Uses the user's selected alarm sound (same as lock-screen AlarmKit tone).
 * Skip when backgrounded — AlarmKit owns the nag there.
 */
export async function playHarshAlarm() {
  stopPreview();
  stopTail();
  if (AppState.currentState !== 'active') {
    return;
  }
  modeReady = false; // re-assert doNotMix each session open
  await ensureMode();
  await ensurePlayers();
  clearVoiceLead();
  try {
    voice?.pause();
  } catch {
    /* ignore */
  }
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

/** Voice starts after a short lead-in (first time) or resumes; the backtrack ducks under it. */
function startOrResumeVoice() {
  const player = voice;
  if (!player || voiceState === 'done') return;
  const begin = () => {
    voiceLeadTimer = null;
    if (voice !== player || AppState.currentState !== 'active') return;
    voiceState = 'playing';
    if (calm) rampVolume(calm, BACKTRACK_DUCKED, DUCK_DOWN_MS);
    try {
      player.play();
    } catch (e) {
      console.warn('[quiett audio] voice play', e);
      voiceState = 'done';
      if (calm) rampVolume(calm, BACKTRACK_VOLUME, DUCK_UP_MS);
    }
  };
  clearVoiceLead();
  if (voiceState === 'playing') begin();
  else voiceLeadTimer = setTimeout(begin, VOICE_LEAD_MS);
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
  const player = calm!;
  const firstPlay = !calmStarted;
  if (firstPlay) {
    calmStarted = true;
    await seekToSessionStart(player, loadedMeditationId ?? '');
    if (calm !== player) return; // rebuilt while seeking
    setVolumeNow(player, 0);
  }
  try {
    player.play();
  } catch (e) {
    console.warn('[quiett audio] calm', e);
  }
  // Short fade-in on the first play only; resumes come straight back at full level.
  if (firstPlay) rampVolume(player, BACKTRACK_VOLUME, FIRST_PLAY_FADE_MS);
  startOrResumeVoice();
}

export async function stopAllAudio() {
  stopPreview();
  clearVoiceLead();
  try {
    harsh?.pause();
  } catch {
    /* ignore */
  }
  try {
    voice?.pause();
  } catch {
    /* ignore */
  }
  try {
    calm?.pause();
  } catch {
    /* ignore */
  }
  // Un-duck; a resumed voice ducks again.
  setVolumeNow(calm, BACKTRACK_VOLUME);
}

/**
 * Unlock reached: the backtrack keeps playing into /success. The voice fades out, the
 * backtrack comes back up to full level, and the session's release no longer owns it.
 * /success calls `fadeOutBacktrack()` when the user leaves (or taps to begin the day).
 */
export function handoffBacktrackToSuccess() {
  stopPreview();
  try {
    harsh?.pause();
  } catch {
    /* ignore */
  }
  clearVoiceLead();
  const v = voice;
  if (v && voiceState === 'playing') {
    try {
      voiceSub?.remove();
    } catch {
      /* ignore */
    }
    voiceSub = null;
    voice = null;
    loadedVoiceClip = null;
    voiceState = 'idle';
    rampVolume(v, 0, 700, () => removePlayer(v));
  } else {
    releaseVoice();
  }
  stopTail();
  const player = calm;
  calm = null;
  loadedMeditationId = null;
  calmStarted = false;
  if (!player) return;
  tail = player;
  rampVolume(player, BACKTRACK_VOLUME, DUCK_UP_MS);
  tailTimer = setTimeout(() => fadeOutBacktrack(4000), TAIL_MAX_MS);
}

/** Fade out and release the backtrack carried into /success (no-op when there is none). */
export function fadeOutBacktrack(ms = 1800) {
  if (tailTimer) clearTimeout(tailTimer);
  tailTimer = null;
  const player = tail;
  if (!player) return;
  rampVolume(player, 0, ms, () => {
    if (tail === player) tail = null;
    removePlayer(player);
  });
}

/** Stop the /success backtrack immediately (app backgrounded — JS timers may not run). */
export function stopBacktrack() {
  stopTail();
}

export function releaseAudio() {
  stopPreview();
  removePlayer(harsh);
  removePlayer(calm);
  releaseVoice();
  harsh = null;
  calm = null;
  loadedAlarmId = null;
  loadedMeditationId = null;
  calmStarted = false;
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
  stopTail();
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
