/**
 * Scene cover specs — one hand-tuned generative landscape per track / sound id.
 * Pure data (no RN imports) so the Node preview script can share it.
 * Any id without an entry gets a unique, stable spec derived from its hash.
 */
import { deriveSceneSpec, type SceneSpec } from '@/lib/scene-gen';

export type { SceneSpec, SceneType, TimeOfDay, SceneDetail } from '@/lib/scene-gen';

/**
 * Every cover depicts its track: guided meditations are landscapes that match the title,
 * pure-sound tracks show the sound source, alarm tones picture their name.
 * Each id gets a distinct scene type (or a clearly different time / composition).
 */
/** Shoreline — low view over a sandy beach, gentle waves lapping in, foam lines on wet sand. */
const CALM_WAVES: SceneSpec = { type: 'shoreline', timeOfDay: 'sunrise', sunX: 0.34, sunY: 0.4, hueShift: 0, seed: 3119, details: ['birds'] };
/** Forest birds — sunlit forest edge at sunrise, songbirds on a limb, more flying over the canopy. */
const MORNING_BIRDS: SceneSpec = { type: 'forestbirds', timeOfDay: 'sunrise', sunX: 0.72, sunY: 0.42, hueShift: 0, seed: 3211, details: ['rays'] };
/** Rain — soft, steady rain curtain over a treeline and meadow, ripples in a puddle. */
const SOFT_RAIN: SceneSpec = { type: 'softrain', timeOfDay: 'dawn', sunX: 0.64, sunY: 0.3, hueShift: 0, seed: 3313, details: ['noSun'] };
/** Wind in the trees — tree on a knoll, crown leaning downwind, leaves carried off. */
const WIND_IN_TREES: SceneSpec = { type: 'windtree', timeOfDay: 'morning', sunX: 0.78, sunY: 0.3, hueShift: 0, seed: 3401, details: ['clouds'] };
/** Morning pond — lily pads, a frog on a pad, ripples, cattails. */
const MORNING_POND: SceneSpec = { type: 'pond', timeOfDay: 'sunrise', sunX: 0.7, sunY: 0.46, hueShift: 0, seed: 3503, details: ['birds'] };
/** Campfire — crossed logs in a stone ring, flames, sparks and smoke at dawn. */
const CAMPFIRE: SceneSpec = { type: 'campfire', timeOfDay: 'dawn', sunX: 0.24, sunY: 0.5, hueShift: 0, seed: 3607 };

