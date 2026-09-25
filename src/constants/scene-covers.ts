/**
 * Scene cover specs — one hand-tuned generative landscape per track / sound id.
 * Pure data (no RN imports) so the Node preview script can share it.
 * Any id without an entry gets a unique, stable spec derived from its hash.
 */
import { deriveSceneSpec, type SceneSpec } from '@/lib/scene-gen';

export type { SceneSpec, SceneType, TimeOfDay, SceneDetail } from '@/lib/scene-gen';

export const SCENE_COVERS: Record<string, SceneSpec> = {
  // ── Guided ────────────────────────────────────────────────────────────────
  'guided:first-light': { type: 'hills', timeOfDay: 'dawn', sunX: 0.62, sunY: 0.6, hueShift: 0, seed: 1101, details: ['mist', 'tree'] },
  'guided:open-eyes': { type: 'lake', timeOfDay: 'morning', sunX: 0.34, sunY: 0.4, hueShift: 0, seed: 1207, details: ['peak', 'birds'] },
  'guided:still-horizon': { type: 'ocean', timeOfDay: 'dawn', sunX: 0.5, sunY: 0.62, hueShift: 0, seed: 1311, details: ['clouds'] },
  'guided:warm-window': { type: 'window', timeOfDay: 'golden', sunX: 0.36, sunY: 0.62, hueShift: 0, seed: 1409, details: ['plant'] },
  'guided:quiet-rise': { type: 'hills', timeOfDay: 'sunrise', sunX: 0.42, sunY: 0.52, hueShift: -4, seed: 1523, details: ['mist', 'rays', 'birds'] },
  'guided:clear-morning': { type: 'clouds', timeOfDay: 'morning', sunX: 0.66, sunY: 0.34, hueShift: 0, seed: 1601, details: ['peak'] },
  // ── Healing tones ─────────────────────────────────────────────────────────
  'music:soft-pad': { type: 'clouds', timeOfDay: 'predawn', sunX: 0.3, sunY: 0.6, hueShift: 6, seed: 2113, details: ['stars'] },
  'music:dawn-keys': { type: 'lake', timeOfDay: 'predawn', sunX: 0.7, sunY: 0.66, hueShift: 0, seed: 2207, details: ['stars'] },
  'music:warm-drone': { type: 'dunes', timeOfDay: 'golden', sunX: 0.3, sunY: 0.5, hueShift: 0, seed: 2309 },
  'music:clear-bell': { type: 'mountains', timeOfDay: 'morning', sunX: 0.7, sunY: 0.3, hueShift: 0, seed: 2411, details: ['birds'] },
  // ── Ambient ───────────────────────────────────────────────────────────────
  'ambient:calm_waves': { type: 'ocean', timeOfDay: 'sunrise', sunX: 0.4, sunY: 0.5, hueShift: 0, seed: 3109, details: ['waves', 'headland', 'birds'] },
  'ambient:morning_birds': { type: 'forest', timeOfDay: 'morning', sunX: 0.3, sunY: 0.38, hueShift: 0, seed: 3203, details: ['birds', 'clouds'] },
  'ambient:soft_rain': { type: 'rain', timeOfDay: 'dawn', sunX: 0.62, sunY: 0.42, hueShift: 0, seed: 3307 },

  // ── Meditation sounds (raw playback ids) ─────────────────────────────────
  'sound:calm_waves': { type: 'ocean', timeOfDay: 'sunrise', sunX: 0.4, sunY: 0.5, hueShift: 0, seed: 3109, details: ['waves', 'headland', 'birds'] },
  'sound:morning_birds': { type: 'forest', timeOfDay: 'morning', sunX: 0.3, sunY: 0.38, hueShift: 0, seed: 3203, details: ['birds', 'clouds'] },
  'sound:soft_rain': { type: 'rain', timeOfDay: 'dawn', sunX: 0.62, sunY: 0.42, hueShift: 0, seed: 3307 },

  // ── Alarm sounds ──────────────────────────────────────────────────────────
  'alarm:quiett_harsh': { type: 'mountains', timeOfDay: 'predawn', sunX: 0.72, sunY: 0.62, hueShift: 0, seed: 4101, details: ['stars'] },
  'alarm:rise_and_shine': { type: 'hills', timeOfDay: 'sunrise', sunX: 0.5, sunY: 0.5, hueShift: 4, seed: 4203, details: ['rays'] },
  'alarm:early_bright': { type: 'mountains', timeOfDay: 'sunrise', sunX: 0.36, sunY: 0.44, hueShift: 0, seed: 4307 },
  'alarm:fresh_morning': { type: 'forest', timeOfDay: 'dawn', sunX: 0.6, sunY: 0.56, hueShift: 0, seed: 4409, details: ['mist'] },
  'alarm:new_day': { type: 'ocean', timeOfDay: 'morning', sunX: 0.64, sunY: 0.34, hueShift: 0, seed: 4511, details: ['clouds'] },
  'alarm:sunbeam': { type: 'window', timeOfDay: 'sunrise', sunX: 0.62, sunY: 0.66, hueShift: 0, seed: 4613, details: ['plant'] },
  'alarm:dayspring': { type: 'lake', timeOfDay: 'sunrise', sunX: 0.46, sunY: 0.54, hueShift: 0, seed: 4717 },
  'alarm:peaceful': { type: 'lake', timeOfDay: 'dawn', sunX: 0.3, sunY: 0.58, hueShift: 0, seed: 4819, details: ['birds'] },
  'alarm:slow_wind': { type: 'dunes', timeOfDay: 'dusk', sunX: 0.66, sunY: 0.56, hueShift: 0, seed: 4921, details: ['stars'] },
  'alarm:dawn_rain': { type: 'rain', timeOfDay: 'predawn', sunX: 0.4, sunY: 0.5, hueShift: 0, seed: 5023 },
  'alarm:coastal_breeze': { type: 'ocean', timeOfDay: 'golden', sunX: 0.7, sunY: 0.52, hueShift: 0, seed: 5127, details: ['headland', 'waves', 'birds'] },
  'alarm:hazy_day': { type: 'hills', timeOfDay: 'golden', sunX: 0.3, sunY: 0.44, hueShift: 6, seed: 5231, details: ['mist', 'clouds'] },
  'alarm:new_breath': { type: 'clouds', timeOfDay: 'dawn', sunX: 0.44, sunY: 0.6, hueShift: 0, seed: 5333 },
};

/** Spec for any track / sound id — hand-tuned when mapped, otherwise hash-derived. */
export function sceneSpecFor(id: string): SceneSpec {
  return SCENE_COVERS[id] ?? deriveSceneSpec(id);
}
