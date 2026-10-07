/**
 * Haptics that never crash. expo-haptics is a native module: on a build made before it was added
 * (or on web / simulator without the engine) every call quietly does nothing.
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type HapticsModule = typeof import('expo-haptics');

let mod: HapticsModule | null | undefined;

function haptics(): HapticsModule | null {
  if (mod !== undefined) return mod;
  mod = null;
  if (Platform.OS === 'web') return mod;
  try {
    if (!requireOptionalNativeModule('ExpoHaptics')) return mod;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-haptics') as HapticsModule;
  } catch {
    mod = null;
  }
  return mod;
}

function run(fn: (h: HapticsModule) => Promise<void>) {
  const h = haptics();
  if (!h) return;
  fn(h).catch(() => {});
}

/** Crisp tick for selection changes: day pills, segmented pills, tabs. */
export function hapticSelect() {
  run((h) => h.selectionAsync());
}

/** Light tap: toggles, play/stop, small buttons. */
export function hapticTap() {
  run((h) => h.impactAsync(h.ImpactFeedbackStyle.Light));
}

/** Soft, rounder tap: locking in, confirming a time. */
export function hapticSoft() {
  run((h) => h.impactAsync(h.ImpactFeedbackStyle.Soft));
}

/** Medium thump for bigger moments (streak tick). */
export function hapticMedium() {
  run((h) => h.impactAsync(h.ImpactFeedbackStyle.Medium));
}

/** Success notification: morning unlocked, badge earned. */
export function hapticSuccess() {
  run((h) => h.notificationAsync(h.NotificationFeedbackType.Success));
}

/** Warning notification (e.g. drifted out of stillness). */
export function hapticWarning() {
  run((h) => h.notificationAsync(h.NotificationFeedbackType.Warning));
}

/**
 * Celebration: a success notification followed by two soft taps, like a little heartbeat.
 * Timers are fire-and-forget; nothing fires if the module is missing.
 */
export function hapticCelebrate() {
  if (!haptics()) return;
  hapticSuccess();
  setTimeout(hapticSoft, 260);
  setTimeout(hapticSoft, 420);
}