export const SCENE_COVERS: Record<string, SceneSpec> = {
  // ── Guided — landscapes that match the title ─────────────────────────────
  /** First Light — sunrise over rolling hills. */
  'guided:first-light': { type: 'hills', timeOfDay: 'dawn', sunX: 0.62, sunY: 0.6, hueShift: 0, seed: 1101, details: ['mist', 'tree'] },
  /** Still Lake — calm lake, mountain mirrored in the water. */
  'guided:open-eyes': { type: 'lake', timeOfDay: 'morning', sunX: 0.34, sunY: 0.4, hueShift: 0, seed: 1207, details: ['peak'] },
  /** Still Horizon — flat open sea at dawn, sun on the horizon. */
  'guided:still-horizon': { type: 'ocean', timeOfDay: 'dawn', sunX: 0.5, sunY: 0.62, hueShift: 0, seed: 1311, details: ['clouds'] },
  /** Warm Window — arched window, warm morning light spilling in. */
  'guided:warm-window': { type: 'window', timeOfDay: 'golden', sunX: 0.36, sunY: 0.62, hueShift: 0, seed: 1409, details: ['plant'] },
  /** Drifting Up — hot air balloons rising over misty hills. */
  'guided:quiet-rise': { type: 'balloons', timeOfDay: 'sunrise', sunX: 0.58, sunY: 0.62, hueShift: -4, seed: 1523, details: ['rays'] },
  /** Mountain Bloom — snowy peaks behind a flowering meadow. */
  'guided:clear-morning': { type: 'meadow', timeOfDay: 'morning', sunX: 0.7, sunY: 0.3, hueShift: 0, seed: 1601 },

  // ── Healing tones — the sound source ─────────────────────────────────────
  /** Clear Bell — singing bowl on a cushion, resonance rings. */
  'music:clear-bell': { type: 'bowl', timeOfDay: 'morning', sunX: 0.3, sunY: 0.36, hueShift: 0, seed: 2411 },
  /** Soft Pad — soft puffy clouds. */
  'music:soft-pad': { type: 'puffs', timeOfDay: 'dawn', sunX: 0.46, sunY: 0.56, hueShift: 6, seed: 2113 },
  /** Dawn Keys — piano keys at dawn. */
  'music:dawn-keys': { type: 'piano', timeOfDay: 'dawn', sunX: 0.66, sunY: 0.47, hueShift: 0, seed: 2207 },
  /** Warm Drone — tanpura with warm resonant waves. */
  'music:warm-drone': { type: 'strings', timeOfDay: 'golden', sunX: 0.74, sunY: 0.5, hueShift: 0, seed: 2309 },

  // ── Ambient / meditation sounds — the sound source ───────────────────────
  'ambient:calm_waves': CALM_WAVES,
  'ambient:morning_birds': MORNING_BIRDS,
  'ambient:soft_rain': SOFT_RAIN,
  'ambient:wind_in_trees': WIND_IN_TREES,
  'ambient:morning_pond': MORNING_POND,
  'ambient:campfire': CAMPFIRE,
  // Raw playback ids (same sound → same cover)
  'sound:calm_waves': CALM_WAVES,
  'sound:morning_birds': MORNING_BIRDS,
  'sound:soft_rain': SOFT_RAIN,
  'sound:wind_in_trees': WIND_IN_TREES,
  'sound:morning_pond': MORNING_POND,
  'sound:campfire': CAMPFIRE,

  // ── Alarm tones — picture the name ───────────────────────────────────────
  /** Quiett harsh — jagged dark peaks before dawn. */
  'alarm:quiett_harsh': { type: 'mountains', timeOfDay: 'predawn', sunX: 0.72, sunY: 0.62, hueShift: 0, seed: 4101, details: ['stars'] },
  /** Rise and Shine — big sun cresting a flat horizon, bold ray fan. */
  'alarm:rise_and_shine': { type: 'sunburst', timeOfDay: 'sunrise', sunX: 0.5, sunY: 0.66, hueShift: 4, seed: 4203 },
  /** Early Bright — bright high sun over furrowed fields. */
  'alarm:early_bright': { type: 'hills', timeOfDay: 'morning', sunX: 0.3, sunY: 0.26, hueShift: 0, seed: 4307, details: ['rows', 'rays', 'clouds'] },
  /** Fresh Morning — misty pine forest at dawn. */
  'alarm:fresh_morning': { type: 'forest', timeOfDay: 'dawn', sunX: 0.6, sunY: 0.56, hueShift: 0, seed: 4409, details: ['mist'] },
  /** New Day — sun rising above a sea of clouds. */
  'alarm:new_day': { type: 'clouds', timeOfDay: 'sunrise', sunX: 0.62, sunY: 0.5, hueShift: 0, seed: 4511, details: ['peak'] },
  /** Sunbeam — beams fanning from behind a cloud. */
  'alarm:sunbeam': { type: 'beams', timeOfDay: 'golden', sunX: 0.56, sunY: 0.26, hueShift: 0, seed: 4613 },
  /** Dayspring — winding river through a valley at sunrise. */
  'alarm:dayspring': { type: 'river', timeOfDay: 'sunrise', sunX: 0.42, sunY: 0.5, hueShift: 0, seed: 4717 },
  /** Peaceful — stacked stones by calm water. */
  'alarm:peaceful': { type: 'cairn', timeOfDay: 'dawn', sunX: 0.3, sunY: 0.5, hueShift: 0, seed: 4819 },
  /** Slow Wind — wind-shaped dunes with breeze curls. */
  'alarm:slow_wind': { type: 'dunes', timeOfDay: 'dusk', sunX: 0.66, sunY: 0.56, hueShift: 0, seed: 4921, details: ['breeze'] },
  /** Dawn Rain — rain sweeping over hills before sunrise. */
  'alarm:dawn_rain': { type: 'rain', timeOfDay: 'predawn', sunX: 0.4, sunY: 0.5, hueShift: 0, seed: 5023 },
  /** Coastal Breeze — beach, headland, foam lines, curling breeze. */
  'alarm:coastal_breeze': { type: 'coast', timeOfDay: 'golden', sunX: 0.3, sunY: 0.44, hueShift: 0, seed: 5127, details: ['birds'] },
  /** Hazy Day — diffuse sun behind drifting haze. */
  'alarm:hazy_day': { type: 'haze', timeOfDay: 'golden', sunX: 0.62, sunY: 0.34, hueShift: 6, seed: 5231 },
  /** New Breath — dandelion seeds carried off on a breath. */
  'alarm:new_breath': { type: 'dandelion', timeOfDay: 'dawn', sunX: 0.72, sunY: 0.42, hueShift: 0, seed: 5333 },
  /** System default — moonlit sea. */
  'alarm:system_default': { type: 'ocean', timeOfDay: 'night', sunX: 0.66, sunY: 0.3, hueShift: 0, seed: 5437 },
};

/** Spec for any track / sound id — hand-tuned when mapped, otherwise hash-derived. */
export function sceneSpecFor(id: string): SceneSpec {
  return SCENE_COVERS[id] ?? deriveSceneSpec(id);
}
