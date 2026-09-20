import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import { AppState } from 'react-native';
import {
  meditationSoundById,
  QUIETT_HARSH_ALARM,
} from '@/constants/sounds';
import { loadAlarmSoundId, loadMeditationSoundId } from '@/lib/storage';

let harsh: AudioPlayer | null = null;
let calm: AudioPlayer | null = null;
let modeReady = false;
let loadedAlarmId: string | null = null;
let loadedMeditationId: string | null = null;

/** Loudspeaker playback for in-app harsh / meditation (foreground session). */
async function ensureMode() {
  if (modeReady) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
      // mix so AlarmKit can take over on bail without a sticky exclusive session
      interruptionMode: 'mixWithOthers',
    });
  } catch (e) {
    console.warn('[quiett audio] mode', e);
  }
  modeReady = true;
}

function rebuildHarsh() {
  try {
    harsh?.remove();
  } catch {
    /* ignore */
  }
  harsh = createAudioPlayer(QUIETT_HARSH_ALARM);
  harsh.loop = true;
  harsh.volume = 1;
  loadedAlarmId = 'quiett_harsh';
}

async function ensurePlayers() {
  const [, meditationId] = await Promise.all([
    loadAlarmSoundId(),
    loadMeditationSoundId(),
  ]);

  if (!harsh || loadedAlarmId !== 'quiett_harsh') {
    rebuildHarsh();
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
 * In-app harsh for /session while foreground.
 * Skip when backgrounded — AlarmKit owns the nag there; activating the session
 * after re-arm throws "Session activation failed".
 */
export async function playHarshAlarm() {
  if (AppState.currentState !== 'active') {
    return;
  }
  await ensureMode();
  await ensurePlayers();
  try {
    calm?.pause();
  } catch {
    /* ignore */
  }
  try {
    harsh!.play();
  } catch (e) {
    console.warn('[quiett audio] harsh retry', e);
    try {
      rebuildHarsh();
      harsh!.play();
    } catch (e2) {
      console.warn('[quiett audio] harsh', e2);
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
