import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
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

/** Preview a sound URL briefly (settings). */
export async function previewSoundUrl(url: string | number) {
  await ensureMode();
  const player = createAudioPlayer(url);
  player.volume = 0.85;
  try {
    player.play();
    await new Promise((r) => setTimeout(r, 1800));
  } finally {
    try {
      player.pause();
      player.remove();
    } catch {
      /* ignore */
    }
  }
}
