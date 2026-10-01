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

/** Night crickets — moonlit summer meadow, a cricket on a grass blade, fireflies. */
const NIGHT_CRICKETS: SceneSpec = { type: 'crickets', timeOfDay: 'night', sunX: 0.22, sunY: 0.22, hueShift: 0, seed: 7101 };
/** Snow morning — snowfall over drifts and snowy pines, a bird on a snow-capped branch. */
const SNOW_MORNING: SceneSpec = { type: 'snow', timeOfDay: 'morning', sunX: 0.24, sunY: 0.3, hueShift: 0, seed: 7203, details: ['noSun'] };
/** Night stream — a stream over stones between dark pines, moonlight on the water. */
const NIGHT_STREAM: SceneSpec = { type: 'stream', timeOfDay: 'night', sunX: 0.56, sunY: 0.18, hueShift: 0, seed: 7307 };
/** Distant thunder — far storm cell lit from within, rain curtains, a faint bolt. */
const DISTANT_THUNDER: SceneSpec = { type: 'thunder', timeOfDay: 'dusk', sunX: 0.2, sunY: 0.5, hueShift: 0, seed: 7409, details: ['noSun'] };
/** After the rain — glossy leaves beaded with drops, light breaking through. */
const AFTER_THE_RAIN: SceneSpec = { type: 'afterrain', timeOfDay: 'morning', sunX: 0.7, sunY: 0.3, hueShift: 0, seed: 7511, details: ['rays'] };
/** Hearth — stone fireplace indoors, logs burning under the mantel. */
const HEARTH: SceneSpec = { type: 'hearth', timeOfDay: 'golden', sunX: 0.5, sunY: 0.5, hueShift: 0, seed: 7613, details: ['noGrain'] };
/** Rain on the eaves — rain streaming off a porch roof and gutter, garden beyond. */
const RAIN_ON_EAVES: SceneSpec = { type: 'eaves', timeOfDay: 'dawn', sunX: 0.6, sunY: 0.5, hueShift: 0, seed: 7717 };

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

  // ── Tones & music — the sound source ─────────────────────────────────────
  /** Clear Bell (852 Hz) — singing bowl on a cushion, resonance rings. */
  'music:clear-bell': { type: 'bowl', timeOfDay: 'morning', sunX: 0.3, sunY: 0.36, hueShift: 0, seed: 2411 },
  /** Soft Pad — soft puffy clouds. */
  'music:soft-pad': { type: 'puffs', timeOfDay: 'dawn', sunX: 0.46, sunY: 0.56, hueShift: 6, seed: 2113 },
  /** Dawn Wash (639 Hz) — watercolour bands of dawn colour washing over a still sea. */
  'music:dawn-keys': { type: 'wash', timeOfDay: 'dawn', sunX: 0.38, sunY: 0.58, hueShift: 0, seed: 2207 },
  /** Warm Drone — a string held in one long vibration over a dusk sky, big warm sun on still water, slow ripples. */
  'music:warm-drone': { type: 'drone', timeOfDay: 'dusk', sunX: 0.5, sunY: 0.68, hueShift: 0, seed: 2309 },
  /** Deep Roots (174 Hz) — broad tree, roots spreading deep through layered soil. */
  'music:deep-roots': { type: 'roots', timeOfDay: 'golden', sunX: 0.8, sunY: 0.2, hueShift: 0, seed: 2503 },
  /** Valley Mist (285 Hz) — spurs folding into a valley, mist pooling in every fold. */
  'music:valley-mist': { type: 'valley', timeOfDay: 'sunrise', sunX: 0.5, sunY: 0.42, hueShift: 0, seed: 2609 },
  /** Lantern Glow (417 Hz) — paper lanterns drifting on still water at dusk. */
  'music:lantern-glow': { type: 'lanterns', timeOfDay: 'dusk', sunX: 0.7, sunY: 0.5, hueShift: 0, seed: 2707, details: ['noSun'] },
  /** Moonset (963 Hz) — big moon sinking behind a far ridge before dawn. */
  'music:moonset': { type: 'moonset', timeOfDay: 'predawn', sunX: 0.64, sunY: 0.56, hueShift: 0, seed: 2801 },
  /** Heartwood — cut stump on the forest floor, growth rings from the heart. */
  'music:heartwood': { type: 'rings', timeOfDay: 'morning', sunX: 0.26, sunY: 0.14, hueShift: 0, seed: 2903 },

  // ── Library expansion (music beds) ───────────────────────────────────────
  /** Low Cloud — heavy, soft cloud deck low over flat fields, a thin seam of light beneath. */
  'music:low-cloud': { type: 'lowcloud', timeOfDay: 'dawn', sunX: 0.62, sunY: 0.66, hueShift: 0, seed: 6101 },
  /** Quiet Hours — hourglass on a sill at first light, sand still falling. */
  'music:quiet-hours': { type: 'hours', timeOfDay: 'dawn', sunX: 0.3, sunY: 0.5, hueShift: 0, seed: 6203 },
  /** Golden Hour — big amber sun low behind soft ridges, rim-lit grass in front. */
  'music:golden-hour': { type: 'goldenhour', timeOfDay: 'golden', sunX: 0.62, sunY: 0.56, hueShift: 0, seed: 6307 },
  /** Velvet Night — thin crescent over folded velvet hills. */
  'music:velvet-night': { type: 'velvet', timeOfDay: 'night', sunX: 0.7, sunY: 0.24, hueShift: 0, seed: 6409 },
  /** Starlit — dense star field and galactic band over a lake mirroring the stars. */
  'music:starlit': { type: 'starlit', timeOfDay: 'night', sunX: 0.5, sunY: 0.3, hueShift: 0, seed: 6511, details: ['noSun'] },
  /** Drift — small empty rowboat drifting on calm, misty water, a long soft wake. */
  'music:drift': { type: 'drift', timeOfDay: 'morning', sunX: 0.3, sunY: 0.34, hueShift: 0, seed: 6613 },

  // ── Ambient / meditation sounds — the sound source ───────────────────────
  'ambient:calm_waves': CALM_WAVES,
  'ambient:morning_birds': MORNING_BIRDS,
  'ambient:soft_rain': SOFT_RAIN,
  'ambient:wind_in_trees': WIND_IN_TREES,
  'ambient:morning_pond': MORNING_POND,
  'ambient:campfire': CAMPFIRE,
  'ambient:night_crickets': NIGHT_CRICKETS,
  'ambient:snow_morning': SNOW_MORNING,
  'ambient:night_stream': NIGHT_STREAM,
  'ambient:distant_thunder': DISTANT_THUNDER,
  'ambient:after_the_rain': AFTER_THE_RAIN,
  'ambient:hearth': HEARTH,
  'ambient:rain_on_eaves': RAIN_ON_EAVES,
  // Raw playback ids (same sound → same cover)
  'sound:calm_waves': CALM_WAVES,
  'sound:morning_birds': MORNING_BIRDS,
  'sound:soft_rain': SOFT_RAIN,
  'sound:wind_in_trees': WIND_IN_TREES,
  'sound:morning_pond': MORNING_POND,
  'sound:campfire': CAMPFIRE,
  'sound:night_crickets': NIGHT_CRICKETS,
  'sound:snow_morning': SNOW_MORNING,
  'sound:night_stream': NIGHT_STREAM,
  'sound:distant_thunder': DISTANT_THUNDER,
  'sound:after_the_rain': AFTER_THE_RAIN,
  'sound:hearth': HEARTH,
  'sound:rain_on_eaves': RAIN_ON_EAVES,

  // ── Alarm tones — picture the name ───────────────────────────────────────
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
};

/** Spec for any track / sound id — hand-tuned when mapped, otherwise hash-derived. */
export function sceneSpecFor(id: string): SceneSpec {
  return SCENE_COVERS[id] ?? deriveSceneSpec(id);
}
