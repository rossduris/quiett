/**
 * Generative "scene cover" engine — pure TypeScript, no React / React Native imports.
 *
 * `buildScene(spec, options)` returns a renderer-agnostic SVG model (defs + node tree) that
 * `SceneCover` maps onto react-native-svg, and that `sceneToSvgString` serialises to a
 * standard SVG (used by the Node preview script). Everything is deterministic from
 * `spec.seed`, so a track's cover is stable across renders and devices.
 *
 * Coordinate space: width is always 100; height is 100 * aspect (height / width).
 */

// ─── Public types ────────────────────────────────────────────────────────────

export type SceneType =
  | 'hills'
  | 'ocean'
  | 'lake'
  | 'dunes'
  | 'mountains'
  | 'clouds'
  | 'window'
  | 'forest'
  | 'rain'
  // Motif scenes — literal pictures of a track's title or sound source.
  | 'balloons'
  | 'bowl'
  | 'piano'
  | 'strings'
  | 'drone'
  | 'waves'
  | 'branch'
  | 'raincloud'
  | 'meadow'
  | 'haze'
  | 'coast'
  | 'sunburst'
  | 'beams'
  | 'river'
  | 'cairn'
  | 'dandelion'
  | 'puffs'
  | 'windtree'
  | 'pond'
  | 'campfire'
  | 'forestbirds'
  | 'softrain'
  | 'shoreline'
  // Healing-tone motifs
  | 'wash'
  | 'roots'
  | 'valley'
  | 'lanterns'
  | 'moonset'
  | 'rings'
  // Library expansion — music beds + ambient sources
  | 'lowcloud'
  | 'hours'
  | 'goldenhour'
  | 'velvet'
  | 'starlit'
  | 'drift'
  | 'crickets'
  | 'snow'
  | 'stream'
  | 'thunder'
  | 'afterrain'
  | 'hearth'
  | 'eaves';

/** Landscape types — used for hash-derived fallback specs. */
export const LANDSCAPE_TYPES: readonly SceneType[] = [
  'hills',
  'ocean',
  'lake',
  'dunes',
  'mountains',
  'clouds',
  'window',
  'forest',
  'rain',
];

export const MOTIF_TYPES: readonly SceneType[] = [
  'balloons',
  'bowl',
  'piano',
  'strings',
  'drone',
  'waves',
  'branch',
  'raincloud',
  'meadow',
  'haze',
  'coast',
  'sunburst',
  'beams',
  'river',
  'cairn',
  'dandelion',
  'puffs',
  'windtree',
  'pond',
  'campfire',
  'forestbirds',
  'softrain',
  'shoreline',
  'wash',
  'roots',
  'valley',
  'lanterns',
  'moonset',
  'rings',
  'lowcloud',
  'hours',
  'goldenhour',
  'velvet',
  'starlit',
  'drift',
  'crickets',
  'snow',
  'stream',
  'thunder',
  'afterrain',
  'hearth',
  'eaves',
];

export const SCENE_TYPES: readonly SceneType[] = [...LANDSCAPE_TYPES, ...MOTIF_TYPES];

export type TimeOfDay = 'predawn' | 'dawn' | 'sunrise' | 'morning' | 'golden' | 'dusk' | 'night';

export const TIMES_OF_DAY: readonly TimeOfDay[] = [
  'predawn',
  'dawn',
  'sunrise',
  'morning',
  'golden',
  'dusk',
  'night',
];

export type SceneDetail =
  | 'stars'
  | 'birds'
  | 'clouds'
  | 'mist'
  | 'rays'
  | 'tree'
  | 'headland'
  | 'peak'
  | 'waves'
  | 'plant'
  /** Furrow rows on the nearest hill. */
  | 'rows'
  /** Curling breeze strokes in the sky. */
  | 'breeze'
  | 'noSun'
  | 'noGrain';

export type SceneSpec = {
  type: SceneType;
  timeOfDay: TimeOfDay;
  /** Sun / moon centre, 0 (top) – 1 (bottom) of the cover height. ~0.6 sits on the horizon. */
  sunY: number;
  /** Sun / moon centre, 0 (left) – 1 (right). */
  sunX: number;
  /** Small palette hue rotation in degrees (≈ -20…20) for per-track variety. */
  hueShift: number;
  seed: number;
  details?: readonly SceneDetail[];
};

export type SceneMode = 'light' | 'dark';

/** Subset of the app's ColorTokens the generator needs (kept structural so this file has no RN imports). */
export type SceneTokens = {
  accent: string;
  calm: string;
  sunrise: string;
  warning: string;
  /** Screen background — dark scenes sink toward it so they sit in the UI. */
  bg: string;
};

export type SceneOptions = {
  /** light = peachCream family, dark = nightTeal family. */
  mode: SceneMode;
  /** height / width. Default 1 (square). */
  aspect?: number;
  /** 'lite' drops grain + fine detail for tiny thumbnails (< ~64pt). */
  lod?: 'full' | 'lite';
  /** Theme accent — lightly harmonises the palette. */
  accent?: string;
  /** Theme colour tokens — motif accents (balloons, flowers, brass, felt…) come from these. */
  tokens?: SceneTokens;
  /** Override the id prefix (defaults to a hash of spec + options). */
  idPrefix?: string;
};

export type GradStop = { o: number; c: string; a?: number };

export type SvgDef =
  | { t: 'linear'; id: string; x1: number; y1: number; x2: number; y2: number; stops: GradStop[] }
  | {
      t: 'radial';
      id: string;
      /** 'user' = userSpaceOnUse (viewBox units); 'obb' = objectBoundingBox (0-1). */
      units: 'user' | 'obb';
      cx: number;
      cy: number;
      r: number;
      stops: GradStop[];
    }
  | { t: 'clip'; id: string; children: SvgNode[] };

/**
 * Optional motion for a top-level group, in viewBox units (W = 100). Static renders ignore it;
 * an animated cover moves only these groups (transform + opacity on the UI thread).
 * - wave: sine ping-pong. dx/dy translate ±, deg rotates ±, s/sx/sy scale ±, min dips opacity.
 * - loop: linear 0→(dx,dy), repeating; the group is tiled at −(dx,dy) so it never shows a seam.
 * - ripple: expands by s and fades out, two copies half a period apart.
 * - rise: travels (dx,dy) while fading in and out (sparks, drips).
 * - flicker: irregular scale/opacity jitter (flames).
 * - flash: long rest, then a quick double flash (distant lightning).
 * pri: 1 hero motion, 2 ambient, 3 extra — renderers cap how many groups animate by priority.
 */
export type SceneMotion = {
  k: 'wave' | 'loop' | 'ripple' | 'rise' | 'flicker' | 'flash';
  /** Full cycle in ms. */
  period: number;
  delay?: number;
  dx?: number;
  dy?: number;
  deg?: number;
  s?: number;
  sx?: number;
  sy?: number;
  /** Lowest opacity reached (wave, flicker, flash). */
  min?: number;
  /** Transform origin (viewBox units). Defaults to the frame centre. */
  ox?: number;
  oy?: number;
  /** Clip rect [x, y, w, h] for the moving group (loop). */
  clip?: [number, number, number, number];
  pri?: 1 | 2 | 3;
};

export type SvgNode =
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number; fill: string; opacity?: number }
  | {
      t: 'path';
      d: string;
      fill?: string;
      stroke?: string;
      sw?: number;
      opacity?: number;
    }
  | { t: 'circle'; cx: number; cy: number; r: number; fill: string; opacity?: number }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string; opacity?: number }
  | { t: 'g'; opacity?: number; clip?: string; children: SvgNode[]; motion?: SceneMotion };

export type SceneModel = { w: number; h: number; defs: SvgDef[]; nodes: SvgNode[] };

// ─── PRNG + hashing ──────────────────────────────────────────────────────────

export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const range = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const f = (n: number) => Math.round(n * 100) / 100;

// ─── Colour helpers ──────────────────────────────────────────────────────────

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return [(rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255];
}

function adjust(hex: string, dh: number, satMul = 1, dl = 0): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb(h + dh, clamp(s * satMul, 0, 1), clamp(l + dl, 0, 1)));
}

// ─── Palettes ────────────────────────────────────────────────────────────────

export type ScenePalette = {
  skyTop: string;
  skyMid: string;
  skyLow: string;
  horizon: string;
  sun: string;
  glow: string;
  /** Darkest foreground silhouette. */
  land: string;
  /** Atmospheric haze — far layers fade toward this. */
  haze: string;
  water: string;
  cloud: string;
  cloudShade: string;
  /** 0–1 star visibility. */
  stars: number;
  moon: boolean;
};

type PaletteTable = Record<TimeOfDay, ScenePalette>;

/** peachCream family — soft sunrise, cream, rose, dusty lavender. */
const LIGHT: PaletteTable = {
  predawn: {
    skyTop: '#5E5B8C', skyMid: '#A58FB4', skyLow: '#E3B3B3', horizon: '#F7CDB5',
    sun: '#FFE9DA', glow: '#F6B7A3', land: '#3F3556', haze: '#C9A6BA', water: '#8D86AE',
    cloud: '#E6BFC4', cloudShade: '#9A86A8', stars: 0.8, moon: false,
  },
  dawn: {
    skyTop: '#8C9DC6', skyMid: '#D9B2C0', skyLow: '#F6C7B8', horizon: '#FFDEC6',
    sun: '#FFF4E6', glow: '#FFB999', land: '#5E4561', haze: '#E7BDBA', water: '#A9A6C7',
    cloud: '#FBD9CF', cloudShade: '#C4A0B4', stars: 0.35, moon: false,
  },
  sunrise: {
    skyTop: '#F0B4A4', skyMid: '#F7B596', skyLow: '#FCCB9F', horizon: '#FFE6C2',
    sun: '#FFF8EA', glow: '#FF9F78', land: '#8E4A45', haze: '#F3C1A6', water: '#E9A68F',
    cloud: '#FFE3D2', cloudShade: '#DE9C8E', stars: 0, moon: false,
  },
  morning: {
    skyTop: '#AFCBDD', skyMid: '#D8E2E4', skyLow: '#F6E8DC', horizon: '#FFF0E2',
    sun: '#FFFDF6', glow: '#FFD9B6', land: '#5F7F79', haze: '#DCE0D8', water: '#9DBFCB',
    cloud: '#FFFFFF', cloudShade: '#CBD6DD', stars: 0, moon: false,
  },
  golden: {
    skyTop: '#EFC9A0', skyMid: '#F4B983', skyLow: '#F9CE91', horizon: '#FFE9BD',
    sun: '#FFF6DA', glow: '#FFBE6A', land: '#7E4A34', haze: '#F2CB9E', water: '#E0AE82',
    cloud: '#FFE8C6', cloudShade: '#D9A07C', stars: 0, moon: false,
  },
  dusk: {
    skyTop: '#4F4274', skyMid: '#A7708E', skyLow: '#E0917F', horizon: '#F7B385',
    sun: '#FFE0C2', glow: '#F4A57F', land: '#34253F', haze: '#B98396', water: '#8E6E8E',
    cloud: '#F0A99A', cloudShade: '#7E5E80', stars: 0.45, moon: false,
  },
  night: {
    skyTop: '#27284A', skyMid: '#403F6B', skyLow: '#6D6190', horizon: '#9A83A8',
    sun: '#FFF4E8', glow: '#C9B7E0', land: '#1B1930', haze: '#5E5680', water: '#4A4670',
    cloud: '#7D7298', cloudShade: '#3E3A60', stars: 1, moon: true,
  },
};

/** nightTeal family — deep indigo, teal, blue, with restrained warm horizons. */
const DARK: PaletteTable = {
  predawn: {
    skyTop: '#0A1530', skyMid: '#1C2C57', skyLow: '#3E4A80', horizon: '#7A6F9E',
    sun: '#F2E6F2', glow: '#8B7DC0', land: '#060D1D', haze: '#2E3D6A', water: '#1A2A50',
    cloud: '#4A5584', cloudShade: '#1A2548', stars: 1, moon: false,
  },
  dawn: {
    skyTop: '#11234A', skyMid: '#2C4677', skyLow: '#71739C', horizon: '#D39A8E',
    sun: '#FFEDE0', glow: '#E0907F', land: '#0A162E', haze: '#3E4F7C', water: '#23395F',
    cloud: '#8E86A8', cloudShade: '#2A3860', stars: 0.6, moon: false,
  },
  sunrise: {
    skyTop: '#16305E', skyMid: '#3F5A8E', skyLow: '#A07E98', horizon: '#F4A87F',
    sun: '#FFF0DC', glow: '#F4A57F', land: '#0E1A33', haze: '#4F5E88', water: '#2E4670',
    cloud: '#C9A0A6', cloudShade: '#34466E', stars: 0.15, moon: false,
  },
  morning: {
    skyTop: '#16395E', skyMid: '#2B6886', skyLow: '#5E9DAE', horizon: '#A9D6DA',
    sun: '#F4FCFF', glow: '#8FC4FF', land: '#0B2433', haze: '#3F7488', water: '#1F5670',
    cloud: '#BFDDE6', cloudShade: '#35657E', stars: 0, moon: false,
  },
  golden: {
    skyTop: '#1B2A52', skyMid: '#51507E', skyLow: '#B0818A', horizon: '#F0B274',
    sun: '#FFF2D8', glow: '#F2A968', land: '#161631', haze: '#5B5578', water: '#383E68',
    cloud: '#D8A48E', cloudShade: '#3A3C66', stars: 0, moon: false,
  },
  dusk: {
    skyTop: '#0D1636', skyMid: '#342F68', skyLow: '#7E4F80', horizon: '#CC7383',
    sun: '#FFE0D0', glow: '#D9768A', land: '#080C20', haze: '#3A3566', water: '#242650',
    cloud: '#9A6286', cloudShade: '#241F4C', stars: 0.8, moon: false,
  },
  night: {
    skyTop: '#040916', skyMid: '#0B1934', skyLow: '#16305A', horizon: '#2A4C78',
    sun: '#EAF2FF', glow: '#5B8CFF', land: '#020611', haze: '#1A2E52', water: '#0E1E3C',
    cloud: '#2A3E66', cloudShade: '#0C1630', stars: 1, moon: true,
  },
};

export function scenePalette(
  time: TimeOfDay,
  mode: SceneMode,
  hueShift = 0,
  accent?: string,
  overcast = false,
): ScenePalette {
  const base = (mode === 'dark' ? DARK : LIGHT)[time];
  const out = { ...base };
  const keys = [
    'skyTop', 'skyMid', 'skyLow', 'horizon', 'sun', 'glow', 'land', 'haze', 'water', 'cloud', 'cloudShade',
  ] as const;
  for (const k of keys) {
    let c = out[k];
    if (hueShift) c = adjust(c, hueShift);
    if (overcast) {
      // Rain: desaturate, pull everything toward a soft mid-tone.
      c = adjust(c, 0, 0.62, 0);
      c = mix(c, mode === 'dark' ? '#34425E' : '#D9C4BC', k === 'land' ? 0.1 : 0.24);
    }
    out[k] = c;
  }
  if (accent && /^#[0-9a-f]{3,6}$/i.test(accent)) {
    out.skyMid = mix(out.skyMid, accent, 0.08);
    out.glow = mix(out.glow, accent, 0.1);
  }
  return out;
}

// ─── Geometry helpers ────────────────────────────────────────────────────────

type Pt = [number, number];

/** Catmull-Rom → cubic bezier through points (open curve, starts with M). */
function smoothLine(pts: Pt[], tension = 1): string {
  if (pts.length < 2) return '';
  let d = `M${f(pts[0]![0])} ${f(pts[0]![1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
    d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

function polyLine(pts: Pt[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join('');
}

/** Close an open ridge line down to (or up to) a y level. */
function closeTo(line: string, pts: Pt[], y: number): string {
  const last = pts[pts.length - 1]!;
  const first = pts[0]!;
  return `${line}L${f(last[0])} ${f(y)}L${f(first[0])} ${f(y)}Z`;
}

const mirrorPts = (pts: Pt[], axis: number): Pt[] => pts.map(([x, y]) => [x, 2 * axis - y]);

type RidgeFn = (x: number) => number;

/** Smooth rolling ridge from a few random sines. */
function rollingRidge(rng: Rng, W: number, baseY: number, amp: number, busy = 1): RidgeFn {
  const f1 = range(rng, 0.7, 1.5) * busy;
  const f2 = range(rng, 1.8, 3.2) * busy;
  const f3 = range(rng, 4, 6) * busy;
  const p1 = range(rng, 0, Math.PI * 2);
  const p2 = range(rng, 0, Math.PI * 2);
  const p3 = range(rng, 0, Math.PI * 2);
  const tilt = range(rng, -0.35, 0.35);
  return (x: number) => {
    const u = x / W;
    const n =
      0.62 * Math.sin(u * Math.PI * f1 + p1) +
      0.28 * Math.sin(u * Math.PI * f2 + p2) +
      0.1 * Math.sin(u * Math.PI * f3 + p3);
    return baseY - amp * n + amp * tilt * (u - 0.5);
  };
}

function sample(fn: RidgeFn, x0: number, x1: number, steps: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    pts.push([x, fn(x)]);
  }
  return pts;
}

/** Midpoint-displacement mountain ridge with one dominant peak. */
function mountainPts(rng: Rng, W: number, baseY: number, amp: number, rough: number, peakX: number, width?: number): Pt[] {
  const n = 32;
  const ys = new Array<number>(n + 1).fill(0);
  ys[0] = range(rng, -0.2, 0.3);
  ys[n] = range(rng, -0.2, 0.3);
  let step = n;
  let scale = 0.9;
  while (step > 1) {
    const half = step / 2;
    for (let i = half; i < n; i += step) {
      ys[i] = (ys[i - half]! + ys[i + half]!) / 2 + (rng() - 0.5) * scale;
    }
    step = half;
    scale *= rough;
  }
  const x0 = -6;
  const x1 = W + 6;
  const pw = width ?? range(rng, 14, 26);
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const peak = Math.exp(-(((x - peakX) / pw) ** 2));
    pts.push([x, baseY - amp * (0.35 * ys[i]! + 0.75 * peak)]);
  }
  return pts;
}

/** Circle as a path fragment (so many dots can share one path). */
const dot = (x: number, y: number, r: number) =>
  `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;

// ─── Build context ───────────────────────────────────────────────────────────

type Ctx = {
  W: number;
  H: number;
  rng: Rng;
  pal: ScenePalette;
  mode: SceneMode;
  lite: boolean;
  spec: SceneSpec;
  defs: SvgDef[];
  nodes: SvgNode[];
  idp: string;
  n: number;
  has: (d: SceneDetail) => boolean;
  tok: SceneTokens;
};

function newId(ctx: Ctx, name: string) {
  ctx.n += 1;
  return `${ctx.idp}${name}${ctx.n}`;
}

function linear(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, stops: GradStop[]): string {
  const id = newId(ctx, 'l');
  ctx.defs.push({ t: 'linear', id, x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), stops });
  return `url(#${id})`;
}

function radial(ctx: Ctx, cx: number, cy: number, r: number, stops: GradStop[], units: 'user' | 'obb' = 'user') {
  const id = newId(ctx, 'r');
  ctx.defs.push({ t: 'radial', id, units, cx: f(cx), cy: f(cy), r: f(r), stops });
  return `url(#${id})`;
}

/** Shared soft-edged ellipse gradient (objectBoundingBox) — mist, clouds, glows. */
function softFill(ctx: Ctx, color: string, core = 0.85): string {
  return radial(
    ctx,
    0.5,
    0.5,
    0.5,
    [
      { o: 0, c: color, a: core },
      { o: 0.45, c: color, a: core * 0.6 },
      { o: 1, c: color, a: 0 },
    ],
    'obb',
  );
}

// ─── Shared layers ───────────────────────────────────────────────────────────

/** Wraps whatever `draw` pushes into one motion group (no effect on static renders or RNG order). */
function moving(ctx: Ctx, motion: SceneMotion, draw: () => void, target: SvgNode[] = ctx.nodes) {
  const start = target.length;
  draw();
  const kids = target.splice(start);
  if (kids.length) target.push({ t: 'g', motion: { pri: 1, ...motion }, children: kids });
}

function drawSky(ctx: Ctx, hy: number, target: SvgNode[] = ctx.nodes, box?: { x: number; y: number; w: number; h: number }) {
  const { pal } = ctx;
  const b = box ?? { x: 0, y: 0, w: ctx.W, h: ctx.H };
  const fill = linear(ctx, 0, b.y, 0, hy, [
    { o: 0, c: pal.skyTop },
    { o: 0.5, c: pal.skyMid },
    { o: 0.82, c: pal.skyLow },
    { o: 1, c: pal.horizon },
  ]);
  target.push({ t: 'rect', x: b.x - 1, y: b.y - 1, w: b.w + 2, h: b.h + 2, fill });
}

function sunPos(ctx: Ctx): Pt {
  return [ctx.spec.sunX * ctx.W, ctx.spec.sunY * ctx.H];
}

function drawGlow(ctx: Ctx, target: SvgNode[] = ctx.nodes, strength = 1) {
  const { pal, W, H } = ctx;
  const [sx, sy] = sunPos(ctx);
  const a = pal.moon ? 0.35 : 0.62;
  const fill = radial(ctx, sx, sy, Math.max(W, H) * 0.78, [
    { o: 0, c: pal.glow, a: a * strength },
    { o: 0.28, c: pal.glow, a: a * 0.42 * strength },
    { o: 0.62, c: pal.glow, a: a * 0.1 * strength },
    { o: 1, c: pal.glow, a: 0 },
  ]);
  target.push({ t: 'rect', x: -1, y: -1, w: W + 2, h: H + 2, fill });
}

function drawStars(ctx: Ctx, hy: number, target: SvgNode[] = ctx.nodes) {
  if (target !== ctx.nodes) return drawStarsBase(ctx, hy, target);
  moving(ctx, { k: 'wave', period: 3600, min: 0.4, pri: 2 }, () => drawStarsBase(ctx, hy, target));
}

function drawStarsBase(ctx: Ctx, hy: number, target: SvgNode[]) {
  const { pal, W, rng } = ctx;
  const vis = Math.max(pal.stars, ctx.has('stars') ? 0.6 : 0);
  if (vis <= 0.05) return;
  const count = Math.round((ctx.lite ? 18 : 46) * vis);
  const buckets = ['', '', ''];
  const top = hy * 0.78;
  for (let i = 0; i < count; i++) {
    const x = range(rng, 1, W - 1);
    const y = top * rng() ** 1.6;
    const r = range(rng, 0.16, 0.42) * (ctx.lite ? 1.5 : 1);
    const fade = 1 - y / top;
    const b = fade > 0.66 ? 0 : fade > 0.33 ? 1 : 2;
    buckets[b] += dot(x, y, r);
  }
  const col = ctx.mode === 'dark' ? '#EAF1FF' : '#FFF6EE';
  buckets.forEach((d, i) => {
    if (d) target.push({ t: 'path', d, fill: col, opacity: vis * [0.95, 0.6, 0.3][i]! });
  });
  // A couple of brighter stars with a soft halo.
  if (!ctx.lite) {
    for (let i = 0; i < 2; i++) {
      const x = range(rng, 8, W - 8);
      const y = range(rng, 4, top * 0.55);
      target.push({ t: 'circle', cx: f(x), cy: f(y), r: 1.6, fill: softFill(ctx, col, 0.5), opacity: vis });
      target.push({ t: 'circle', cx: f(x), cy: f(y), r: 0.45, fill: col, opacity: vis });
    }
  }
}

function sunRadius(ctx: Ctx) {
  return (ctx.pal.moon ? 6.2 : 8.2) * (ctx.W / 100);
}

function drawSun(ctx: Ctx, target: SvgNode[] = ctx.nodes, at?: Pt, scale = 1) {
  if (target !== ctx.nodes) return drawSunBase(ctx, target, at, scale);
  const [ox, oy] = at ?? sunPos(ctx);
  moving(ctx, { k: 'wave', period: 7000, s: 0.04, ox, oy, pri: 3 }, () => drawSunBase(ctx, target, at, scale));
}

function drawSunBase(ctx: Ctx, target: SvgNode[], at: Pt | undefined, scale: number) {
  const { pal } = ctx;
  const [sx, sy] = at ?? sunPos(ctx);
  const r = sunRadius(ctx) * scale;
  // Halo
  target.push({ t: 'circle', cx: f(sx), cy: f(sy), r: f(r * 2.6), fill: softFill(ctx, pal.sun, 0.42) });
  target.push({ t: 'circle', cx: f(sx), cy: f(sy), r: f(r * 1.25), fill: pal.sun, opacity: 0.16 });
  const disc = radial(ctx, sx, sy, r, [
    { o: 0, c: mix(pal.sun, '#FFFFFF', 0.4), a: 1 },
    { o: 0.7, c: pal.sun, a: 1 },
    { o: 1, c: mix(pal.sun, pal.glow, pal.moon ? 0.15 : 0.3), a: 1 },
  ]);
  target.push({ t: 'circle', cx: f(sx), cy: f(sy), r: f(r), fill: disc });
  if (pal.moon) {
    const shade = mix(pal.sun, pal.skyMid, 0.35);
    target.push({ t: 'circle', cx: f(sx - r * 0.3), cy: f(sy - r * 0.15), r: f(r * 0.26), fill: shade, opacity: 0.35 });
    target.push({ t: 'circle', cx: f(sx + r * 0.32), cy: f(sy + r * 0.28), r: f(r * 0.18), fill: shade, opacity: 0.3 });
    target.push({ t: 'circle', cx: f(sx + r * 0.1), cy: f(sy - r * 0.5), r: f(r * 0.12), fill: shade, opacity: 0.25 });
  }
}

function drawRays(ctx: Ctx) {
  if (!ctx.has('rays') || ctx.pal.moon) return;
  const { rng, pal } = ctx;
  const [sx, sy] = sunPos(ctx);
  const len = 130;
  let d = '';
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI + (Math.PI * (i + 0.5)) / n + range(rng, -0.08, 0.08);
    const w = range(rng, 0.025, 0.06);
    d += `M${f(sx)} ${f(sy)}L${f(sx + Math.cos(a - w) * len)} ${f(sy + Math.sin(a - w) * len)}L${f(
      sx + Math.cos(a + w) * len,
    )} ${f(sy + Math.sin(a + w) * len)}Z`;
  }
  const rayCol = ctx.mode === 'dark' ? pal.glow : pal.sun;
  const fill = radial(ctx, sx, sy, 80, [
    { o: 0, c: rayCol, a: ctx.mode === 'dark' ? 0.2 : 0.3 },
    { o: 1, c: rayCol, a: 0 },
  ]);
  moving(ctx, { k: 'wave', period: 14000, deg: 2, min: 0.7, ox: sx, oy: sy, pri: 2 }, () => ctx.nodes.push({ t: 'path', d, fill }));
}

function drawCloudWisps(ctx: Ctx, hy: number, count: number, target: SvgNode[] = ctx.nodes, box?: { x: number; w: number; y0: number; y1: number }) {
  if (target !== ctx.nodes) return drawCloudWispsBase(ctx, hy, count, target, box);
  moving(ctx, { k: 'wave', period: 16000, dx: 3.5, pri: 2 }, () => drawCloudWispsBase(ctx, hy, count, target, box));
}

function drawCloudWispsBase(ctx: Ctx, hy: number, count: number, target: SvgNode[], box?: { x: number; w: number; y0: number; y1: number }) {
  const { rng, pal, W } = ctx;
  const bx = box ?? { x: 0, w: W, y0: hy * 0.14, y1: hy * 0.8 };
  const lit = mix(pal.cloud, pal.glow, 0.25);
  const fill = softFill(ctx, lit, 0.9);
  const fillShade = softFill(ctx, pal.cloudShade, 0.6);
  for (let i = 0; i < count; i++) {
    const cx = bx.x + range(rng, 0.05, 0.95) * bx.w;
    const cy = range(rng, bx.y0, bx.y1);
    const rx = range(rng, 12, 26) * (bx.w / 100);
    const ry = range(rng, 1.6, 3.2) * (bx.w / 100);
    const op = range(rng, 0.55, 0.9);
    target.push({ t: 'ellipse', cx: f(cx), cy: f(cy + ry * 0.5), rx: f(rx * 0.9), ry: f(ry), fill: fillShade, opacity: op * 0.5 });
    target.push({ t: 'ellipse', cx: f(cx), cy: f(cy), rx: f(rx), ry: f(ry), fill, opacity: op });
    target.push({
      t: 'ellipse',
      cx: f(cx + range(rng, -0.4, 0.4) * rx),
      cy: f(cy - ry * 0.6),
      rx: f(rx * range(rng, 0.35, 0.6)),
      ry: f(ry * 0.9),
      fill,
      opacity: op * 0.9,
    });
  }
}

function drawBirds(ctx: Ctx, cx: number, cy: number, color: string, scale = 1) {
  const { rng } = ctx;
  const n = ctx.lite ? 3 : Math.round(range(rng, 3, 6));
  let d = '';
  for (let i = 0; i < n; i++) {
    const x = cx + range(rng, -11, 11) * scale;
    const y = cy + range(rng, -5, 5) * scale;
    const s = range(rng, 1.1, 2) * scale * (ctx.lite ? 1.5 : 1);
    const lift = range(rng, 0.3, 0.7);
    d += `M${f(x - s)} ${f(y - s * 0.1)}Q${f(x - s * 0.5)} ${f(y - s * lift)} ${f(x)} ${f(y + s * 0.15)}Q${f(
      x + s * 0.5,
    )} ${f(y - s * lift)} ${f(x + s)} ${f(y - s * 0.1)}`;
  }
  moving(ctx, { k: 'wave', period: 8000, dx: 2.6, dy: -1.2, sy: 0.12, ox: cx, oy: cy, pri: 2 }, () =>
    ctx.nodes.push({ t: 'path', d, stroke: color, sw: f((ctx.lite ? 0.9 : 0.55) * scale), fill: 'none', opacity: 0.8 }),
  );
}

function drawMist(ctx: Ctx, y: number, strength = 1, target: SvgNode[] = ctx.nodes) {
  const { rng, pal, W } = ctx;
  const col = mix(pal.haze, '#FFFFFF', ctx.mode === 'dark' ? 0.1 : 0.35);
  const fill = softFill(ctx, col, 0.8);
  const n = 3;
  for (let i = 0; i < n; i++) {
    target.push({
      t: 'ellipse',
      cx: f(range(rng, 0.1, 0.9) * W),
      cy: f(y + range(rng, -2, 2)),
      rx: f(range(rng, 30, 55)),
      ry: f(range(rng, 2.5, 5)),
      fill,
      opacity: f(range(rng, 0.45, 0.8) * strength),
    });
  }
}

/** Colour for depth layer i of n (0 = farthest). */
function layerColor(ctx: Ctx, i: number, n: number, base = ctx.pal.land): string {
  const t = (i + 1) / n;
  return mix(ctx.pal.haze, base, 0.22 + 0.78 * t ** 1.25);
}

/** Fill a silhouette with a vertical gradient: rim-lit top, misty base. */
function layerFill(ctx: Ctx, color: string, top: number, bottom: number, depth: number) {
  const { pal } = ctx;
  return linear(ctx, 0, top, 0, bottom, [
    { o: 0, c: mix(color, pal.glow, 0.14 * (1 - depth)) },
    { o: 0.55, c: color },
    { o: 1, c: depth > 0.95 ? mix(color, '#000000', ctx.mode === 'dark' ? 0.25 : 0.12) : mix(color, pal.haze, 0.45 * (1 - depth) + 0.1) },
  ]);
}

function ridgeLayer(ctx: Ctx, pts: Pt[], color: string, depth: number, smooth = true, target: SvgNode[] = ctx.nodes) {
  const minY = Math.min(...pts.map((p) => p[1]));
  const line = smooth ? smoothLine(pts) : polyLine(pts);
  const fill = layerFill(ctx, color, minY, Math.min(ctx.H, minY + ctx.H * 0.32), depth);
  target.push({ t: 'path', d: closeTo(line, pts, ctx.H + 2), fill });
}

function drawGrain(ctx: Ctx) {
  if (ctx.lite || ctx.has('noGrain')) return;
  const { W, H } = ctx;
  const rng = mulberry32(ctx.spec.seed ^ 0x9e3779b9);
  let light = '';
  let dark = '';
  const n = Math.round(420 * (H / W));
  for (let i = 0; i < n; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const s = range(rng, 0.25, 0.45);
    const frag = `M${f(x)} ${f(y)}h${f(s)}v${f(s)}h${f(-s)}Z`;
    if (i % 2) light += frag;
    else dark += frag;
  }
  ctx.nodes.push({ t: 'path', d: light, fill: '#FFFFFF', opacity: ctx.mode === 'dark' ? 0.07 : 0.14 });
  ctx.nodes.push({ t: 'path', d: dark, fill: '#000000', opacity: ctx.mode === 'dark' ? 0.12 : 0.05 });
}

function drawVignette(ctx: Ctx) {
  const { W, H, pal } = ctx;
  const fill = radial(ctx, W / 2, H * 0.45, Math.max(W, H) * 0.8, [
    { o: 0, c: pal.land, a: 0 },
    { o: 0.6, c: pal.land, a: 0 },
    { o: 1, c: pal.land, a: ctx.mode === 'dark' ? 0.35 : 0.16 },
  ]);
  ctx.nodes.push({ t: 'rect', x: -1, y: -1, w: W + 2, h: H + 2, fill });
}

function drawLoneTree(ctx: Ctx, x: number, ground: number, h: number, color: string) {
  const r = h * 0.32;
  const d =
    `M${f(x - h * 0.03)} ${f(ground + 1)}L${f(x - h * 0.025)} ${f(ground - h * 0.55)}L${f(x + h * 0.025)} ${f(
      ground - h * 0.55,
    )}L${f(x + h * 0.03)} ${f(ground + 1)}Z` +
    dot(x, ground - h * 0.72, r) +
    dot(x - r * 0.75, ground - h * 0.55, r * 0.72) +
    dot(x + r * 0.8, ground - h * 0.58, r * 0.66) +
    dot(x + r * 0.15, ground - h * 0.95, r * 0.6);
  ctx.nodes.push({ t: 'path', d, fill: color });
}

// ─── Scene builders ──────────────────────────────────────────────────────────

function skyAndSun(ctx: Ctx, hy: number, opts: { sun?: boolean; cloudCount?: number } = {}) {
  drawSky(ctx, hy);
  drawStars(ctx, hy);
  drawGlow(ctx);
  drawRays(ctx);
  if (opts.sun !== false && !ctx.has('noSun')) drawSun(ctx);
  const clouds = opts.cloudCount ?? (ctx.has('clouds') ? (ctx.lite ? 2 : 4) : 0);
  if (clouds) drawCloudWisps(ctx, hy, clouds);
}

function buildHills(ctx: Ctx) {
  const { W, H, rng } = ctx;
  const hy = H * 0.6;
  skyAndSun(ctx, hy);
  const n = ctx.lite ? 3 : 4;
  let nearPts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const base = H * (0.6 + t * 0.26);
    const amp = H * (0.045 + 0.05 * t);
    const fn = rollingRidge(rng, W, base, amp, 1 - t * 0.35);
    const pts = sample(fn, -6, W + 6, 10);
    ridgeLayer(ctx, pts, layerColor(ctx, i, n), (i + 1) / n);
    if (i === 0 && (ctx.has('mist') || !ctx.lite)) moving(ctx, { k: 'wave', period: 13000, dx: 4, pri: 2 }, () => drawMist(ctx, base + amp * 0.6, ctx.has('mist') ? 1 : 0.55));
    if (i === 1 && ctx.has('mist')) drawMist(ctx, base + amp * 0.8, 0.8);
    if (i === n - 1) nearPts = pts;
  }
  if (ctx.has('rows')) drawRows(ctx, nearPts, layerColor(ctx, n - 1, n));
  if (ctx.has('tree')) {
    // Place a lone tree on the highest point of the nearest ridge (within frame).
    const inFrame = nearPts.filter((p) => p[0] > 12 && p[0] < W - 12);
    const top = inFrame.reduce((a, b) => (b[1] < a[1] ? b : a), inFrame[0]!);
    moving(ctx, { k: 'wave', period: 6000, deg: 1.2, ox: top[0], oy: top[1] + 1.2, pri: 2 }, () => drawLoneTree(ctx, top[0], top[1] + 1.2, H * 0.13, layerColor(ctx, n - 1, n)));
  }
  if (ctx.has('birds')) {
    const [sx, sy] = sunPos(ctx);
    drawBirds(ctx, clamp(W - sx, 25, 75), clamp(sy - H * 0.2, H * 0.14, H * 0.4), layerColor(ctx, n - 1, n));
  }
}

function drawWater(ctx: Ctx, hy: number, calm: boolean) {
  const { W, H, pal, rng } = ctx;
  const [sx, sy] = sunPos(ctx);
  const water = linear(ctx, 0, hy, 0, H, [
    { o: 0, c: mix(pal.horizon, pal.water, 0.35) },
    { o: 0.35, c: mix(pal.water, pal.skyMid, 0.3) },
    { o: 1, c: mix(pal.water, pal.land, ctx.mode === 'dark' ? 0.55 : 0.35) },
  ]);
  ctx.nodes.push({ t: 'rect', x: -1, y: f(hy), w: W + 2, h: f(H - hy + 1), fill: water });
  // Soft sun column
  if (!ctx.has('noSun')) {
    ctx.nodes.push({
      t: 'ellipse',
      cx: f(sx),
      cy: f(hy + (H - hy) * 0.32),
      rx: f(sunRadius(ctx) * 1.7),
      ry: f((H - hy) * 0.55),
      fill: softFill(ctx, pal.glow, pal.moon ? 0.35 : 0.55),
    });
  }
  // Glitter — dashes that widen toward the viewer.
  if (!ctx.has('noSun')) {
    const rows = ctx.lite ? 7 : 14;
    const sunVis = clamp(1 - (sy - hy) / 8, 0.3, 1);
    let dNear = '';
    let dFar = '';
    for (let k = 0; k < rows; k++) {
      const u = (k + 0.5) / rows;
      const y = hy + 0.6 + (H - hy - 1) * u ** 1.5 + range(rng, -0.6, 0.6);
      const spread = sunRadius(ctx) * (0.7 + 2.2 * u);
      const dashes = 1 + Math.round(rng() * 1.6);
      for (let j = 0; j < dashes; j++) {
        const len = range(rng, 0.8, 3.2) * (0.5 + u) * (ctx.lite ? 1.4 : 1);
        const th = (0.22 + 0.38 * u) * (ctx.lite ? 1.6 : 1);
        const x = sx + (rng() - 0.5) * (rng() - 0.5) * 4 * spread - len / 2;
        const frag = `M${f(x)} ${f(y)}h${f(len)}v${f(th)}h${f(-len)}Z`;
        if (u < 0.5) dFar += frag;
        else dNear += frag;
      }
    }
    const glint = mix(pal.sun, '#FFFFFF', 0.3);
    moving(ctx, { k: 'wave', period: 2600, min: 0.35, dx: 0.6, pri: 2 }, () => {
      ctx.nodes.push({ t: 'path', d: dFar, fill: glint, opacity: 0.85 * sunVis });
      ctx.nodes.push({ t: 'path', d: dNear, fill: glint, opacity: 0.5 * sunVis });
    });
  }
  // Swell lines
  const lines = calm ? 4 : ctx.lite ? 4 : 8;
  let d = '';
  for (let k = 0; k < lines; k++) {
    const u = (k + 1) / (lines + 1);
    const y = hy + (H - hy) * u ** 1.4;
    const a = 0.3 + 0.9 * u;
    const ph = rng() * 10;
    const pts: Pt[] = [];
    for (let x = -6; x <= W + 6; x += 9) pts.push([x, y + Math.sin(x / 7 + ph) * a * 0.4]);
    // Break lines into broken segments for a painterly feel.
    const start = Math.floor(range(rng, 0, 3));
    const seg = pts.slice(start, start + 5 + Math.floor(rng() * 6));
    if (seg.length > 1) d += smoothLine(seg);
  }
  moving(ctx, { k: 'wave', period: 7000, dx: 1.8, dy: 0.3, pri: 3 }, () =>
    ctx.nodes.push({
      t: 'path',
      d,
      stroke: mix(pal.horizon, '#FFFFFF', 0.3),
      sw: ctx.lite ? 0.8 : 0.45,
      fill: 'none',
      opacity: calm ? 0.22 : 0.32,
    }),
  );
  // Crisp horizon line
  ctx.nodes.push({ t: 'rect', x: -1, y: f(hy - 0.15), w: W + 2, h: 0.4, fill: mix(pal.horizon, '#FFFFFF', 0.4), opacity: 0.55 });
}

function buildOcean(ctx: Ctx) {
  const { W, H, rng } = ctx;
  const hy = H * 0.62;
  skyAndSun(ctx, hy);
  if (ctx.has('headland')) {
    const left = rng() < 0.5;
    const cx = left ? range(rng, -6, 12) : range(rng, 88, 106);
    const pw = range(rng, 16, 26);
    const hgt = H * range(rng, 0.06, 0.1);
    const pts = sample((x) => hy - hgt * Math.exp(-(((x - cx) / pw) ** 2)) * (1 + 0.06 * Math.sin(x)), cx - pw * 2.2, cx + pw * 2.2, 14);
    ctx.nodes.push({ t: 'path', d: closeTo(smoothLine(pts), pts, hy + 0.3), fill: layerColor(ctx, 1, 4) });
  }
  drawWater(ctx, hy, ctx.has('waves') === false);
  if (ctx.has('birds')) drawBirds(ctx, W * 0.3, H * 0.28, layerColor(ctx, 3, 4));
}

function buildLake(ctx: Ctx) {
  const { W, H, rng, pal } = ctx;
  const hy = H * 0.64;
  skyAndSun(ctx, hy);
  const mountains = ctx.has('peak') || rng() < 0.45;
  const layers: { pts: Pt[]; color: string; smooth: boolean }[] = [];
  if (mountains) {
    layers.push({ pts: mountainPts(rng, W, hy - H * 0.02, H * 0.26, 0.55, range(rng, 25, 75)), color: layerColor(ctx, 0, 4), smooth: false });
  } else {
    layers.push({ pts: sample(rollingRidge(rng, W, hy - H * 0.07, H * 0.05), -6, W + 6, 10), color: layerColor(ctx, 0, 4), smooth: true });
  }
  layers.push({ pts: sample(rollingRidge(rng, W, hy - H * 0.03, H * 0.035, 1.3), -6, W + 6, 10), color: layerColor(ctx, 1, 4), smooth: true });
  // Treeline shore — a thin serrated band.
  const shore: Pt[] = [[-6, hy]];
  for (let x = -6; x <= W + 6; x += ctx.lite ? 2.4 : 1.6) {
    const h = range(rng, 0.8, 2.6) * (H / 100);
    shore.push([x, hy - 0.6], [x + 0.6, hy - 0.6 - h]);
  }
  shore.push([W + 6, hy]);
  layers.push({ pts: shore, color: layerColor(ctx, 2, 4), smooth: false });

  for (const [i, L] of layers.entries()) {
    if (L.smooth) ridgeLayer(ctx, L.pts, L.color, (i + 1) / 4, true);
    else ctx.nodes.push({ t: 'path', d: closeTo(polyLine(L.pts), L.pts, hy + 0.5), fill: layerFill(ctx, L.color, Math.min(...L.pts.map((p) => p[1])), hy, (i + 1) / 4) });
    if (i === 0) moving(ctx, { k: 'wave', period: 13000, dx: 4, pri: 2 }, () => drawMist(ctx, hy - H * 0.03, 0.7));
  }

  // Water with mirrored reflection.
  const clipId = newId(ctx, 'c');
  ctx.defs.push({ t: 'clip', id: clipId, children: [{ t: 'rect', x: -1, y: f(hy), w: W + 2, h: f(H - hy + 1), fill: '#000' }] });
  const refl: SvgNode[] = [];
  const flipped = linear(ctx, 0, hy, 0, H, [
    { o: 0, c: pal.horizon },
    { o: 0.25, c: pal.skyLow },
    { o: 0.7, c: pal.skyMid },
    { o: 1, c: pal.skyTop },
  ]);
  refl.push({ t: 'rect', x: -1, y: f(hy), w: W + 2, h: f(H - hy + 1), fill: flipped });
  if (!ctx.has('noSun')) {
    const [sx, sy] = sunPos(ctx);
    if (sy < hy) drawSun(ctx, refl, [sx, 2 * hy - sy], 1);
  }
  for (const L of layers) {
    const m = mirrorPts(L.pts, hy);
    const d = `${(L.smooth ? smoothLine(m) : polyLine(m))}L${f(W + 6)} ${f(hy - 0.5)}L-6 ${f(hy - 0.5)}Z`;
    refl.push({ t: 'path', d, fill: L.color });
  }
  const tint = linear(ctx, 0, hy, 0, H, [
    { o: 0, c: pal.water, a: 0.25 },
    { o: 1, c: mix(pal.water, pal.land, 0.4), a: 0.7 },
  ]);
  refl.push({ t: 'rect', x: -1, y: f(hy), w: W + 2, h: f(H - hy + 1), fill: tint });
  // Shimmer lines
  let d = '';
  const nLines = ctx.lite ? 4 : 9;
  for (let k = 0; k < nLines; k++) {
    const u = (k + 1) / (nLines + 1);
    const y = hy + (H - hy) * u ** 1.3;
    const x = range(rng, -10, W * 0.7);
    const len = range(rng, 12, 40);
    d += `M${f(x)} ${f(y)}h${f(len)}`;
  }
  refl.push({ t: 'path', d, stroke: mix(pal.horizon, '#FFFFFF', 0.4), sw: ctx.lite ? 0.8 : 0.4, fill: 'none', opacity: 0.45 });
  ctx.nodes.push({ t: 'g', clip: clipId, children: refl });

  // Near bank framing a corner.
  const left = rng() < 0.5;
  const bank = sample(
    (x) => {
      const u = left ? x / W : 1 - x / W;
      return H * 0.9 + H * 0.22 * clamp(u - 0.05, 0, 1) ** 0.8 - H * 0.02 * Math.sin(u * 9);
    },
    -6,
    W + 6,
    12,
  );
  ridgeLayer(ctx, bank, layerColor(ctx, 3, 4), 1);
  if (ctx.has('birds')) drawBirds(ctx, W * 0.65, H * 0.3, layerColor(ctx, 3, 4));
}

function buildDunes(ctx: Ctx) {
  const { W, H, rng, pal } = ctx;
  const hy = H * 0.6;
  skyAndSun(ctx, hy);
  const [sx] = sunPos(ctx);
  const sand = ctx.mode === 'dark' ? mix(mix(pal.land, pal.glow, 0.3), pal.skyLow, 0.2) : mix(pal.land, pal.glow, 0.34);
  const n = ctx.lite ? 3 : 4;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const base = H * (0.62 + t * 0.24);
    const amp = H * (0.05 + 0.07 * t);
    const color = layerColor(ctx, i, n, sand);
    // Crests alternate gentle windward slope → sharp lee face. The lee (shadow) face always
    // points away from the sun, so mirror the construction when the sun is on the right.
    const flip = sx > W / 2;
    const X = (v: number) => f(flip ? W - v : v);
    let x = range(rng, -40, -10);
    let y = base + amp * 0.3;
    let d = `M${X(x)} ${f(y)}`;
    const shadows: string[] = [];
    const minY = base - amp;
    while (x < W + 10) {
      const span = range(rng, 34, 60) * (1 - t * 0.2);
      const cx = x + span * range(rng, 0.55, 0.72);
      const cy = base - amp * range(rng, 0.55, 1);
      const nx = x + span;
      const ny = base + amp * range(rng, 0.05, 0.45);
      d += `C${X(x + (cx - x) * 0.45)} ${f(y)} ${X(cx - (cx - x) * 0.3)} ${f(cy)} ${X(cx)} ${f(cy)}`;
      const lee = `C${X(cx + (nx - cx) * 0.25)} ${f(cy + (ny - cy) * 0.1)} ${X(nx - (nx - cx) * 0.3)} ${f(ny)} ${X(nx)} ${f(ny)}`;
      d += lee;
      // Shadow hugs the lee face exactly, then curves back up to the crest.
      shadows.push(`M${X(cx)} ${f(cy)}${lee}Q${X(cx + (nx - cx) * 0.2)} ${f(ny)} ${X(cx)} ${f(cy)}Z`);
      x = nx;
      y = ny;
    }
    d += `L${X(x)} ${f(H + 2)}L${X(-50)} ${f(H + 2)}Z`;
    ctx.nodes.push({ t: 'path', d, fill: layerFill(ctx, color, minY, Math.min(H, minY + H * 0.3), (i + 1) / n) });
    ctx.nodes.push({ t: 'path', d: shadows.join(''), fill: mix(color, pal.land, 0.45), opacity: (ctx.mode === 'dark' ? 0.25 : 0.32) + 0.2 * t });
    if (i === 0) drawMist(ctx, base + amp * 0.4, 0.5);
  }
  if (ctx.has('breeze')) drawBreeze(ctx, ctx.lite ? 2 : 3, H * 0.14, H * 0.5, mix(pal.sun, '#FFFFFF', 0.25));
  if (ctx.has('birds')) drawBirds(ctx, W * 0.7, H * 0.3, pal.land);
}

function buildMountains(ctx: Ctx) {
  const { W, H, rng, pal } = ctx;
  const hy = H * 0.6;
  skyAndSun(ctx, hy);
  const n = ctx.lite ? 3 : 4;
  const [sx] = sunPos(ctx);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const color = layerColor(ctx, i, n);
    if (i < n - 1) {
      const peakX = i === 0 ? clamp(W - sx + range(rng, -15, 15), 15, 85) : range(rng, 10, 90);
      const pts = mountainPts(rng, W, H * (0.56 + t * 0.2), H * (0.3 - t * 0.1), 0.52, peakX);
      const minY = Math.min(...pts.map((p) => p[1]));
      ctx.nodes.push({ t: 'path', d: closeTo(polyLine(pts), pts, H + 2), fill: layerFill(ctx, color, minY, minY + H * 0.3, (i + 1) / n) });
      // Snow / lit cap on the farthest range.
      if (i === 0 && !pal.moon) {
        const clipId = newId(ctx, 'c');
        ctx.defs.push({ t: 'clip', id: clipId, children: [{ t: 'path', d: closeTo(polyLine(pts), pts, H + 2), fill: '#000' }] });
        const snowLine = sample(rollingRidge(rng, W, minY + H * 0.07, H * 0.015, 3), -6, W + 6, 14);
        const snowD = `${polyLine(snowLine)}L${f(W + 6)} -2L-6 -2Z`;
        ctx.nodes.push({
          t: 'g',
          clip: clipId,
          children: [{ t: 'path', d: snowD, fill: mix(pal.sun, pal.haze, 0.35), opacity: ctx.mode === 'dark' ? 0.35 : 0.6 }],
        });
      }
      drawMist(ctx, H * (0.6 + t * 0.2), i === 0 ? 0.9 : 0.6);
    } else {
      const pts = sample(rollingRidge(rng, W, H * 0.88, H * 0.05), -6, W + 6, 10);
      ridgeLayer(ctx, pts, color, 1);
    }
  }
  if (ctx.has('birds')) drawBirds(ctx, W * 0.3, H * 0.25, pal.land);
}

function cloudBank(ctx: Ctx, baseY: number, rMin: number, rMax: number): { d: string; minY: number } {
  const { rng, W, H } = ctx;
  const ph = range(rng, 0, 6.28);
  const ph2 = range(rng, 0, 6.28);
  const fr = range(rng, 0.8, 1.6);
  let x = range(rng, -18, -8);
  const yAt = (xx: number) => baseY + Math.sin((xx / W) * Math.PI * 1.4 + ph2) * (H * 0.018);
  let y = yAt(x);
  let d = `M${f(x)} ${f(y)}`;
  let minY = baseY;
  while (x < W + 12) {
    const env = 0.5 + 0.5 * Math.sin((x / W) * Math.PI * 2 * fr + ph);
    const r = (rMin + (rMax - rMin) * env) * range(rng, 0.7, 1.25);
    const span = r * range(rng, 1.5, 2.6);
    const nx = x + span;
    const ny = yAt(nx) + range(rng, -1.2, 1.2);
    const h = r * range(rng, 0.45, 0.85);
    d += `C${f(x + span * 0.02)} ${f(y - h * 1.3)} ${f(nx - span * 0.02)} ${f(ny - h * 1.3)} ${f(nx)} ${f(ny)}`;
    minY = Math.min(minY, Math.min(y, ny) - h);
    x = nx;
    y = ny;
  }
  d += `L${f(x)} ${f(H + 2)}L-30 ${f(H + 2)}Z`;
  return { d, minY };
}

function buildClouds(ctx: Ctx) {
  const { W, H, rng, pal } = ctx;
  const hy = H * 0.66;
  skyAndSun(ctx, hy, { cloudCount: ctx.lite ? 1 : 2 });
  if (ctx.has('peak')) {
    const pts = mountainPts(rng, W, H * 0.68, H * 0.24, 0.62, range(rng, 20, 80), range(rng, 10, 15));
    ctx.nodes.push({ t: 'path', d: closeTo(polyLine(pts), pts, H + 2), fill: layerFill(ctx, layerColor(ctx, 0, 4), Math.min(...pts.map((p) => p[1])), H * 0.7, 0.3) });
  }
  const n = ctx.lite ? 3 : 4;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const base = H * (0.66 + t * 0.22);
    const { d, minY } = cloudBank(ctx, base, 2.6 + t * 3, 4.5 + t * 6);
    const lit = mix(pal.cloud, pal.sun, 0.35);
    const shade = mix(pal.cloudShade, pal.haze, 0.5 * (1 - t));
    const top = mix(mix(pal.haze, lit, 0.35 + 0.65 * t), pal.glow, 0.15);
    const fill = linear(ctx, 0, minY, 0, base + H * 0.08, [
      { o: 0, c: top },
      { o: 0.55, c: mix(top, shade, 0.45) },
      { o: 1, c: shade },
    ]);
    ctx.nodes.push({ t: 'path', d, fill });
    if (i < n - 1) drawMist(ctx, base + H * 0.04, 0.5);
  }
  // Sunlit sheen on the nearest bank.
  const [sx] = sunPos(ctx);
  ctx.nodes.push({ t: 'ellipse', cx: f(sx), cy: f(H * 0.78), rx: 32, ry: 9, fill: softFill(ctx, pal.sun, 0.35) });
  if (ctx.has('birds')) drawBirds(ctx, W - sx, H * 0.35, pal.cloudShade);
}

function buildForest(ctx: Ctx) {
  const { W, H, rng, pal } = ctx;
  const hy = H * 0.6;
  skyAndSun(ctx, hy);
  // Distant hills
  const far = sample(rollingRidge(rng, W, H * 0.6, H * 0.06), -6, W + 6, 10);
  ridgeLayer(ctx, far, layerColor(ctx, 0, 4), 0.25);
  drawMist(ctx, H * 0.63, 0.8);
  const rows = ctx.lite ? 2 : 3;
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const ground = rollingRidge(rng, W, H * (0.68 + t * 0.16), H * (0.02 + 0.03 * t));
    const treeH = H * (0.07 + 0.12 * t);
    const step = (1.6 + 3.2 * t) * (ctx.lite ? 1.5 : 1);
    const pts: Pt[] = [[-6, ground(-6)]];
    let x = -6;
    let minY = H;
    while (x < W + 6) {
      const h = treeH * range(rng, 0.55, 1.15);
      const w = h * range(rng, 0.34, 0.46);
      const by = ground(x);
      const tip = by - h;
      minY = Math.min(minY, tip);
      if (t > 0.4 && !ctx.lite) {
        // Tiered conifer
        pts.push(
          [x - w / 2, by],
          [x - w * 0.2, by - h * 0.42],
          [x - w * 0.36, by - h * 0.4],
          [x - w * 0.1, by - h * 0.72],
          [x - w * 0.22, by - h * 0.7],
          [x, tip],
          [x + w * 0.22, by - h * 0.7],
          [x + w * 0.1, by - h * 0.72],
          [x + w * 0.36, by - h * 0.4],
          [x + w * 0.2, by - h * 0.42],
          [x + w / 2, by],
        );
      } else {
        pts.push([x - w / 2, by], [x, tip], [x + w / 2, by]);
      }
      x += step * range(rng, 0.7, 1.3);
    }
    pts.push([W + 6, ground(W + 6)]);
    const color = layerColor(ctx, r + 1, rows + 1);
    ctx.nodes.push({ t: 'path', d: closeTo(polyLine(pts), pts, H + 2), fill: layerFill(ctx, color, minY, minY + H * 0.25, (r + 2) / (rows + 1)) });
    if (r < rows - 1) drawMist(ctx, H * (0.72 + t * 0.14), 0.75);
  }
  if (ctx.has('birds')) {
    const [sx, sy] = sunPos(ctx);
    drawBirds(ctx, clamp(sx + 18, 22, 78), clamp(sy - 16, 12, 40), pal.land);
  }
}

function buildRain(ctx: Ctx) {
  const { W, H, rng, pal } = ctx;
  const hy = H * 0.62;
  drawSky(ctx, hy);
  drawGlow(ctx, ctx.nodes, 0.7);
  if (!ctx.has('noSun')) {
    const [sx, sy] = sunPos(ctx);
    ctx.nodes.push({ t: 'circle', cx: f(sx), cy: f(sy), r: f(sunRadius(ctx)), fill: softFill(ctx, pal.sun, 0.7) });
  }
  // Heavy strata
  const shade = softFill(ctx, pal.cloudShade, 0.75);
  const lightC = softFill(ctx, mix(pal.cloud, pal.skyLow, 0.4), 0.6);
  for (let i = 0; i < (ctx.lite ? 4 : 8); i++) {
    ctx.nodes.push({
      t: 'ellipse',
      cx: f(range(rng, -10, W + 10)),
      cy: f(range(rng, -2, H * 0.3)),
      rx: f(range(rng, 25, 50)),
      ry: f(range(rng, 5, 11)),
      fill: i % 3 === 2 ? lightC : shade,
      opacity: f(range(rng, 0.55, 0.9)),
    });
  }
  const n = ctx.lite ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const pts = sample(rollingRidge(rng, W, H * (0.64 + t * 0.2), H * (0.04 + 0.04 * t)), -6, W + 6, 10);
    ridgeLayer(ctx, pts, layerColor(ctx, i, n + 0.6), (i + 1) / (n + 0.6));
    drawMist(ctx, H * (0.68 + t * 0.2), 0.7);
  }
  // Rain streaks — slanted, two depths.
  const slant = range(rng, 0.12, 0.26);
  const streaks = (count: number, lMin: number, lMax: number) => {
    let d = '';
    for (let i = 0; i < count; i++) {
      const x = range(rng, -10, W + 5);
      const y = range(rng, -5, H);
      const len = range(rng, lMin, lMax);
      d += `M${f(x)} ${f(y)}l${f(-len * slant)} ${f(len)}`;
    }
    return d;
  };
  const rainCol = mix(pal.skyLow, '#FFFFFF', 0.6);
  const fallY = H + 5;
  moving(ctx, { k: 'loop', period: 1500, dx: -fallY * slant, dy: fallY }, () =>
    ctx.nodes.push({ t: 'path', d: streaks(ctx.lite ? 30 : 80, 2.5, 5), stroke: rainCol, sw: ctx.lite ? 0.45 : 0.25, fill: 'none', opacity: 0.35 }),
  );
  moving(ctx, { k: 'loop', period: 950, dx: -fallY * slant, dy: fallY }, () =>
    ctx.nodes.push({ t: 'path', d: streaks(ctx.lite ? 12 : 28, 6, 12), stroke: rainCol, sw: ctx.lite ? 0.7 : 0.4, fill: 'none', opacity: 0.4 }),
  );
}

function buildWindow(ctx: Ctx) {
  const { W, H, rng, pal, mode } = ctx;
  const dark = mode === 'dark';
  // Interior wall — a warm, shadowed tone taken from the palette.
  const wall = dark ? mix(pal.land, pal.skyMid, 0.28) : mix(mix(pal.land, pal.horizon, 0.58), '#FFF3EA', 0.1);
  const wallFill = linear(ctx, 0, 0, 0, H, [
    { o: 0, c: mix(wall, '#000000', dark ? 0.35 : 0.14) },
    { o: 0.7, c: wall },
    { o: 1, c: mix(wall, '#000000', dark ? 0.2 : 0.08) },
  ]);
  ctx.nodes.push({ t: 'rect', x: -1, y: -1, w: W + 2, h: H + 2, fill: wallFill });

  const x0 = W * 0.27;
  const x1 = W * 0.73;
  const ww = x1 - x0;
  const r = ww / 2;
  const top = H * 0.1;
  const bottom = H * 0.64;
  const archD = `M${f(x0)} ${f(bottom)}L${f(x0)} ${f(top + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(top + r)}L${f(x1)} ${f(bottom)}Z`;

  // Warm light bloom on the wall around the window.
  const [sxN] = [ctx.spec.sunX];
  const bloom = radial(ctx, W / 2, (top + bottom) / 2, W * 0.62, [
    { o: 0, c: pal.glow, a: 0.55 },
    { o: 0.5, c: pal.glow, a: 0.18 },
    { o: 1, c: pal.glow, a: 0 },
  ]);
  ctx.nodes.push({ t: 'rect', x: -1, y: -1, w: W + 2, h: H + 2, fill: bloom });

  // Outside view, clipped to the arch.
  const clipId = newId(ctx, 'c');
  ctx.defs.push({ t: 'clip', id: clipId, children: [{ t: 'path', d: archD, fill: '#000' }] });
  const view: SvgNode[] = [];
  const vhy = bottom - (bottom - top) * 0.2;
  drawSky(ctx, vhy, view, { x: x0, y: top, w: ww, h: bottom - top });
  drawStars(ctx, vhy, view);
  // Sun inside the frame: map sunX/sunY into the window.
  const sunAt: Pt = [x0 + ww * clamp(sxN, 0.2, 0.8), top + (bottom - top) * clamp(ctx.spec.sunY, 0.25, 0.85)];
  const g = radial(ctx, sunAt[0], sunAt[1], ww * 0.9, [
    { o: 0, c: pal.glow, a: 0.8 },
    { o: 0.4, c: pal.glow, a: 0.25 },
    { o: 1, c: pal.glow, a: 0 },
  ]);
  view.push({ t: 'rect', x: f(x0), y: f(top), w: f(ww), h: f(bottom - top), fill: g });
  if (!ctx.has('noSun')) drawSun(ctx, view, sunAt, 0.7);
  if (!ctx.lite) drawCloudWisps(ctx, vhy, 2, view, { x: x0, w: ww, y0: top + r * 0.6, y1: vhy - 8 });
  for (let i = 0; i < 2; i++) {
    const pts = sample(rollingRidge(rng, ww, vhy + i * 5 - 2, 3 + i * 2), -2, ww + 2, 8).map(([x, y]) => [x + x0, y] as Pt);
    const c = layerColor(ctx, i + 1, 3);
    view.push({ t: 'path', d: closeTo(smoothLine(pts), pts, bottom + 2), fill: layerFill(ctx, c, vhy - 6, bottom, (i + 2) / 3) });
  }
  ctx.nodes.push({ t: 'g', clip: clipId, children: view });

  // Frame + muntins
  const frame = mix(wall, dark ? '#000000' : pal.land, dark ? 0.45 : 0.35);
  const fw = ctx.lite ? 2.6 : 2;
  ctx.nodes.push({ t: 'path', d: archD, stroke: frame, sw: fw, fill: 'none' });
  const mw = ctx.lite ? 1.8 : 1.1;
  ctx.nodes.push({
    t: 'path',
    d: `M${f(W / 2)} ${f(top)}L${f(W / 2)} ${f(bottom)}M${f(x0)} ${f(top + r)}L${f(x1)} ${f(top + r)}${
      ctx.lite ? '' : `M${f(x0)} ${f(top + r + (bottom - top - r) / 2)}L${f(x1)} ${f(top + r + (bottom - top - r) / 2)}`
    }`,
    stroke: frame,
    sw: mw,
    fill: 'none',
  });
  // Sill
  const sillY = bottom + fw / 2;
  ctx.nodes.push({ t: 'rect', x: f(x0 - 5), y: f(sillY), w: f(ww + 10), h: 2.6, rx: 0.6, fill: mix(wall, '#FFFFFF', dark ? 0.08 : 0.35) });
  ctx.nodes.push({ t: 'rect', x: f(x0 - 5), y: f(sillY + 2.6), w: f(ww + 10), h: 1.2, fill: mix(wall, '#000000', 0.25), opacity: 0.6 });

  // Floor and projected light patch.
  const floorY = H * 0.84;
  const floor = mix(wall, pal.land, dark ? 0.35 : 0.25);
  ctx.nodes.push({ t: 'rect', x: -1, y: f(floorY), w: W + 2, h: f(H - floorY + 1), fill: linear(ctx, 0, floorY, 0, H, [{ o: 0, c: mix(floor, '#000', 0.12) }, { o: 1, c: floor }]) });
  const skew = (0.5 - sxN) * 60;
  const px0 = x0 + skew * 0.5;
  const px1 = x1 + skew * 0.5;
  const patchD = `M${f(px0)} ${f(floorY + 1)}L${f(px1)} ${f(floorY + 1)}L${f(px1 + skew)} ${f(H + 1)}L${f(px0 + skew - 6)} ${f(H + 1)}Z`;
  const patch = linear(ctx, 0, floorY, 0, H, [
    { o: 0, c: pal.sun, a: dark ? 0.32 : 0.55 },
    { o: 1, c: pal.glow, a: dark ? 0.12 : 0.25 },
  ]);
  ctx.nodes.push({ t: 'path', d: patchD, fill: patch });
  // Muntin shadow across the patch
  const midTop = (px0 + px1) / 2;
  ctx.nodes.push({
    t: 'path',
    d: `M${f(midTop)} ${f(floorY + 1)}L${f(midTop + skew - 3)} ${f(H + 1)}`,
    stroke: floor,
    sw: ctx.lite ? 1.6 : 1.1,
    fill: 'none',
    opacity: 0.8,
  });
  // Spill beam from window toward the floor.
  const beam = linear(ctx, 0, bottom, 0, H, [
    { o: 0, c: pal.sun, a: dark ? 0.1 : 0.16 },
    { o: 1, c: pal.sun, a: 0 },
  ]);
  ctx.nodes.push({ t: 'path', d: `M${f(x0)} ${f(top + r)}L${f(x1)} ${f(top + r)}L${f(px1 + skew)} ${f(H)}L${f(px0 + skew - 6)} ${f(H)}Z`, fill: beam });

  // Potted plant on the sill.
  if (ctx.has('plant') || rng() < 0.6) {
    const left = rng() < 0.5;
    const px = left ? x0 + 3 : x1 - 3;
    const ps = 1;
    const pot = mix(frame, pal.glow, 0.2);
    const py = sillY;
    let d = `M${f(px - 3.2 * ps)} ${f(py - 5.5)}L${f(px + 3.2 * ps)} ${f(py - 5.5)}L${f(px + 2.4 * ps)} ${f(py)}L${f(px - 2.4 * ps)} ${f(py)}Z`;
    ctx.nodes.push({ t: 'path', d, fill: pot });
    d = '';
    const leaves = ctx.lite ? 4 : 6;
    for (let i = 0; i < leaves; i++) {
      const a = -Math.PI / 2 + ((i / (leaves - 1)) - 0.5) * 2.2;
      const len = range(rng, 6, 10);
      const tx = px + Math.cos(a) * len;
      const ty = py - 5.5 + Math.sin(a) * len;
      const nx = Math.cos(a + Math.PI / 2) * 1.8;
      const ny = Math.sin(a + Math.PI / 2) * 1.8;
      const mx = (px + tx) / 2;
      const my = (py - 5.5 + ty) / 2;
      d += `M${f(px)} ${f(py - 5.5)}Q${f(mx + nx)} ${f(my + ny)} ${f(tx)} ${f(ty)}Q${f(mx - nx)} ${f(my - ny)} ${f(px)} ${f(py - 5.5)}Z`;
    }
    ctx.nodes.push({ t: 'path', d, fill: mix(frame, dark ? '#16302C' : '#4E6B55', 0.45) });
  }
}

// ─── Motif helpers ───────────────────────────────────────────────────────────

/** Ellipse as a path fragment. */
const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;

/** Stroke width that stays legible in lite (thumbnail) renders. */
const sw = (ctx: Ctx, full: number, lite = full * 1.7) => f(ctx.lite ? lite : full);

/** Soft sky + sun + a couple of hazy distant ridges — backdrop for object motifs. */
function backdrop(ctx: Ctx, hy: number, opts: { layers?: number; sun?: boolean; clouds?: number; amp?: number } = {}) {
  const { W, H, rng } = ctx;
  skyAndSun(ctx, hy, { sun: opts.sun, cloudCount: opts.clouds });
  const n = opts.layers ?? 2;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const pts = sample(rollingRidge(rng, W, hy + H * 0.05 * t, H * (opts.amp ?? 0.04) * (1 + t)), -6, W + 6, 10);
    ridgeLayer(ctx, pts, layerColor(ctx, i, n + 2), (i + 1) / (n + 2));
    drawMist(ctx, hy + H * (0.02 + 0.05 * t), 0.7);
  }
}

/** Filled, tapering stroke along a polyline (branches, stems). */
function taper(pts: Pt[], w0: number, w1: number): string {
  const L: Pt[] = [];
  const R: Pt[] = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * (i / (pts.length - 1))) / 2;
    L.push([p[0] - (dy / len) * w, p[1] + (dx / len) * w]);
    R.push([p[0] + (dy / len) * w, p[1] - (dx / len) * w]);
  });
  const back = R.reverse();
  return `${smoothLine(L)}L${f(back[0]![0])} ${f(back[0]![1])}${smoothLine(back).replace(/^M[^C]*/, '')}Z`;
}

/** Cumulus puff (union of circles on a flat base). Returns top y. */
function cloudPuff(
  ctx: Ctx,
  cx: number,
  baseY: number,
  w: number,
  lit: string,
  shade: string,
  opts: { opacity?: number; lumps?: number; target?: SvgNode[]; tall?: number } = {},
): number {
  const { rng } = ctx;
  const k = opts.lumps ?? 5;
  const tall = opts.tall ?? 1;
  let d = '';
  let minY = baseY;
  for (let i = 0; i < k; i++) {
    const u = (i + 0.5) / k;
    const r = w * (0.11 + 0.13 * Math.sin(Math.PI * u) * tall) * range(rng, 0.85, 1.15);
    const x = cx - w / 2 + w * u + range(rng, -0.03, 0.03) * w;
    const y = baseY - r * 0.55;
    d += dot(x, y, r);
    minY = Math.min(minY, y - r);
  }
  const bh = w * 0.1;
  // Same winding as the circle arcs so the union has no holes (nonzero fill).
  d += `M${f(cx - w * 0.44)} ${f(baseY - bh)}L${f(cx - w * 0.44)} ${f(baseY)}L${f(cx + w * 0.44)} ${f(baseY)}L${f(cx + w * 0.44)} ${f(baseY - bh)}Z`;
  const fill = linear(ctx, 0, minY, 0, baseY, [
    { o: 0, c: lit },
    { o: 0.55, c: mix(lit, shade, 0.4) },
    { o: 1, c: shade },
  ]);
  (opts.target ?? ctx.nodes).push({ t: 'path', d, fill, opacity: opts.opacity });
  return minY;
}

/** Curling breeze strokes. */
function drawBreeze(ctx: Ctx, count: number, y0: number, y1: number, color: string) {
  const { rng, W } = ctx;
  let d = '';
  for (let i = 0; i < count; i++) {
    const y = y0 + ((y1 - y0) * (i + 0.5)) / count + range(rng, -1.5, 1.5);
    const x = range(rng, -4, W * 0.35);
    const len = range(rng, 30, 48);
    const c = range(rng, 1.8, 3);
    d += `M${f(x)} ${f(y)}C${f(x + len * 0.35)} ${f(y - 2.5)} ${f(x + len * 0.65)} ${f(y + 2.5)} ${f(x + len)} ${f(y)}`;
    d += `a${f(c)} ${f(c)} 0 1 0 ${f(-c)} ${f(-c)}`;
  }
  moving(ctx, { k: 'wave', period: 7000, dx: 3, min: 0.6, pri: 2 }, () =>
    ctx.nodes.push({ t: 'path', d, stroke: color, sw: sw(ctx, 0.6, 1.1), fill: 'none', opacity: 0.7 }),
  );
}

/** Five-petal flower head. */
function flowerHead(x: number, y: number, r: number): string {
  let d = '';
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
    d += dot(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.5);
  }
  return d;
}

// ─── Motif scenes ────────────────────────────────────────────────────────────

function drawBalloon(ctx: Ctx, cx: number, cy: number, r: number, color: string, depth: number) {
  const { pal } = ctx;
  const [sx] = sunPos(ctx);
  const base = mix(pal.haze, color, 0.3 + 0.7 * depth);
  const lx = sx < cx ? -0.4 : 0.4;
  const fill = radial(ctx, cx + lx * r, cy - 0.35 * r, r * 1.9, [
    { o: 0, c: mix(base, pal.sun, 0.45) },
    { o: 0.45, c: base },
    { o: 1, c: mix(base, pal.land, 0.5) },
  ]);
  const P = (x: number, y: number) => `${f(cx + x * r)} ${f(cy + y * r)}`;
  const env = `M${P(-0.2, 1.32)}C${P(-0.72, 0.95)} ${P(-1, 0.5)} ${P(-1, 0)}A${f(r)} ${f(r)} 0 0 1 ${P(1, 0)}C${P(1, 0.5)} ${P(0.72, 0.95)} ${P(0.2, 1.32)}Z`;
  ctx.nodes.push({ t: 'path', d: env, fill });
  const lineC = mix(base, pal.land, 0.45);
  const gores = ctx.lite && r < 8
    ? `M${P(0, -1)}L${P(0, 1.32)}`
    : `M${P(0, -1)}C${P(-0.62, -0.6)} ${P(-0.62, 0.7)} ${P(-0.2, 1.32)}M${P(0, -1)}C${P(0.62, -0.6)} ${P(0.62, 0.7)} ${P(0.2, 1.32)}M${P(0, -1)}L${P(0, 1.32)}`;
  ctx.nodes.push({ t: 'path', d: gores, stroke: lineC, sw: f(Math.max(0.3, r * 0.05)), fill: 'none', opacity: 0.55 });
  // Lit band
  ctx.nodes.push({ t: 'path', d: `M${P(-0.9, 0.55)}Q${P(0, 0.85)} ${P(0.9, 0.55)}`, stroke: mix(base, pal.sun, 0.55), sw: f(r * 0.14), fill: 'none', opacity: 0.55 });
  // Ropes + basket
  ctx.nodes.push({ t: 'path', d: `M${P(-0.2, 1.32)}L${P(-0.13, 1.62)}M${P(0.2, 1.32)}L${P(0.13, 1.62)}`, stroke: lineC, sw: f(Math.max(0.25, r * 0.045)), fill: 'none' });
  const basket = mix(pal.haze, mix(pal.land, ctx.tok.sunrise, 0.25), 0.3 + 0.7 * depth);
  ctx.nodes.push({ t: 'rect', x: f(cx - 0.16 * r), y: f(cy + 1.6 * r), w: f(0.32 * r), h: f(0.26 * r), rx: f(0.05 * r), fill: basket });
}

function buildBalloons(ctx: Ctx) {
  const { W, H, rng, tok, pal } = ctx;
  const hy = H * 0.66;
  skyAndSun(ctx, hy);
  const n = ctx.lite ? 3 : 4;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const base = H * (0.66 + t * 0.22);
    const amp = H * (0.04 + 0.05 * t);
    const pts = sample(rollingRidge(rng, W, base, amp, 1 - t * 0.35), -6, W + 6, 10);
    ridgeLayer(ctx, pts, layerColor(ctx, i, n), (i + 1) / n);
    if (i < 2) drawMist(ctx, base + amp * 0.6, 0.9);
  }
  const cool = mix(tok.accent, pal.skyTop, 0.35);
  const balloons: [number, number, number, string, number][] = [
    [W * 0.84, H * 0.44, H * 0.045, cool, 0.35],
    [W * 0.68, H * 0.2, H * 0.08, tok.warning, 0.65],
    [W * 0.32, H * 0.3, H * 0.13, tok.calm, 1],
  ];
  balloons.forEach(([x, y, r, c, depth], i) =>
    moving(ctx, { k: 'wave', period: 7000 + i * 1300, delay: i * 900, dy: -1.6 * (0.5 + depth), dx: 0.6 }, () => drawBalloon(ctx, x, y, r, c, depth)),
  );
}

function buildBowl(ctx: Ctx) {
  const { W, H, pal, tok, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.6;
  backdrop(ctx, hy, { layers: 2 });
  // Surface
  const surfY = H * 0.8;
  const surf = mix(pal.land, pal.haze, dark ? 0.25 : 0.45);
  ctx.nodes.push({ t: 'rect', x: -1, y: f(surfY - H * 0.04), w: W + 2, h: f(H * 0.26), fill: linear(ctx, 0, surfY - H * 0.04, 0, H, [{ o: 0, c: mix(surf, pal.glow, 0.2) }, { o: 1, c: mix(surf, pal.land, 0.5) }]) });
  const cx = W / 2;
  const rx = Math.min(W * 0.28, H * 0.34);
  const ry = rx * 0.24;
  const depth = rx * 0.62;
  const rimY = surfY - depth - ry * 0.2;
  // Resonance rings
  let rings = '';
  const nR = 3;
  for (let k = 0; k < nR; k++) {
    const s = 1.35 + 0.38 * k;
    rings += ell(cx, rimY + depth * 0.3, rx * s, (ry + depth * 0.5) * s);
  }
  moving(ctx, { k: 'ripple', period: 3800, s: 0.16, ox: cx, oy: rimY + depth * 0.3 }, () =>
    ctx.nodes.push({ t: 'path', d: rings, stroke: mix(pal.sun, pal.glow, 0.3), sw: sw(ctx, 0.55, 0.9), fill: 'none', opacity: dark ? 0.45 : 0.6 }),
  );
  // Cushion + shadow
  ctx.nodes.push({ t: 'ellipse', cx: f(cx), cy: f(surfY + ry * 0.4), rx: f(rx * 1.15), ry: f(ry * 0.9), fill: softFill(ctx, pal.land, 0.6) });
  const cush = mix(tok.calm, pal.land, dark ? 0.55 : 0.3);
  ctx.nodes.push({ t: 'ellipse', cx: f(cx), cy: f(surfY - ry * 0.1), rx: f(rx * 0.92), ry: f(ry * 1.15), fill: linear(ctx, 0, surfY - ry * 1.3, 0, surfY + ry, [{ o: 0, c: mix(cush, pal.sun, 0.25) }, { o: 1, c: mix(cush, pal.land, 0.4) }]) });
  // Bowl body
  const brass = dark ? mix(tok.warning, pal.haze, 0.5) : mix(tok.warning, pal.glow, 0.35);
  const [sx] = sunPos(ctx);
  const hl = sx < cx ? 0.3 : 0.7;
  const metal = linear(ctx, cx - rx, 0, cx + rx, 0, [
    { o: 0, c: mix(brass, pal.land, 0.55) },
    { o: hl - 0.12, c: brass },
    { o: hl, c: mix(brass, pal.sun, 0.65) },
    { o: hl + 0.12, c: brass },
    { o: 1, c: mix(brass, pal.land, 0.6) },
  ]);
  const body = `M${f(cx - rx)} ${f(rimY)}C${f(cx - rx)} ${f(rimY + depth * 0.9)} ${f(cx - rx * 0.55)} ${f(rimY + depth * 1.05)} ${f(cx)} ${f(rimY + depth * 1.05)}C${f(cx + rx * 0.55)} ${f(rimY + depth * 1.05)} ${f(cx + rx)} ${f(rimY + depth * 0.9)} ${f(cx + rx)} ${f(rimY)}Z`;
  ctx.nodes.push({ t: 'path', d: body, fill: metal });
  // Rim + inside
  ctx.nodes.push({ t: 'ellipse', cx: f(cx), cy: f(rimY), rx: f(rx), ry: f(ry), fill: mix(brass, pal.sun, 0.35) });
  ctx.nodes.push({
    t: 'ellipse', cx: f(cx), cy: f(rimY + ry * 0.12), rx: f(rx * 0.9), ry: f(ry * 0.78),
    fill: linear(ctx, 0, rimY - ry, 0, rimY + ry, [{ o: 0, c: mix(brass, pal.land, 0.6) }, { o: 1, c: mix(brass, pal.glow, 0.2) }]),
  });
  // Mallet resting against the cushion
  const wood = mix(tok.sunrise, pal.land, dark ? 0.65 : 0.45);
  const mx0 = cx + rx * 0.95;
  const my0 = surfY + ry * 0.25;
  ctx.nodes.push({ t: 'path', d: `M${f(mx0)} ${f(my0)}L${f(mx0 + rx * 0.62)} ${f(my0 - rx * 0.12)}`, stroke: wood, sw: f(Math.max(0.9, rx * 0.06)), fill: 'none' });
  ctx.nodes.push({ t: 'ellipse', cx: f(mx0 + rx * 0.66), cy: f(my0 - rx * 0.13), rx: f(rx * 0.1), ry: f(rx * 0.08), fill: mix(wood, pal.land, 0.3) });
}

function buildPiano(ctx: Ctx) {
  const { W, H, pal, tok, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.5;
  backdrop(ctx, hy, { layers: 2 });
  const top = H * 0.56;
  const keyTop = H * 0.63;
  // Case / fallboard
  const wood = dark ? mix(pal.land, tok.sunrise, 0.12) : mix(pal.land, tok.sunrise, 0.22);
  ctx.nodes.push({ t: 'rect', x: -1, y: f(top), w: W + 2, h: f(H - top + 1), fill: linear(ctx, 0, top, 0, keyTop, [{ o: 0, c: mix(wood, pal.glow, 0.25) }, { o: 1, c: mix(wood, '#000000', 0.2) }]) });
  ctx.nodes.push({ t: 'rect', x: -1, y: f(top), w: W + 2, h: f(Math.max(0.5, H * 0.008)), fill: mix(pal.horizon, pal.sun, 0.4), opacity: 0.7 });
  ctx.nodes.push({ t: 'rect', x: -1, y: f(keyTop - H * 0.012), w: W + 2, h: f(H * 0.012), fill: mix(tok.calm, pal.land, dark ? 0.4 : 0.15) });
  // White keys
  const kw = Math.max(6.5, H * 0.125);
  const ivory = dark ? mix(pal.cloud, pal.haze, 0.35) : mix(pal.cloud, pal.horizon, 0.35);
  const keyFill = linear(ctx, 0, keyTop, 0, H, [
    { o: 0, c: mix(ivory, pal.cloudShade, 0.3) },
    { o: 0.2, c: mix(ivory, pal.sun, 0.25) },
    { o: 1, c: mix(ivory, pal.cloudShade, 0.35) },
  ]);
  const x0 = -kw * 0.35;
  const count = Math.ceil((W - x0) / kw) + 1;
  let whites = '';
  const gap = Math.max(0.35, kw * 0.05);
  for (let i = 0; i < count; i++) {
    const x = x0 + i * kw;
    whites += `M${f(x + gap / 2)} ${f(keyTop)}h${f(kw - gap)}v${f(H - keyTop + 2)}h${f(-(kw - gap))}Z`;
  }
  ctx.nodes.push({ t: 'rect', x: -1, y: f(keyTop), w: W + 2, h: f(H - keyTop + 1), fill: mix(pal.land, '#000000', 0.2) });
  ctx.nodes.push({ t: 'path', d: whites, fill: keyFill });
  // Warm light across the keys
  const [sx] = sunPos(ctx);
  ctx.nodes.push({ t: 'ellipse', cx: f(sx), cy: f(keyTop + (H - keyTop) * 0.35), rx: 38, ry: f((H - keyTop) * 0.6), fill: softFill(ctx, pal.glow, dark ? 0.3 : 0.4) });
  // Black keys
  const bh = (H - keyTop) * 0.58;
  const bw = kw * 0.56;
  let blacks = '';
  for (let i = 0; i < count; i++) {
    if (![0, 1, 3, 4, 5].includes(i % 7)) continue;
    const bx = x0 + (i + 1) * kw - bw / 2;
    blacks += `M${f(bx)} ${f(keyTop - 0.2)}h${f(bw)}v${f(bh)}q0 ${f(bw * 0.12)} ${f(-bw * 0.12)} ${f(bw * 0.12)}h${f(-bw * 0.76)}q${f(-bw * 0.12)} 0 ${f(-bw * 0.12)} ${f(-bw * 0.12)}Z`;
  }
  const ebony = mix(pal.land, '#000000', dark ? 0.2 : 0.1);
  ctx.nodes.push({ t: 'path', d: blacks, fill: linear(ctx, 0, keyTop, 0, keyTop + bh, [{ o: 0, c: ebony }, { o: 0.85, c: mix(ebony, pal.glow, 0.12) }, { o: 1, c: mix(ebony, pal.sun, 0.25) }]) });
}

function buildStrings(ctx: Ctx) {
  const { W, H, pal, tok, mode, rng } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.7;
  backdrop(ctx, hy, { layers: 2, amp: 0.03 });
  // Warm resonant waves across the whole cover
  let bgWaves = '';
  for (let k = 0; k < (ctx.lite ? 3 : 5); k++) {
    const y = H * (0.22 + 0.1 * k);
    const ph = rng() * 6;
    const pts: Pt[] = [];
    for (let x = -6; x <= W + 6; x += 4) pts.push([x, y + Math.sin(x / 9 + ph) * H * 0.018]);
    bgWaves += smoothLine(pts);
  }
  ctx.nodes.push({ t: 'path', d: bgWaves, stroke: mix(pal.sun, pal.glow, 0.4), sw: sw(ctx, 0.4, 0.7), fill: 'none', opacity: dark ? 0.25 : 0.35 });
  const R = H * 0.23;
  const bx = W * 0.38;
  const by = H * 0.8;
  const ang = (-62 * Math.PI) / 180;
  const d: Pt = [Math.cos(ang), Math.sin(ang)];
  const nrm: Pt = [-d[1], d[0]];
  const wood = dark ? mix(tok.sunrise, pal.land, 0.62) : mix(tok.sunrise, pal.land, 0.42);
  const wN = R * 0.42;
  const wT = R * 0.34;
  const p0: Pt = [bx + d[0] * R * 0.5, by + d[1] * R * 0.5];
  const L = H * 1.1;
  const p1: Pt = [p0[0] + d[0] * L, p0[1] + d[1] * L];
  // Sound rings from the body
  let rings = '';
  for (let k = 1; k <= 3; k++) {
    const rr = R * (1.25 + 0.38 * k);
    for (const [a0, a1] of [[-0.55, 0.45], [Math.PI - 0.45, Math.PI + 0.4]] as const) {
      rings += `M${f(bx + Math.cos(a0) * rr)} ${f(by + Math.sin(a0) * rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(bx + Math.cos(a1) * rr)} ${f(by + Math.sin(a1) * rr)}`;
    }
  }
  moving(ctx, { k: 'ripple', period: 3400, s: 0.12, ox: bx, oy: by }, () =>
    ctx.nodes.push({ t: 'path', d: rings, stroke: mix(pal.sun, pal.glow, 0.25), sw: sw(ctx, 0.6, 1), fill: 'none', opacity: dark ? 0.5 : 0.65 }),
  );
  // Neck
  const neck = `M${f(p0[0] - (nrm[0] * wN) / 2)} ${f(p0[1] - (nrm[1] * wN) / 2)}L${f(p1[0] - (nrm[0] * wT) / 2)} ${f(p1[1] - (nrm[1] * wT) / 2)}L${f(p1[0] + (nrm[0] * wT) / 2)} ${f(p1[1] + (nrm[1] * wT) / 2)}L${f(p0[0] + (nrm[0] * wN) / 2)} ${f(p0[1] + (nrm[1] * wN) / 2)}Z`;
  ctx.nodes.push({ t: 'path', d: neck, fill: linear(ctx, p0[0] - nrm[0] * wN, p0[1] - nrm[1] * wN, p0[0] + nrm[0] * wN, p0[1] + nrm[1] * wN, [{ o: 0, c: mix(wood, pal.land, 0.4) }, { o: 0.5, c: mix(wood, pal.glow, 0.25) }, { o: 1, c: mix(wood, pal.land, 0.45) }]) });
  // Pegs where the neck is still in frame
  const tTop = (p0[1] - H * 0.06) / -d[1];
  for (const t of [0.72, 0.86]) {
    const c: Pt = [p0[0] + d[0] * tTop * t, p0[1] + d[1] * tTop * t];
    const pl = wN * 0.95;
    ctx.nodes.push({ t: 'path', d: `M${f(c[0] - nrm[0] * pl)} ${f(c[1] - nrm[1] * pl)}L${f(c[0] + nrm[0] * pl)} ${f(c[1] + nrm[1] * pl)}`, stroke: mix(wood, pal.land, 0.35), sw: f(Math.max(0.8, R * 0.09)), fill: 'none' });
  }
  // Body (gourd)
  ctx.nodes.push({ t: 'ellipse', cx: f(bx), cy: f(by + R * 0.95), rx: f(R * 1.3), ry: f(R * 0.25), fill: softFill(ctx, pal.land, 0.5) });
  const [sx] = sunPos(ctx);
  const bodyFill = radial(ctx, bx + (sx > bx ? 0.35 : -0.35) * R, by - R * 0.4, R * 1.6, [
    { o: 0, c: mix(wood, pal.sun, 0.45) },
    { o: 0.5, c: wood },
    { o: 1, c: mix(wood, pal.land, 0.55) },
  ]);
  ctx.nodes.push({ t: 'ellipse', cx: f(bx), cy: f(by), rx: f(R * 1.02), ry: f(R), fill: bodyFill });
  // Soundboard + decorative rim
  ctx.nodes.push({ t: 'ellipse', cx: f(bx + R * 0.05), cy: f(by + R * 0.02), rx: f(R * 0.72), ry: f(R * 0.7), fill: mix(wood, pal.sun, 0.22), opacity: 0.8 });
  ctx.nodes.push({ t: 'path', d: ell(bx + R * 0.05, by + R * 0.02, R * 0.72, R * 0.7), stroke: mix(tok.warning, pal.sun, 0.3), sw: sw(ctx, 0.5, 0.8), fill: 'none', opacity: 0.8 });
  // Neck joint band
  ctx.nodes.push({ t: 'path', d: `M${f(p0[0] - nrm[0] * wN * 0.62)} ${f(p0[1] - nrm[1] * wN * 0.62)}L${f(p0[0] + nrm[0] * wN * 0.62)} ${f(p0[1] + nrm[1] * wN * 0.62)}`, stroke: mix(tok.warning, pal.sun, 0.25), sw: f(R * 0.12), fill: 'none' });
  // Strings
  const bridge: Pt = [bx - d[0] * R * 0.32, by - d[1] * R * 0.32];
  let strings = '';
  for (let s = 0; s < 4; s++) {
    const o = (s - 1.5) * wN * 0.2;
    strings += `M${f(bridge[0] + nrm[0] * o)} ${f(bridge[1] + nrm[1] * o)}L${f(p1[0] + nrm[0] * o * 0.8)} ${f(p1[1] + nrm[1] * o * 0.8)}`;
  }
  ctx.nodes.push({ t: 'path', d: strings, stroke: mix(pal.sun, '#FFFFFF', 0.3), sw: sw(ctx, 0.22, 0.4), fill: 'none', opacity: 0.85 });
  ctx.nodes.push({ t: 'path', d: `M${f(bridge[0] - nrm[0] * wN * 0.45)} ${f(bridge[1] - nrm[1] * wN * 0.45)}L${f(bridge[0] + nrm[0] * wN * 0.45)} ${f(bridge[1] + nrm[1] * wN * 0.45)}`, stroke: mix(pal.sun, wood, 0.2), sw: f(R * 0.08), fill: 'none' });
}

/**
 * Warm Drone — one long, low, sustained note. A string vibrating in slow motion across a dusk
 * sky (standing-wave snapshots fanning between two far nodes), a big warm sun half-sunk on still
 * water, and wide, slow ripples spreading from its reflection.
 */
function buildDrone(ctx: Ctx) {
  const { W, H, pal, tok, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.68;
  skyAndSun(ctx, hy, { sun: false });
  const sx = ctx.spec.sunX * W;
  const warm = dark ? mix(tok.warning, pal.glow, 0.35) : mix(tok.warning, pal.glow, 0.25);
  const hot = mix(pal.sun, warm, 0.35);
  // Low far ridge so the horizon reads as land meeting water at the edges only
  const ridge: Pt[] = [];
  for (let x = -6; x <= W + 6; x += 4) {
    const edge = Math.abs(x - sx) / W;
    ridge.push([x, hy - H * 0.06 * Math.max(0, edge - 0.18) * (1 + 0.25 * Math.sin(x / 7))]);
  }
  ctx.nodes.push({ t: 'path', d: closeTo(smoothLine(ridge), ridge, hy + 1), fill: mix(pal.land, pal.haze, dark ? 0.35 : 0.45) });
  // Sun: large, half-sunk on the horizon, extra warm halo
  const r = sunRadius(ctx) * 1.55;
  ctx.nodes.push({ t: 'circle', cx: f(sx), cy: f(hy), r: f(r * 3.4), fill: softFill(ctx, warm, dark ? 0.45 : 0.55) });
  const sunClip = newId(ctx, 'c');
  ctx.defs.push({ t: 'clip', id: sunClip, children: [{ t: 'rect', x: -1, y: -1, w: W + 2, h: f(hy + 1), fill: '#000' }] });
  const disc = radial(ctx, sx, hy - r * 0.2, r, [
    { o: 0, c: mix(pal.sun, '#FFFFFF', 0.35), a: 1 },
    { o: 0.65, c: hot, a: 1 },
    { o: 1, c: mix(warm, pal.glow, 0.4), a: 1 },
  ]);
  ctx.nodes.push({ t: 'g', clip: sunClip, children: [{ t: 'circle', cx: f(sx), cy: f(hy), r: f(r), fill: disc }] });
  // Still water
  const waterTop = mix(pal.horizon, warm, 0.3);
  ctx.nodes.push({
    t: 'rect', x: -1, y: f(hy), w: W + 2, h: f(H - hy + 1),
    fill: linear(ctx, 0, hy, 0, H, [{ o: 0, c: waterTop }, { o: 0.45, c: mix(pal.water, warm, 0.18) }, { o: 1, c: mix(pal.water, pal.land, 0.45) }]),
  });
  // Reflection column
  ctx.nodes.push({ t: 'ellipse', cx: f(sx), cy: f(hy + (H - hy) * 0.3), rx: f(r * 1.1), ry: f((H - hy) * 0.42), fill: softFill(ctx, hot, dark ? 0.55 : 0.7) });
  ctx.nodes.push({ t: 'rect', x: -1, y: f(hy - 0.2), w: W + 2, h: 0.5, fill: mix(pal.sun, '#FFFFFF', 0.3), opacity: 0.7 });
  // Slow ripples spreading from the reflection — wide, flat, evenly spaced (a sustained tone)
  let ripples = '';
  const nRip = ctx.lite ? 3 : 5;
  for (let k = 1; k <= nRip; k++) {
    const t = k / nRip;
    ripples += ell(sx, hy + (H - hy) * (0.12 + 0.62 * t * t), r * (1.2 + 3.8 * t), (H - hy) * (0.04 + 0.1 * t));
  }
  moving(ctx, { k: 'ripple', period: 5600, s: 0.07, ox: sx, oy: hy }, () =>
    ctx.nodes.push({ t: 'path', d: ripples, stroke: mix(hot, '#FFFFFF', dark ? 0.05 : 0.2), sw: sw(ctx, 0.45, 0.8), fill: 'none', opacity: dark ? 0.5 : 0.6 }),
  );
  // The drone: a string vibrating between two nodes beyond the frame, drawn as fanned snapshots
  const x0 = W * 0.07;
  const x1 = W * 0.93;
  const y0 = hy - H * 0.33;
  const amp = H * 0.12;
  const snap = (a: number, harmonic = 1) => {
    const pts: Pt[] = [];
    for (let x = x0; x <= x1 + 0.1; x += (x1 - x0) / 40) pts.push([x, y0 + a * Math.sin((harmonic * Math.PI * (x - x0)) / (x1 - x0))]);
    return smoothLine(pts);
  };
  // Soft glow filling the vibration envelope — envelope + snapshots vibrate together (one held note)
  moving(ctx, { k: 'wave', period: 1100, sy: 0.3, ox: W / 2, oy: y0 }, () => {
  const env: Pt[] = [];
  for (let x = x0; x <= x1 + 0.1; x += (x1 - x0) / 40) env.push([x, y0 - amp * Math.sin((Math.PI * (x - x0)) / (x1 - x0))]);
  for (let x = x1; x >= x0 - 0.1; x -= (x1 - x0) / 40) env.push([x, y0 + amp * Math.sin((Math.PI * (x - x0)) / (x1 - x0))]);
  ctx.nodes.push({ t: 'path', d: `${polyLine(env)}Z`, fill: linear(ctx, 0, y0 - amp, 0, y0 + amp, [{ o: 0, c: warm, a: 0 }, { o: 0.5, c: warm, a: dark ? 0.22 : 0.26 }, { o: 1, c: warm, a: 0 }]) });
  // Faint second harmonic underneath
  ctx.nodes.push({ t: 'path', d: snap(amp * 0.35, 2) + snap(-amp * 0.35, 2), stroke: mix(warm, pal.skyMid, 0.35), sw: sw(ctx, 0.35, 0.6), fill: 'none', opacity: 0.45 });
  // Fundamental: brightest at the extremes (where a string lingers), fading through the middle
  const n = ctx.lite ? 5 : 9;
  const buckets: [string, string, string] = ['', '', ''];
  for (let i = 0; i < n; i++) {
    const c = Math.cos((Math.PI * i) / (n - 1));
    const b = Math.abs(c) > 0.9 ? 0 : Math.abs(c) > 0.5 ? 1 : 2;
    buckets[b] += snap(amp * c);
  }
  const strokeC = mix(hot, warm, 0.25);
  ctx.nodes.push({ t: 'path', d: buckets[2], stroke: strokeC, sw: sw(ctx, 0.4, 0.7), fill: 'none', opacity: 0.35 });
  ctx.nodes.push({ t: 'path', d: buckets[1], stroke: strokeC, sw: sw(ctx, 0.55, 0.9), fill: 'none', opacity: 0.6 });
  ctx.nodes.push({ t: 'path', d: buckets[0], stroke: mix(hot, '#FFFFFF', 0.2), sw: sw(ctx, 0.9, 1.3), fill: 'none', opacity: 0.95 });
  });
  // Rest line + the two fixed ends (nodes), so it reads as one held string
  ctx.nodes.push({ t: 'path', d: `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y0)}`, stroke: mix(hot, '#FFFFFF', 0.3), sw: sw(ctx, 0.3, 0.5), fill: 'none', opacity: 0.5 });
  for (const x of [x0, x1]) {
    ctx.nodes.push({ t: 'circle', cx: f(x), cy: f(y0), r: f(W * 0.035), fill: softFill(ctx, hot, 0.7) });
    ctx.nodes.push({ t: 'circle', cx: f(x), cy: f(y0), r: f(W * (ctx.lite ? 0.018 : 0.012)), fill: mix(pal.sun, '#FFFFFF', 0.4) });
  }
}

function buildWaves(ctx: Ctx) {
  const { W, H, pal, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.4;
  skyAndSun(ctx, hy);
  const sea = linear(ctx, 0, hy, 0, H, [{ o: 0, c: mix(pal.horizon, pal.water, 0.45) }, { o: 1, c: mix(pal.water, pal.land, 0.3) }]);
  ctx.nodes.push({ t: 'rect', x: -1, y: f(hy), w: W + 2, h: f(H - hy + 1), fill: sea });
  const [sx] = sunPos(ctx);
  ctx.nodes.push({ t: 'ellipse', cx: f(sx), cy: f(hy + (H - hy) * 0.15), rx: 22, ry: f((H - hy) * 0.25), fill: softFill(ctx, pal.glow, 0.5) });
  ctx.nodes.push({ t: 'rect', x: -1, y: f(hy - 0.15), w: W + 2, h: 0.4, fill: mix(pal.horizon, '#FFFFFF', 0.4), opacity: 0.55 });
  const foam = mix(pal.sun, '#FFFFFF', dark ? 0.1 : 0.4);
  const bands = ctx.lite ? 3 : 4;
  for (let k = 0; k < bands; k++) {
    const t = k / (bands - 1);
    const base = hy + (H - hy) * (0.22 + 0.26 * k * (4 / (bands + 1)));
    const a = (H - hy) * (0.07 + 0.1 * t);
    const Lw = 26 + 22 * t;
    const ph = rng() * Math.PI * 2;
    const yAt = (x: number) => base - a * (0.5 + 0.5 * Math.sin((2 * Math.PI * x) / Lw + ph)) ** 2.4;
    const pts = sample(yAt, -8, W + 8, Math.round((W + 16) / 2));
    const col = mix(mix(pal.water, pal.skyMid, 0.25 * (1 - t)), pal.land, 0.15 + 0.25 * t);
    const fill = linear(ctx, 0, base - a, 0, base + (H - hy) * 0.25, [
      { o: 0, c: mix(col, pal.horizon, 0.4) },
      { o: 0.4, c: col },
      { o: 1, c: mix(col, pal.land, 0.3) },
    ]);
    ctx.nodes.push({ t: 'path', d: closeTo(polyLine(pts), pts, H + 2), fill });
    ctx.nodes.push({ t: 'path', d: polyLine(pts), stroke: foam, sw: sw(ctx, 0.35 + 0.35 * t, 0.7 + 0.5 * t), fill: 'none', opacity: 0.75 });
    // Curling lips on crests (nearer bands)
    if (t > 0.3) {
      let curl = '';
      const first = ((Math.PI / 2 - ph) / (2 * Math.PI)) * Lw;
      for (let x = first - Lw * 3; x < W + Lw; x += Lw) {
        if (x < -4 || x > W + 4) continue;
        const y = base - a;
        const c = a * 0.75;
        curl += `M${f(x - c * 0.3)} ${f(y)}C${f(x + c * 0.5)} ${f(y - c * 0.35)} ${f(x + c * 1.1)} ${f(y + c * 0.25)} ${f(x + c * 0.7)} ${f(y + c * 0.8)}`;
        curl += `M${f(x + c * 0.1)} ${f(y + c * 0.35)}c${f(c * 0.25)} ${f(-c * 0.1)} ${f(c * 0.4)} ${f(c * 0.1)} ${f(c * 0.3)} ${f(c * 0.35)}`;
      }
      ctx.nodes.push({ t: 'path', d: curl, stroke: foam, sw: sw(ctx, 0.5 + 0.4 * t, 0.9 + 0.5 * t), fill: 'none', opacity: 0.85 });
    }
    // Foam flecks
    if (!ctx.lite) {
      let fl = '';
      for (let i = 0; i < 10; i++) {
        const x = range(rng, 0, W);
        fl += dot(x, yAt(x) + range(rng, 0.5, 3), range(rng, 0.15, 0.35));
      }
      ctx.nodes.push({ t: 'path', d: fl, fill: foam, opacity: 0.6 });
    }
  }
  if (ctx.has('birds')) drawBirds(ctx, W * 0.7, H * 0.18, layerColor(ctx, 3, 4), 0.8);
}

function drawPerchedBird(ctx: Ctx, x: number, y: number, b: number, dir: 1 | -1, color: string) {
  const { pal, tok } = ctx;
  const X = (v: number) => f(x + v * b * dir);
  const Y = (v: number) => f(y + v * b);
  let d = ell(x, y - 0.8 * b, 1.0 * b, 0.78 * b);
  d += dot(x + 0.72 * b * dir, y - 1.55 * b, 0.56 * b);
  // Beak
  d += `M${X(1.15)} ${Y(-1.72)}L${X(1.7)} ${Y(-1.5)}L${X(1.15)} ${Y(-1.35)}Z`;
  // Tail
  d += `M${X(-0.7)} ${Y(-0.95)}L${X(-2)} ${Y(-0.2)}L${X(-1.8)} ${Y(0.12)}L${X(-0.5)} ${Y(-0.45)}Z`;
  ctx.nodes.push({ t: 'path', d, fill: color });
  // Breast patch
  ctx.nodes.push({ t: 'path', d: ell(x + 0.42 * b * dir, y - 0.72 * b, 0.52 * b, 0.5 * b), fill: mix(tok.calm, color, ctx.mode === 'dark' ? 0.5 : 0.25) });
  // Legs + eye
  ctx.nodes.push({ t: 'path', d: `M${X(-0.15)} ${Y(-0.1)}L${X(-0.2)} ${Y(0.35)}M${X(0.2)} ${Y(-0.1)}L${X(0.18)} ${Y(0.35)}`, stroke: color, sw: f(Math.max(0.25, b * 0.12)), fill: 'none' });
  if (b > 2.2) ctx.nodes.push({ t: 'circle', cx: X(0.85), cy: Y(-1.65), r: f(b * 0.1), fill: pal.sun, opacity: 0.8 });
}

function buildBranch(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.74;
  backdrop(ctx, hy, { layers: 2 });
  const col = mix(pal.land, pal.haze, dark ? 0.05 : 0.12);
  const y0 = H * 0.72;
  const y1 = H * 0.56;
  const pts: Pt[] = sample((x) => y0 + (y1 - y0) * (x / W) + Math.sin((x / W) * Math.PI) * -H * 0.04, -6, W * 0.92, 10);
  ctx.nodes.push({ t: 'path', d: taper(pts, H * 0.055, H * 0.012), fill: col });
  // Twigs
  const twig = (i: number, dx: number, dy: number, w: number) => {
    const p = pts[i]!;
    const tp: Pt[] = [p, [p[0] + dx * 0.5, p[1] + dy * 0.55], [p[0] + dx, p[1] + dy]];
    ctx.nodes.push({ t: 'path', d: taper(tp, w, w * 0.3), fill: col });
    return tp[2];
  };
  const tips = [twig(3, W * 0.1, -H * 0.2, H * 0.02), twig(7, W * 0.12, H * 0.08, H * 0.014), pts[pts.length - 1]!];
  // Leaves + blossoms
  const leafC = mix(col, dark ? pal.haze : pal.glow, 0.25);
  let leaves = '';
  let blooms = '';
  for (const tip of tips) {
    for (let j = 0; j < (ctx.lite ? 2 : 3); j++) {
      const a = range(rng, -2.6, 0.4);
      const len = H * range(rng, 0.05, 0.08);
      const tx = tip![0] + Math.cos(a) * len;
      const ty = tip![1] + Math.sin(a) * len;
      const nx = Math.cos(a + Math.PI / 2) * len * 0.28;
      const ny = Math.sin(a + Math.PI / 2) * len * 0.28;
      const mx = (tip![0] + tx) / 2;
      const my = (tip![1] + ty) / 2;
      leaves += `M${f(tip![0])} ${f(tip![1])}Q${f(mx + nx)} ${f(my + ny)} ${f(tx)} ${f(ty)}Q${f(mx - nx)} ${f(my - ny)} ${f(tip![0])} ${f(tip![1])}Z`;
    }
    blooms += flowerHead(tip![0] + H * 0.01, tip![1] - H * 0.02, H * 0.028);
  }
  ctx.nodes.push({ t: 'path', d: leaves, fill: leafC });
  ctx.nodes.push({ t: 'path', d: blooms, fill: mix(tok.accent, pal.sun, dark ? 0.2 : 0.35), opacity: 0.95 });
  // Perched birds
  const b = H * 0.075;
  const at = (x: number) => pts.reduce((a, p) => (Math.abs(p[0] - x) < Math.abs(a[0] - x) ? p : a), pts[0]!);
  const p1 = at(W * 0.3);
  const p2 = at(W * 0.6);
  drawPerchedBird(ctx, p1[0], p1[1] - H * 0.018, b, 1, col);
  drawPerchedBird(ctx, p2[0], p2[1] - H * 0.012, b * 0.85, -1, col);
  drawBirds(ctx, W * 0.72, H * 0.2, mix(col, pal.haze, 0.2), 0.8);
}

function buildRaincloud(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.82;
  drawSky(ctx, hy);
  drawGlow(ctx, ctx.nodes, 0.6);
  // Distant hills + puddle surface
  const far = sample(rollingRidge(rng, W, hy, H * 0.035), -6, W + 6, 10);
  ridgeLayer(ctx, far, layerColor(ctx, 0, 3), 0.3);
  drawMist(ctx, hy + H * 0.01, 0.8);
  const water = linear(ctx, 0, hy + H * 0.03, 0, H, [{ o: 0, c: mix(pal.water, pal.skyLow, 0.4) }, { o: 1, c: mix(pal.water, pal.land, 0.35) }]);
  ctx.nodes.push({ t: 'rect', x: -1, y: f(hy + H * 0.03), w: W + 2, h: f(H * 0.2), fill: water });
  // Cloud
  const cs = Math.min(W * 0.78, H * 0.95);
  const cx = W / 2;
  const cb = H * 0.42;
  const lit = mix(pal.cloud, pal.sun, dark ? 0.15 : 0.35);
  cloudPuff(ctx, cx - cs * 0.28, cb - H * 0.1, cs * 0.5, mix(lit, pal.skyMid, 0.35), mix(pal.cloudShade, pal.skyMid, 0.3), { opacity: 0.7, lumps: 3 });
  cloudPuff(ctx, cx, cb, cs, lit, mix(pal.cloudShade, pal.land, 0.1), { lumps: 5 });
  // Drops
  const dropC = dark ? mix(tok.accent, pal.cloud, 0.45) : mix(pal.water, pal.land, 0.3);
  const s = H * 0.02;
  let drops = '';
  const cols = ctx.lite ? 5 : 7;
  for (let c = 0; c < cols; c++) {
    const x = cx - cs * 0.36 + (cs * 0.72 * c) / (cols - 1);
    const rows = ctx.lite ? 2 : 3;
    for (let r = 0; r < rows; r++) {
      const y = cb + H * 0.07 + ((hy - cb - H * 0.05) * (r + (c % 2) * 0.5)) / rows;
      if (y > hy) continue;
      const ss = s * range(rng, 0.8, 1.1);
      drops += `M${f(x)} ${f(y - 1.8 * ss)}C${f(x + 0.2 * ss)} ${f(y - 1.1 * ss)} ${f(x + ss)} ${f(y - 0.3 * ss)} ${f(x + ss)} ${f(y + 0.3 * ss)}A${f(ss)} ${f(ss)} 0 0 1 ${f(x - ss)} ${f(y + 0.3 * ss)}C${f(x - ss)} ${f(y - 0.3 * ss)} ${f(x - 0.2 * ss)} ${f(y - 1.1 * ss)} ${f(x)} ${f(y - 1.8 * ss)}Z`;
    }
  }
  ctx.nodes.push({ t: 'path', d: drops, fill: dropC, opacity: 0.9 });
  // Ripples
  let rip = '';
  for (const [rx, k] of [[0.3, 2], [0.62, 3], [0.85, 1]] as const) {
    for (let i = 0; i < k; i++) rip += ell(W * rx, hy + H * 0.1, H * (0.03 + 0.03 * i), H * (0.008 + 0.008 * i));
  }
  ctx.nodes.push({ t: 'path', d: rip, stroke: mix(pal.skyLow, '#FFFFFF', 0.4), sw: sw(ctx, 0.35, 0.6), fill: 'none', opacity: 0.6 });
}

function mountainRange(ctx: Ctx, i: number, n: number, baseY: number, amp: number, peakX: number, snow: boolean, width?: number) {
  const { W, H, rng, pal } = ctx;
  const pts = mountainPts(rng, W, baseY, amp, 0.6, peakX, width);
  const color = layerColor(ctx, i, n);
  const minY = Math.min(...pts.map((p) => p[1]));
  const d = closeTo(polyLine(pts), pts, H + 2);
  ctx.nodes.push({ t: 'path', d, fill: layerFill(ctx, color, minY, minY + H * 0.3, (i + 1) / n) });
  if (snow) {
    const clipId = newId(ctx, 'c');
    ctx.defs.push({ t: 'clip', id: clipId, children: [{ t: 'path', d, fill: '#000' }] });
    const snowLine = sample(rollingRidge(rng, W, minY + amp * 0.22, H * 0.02, 4), -6, W + 6, 18);
    ctx.nodes.push({
      t: 'g',
      clip: clipId,
      children: [{ t: 'path', d: `${polyLine(snowLine)}L${f(W + 6)} -2L-6 -2Z`, fill: mix(pal.sun, pal.haze, 0.3), opacity: ctx.mode === 'dark' ? 0.45 : 0.75 }],
    });
  }
}

function buildMeadow(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.58;
  skyAndSun(ctx, hy);
  const [sx] = sunPos(ctx);
  const peakX = clamp(W - sx + 8, 30, 70);
  mountainRange(ctx, 0, 5, H * 0.56, H * 0.4, peakX, true, 13);
  drawMist(ctx, H * 0.56, 0.8);
  mountainRange(ctx, 1, 5, H * 0.63, H * 0.24, peakX < 50 ? peakX + 38 : peakX - 38, true, 11);
  drawMist(ctx, H * 0.64, 0.7);
  // Meadow slopes
  const green = mix(pal.land, dark ? pal.water : pal.haze, dark ? 0.15 : 0.1);
  const m1 = sample(rollingRidge(rng, W, H * 0.7, H * 0.04), -6, W + 6, 10);
  ridgeLayer(ctx, m1, mix(pal.haze, green, 0.65), 0.6);
  const m2 = sample(rollingRidge(rng, W, H * 0.82, H * 0.05), -6, W + 6, 10);
  ridgeLayer(ctx, m2, green, 1);
  // Flowers: specks on the far slope, heads on stems in front
  const petals = [tok.accent, tok.warning, pal.sun, tok.calm].map((c) => (dark ? mix(c, pal.land, 0.3) : mix(c, pal.sun, 0.12)));
  const specks = ['', '', '', ''];
  const nS = ctx.lite ? 18 : 60;
  for (let i = 0; i < nS; i++) {
    const u = rng();
    const y = H * (0.7 + 0.28 * u);
    specks[i % 4] += dot(range(rng, 0, W), y, (0.35 + 0.7 * u) * (ctx.lite ? 1.6 : 1) * (H / 100) * 1.3);
  }
  specks.forEach((d, i) => ctx.nodes.push({ t: 'path', d, fill: petals[i]!, opacity: 0.9 }));
  const nF = ctx.lite ? 4 : 7;
  let stems = '';
  const heads = ['', '', '', ''];
  const centres: string[] = [];
  for (let i = 0; i < nF; i++) {
    const x = (W * (i + 0.5)) / nF + range(rng, -3, 3);
    const top = H * range(rng, 0.74, 0.86);
    stems += `M${f(x)} ${f(H + 1)}Q${f(x + range(rng, -2, 2))} ${f((top + H) / 2)} ${f(x)} ${f(top)}`;
    const r = H * range(rng, 0.03, 0.045) * (ctx.lite ? 1.2 : 1);
    heads[i % 4] += flowerHead(x, top, r);
    centres.push(dot(x, top, r * 0.28));
  }
  moving(ctx, { k: 'wave', period: 5600, deg: 1.1, ox: W / 2, oy: H + 2 }, () => {
    ctx.nodes.push({ t: 'path', d: stems, stroke: mix(green, pal.land, 0.4), sw: sw(ctx, 0.45, 0.8), fill: 'none' });
    heads.forEach((d, i) => d && ctx.nodes.push({ t: 'path', d, fill: petals[i]! }));
    ctx.nodes.push({ t: 'path', d: centres.join(''), fill: mix(tok.warning, pal.land, 0.35) });
  });
}

function buildHaze(ctx: Ctx) {
  const { W, H, pal, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.68;
  const wash = (c: string, t = 0.45) => mix(c, pal.haze, t);
  const sky = linear(ctx, 0, 0, 0, hy, [
    { o: 0, c: wash(pal.skyTop, 0.35) },
    { o: 0.6, c: wash(pal.skyMid, 0.4) },
    { o: 1, c: wash(pal.horizon, 0.3) },
  ]);
  ctx.nodes.push({ t: 'rect', x: -1, y: -1, w: W + 2, h: H + 2, fill: sky });
  drawGlow(ctx, ctx.nodes, 0.8);
  // Diffuse sun: soft disc with no hard edge
  const [sx, sy] = sunPos(ctx);
  const r = sunRadius(ctx) * 1.35;
  ctx.nodes.push({ t: 'circle', cx: f(sx), cy: f(sy), r: f(r * 3), fill: softFill(ctx, pal.sun, 0.5) });
  ctx.nodes.push({ t: 'circle', cx: f(sx), cy: f(sy), r: f(r), fill: radial(ctx, sx, sy, r, [{ o: 0, c: pal.sun, a: 0.95 }, { o: 0.75, c: pal.sun, a: 0.7 }, { o: 1, c: pal.sun, a: 0 }]) });
  // Haze bands drifting across (including over the sun)
  const hazeC = mix(pal.haze, '#FFFFFF', dark ? 0.08 : 0.4);
  const bandFill = softFill(ctx, hazeC, 0.85);
  const bands = ctx.lite ? 4 : 7;
  for (let i = 0; i < bands; i++) {
    const y = H * (0.12 + (0.6 * i) / bands) + range(rng, -2, 2);
    ctx.nodes.push({ t: 'ellipse', cx: f(range(rng, 0.2, 0.8) * W), cy: f(y), rx: f(range(rng, 45, 70)), ry: f(H * range(rng, 0.035, 0.06)), fill: bandFill, opacity: f(range(rng, 0.55, 0.85)) });
  }
  // Faded layered hills
  const n = 3;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const pts = sample(rollingRidge(rng, W, H * (0.68 + t * 0.16), H * (0.03 + 0.03 * t)), -6, W + 6, 10);
    ridgeLayer(ctx, pts, wash(layerColor(ctx, i, n + 1), 0.45 - t * 0.2), (i + 1) / (n + 1));
    drawMist(ctx, H * (0.72 + t * 0.16), 1);
  }
  // Fine horizontal haze streaks
  let streaks = '';
  for (let i = 0; i < (ctx.lite ? 4 : 9); i++) {
    const y = range(rng, H * 0.1, H * 0.85);
    const x = range(rng, -10, W * 0.7);
    streaks += `M${f(x)} ${f(y)}h${f(range(rng, 20, 45))}`;
  }
  ctx.nodes.push({ t: 'path', d: streaks, stroke: hazeC, sw: sw(ctx, 0.8, 1.3), fill: 'none', opacity: 0.35 });
}

function buildCoast(ctx: Ctx) {
  const { W, H, pal, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.5;
  skyAndSun(ctx, hy, { cloudCount: ctx.lite ? 1 : 2 });
  drawWater(ctx, hy, false);
  // Headland cliff on the right
  const cliffC = layerColor(ctx, 2, 4);
  const cx0 = W * 0.62;
  const top = hy - H * 0.2;
  const cliff: Pt[] = [
    [cx0, hy + 0.3], [cx0 + W * 0.05, hy - H * 0.06], [cx0 + W * 0.09, hy - H * 0.13], [cx0 + W * 0.16, top + H * 0.02],
    [cx0 + W * 0.28, top], [W + 6, top + H * 0.01], [W + 6, H * 0.8],
  ];
  const cliffD = `${smoothLine(cliff.slice(0, 6))}L${f(W + 6)} ${f(H + 2)}L${f(cx0 + W * 0.2)} ${f(H + 2)}Q${f(cx0 + W * 0.05)} ${f(hy + H * 0.12)} ${f(cx0)} ${f(hy + 0.3)}Z`;
  ctx.nodes.push({ t: 'path', d: cliffD, fill: layerFill(ctx, cliffC, top, hy + H * 0.1, 0.75) });
  // Rock face striations + foam at the cliff foot
  let face = '';
  for (let k = 0; k < (ctx.lite ? 2 : 4); k++) {
    const x = cx0 + W * (0.1 + 0.07 * k);
    face += `M${f(x)} ${f(top + H * 0.05 + k * 0.8)}L${f(x - W * 0.03)} ${f(hy + H * 0.08)}`;
  }
  ctx.nodes.push({ t: 'path', d: face, stroke: mix(cliffC, pal.land, 0.5), sw: sw(ctx, 0.5, 0.8), fill: 'none', opacity: 0.5 });
  ctx.nodes.push({ t: 'path', d: `M${f(cx0 - 2)} ${f(hy + 0.8)}Q${f(cx0 + W * 0.05)} ${f(hy + H * 0.06)} ${f(cx0 + W * 0.12)} ${f(hy + H * 0.14)}`, stroke: mix(pal.sun, '#FFFFFF', 0.3), sw: sw(ctx, 0.6, 1), fill: 'none', opacity: 0.6 });
  // Grassy cap
  ctx.nodes.push({ t: 'path', d: smoothLine(cliff.slice(2, 6)), stroke: mix(cliffC, pal.glow, 0.35), sw: sw(ctx, 1, 1.6), fill: 'none', opacity: 0.7 });
  // Beach sweeping in from the lower left
  const sand = dark ? mix(pal.land, pal.glow, 0.3) : mix(mix(pal.sun, pal.glow, 0.45), pal.horizon, 0.3);
  const beach: Pt[] = [[-6, H * 0.64], [W * 0.22, H * 0.68], [W * 0.48, H * 0.77], [W * 0.72, H * 0.9], [W * 0.86, H + 2]];
  const beachD = `${smoothLine(beach)}L-6 ${f(H + 2)}Z`;
  ctx.nodes.push({ t: 'path', d: beachD, fill: linear(ctx, 0, H * 0.66, 0, H, [{ o: 0, c: mix(sand, pal.sun, 0.2) }, { o: 1, c: mix(sand, pal.land, 0.3) }]) });
  // Foam lines along the shore
  const foam = mix(pal.sun, '#FFFFFF', dark ? 0.15 : 0.45);
  let fd = '';
  for (let k = 0; k < 2; k++) {
    const off = H * (0.018 + 0.035 * k);
    const pts: Pt[] = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      const x = -6 + (W * (0.62 - 0.12 * k) + 6) * u;
      const y = H * 0.64 + (H * 0.2) * u ** 1.4 - off + Math.sin(u * 14 + k * 2) * H * 0.006;
      pts.push([x, y]);
    }
    fd += smoothLine(pts.slice(k * 2));
  }
  ctx.nodes.push({ t: 'path', d: fd, stroke: foam, sw: sw(ctx, 0.55, 0.9), fill: 'none', opacity: 0.8 });
  // Dune grass leaning in the wind
  const gc = mix(pal.land, sand, 0.2);
  let grass = '';
  const gx = W * 0.12;
  const gy = H * 0.9;
  for (let i = 0; i < (ctx.lite ? 4 : 7); i++) {
    const x = gx + i * 1.6;
    const h = H * range(rng, 0.12, 0.2);
    grass += `M${f(x)} ${f(gy + 3)}Q${f(x + h * 0.15)} ${f(gy - h * 0.5)} ${f(x + h * 0.55)} ${f(gy - h)}`;
  }
  ctx.nodes.push({ t: 'path', d: grass, stroke: gc, sw: sw(ctx, 0.6, 1), fill: 'none' });
  drawBreeze(ctx, ctx.lite ? 2 : 3, H * 0.12, hy - H * 0.1, mix(pal.sun, '#FFFFFF', 0.3));
  if (ctx.has('birds')) drawBirds(ctx, W * 0.42, H * 0.2, layerColor(ctx, 3, 4), 0.8);
}

function buildSunburst(ctx: Ctx) {
  const { W, H, pal, rng, mode } = ctx;
  const hy = H * 0.66;
  drawSky(ctx, hy);
  drawGlow(ctx, ctx.nodes, 1.1);
  const sx = W * ctx.spec.sunX;
  const sy = hy;
  const n = ctx.lite ? 12 : 16;
  let d = '';
  const len = 160;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI + (Math.PI * (i + 0.5)) / n;
    const w = (Math.PI / n) * 0.42;
    d += `M${f(sx)} ${f(sy)}L${f(sx + Math.cos(a - w) * len)} ${f(sy + Math.sin(a - w) * len)}L${f(sx + Math.cos(a + w) * len)} ${f(sy + Math.sin(a + w) * len)}Z`;
  }
  ctx.nodes.push({ t: 'path', d, fill: radial(ctx, sx, sy, 95, [{ o: 0, c: pal.sun, a: mode === 'dark' ? 0.34 : 0.5 }, { o: 1, c: pal.sun, a: 0 }]) });
  drawSun(ctx, ctx.nodes, [sx, sy], 1.7);
  // Flat field bands
  const bands = ctx.lite ? 3 : 4;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const y = hy + (H - hy) * (0.02 + 0.3 * t ** 1.3);
    const pts = sample(rollingRidge(rng, W, y, H * 0.008 * (1 + t), 0.6), -6, W + 6, 8);
    ridgeLayer(ctx, pts, layerColor(ctx, i, bands), (i + 1) / bands);
    if (i === 0) drawMist(ctx, y + 1, 0.8);
  }
  ctx.nodes.push({ t: 'rect', x: -1, y: f(hy - 0.2), w: W + 2, h: 0.45, fill: mix(pal.sun, '#FFFFFF', 0.3), opacity: 0.6 });
}

function buildBeams(ctx: Ctx) {
  const { W, H, pal, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.64;
  drawSky(ctx, hy);
  drawStars(ctx, hy);
  drawGlow(ctx, ctx.nodes, 0.9);
  const sx = ctx.spec.sunX * W;
  const sy = H * 0.26;
  // Beams fanning down from behind the cloud
  let d = '';
  const nB = ctx.lite ? 5 : 7;
  for (let i = 0; i < nB; i++) {
    const a = Math.PI / 2 + ((i - (nB - 1) / 2) / nB) * 1.5 + range(rng, -0.05, 0.05);
    const w = range(rng, 0.035, 0.07);
    const L = H * 1.4;
    d += `M${f(sx)} ${f(sy)}L${f(sx + Math.cos(a - w) * L)} ${f(sy + Math.sin(a - w) * L)}L${f(sx + Math.cos(a + w) * L)} ${f(sy + Math.sin(a + w) * L)}Z`;
  }
  const beamFill = linear(ctx, 0, sy, 0, H, [{ o: 0, c: pal.sun, a: dark ? 0.4 : 0.55 }, { o: 1, c: pal.sun, a: 0.02 }]);
  // Hills under the beams
  const n = ctx.lite ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const pts = sample(rollingRidge(rng, W, H * (0.66 + t * 0.2), H * (0.04 + 0.04 * t)), -6, W + 6, 10);
    ridgeLayer(ctx, pts, layerColor(ctx, i, n), (i + 1) / n);
    if (i === 0) drawMist(ctx, H * 0.68, 0.7);
  }
  ctx.nodes.push({ t: 'path', d, fill: beamFill });
  // Cloud bank hiding the sun, with a bright silver lining
  const lit = mix(pal.cloud, pal.sun, dark ? 0.2 : 0.4);
  ctx.nodes.push({ t: 'ellipse', cx: f(sx), cy: f(sy), rx: 30, ry: f(H * 0.18), fill: softFill(ctx, pal.sun, 0.7) });
  cloudPuff(ctx, sx - 22, sy + H * 0.02, 44, mix(lit, pal.skyMid, 0.25), mix(pal.cloudShade, pal.skyMid, 0.2), { lumps: 4, opacity: 0.85 });
  cloudPuff(ctx, sx + 6, sy + H * 0.06, 58, lit, pal.cloudShade, { lumps: 5 });
}

function buildRiver(ctx: Ctx) {
  const { W, H, pal, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.52;
  skyAndSun(ctx, hy);
  for (let i = 0; i < 2; i++) {
    const pts = sample(rollingRidge(rng, W, hy + i * H * 0.03, H * (0.05 - i * 0.015)), -6, W + 6, 10);
    ridgeLayer(ctx, pts, layerColor(ctx, i, 5), (i + 1) / 5);
    drawMist(ctx, hy + H * 0.02 + i * H * 0.03, 0.8);
  }
  // Valley floor
  const floorTop = hy + H * 0.05;
  const vc = layerColor(ctx, 3, 5);
  ctx.nodes.push({ t: 'rect', x: -1, y: f(floorTop), w: W + 2, h: f(H - floorTop + 1), fill: linear(ctx, 0, floorTop, 0, H, [{ o: 0, c: mix(vc, pal.haze, 0.35) }, { o: 1, c: mix(vc, pal.land, 0.3) }]) });
  drawMist(ctx, floorTop + 1, 0.7);
  // Winding river
  const [sx] = sunPos(ctx);
  const ph = range(rng, 0, Math.PI);
  const steps = 16;
  const L: Pt[] = [];
  const R: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = floorTop + (H + 2 - floorTop) * t ** 1.25;
    const x = sx + Math.sin(t * Math.PI * 1.7 + ph) * W * 0.24 * t + (W / 2 - sx) * t;
    const w = 0.6 + t * W * 0.22;
    L.push([x - w / 2, y]);
    R.push([x + w / 2, y]);
  }
  const riverD = `${smoothLine(L)}L${f(R[R.length - 1]![0])} ${f(R[R.length - 1]![1])}${smoothLine([...R].reverse()).replace(/^M[^C]*/, '')}Z`;
  const rf = linear(ctx, 0, floorTop, 0, H, [{ o: 0, c: mix(pal.horizon, '#FFFFFF', 0.25) }, { o: 0.4, c: pal.skyLow }, { o: 1, c: mix(pal.skyMid, pal.water, 0.4) }]);
  ctx.nodes.push({ t: 'path', d: riverD, fill: rf });
  ctx.nodes.push({ t: 'path', d: smoothLine(L) + smoothLine(R), stroke: mix(pal.sun, '#FFFFFF', 0.3), sw: sw(ctx, 0.35, 0.6), fill: 'none', opacity: dark ? 0.4 : 0.55 });
  // Bushes along the banks
  let bush = '';
  for (let i = 3; i < steps; i += 2) {
    const s = (0.4 + (i / steps) * 1.3) * (ctx.lite ? 1.3 : 1);
    bush += dot(L[i]![0] - s * 1.5, L[i]![1] - s * 0.3, s) + dot(R[i]![0] + s * 1.6, R[i]![1] - s * 0.2, s * 0.9);
  }
  ctx.nodes.push({ t: 'path', d: bush, fill: mix(vc, pal.land, 0.3), opacity: 0.85 });
  // Framing slope in the near corner
  const left = sx > W / 2;
  const bank = sample((x) => {
    const u = left ? x / W : 1 - x / W;
    return H * 0.86 + H * 0.3 * clamp(u - 0.1, 0, 1) ** 0.9;
  }, -6, W + 6, 12);
  ridgeLayer(ctx, bank, layerColor(ctx, 4, 5), 1);
}

function buildCairn(ctx: Ctx) {
  const { W, H, pal, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.56;
  skyAndSun(ctx, hy);
  const far = sample(rollingRidge(rng, W, hy - H * 0.01, H * 0.03), -6, W + 6, 10);
  ridgeLayer(ctx, far, layerColor(ctx, 0, 4), 0.25);
  drawWater(ctx, hy, true);
  // Flat rock shore
  const shoreC = layerColor(ctx, 3, 4);
  const shore = sample((x) => H * 0.86 - H * 0.05 * Math.exp(-(((x - W * 0.62) / 28) ** 2)) + Math.sin(x / 6) * 0.4, -6, W + 6, 16);
  ridgeLayer(ctx, shore, shoreC, 1);
  // Stacked stones
  const baseX = W * 0.62;
  let y = H * 0.83;
  const stone = mix(pal.land, pal.haze, dark ? 0.25 : 0.4);
  const sizes = [0.13, 0.105, 0.085, 0.066, 0.05];
  const [sx] = sunPos(ctx);
  sizes.forEach((s, i) => {
    const rx = H * s;
    const ry = rx * 0.42;
    const cx = baseX + range(rng, -1, 1) * H * 0.012;
    const cy = y - ry;
    const c = mix(stone, pal.haze, i * 0.05);
    const fill = linear(ctx, cx + (sx < cx ? -rx : rx), cy - ry, cx + (sx < cx ? rx : -rx), cy + ry, [
      { o: 0, c: mix(c, pal.sun, 0.35) },
      { o: 0.5, c },
      { o: 1, c: mix(c, pal.land, 0.5) },
    ]);
    ctx.nodes.push({ t: 'ellipse', cx: f(cx), cy: f(cy), rx: f(rx), ry: f(ry), fill });
    y = cy - ry * 0.75;
  });
  // Pebbles
  let peb = '';
  for (let i = 0; i < (ctx.lite ? 3 : 6); i++) peb += ell(range(rng, W * 0.1, W * 0.9), H * range(rng, 0.9, 0.97), H * range(rng, 0.015, 0.03), H * 0.01);
  ctx.nodes.push({ t: 'path', d: peb, fill: mix(stone, pal.land, 0.2) });
}

function buildDandelion(ctx: Ctx) {
  const { W, H, pal, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.74;
  backdrop(ctx, hy, { layers: 2 });
  const hx = W * 0.4;
  const hyH = H * 0.4;
  const R = H * 0.17;
  const seedC = dark ? mix(pal.sun, pal.cloud, 0.25) : mix(pal.sun, '#FFFFFF', 0.4);
  // Breath lines
  let br = '';
  for (let k = 0; k < 2; k++) {
    const y = hyH + (k - 0.5) * R * 0.9;
    br += `M${f(hx - W * 0.5)} ${f(y + R * 0.3)}C${f(hx - R)} ${f(y + R * 0.5)} ${f(hx + R)} ${f(y - R * 0.6)} ${f(W + 4)} ${f(y - R * 1.3)}`;
  }
  ctx.nodes.push({ t: 'path', d: br, stroke: seedC, sw: sw(ctx, 0.45, 0.8), fill: 'none', opacity: 0.35 });
  // Stem
  ctx.nodes.push({ t: 'path', d: `M${f(hx - W * 0.06)} ${f(H + 2)}Q${f(hx - W * 0.08)} ${f((H + hyH) / 2)} ${f(hx)} ${f(hyH)}`, stroke: mix(pal.land, pal.haze, 0.15), sw: sw(ctx, 0.9, 1.4), fill: 'none' });
  // Halo behind the head
  ctx.nodes.push({ t: 'circle', cx: f(hx), cy: f(hyH), r: f(R * 1.5), fill: softFill(ctx, pal.sun, dark ? 0.35 : 0.5) });
  // Seed head (a wedge already blown away)
  const n = ctx.lite ? 16 : 30;
  let spokes = '';
  let tufts = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + range(rng, -0.05, 0.05);
    if (a > Math.PI * 1.72 && a < Math.PI * 1.98) continue;
    const r = R * range(rng, 0.85, 1);
    const ex = hx + Math.cos(a) * r;
    const ey = hyH + Math.sin(a) * r;
    spokes += `M${f(hx + Math.cos(a) * R * 0.15)} ${f(hyH + Math.sin(a) * R * 0.15)}L${f(ex)} ${f(ey)}`;
    const t = R * 0.16;
    for (const da of [-0.5, 0, 0.5]) tufts += `M${f(ex)} ${f(ey)}l${f(Math.cos(a + da) * t)} ${f(Math.sin(a + da) * t)}`;
  }
  ctx.nodes.push({ t: 'path', d: spokes, stroke: seedC, sw: sw(ctx, 0.22, 0.45), fill: 'none', opacity: 0.85 });
  ctx.nodes.push({ t: 'path', d: tufts, stroke: seedC, sw: sw(ctx, 0.25, 0.5), fill: 'none', opacity: 0.95 });
  ctx.nodes.push({ t: 'circle', cx: f(hx), cy: f(hyH), r: f(R * 0.16), fill: mix(pal.land, pal.glow, 0.3) });
  // Drifting seeds
  let flying = '';
  for (let i = 0; i < (ctx.lite ? 3 : 6); i++) {
    const t = (i + 1) / 7;
    const x = hx + R * 1.3 + (W - hx - R) * t;
    const y = hyH - R * 0.6 - H * 0.28 * t + range(rng, -2, 2);
    const s = R * 0.22;
    flying += `M${f(x)} ${f(y)}l${f(-s * 0.6)} ${f(s)}`;
    for (const da of [-0.7, -0.25, 0.2]) flying += `M${f(x)} ${f(y)}l${f(Math.cos(-Math.PI / 2 + da) * s * 0.6)} ${f(Math.sin(-Math.PI / 2 + da) * s * 0.6)}`;
  }
  ctx.nodes.push({ t: 'path', d: flying, stroke: seedC, sw: sw(ctx, 0.25, 0.5), fill: 'none', opacity: 0.9 });
}

function buildPuffs(ctx: Ctx) {
  const { W, H, pal, mode } = ctx;
  const dark = mode === 'dark';
  drawSky(ctx, H);
  drawStars(ctx, H * 0.7);
  drawGlow(ctx, ctx.nodes, 0.9);
  if (!ctx.has('noSun')) drawSun(ctx, ctx.nodes, undefined, 0.85);
  const lit = mix(pal.cloud, pal.sun, dark ? 0.2 : 0.45);
  const layers: [number, number, number, number][] = [
    // cx, baseY, width, depth
    [W * 0.78, H * 0.3, 34, 0.25],
    [W * 0.2, H * 0.44, 40, 0.45],
    [W * 0.7, H * 0.66, 58, 0.7],
    [W * 0.28, H * 0.9, 70, 1],
  ];
  const puff = ([cx, by, w, dp]: [number, number, number, number]) => {
    const l = mix(pal.haze, lit, 0.35 + 0.65 * dp);
    const s = mix(pal.haze, mix(pal.cloudShade, pal.skyMid, 0.3), 0.3 + 0.7 * dp);
    cloudPuff(ctx, cx, by, w * Math.max(0.8, H / 100), l, s, { lumps: 5, tall: 1.25 });
  };
  // Far puffs drift slowly one way, near puffs a little further the other (parallax).
  moving(ctx, { k: 'wave', period: 16000, dx: 2.5, dy: -0.6 }, () => layers.slice(0, 2).forEach(puff));
  moving(ctx, { k: 'wave', period: 12000, delay: 2000, dx: -3.5, dy: 0.5 }, () => layers.slice(2).forEach(puff));
  // Soft bank along the bottom
  const bank = cloudBank(ctx, H * 0.97, 3, 6);
  ctx.nodes.push({ t: 'path', d: bank.d, fill: linear(ctx, 0, bank.minY, 0, H, [{ o: 0, c: lit }, { o: 1, c: pal.cloudShade }]) });
}

/** Furrow rows on the nearest hill (detail 'rows'). */
/** Almond leaf centred at (x, y), length l, rotated by a (radians). */
function leafShape(x: number, y: number, l: number, a: number): string {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const P = (u: number, v: number) => `${f(x + u * c - v * s)} ${f(y + u * s + v * c)}`;
  return `M${P(-l / 2, 0)}Q${P(0, -l * 0.42)} ${P(l / 2, 0)}Q${P(0, l * 0.42)} ${P(-l / 2, 0)}Z`;
}

/** Wind in the trees — a broadleaf tree on a knoll, crown leaning downwind, leaves carried off. */
function buildWindtree(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.68;
  backdrop(ctx, hy, { layers: 2 });
  drawBreeze(ctx, ctx.lite ? 2 : 4, H * 0.16, H * 0.46, mix(pal.sun, pal.cloud, 0.4));
  // Knoll
  const kx = W * 0.4;
  const knoll = sample((x) => H * 0.9 - H * 0.12 * Math.exp(-(((x - kx) / 34) ** 2)) + Math.sin(x / 7) * 0.35, -6, W + 6, 18);
  const groundY = (x: number) => H * 0.9 - H * 0.12 * Math.exp(-(((x - kx) / 34) ** 2));
  const hillC = layerColor(ctx, 3, 4);
  ridgeLayer(ctx, knoll, hillC, 1);
  // Trunk + limbs, leaning downwind (to the right)
  const base: Pt = [kx, groundY(kx) + 0.5];
  const th = H * 0.36;
  const bark = mix(pal.land, tok.sunrise, dark ? 0.1 : 0.18);
  const trunk: Pt[] = [base, [kx + th * 0.03, base[1] - th * 0.35], [kx + th * 0.1, base[1] - th * 0.62], [kx + th * 0.2, base[1] - th * 0.8]];
  ctx.nodes.push({ t: 'path', d: taper(trunk, H * 0.045, H * 0.014), fill: bark });
  const limbs: Pt[][] = [
    [[kx + th * 0.05, base[1] - th * 0.45], [kx - th * 0.12, base[1] - th * 0.62], [kx - th * 0.18, base[1] - th * 0.75]],
    [[kx + th * 0.09, base[1] - th * 0.58], [kx + th * 0.32, base[1] - th * 0.7], [kx + th * 0.48, base[1] - th * 0.74]],
  ];
  for (const l of limbs) ctx.nodes.push({ t: 'path', d: taper(l, H * 0.016, H * 0.006), fill: bark });
  // Crown — clusters blown to the right
  const leafBase = mix(pal.land, tok.calm, dark ? 0.22 : 0.18);
  const [sx, sy] = sunPos(ctx);
  const ccx = kx + th * 0.14;
  const ccy = base[1] - th * 0.78;
  const blobs: [number, number, number][] = [
    [-0.34, 0.1, 0.2], [-0.12, -0.12, 0.26], [0.16, -0.18, 0.26], [0.42, -0.06, 0.24],
    [0.62, 0.08, 0.18], [0.3, 0.12, 0.24], [0.02, 0.14, 0.24], [-0.2, 0.22, 0.16], [0.52, 0.22, 0.15],
  ];
  let crown = '';
  for (const [u, v, r] of blobs) crown += dot(ccx + u * th, ccy + v * th, r * th * range(rng, 0.92, 1.08));
  const crownFill = linear(ctx, sx < ccx ? ccx - th * 0.6 : ccx + th * 0.8, Math.min(sy, ccy - th * 0.4), sx < ccx ? ccx + th * 0.8 : ccx - th * 0.6, ccy + th * 0.4, [
    { o: 0, c: mix(leafBase, pal.glow, dark ? 0.28 : 0.4) },
    { o: 0.5, c: leafBase },
    { o: 1, c: mix(leafBase, '#000000', dark ? 0.3 : 0.15) },
  ]);
  moving(ctx, { k: 'wave', period: 5200, deg: 1.8, sx: 0.015, ox: kx + th * 0.12, oy: base[1] - th * 0.62 }, () => {
    ctx.nodes.push({ t: 'path', d: crown, fill: crownFill });
    // Leaf texture on the lit side
    if (!ctx.lite) {
      let tex = '';
      for (let i = 0; i < 26; i++) {
        const a = range(rng, 0, Math.PI * 2);
        const rr = range(rng, 0.05, 0.42) * th;
        tex += leafShape(ccx + th * 0.14 + Math.cos(a) * rr * 1.3, ccy - th * 0.02 + Math.sin(a) * rr * 0.7, th * 0.05, range(rng, -0.6, 0.6));
      }
      ctx.nodes.push({ t: 'path', d: tex, fill: mix(leafBase, pal.glow, 0.45), opacity: dark ? 0.45 : 0.55 });
    }
  });
  // Leaves carried off on the wind
  const flyC = mix(tok.sunrise, tok.warning, 0.4);
  let fly = '';
  const nFly = ctx.lite ? 5 : 11;
  for (let i = 0; i < nFly; i++) {
    const t = i / nFly;
    const x = ccx + th * (0.7 + t * 1.2) + range(rng, -3, 3);
    const y = ccy - th * 0.1 + Math.sin(t * 5 + 1) * H * 0.07 + range(rng, -2, 2);
    if (x > W + 2) continue;
    fly += leafShape(x, y, H * range(rng, 0.022, 0.034) * (ctx.lite ? 1.5 : 1), range(rng, -1.2, 1.2));
  }
  moving(ctx, { k: 'wave', period: 4200, dx: 3.5, dy: -1.6, min: 0.55 }, () =>
    ctx.nodes.push({ t: 'path', d: fly, fill: mix(flyC, pal.land, dark ? 0.35 : 0.12), opacity: 0.9 }),
  );
  // Bent grass tufts on the knoll
  let grass = '';
  for (let i = 0; i < (ctx.lite ? 8 : 18); i++) {
    const x = range(rng, 2, W - 2);
    const y = groundY(x) + range(rng, 0, H * 0.04);
    const h = H * range(rng, 0.025, 0.05);
    grass += `M${f(x)} ${f(y)}Q${f(x + h * 0.15)} ${f(y - h * 0.7)} ${f(x + h * 0.6)} ${f(y - h)}`;
  }
  ctx.nodes.push({ t: 'path', d: grass, stroke: mix(hillC, pal.glow, 0.3), sw: sw(ctx, 0.45, 0.8), fill: 'none', opacity: 0.8 });
}

/** Morning pond — lily pads, a frog on a pad, ripples, cattails at the water's edge. */
function buildPond(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.56;
  skyAndSun(ctx, hy);
  // Far treeline
  const far = sample(rollingRidge(rng, W, hy - H * 0.02, H * 0.04, 1.6), -6, W + 6, 16);
  ridgeLayer(ctx, far, layerColor(ctx, 1, 4), 0.4);
  drawWater(ctx, hy, true);
  drawMist(ctx, hy + H * 0.02, 0.9);
  const padC = mix(pal.land, tok.calm, dark ? 0.24 : 0.2);
  const padLit = mix(padC, pal.glow, dark ? 0.2 : 0.3);
  // Ripples around the frog's pad
  const fx = W * 0.56;
  const fy = H * 0.8;
  let rip = '';
  for (let k = 0; k < 3; k++) rip += ell(fx, fy + H * 0.005, H * (0.14 + 0.07 * k), H * (0.03 + 0.016 * k));
  moving(ctx, { k: 'ripple', period: 4400, s: 0.2, ox: fx, oy: fy }, () =>
    ctx.nodes.push({ t: 'path', d: rip, stroke: mix(pal.sun, pal.horizon, 0.3), sw: sw(ctx, 0.4, 0.7), fill: 'none', opacity: dark ? 0.4 : 0.6 }),
  );
  // Lily pads (notched ellipses), perspective-scaled
  const pad = (x: number, y: number, r: number) => {
    const ry = r * 0.34;
    const a = 0.22;
    const d = `M${f(x)} ${f(y)}L${f(x + r * Math.cos(-a))} ${f(y + ry * Math.sin(-a))}A${f(r)} ${f(ry)} 0 1 0 ${f(x + r * Math.cos(a))} ${f(y + ry * Math.sin(a))}Z`;
    ctx.nodes.push({ t: 'path', d, fill: linear(ctx, 0, y - ry, 0, y + ry, [{ o: 0, c: padLit }, { o: 1, c: padC }]) });
  };
  const pads: [number, number, number][] = [
    [W * 0.2, H * 0.64, H * 0.05], [W * 0.34, H * 0.7, H * 0.065], [W * 0.82, H * 0.66, H * 0.055], [W * 0.14, H * 0.86, H * 0.1], [W * 0.84, H * 0.9, H * 0.085],
  ];
  for (const [x, y, r] of pads) pad(x, y, r);
  pad(fx, fy, H * 0.13);
  // Water-lily bloom
  const bloom = dark ? mix(tok.accent, pal.sun, 0.45) : mix(pal.sun, tok.accent, 0.35);
  const bx = W * 0.34 + H * 0.02;
  const by = H * 0.69;
  let petals = '';
  for (let p = -2; p <= 2; p++) petals += leafShape(bx + p * H * 0.012, by - H * 0.012 - (2 - Math.abs(p)) * H * 0.004, H * 0.03, -Math.PI / 2 + p * 0.45);
  ctx.nodes.push({ t: 'path', d: petals, fill: bloom });
  // Frog sitting on the big pad
  const b = H * 0.05;
  const frogC = dark ? mix(tok.calm, pal.land, 0.45) : mix(pal.land, tok.calm, 0.3);
  let frog = ell(fx, fy - b * 0.55, b * 1.1, b * 0.62); // body
  frog += ell(fx + b * 0.95, fy - b * 0.95, b * 0.55, b * 0.42); // head
  frog += dot(fx + b * 0.85, fy - b * 1.35, b * 0.22) + dot(fx + b * 1.2, fy - b * 1.3, b * 0.2); // eyes
  frog += ell(fx - b * 0.55, fy - b * 0.2, b * 0.55, b * 0.3); // haunch
  ctx.nodes.push({ t: 'path', d: frog, fill: linear(ctx, 0, fy - b * 1.6, 0, fy, [{ o: 0, c: mix(frogC, pal.glow, 0.3) }, { o: 1, c: mix(frogC, '#000000', 0.15) }]) });
  if (!ctx.lite) ctx.nodes.push({ t: 'circle', cx: f(fx + b * 0.88), cy: f(fy - b * 1.38), r: f(b * 0.08), fill: pal.sun, opacity: 0.85 });
  // Cattails + reeds on the left bank
  const reedC = mix(pal.land, pal.haze, dark ? 0.05 : 0.1);
  const headC = mix(tok.sunrise, pal.land, dark ? 0.6 : 0.45);
  const nReeds = ctx.lite ? 4 : 7;
  moving(ctx, { k: 'wave', period: 6200, deg: 1.4, ox: W * 0.14, oy: H + 1, pri: 2 }, () => {
  for (let i = 0; i < nReeds; i++) {
    const x = W * (0.02 + i * 0.045) + range(rng, -1, 1);
    const y0 = H + 1;
    const h = H * range(rng, 0.3, 0.46);
    const lean = range(rng, -2, 4);
    const pts: Pt[] = [[x, y0], [x + lean * 0.4, y0 - h * 0.5], [x + lean, y0 - h]];
    ctx.nodes.push({ t: 'path', d: taper(pts, H * 0.012, H * 0.005), fill: reedC });
    if (i % 2 === 0) {
      const hx = x + lean * 0.92;
      const hyy = y0 - h * 0.86;
      ctx.nodes.push({ t: 'path', d: ell(hx, hyy, H * 0.012, H * 0.045), fill: headC });
    } else {
      ctx.nodes.push({ t: 'path', d: taper([[x, y0], [x + lean + 4, y0 - h * 0.6], [x + lean + 9, y0 - h * 0.75]], H * 0.01, H * 0.001), fill: reedC });
    }
  }
  });
  if (ctx.has('birds')) {
    const [sx, sy] = sunPos(ctx);
    drawBirds(ctx, clamp(sx - 16, 18, 80), clamp(sy - 14, 10, 36), pal.land, 0.8);
  }
}

/** Campfire — crossed logs in a ring of stones, layered flames, rising sparks and smoke. */
function buildCampfire(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.6;
  backdrop(ctx, hy, { layers: 2 });
  const groundTop = H * 0.72;
  const ground = sample((x) => groundTop + Math.sin(x / 9) * 0.6 + (x / W) * H * 0.02, -6, W + 6, 14);
  ridgeLayer(ctx, ground, layerColor(ctx, 3, 4), 1);
  const cx = W * 0.5;
  const baseY = H * 0.84;
  const fire = tok.sunrise;
  const hot = tok.warning;
  // Warm light pooled on the ground
  moving(ctx, { k: 'flicker', period: 1400, min: 0.7, s: 0.03, ox: cx, oy: baseY, pri: 3 }, () =>
    ctx.nodes.push({ t: 'ellipse', cx: f(cx), cy: f(baseY), rx: f(W * 0.42), ry: f(H * 0.1), fill: softFill(ctx, mix(hot, pal.glow, 0.3), dark ? 0.55 : 0.5) }),
  );
  // Smoke curling up
  const smokeX = cx + H * 0.02;
  moving(ctx, { k: 'wave', period: 5200, deg: 4, dx: 1, min: 0.6, ox: smokeX, oy: baseY - H * 0.3, pri: 2 }, () => ctx.nodes.push({
    t: 'path',
    d: `M${f(smokeX)} ${f(baseY - H * 0.3)}C${f(smokeX + 6)} ${f(baseY - H * 0.4)} ${f(smokeX - 5)} ${f(baseY - H * 0.48)} ${f(smokeX + 3)} ${f(baseY - H * 0.58)}S${f(smokeX + 10)} ${f(baseY - H * 0.7)} ${f(smokeX + 6)} ${f(baseY - H * 0.78)}`,
    stroke: mix(pal.haze, pal.cloud, 0.5),
    sw: sw(ctx, 1.6, 2.2),
    fill: 'none',
    opacity: dark ? 0.35 : 0.45,
  }));
  // Flames — outer, middle, core
  const flame = (w: number, h: number, dx: number, lean: number) => {
    const x0 = cx + dx;
    const y0 = baseY - H * 0.03;
    return `M${f(x0 - w)} ${f(y0)}C${f(x0 - w * 1.05)} ${f(y0 - h * 0.45)} ${f(x0 - w * 0.2 + lean * 0.5)} ${f(y0 - h * 0.6)} ${f(x0 + lean)} ${f(y0 - h)}C${f(x0 + w * 0.35 + lean * 0.4)} ${f(y0 - h * 0.62)} ${f(x0 + w * 1.05)} ${f(y0 - h * 0.42)} ${f(x0 + w)} ${f(y0)}Z`;
  };
  const fh = H * 0.3;
  const flameBase = baseY - H * 0.03;
  moving(ctx, { k: 'flicker', period: 1300, s: 0.07, min: 0.85, ox: cx, oy: flameBase }, () =>
    ctx.nodes.push({ t: 'path', d: flame(W * 0.12, fh, 0, 2) + flame(W * 0.07, fh * 0.7, -W * 0.08, -3) + flame(W * 0.07, fh * 0.66, W * 0.08, 4), fill: mix(fire, pal.land, dark ? 0.08 : 0.04), opacity: 0.95 }),
  );
  moving(ctx, { k: 'flicker', period: 1000, delay: 350, s: 0.1, min: 0.9, ox: cx, oy: flameBase }, () => {
    ctx.nodes.push({ t: 'path', d: flame(W * 0.08, fh * 0.72, W * 0.005, 1.5) + flame(W * 0.045, fh * 0.48, -W * 0.06, -2), fill: mix(hot, fire, 0.2) });
    ctx.nodes.push({ t: 'path', d: flame(W * 0.04, fh * 0.42, W * 0.01, 1), fill: mix(pal.sun, hot, 0.25) });
  });
  // Logs (crossed)
  const wood = mix(pal.land, tok.sunrise, dark ? 0.22 : 0.3);
  const L = W * 0.24;
  const logs: [Pt, Pt][] = [
    [[cx - L * 0.6, baseY + H * 0.01], [cx + L * 0.5, baseY - H * 0.05]],
    [[cx + L * 0.6, baseY + H * 0.01], [cx - L * 0.5, baseY - H * 0.05]],
  ];
  for (const [a, b] of logs) {
    ctx.nodes.push({ t: 'path', d: taper([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b], H * 0.04, H * 0.034), fill: linear(ctx, 0, baseY - H * 0.07, 0, baseY + H * 0.03, [{ o: 0, c: mix(wood, hot, 0.35) }, { o: 1, c: mix(wood, '#000000', 0.2) }]) });
    ctx.nodes.push({ t: 'ellipse', cx: f(a[0]), cy: f(a[1]), rx: f(H * 0.014), ry: f(H * 0.019), fill: mix(wood, pal.glow, 0.35) });
  }
  // Sparks
  let sparks = '';
  for (let i = 0; i < (ctx.lite ? 4 : 9); i++) {
    sparks += dot(cx + range(rng, -W * 0.14, W * 0.16), baseY - fh * range(rng, 1.05, 1.7), range(rng, 0.35, 0.7) * (ctx.lite ? 1.6 : 1));
  }
  moving(ctx, { k: 'rise', period: 2600, dy: -H * 0.12, dx: 1 }, () => ctx.nodes.push({ t: 'path', d: sparks, fill: mix(hot, pal.sun, 0.4), opacity: 0.9 }));
  // Ring of stones in front
  const stone = mix(pal.land, pal.haze, dark ? 0.22 : 0.35);
  const nS = ctx.lite ? 5 : 8;
  for (let i = 0; i < nS; i++) {
    const a = Math.PI * (0.08 + (0.84 * i) / (nS - 1));
    const x = cx - Math.cos(a) * W * 0.25;
    const y = baseY + Math.sin(a) * H * 0.05 + H * 0.01;
    const rx = H * range(rng, 0.028, 0.038);
    ctx.nodes.push({ t: 'ellipse', cx: f(x), cy: f(y), rx: f(rx), ry: f(rx * 0.62), fill: linear(ctx, 0, y - rx, 0, y + rx, [{ o: 0, c: mix(stone, hot, 0.3) }, { o: 1, c: mix(stone, '#000000', 0.2) }]) });
  }
}

/** Rounded deciduous canopy line — union of overlapping crowns along a ground ridge. */
function canopyRow(ctx: Ctx, ground: RidgeFn, crownR: number, step: number, color: string, depth: number) {
  const { W, H, rng } = ctx;
  let d = '';
  let minY = H;
  for (let x = -6; x < W + 8; x += step * range(rng, 0.7, 1.2)) {
    const r = crownR * range(rng, 0.7, 1.25);
    const by = ground(x);
    const cy = by - r * range(rng, 1.1, 1.6);
    d += dot(x, cy, r) + dot(x + r * 0.55, cy + r * 0.35, r * 0.72);
    minY = Math.min(minY, cy - r);
  }
  const base = sample(ground, -6, W + 6, 12);
  d += closeTo(smoothLine(base), base, H + 2);
  ctx.nodes.push({ t: 'path', d, fill: layerFill(ctx, color, minY, minY + H * 0.3, depth) });
}

/** Forest birds — sunlit forest edge at dawn, songbirds on a limb, more flying over the trees. */
function buildForestBirds(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.6;
  skyAndSun(ctx, hy);
  // Two rows of rounded forest canopy + a meadow edge
  canopyRow(ctx, rollingRidge(rng, W, H * 0.62, H * 0.03), H * 0.05, 6, layerColor(ctx, 1, 5), 0.35);
  drawMist(ctx, H * 0.62, 0.9);
  canopyRow(ctx, rollingRidge(rng, W, H * 0.74, H * 0.03), H * 0.075, 9, layerColor(ctx, 2, 5), 0.6);
  drawMist(ctx, H * 0.75, 0.6);
  const meadow = sample(rollingRidge(rng, W, H * 0.88, H * 0.02), -6, W + 6, 12);
  ridgeLayer(ctx, meadow, layerColor(ctx, 3, 5, mix(pal.land, tok.calm, 0.12)), 0.85);
  // Flying birds over the treetops, near the sun
  const [sx, sy] = sunPos(ctx);
  const flyC = mix(pal.land, pal.haze, 0.15);
  drawBirds(ctx, clamp(sx - 8, 30, 80), clamp(sy - 12, 12, 34), flyC, 0.85);
  // Foreground tree at the forest edge: trunk on the left, a long limb into the frame
  const col = dark ? mix(pal.land, '#000000', 0.15) : mix(pal.land, pal.haze, 0.08);
  const trunk: Pt[] = [[W * 0.06, H + 2], [W * 0.08, H * 0.6], [W * 0.05, H * 0.2], [W * 0.02, -2]];
  ctx.nodes.push({ t: 'path', d: taper(trunk, W * 0.1, W * 0.065), fill: col });
  const limb: Pt[] = sample((x) => H * 0.5 - (x / W) * H * 0.08 + Math.sin((x / W) * Math.PI * 1.4) * H * 0.02, W * 0.08, W * 0.9, 10);
  ctx.nodes.push({ t: 'path', d: taper(limb, H * 0.04, H * 0.01), fill: col });
  const twig: Pt[] = [limb[5]!, [limb[5]![0] + W * 0.05, limb[5]![1] - H * 0.08], [limb[5]![0] + W * 0.11, limb[5]![1] - H * 0.13]];
  ctx.nodes.push({ t: 'path', d: taper(twig, H * 0.016, H * 0.005), fill: col });
  // Leaf canopy hanging over the top-left
  const leafC = mix(col, tok.calm, dark ? 0.18 : 0.14);
  let canopy = '';
  const clumps: [number, number, number][] = [[0.02, 0.02, 0.2], [0.2, -0.02, 0.16], [0.36, 0.04, 0.12], [0.1, 0.14, 0.12], [0.5, -0.01, 0.1]];
  for (const [u, v, r] of clumps) canopy += dot(W * u, H * v, H * r * range(rng, 0.9, 1.1));
  moving(ctx, { k: 'wave', period: 6400, dx: 0.8, deg: 0.8, ox: 0, oy: 0, pri: 2 }, () => ctx.nodes.push({ t: 'path', d: canopy, fill: leafC }));
  let leaves = '';
  const tips: Pt[] = [limb[limb.length - 1]!, twig[2]!, limb[3]!];
  for (const tip of tips) {
    for (let j = 0; j < (ctx.lite ? 2 : 4); j++) leaves += leafShape(tip[0] + range(rng, -2, 3), tip[1] - range(rng, 0, 3), H * 0.05, range(rng, -2.4, -0.4));
  }
  moving(ctx, { k: 'wave', period: 5000, dy: 0.5, deg: 0.6, ox: W * 0.5, oy: H * 0.5, pri: 2 }, () => ctx.nodes.push({ t: 'path', d: leaves, fill: mix(leafC, pal.glow, 0.2) }));
  // Songbirds perched along the limb
  const at = (x: number) => limb.reduce((a, p) => (Math.abs(p[0] - x) < Math.abs(a[0] - x) ? p : a), limb[0]!);
  const b = H * 0.062;
  const perch: [number, number, 1 | -1][] = ctx.lite ? [[0.34, 1, 1], [0.62, 0.9, -1]] : [[0.28, 1, 1], [0.45, 0.85, 1], [0.64, 0.95, -1]];
  for (const [x, s, dir] of perch) {
    const p = at(W * x);
    drawPerchedBird(ctx, p[0], p[1] - H * 0.012, b * s, dir, col);
  }
  // A second small flock lifting off the canopy
  drawBirds(ctx, W * 0.52, H * 0.24, col, 0.7);
}

/** Soft rain — a gentle, dense rain curtain over a treeline and meadow, ripples in a puddle. */
function buildSoftRain(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.6;
  drawSky(ctx, hy);
  drawGlow(ctx, ctx.nodes, 0.5);
  // Low, even overcast
  const shade = softFill(ctx, mix(pal.cloudShade, pal.skyMid, 0.3), 0.7);
  for (let i = 0; i < (ctx.lite ? 3 : 6); i++) {
    ctx.nodes.push({ t: 'ellipse', cx: f(range(rng, -10, W + 10)), cy: f(range(rng, 0, H * 0.22)), rx: f(range(rng, 30, 55)), ry: f(range(rng, 6, 12)), fill: shade, opacity: f(range(rng, 0.5, 0.8)) });
  }
  // Far hills fading into the rain
  const far = sample(rollingRidge(rng, W, H * 0.58, H * 0.05), -6, W + 6, 10);
  ridgeLayer(ctx, far, layerColor(ctx, 0, 5), 0.2);
  drawMist(ctx, H * 0.6, 1);
  // Treeline of rounded trees
  canopyRow(ctx, rollingRidge(rng, W, H * 0.7, H * 0.02), H * 0.055, 7, layerColor(ctx, 1, 4.5), 0.45);
  drawMist(ctx, H * 0.7, 0.9);
  // Meadow
  const meadowTop = H * 0.76;
  const meadow = sample((x) => meadowTop + Math.sin(x / 13) * H * 0.008, -6, W + 6, 14);
  ridgeLayer(ctx, meadow, layerColor(ctx, 2.2, 4.5, mix(pal.land, tok.calm, 0.1)), 0.75);
  // Puddle reflecting the sky, with ripple rings
  const px = W * 0.58;
  const py = H * 0.88;
  const prx = W * 0.3;
  const pry = H * 0.055;
  ctx.nodes.push({ t: 'path', d: ell(px, py, prx, pry), fill: linear(ctx, 0, py - pry, 0, py + pry, [{ o: 0, c: mix(pal.skyLow, pal.horizon, 0.4) }, { o: 1, c: mix(pal.water, pal.skyMid, 0.3) }]) });
  let rip = '';
  const rings: [number, number][] = ctx.lite ? [[-0.4, 0], [0.35, 0.1]] : [[-0.55, -0.1], [-0.15, 0.25], [0.3, -0.2], [0.6, 0.2], [0.05, -0.35]];
  for (const [u, v] of rings) {
    for (let k = 0; k < 2; k++) rip += ell(px + u * prx, py + v * pry, H * (0.018 + 0.02 * k), H * (0.005 + 0.005 * k));
  }
  moving(ctx, { k: 'wave', period: 1500, min: 0.3, s: 0.06, ox: px, oy: py, pri: 2 }, () =>
    ctx.nodes.push({ t: 'path', d: rip, stroke: mix(pal.skyLow, '#FFFFFF', 0.5), sw: sw(ctx, 0.3, 0.55), fill: 'none', opacity: 0.75 }),
  );
  // Rain curtain — soft translucent sheets, then dense fine streaks, nearly vertical
  const sheetC = mix(pal.cloud, pal.skyLow, 0.4);
  for (let i = 0; i < 3; i++) {
    const x = range(rng, -5, W - 15);
    const w = range(rng, 18, 34);
    ctx.nodes.push({ t: 'path', d: `M${f(x)} -1L${f(x + w)} -1L${f(x + w - 4)} ${f(H * 0.8)}L${f(x - 4)} ${f(H * 0.8)}Z`, fill: linear(ctx, 0, 0, 0, H * 0.8, [{ o: 0, c: sheetC, a: 0 }, { o: 0.35, c: sheetC, a: dark ? 0.16 : 0.22 }, { o: 1, c: sheetC, a: 0 }]) });
  }
  const slant = 0.07;
  const streaks = (count: number, lMin: number, lMax: number, y1: number) => {
    let d = '';
    for (let i = 0; i < count; i++) {
      const x = range(rng, -4, W + 6);
      const y = range(rng, -6, y1);
      const len = range(rng, lMin, lMax);
      d += `M${f(x)} ${f(y)}l${f(-len * slant)} ${f(len)}`;
    }
    return d;
  };
  const rainC = dark ? mix(pal.cloud, tok.accent, 0.2) : mix(pal.cloudShade, pal.water, 0.35);
  // Rain falls: each layer loops by its own height (tiled, clipped above the puddle); near drops fall faster.
  const farY = H * 0.92 + 6;
  const nearY = H * 0.9 + 6;
  moving(ctx, { k: 'loop', period: 1700, dx: -farY * slant, dy: farY, clip: [-12, -6, W + 24, farY + 4] }, () =>
    ctx.nodes.push({ t: 'path', d: streaks(ctx.lite ? 40 : 140, 3, 6, H * 0.92), stroke: rainC, sw: ctx.lite ? 0.5 : 0.28, fill: 'none', opacity: dark ? 0.45 : 0.55 }),
  );
  moving(ctx, { k: 'loop', period: 1050, dx: -nearY * slant, dy: nearY, clip: [-12, -6, W + 24, nearY + 8] }, () =>
    ctx.nodes.push({ t: 'path', d: streaks(ctx.lite ? 12 : 36, 7, 13, H * 0.9), stroke: rainC, sw: ctx.lite ? 0.8 : 0.45, fill: 'none', opacity: dark ? 0.5 : 0.6 }),
  );
}

/** Shoreline — low view over a sandy beach, gentle waves lapping in, foam lines on wet sand. */
function buildShoreline(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.46;
  skyAndSun(ctx, hy, { cloudCount: ctx.lite ? 1 : 3 });
  // Open sea to the horizon
  const sea = linear(ctx, 0, hy, 0, H * 0.66, [{ o: 0, c: mix(pal.horizon, pal.water, 0.45) }, { o: 1, c: mix(pal.water, pal.land, 0.2) }]);
  ctx.nodes.push({ t: 'rect', x: -1, y: f(hy), w: W + 2, h: f(H * 0.22), fill: sea });
  ctx.nodes.push({ t: 'rect', x: -1, y: f(hy - 0.15), w: W + 2, h: 0.4, fill: mix(pal.horizon, '#FFFFFF', 0.4), opacity: 0.55 });
  const [sx] = sunPos(ctx);
  ctx.nodes.push({ t: 'ellipse', cx: f(sx), cy: f(hy + H * 0.06), rx: 16, ry: f(H * 0.07), fill: softFill(ctx, pal.glow, 0.55) });
  const foam = mix(pal.sun, '#FFFFFF', dark ? 0.15 : 0.45);
  // Low swells
  let swell = '';
  for (let k = 0; k < (ctx.lite ? 2 : 4); k++) {
    const y = hy + H * (0.03 + 0.035 * k);
    const x0 = range(rng, -10, W * 0.4);
    swell += `M${f(x0)} ${f(y)}Q${f(x0 + 20)} ${f(y - 0.8)} ${f(x0 + range(rng, 35, 60))} ${f(y)}`;
  }
  moving(ctx, { k: 'wave', period: 9000, dx: 3, min: 0.5, pri: 2 }, () => ctx.nodes.push({ t: 'path', d: swell, stroke: foam, sw: sw(ctx, 0.35, 0.6), fill: 'none', opacity: 0.55 }));
  // Sand (dry at the bottom), sloping gently toward the right
  const sand = dark ? mix(tok.sunrise, pal.land, 0.62) : mix(mix(tok.sunrise, '#FFFFFF', 0.3), pal.haze, 0.3);
  const slope = (x: number) => (x / W) * H * 0.04;
  const sandTop = H * 0.64;
  const sandPts = sample((x) => sandTop + slope(x) + Math.sin(x / 11) * 0.5, -6, W + 6, 14);
  ctx.nodes.push({ t: 'path', d: closeTo(smoothLine(sandPts), sandPts, H + 2), fill: linear(ctx, 0, sandTop, 0, H, [{ o: 0, c: mix(sand, pal.land, dark ? 0.35 : 0.3) }, { o: 0.5, c: mix(sand, pal.land, dark ? 0.2 : 0.12) }, { o: 0.75, c: mix(sand, pal.glow, 0.15) }, { o: 1, c: mix(sand, pal.land, dark ? 0.3 : 0.15) }]) });
  // Wash sheets: thin water sliding up the sand, each with a scalloped foam edge
  const washes: [number, number, number][] = [[0.72, 0.08, 0.75], [0.8, 0.05, 0.6]];
  // Waves roll: the wash sheets and the shore break slide up the sand and back.
  moving(ctx, { k: 'wave', period: 5400, dy: 1.3, sy: 0.02, ox: W / 2, oy: H * 0.64 }, () => {
  for (const [yb, amp, op] of washes) {
    const ph = range(rng, 0, Math.PI * 2);
    const edge = (x: number) => H * yb + slope(x) + Math.sin(x / 9 + ph) * H * 0.012 + Math.sin(x / 3.2 + ph * 2) * H * 0.004;
    const pts = sample(edge, -6, W + 6, 40);
    const top = H * (yb - amp);
    const body = `M-6 ${f(top)}L${f(W + 6)} ${f(top + slope(W))}` + smoothLine([...pts].reverse()).replace(/^M/, 'L') + 'Z';
    ctx.nodes.push({ t: 'path', d: body, fill: linear(ctx, 0, top, 0, H * yb, [{ o: 0, c: mix(pal.water, pal.skyLow, 0.4), a: op }, { o: 1, c: mix(pal.skyLow, '#FFFFFF', dark ? 0.1 : 0.35), a: op }]) });
    ctx.nodes.push({ t: 'path', d: smoothLine(pts), stroke: foam, sw: sw(ctx, 1.1, 1.6), fill: 'none', opacity: 0.95 });
    // Secondary foam trace just behind the edge
    const back = sample((x) => edge(x) - H * 0.018, -6, W + 6, 30);
    if (!ctx.lite) ctx.nodes.push({ t: 'path', d: smoothLine(back), stroke: foam, sw: 0.35, fill: 'none', opacity: 0.5 });
  }
  // Shore break — a low curling wave with a thick foam crest where the sea meets the sand
  const bph = range(rng, 0, Math.PI * 2);
  const crest = sample((x) => H * 0.645 + slope(x) * 0.5 + Math.sin(x / 7 + bph) * H * 0.006, -6, W + 6, 30);
  const under = sample((x) => H * 0.665 + slope(x) * 0.5, -6, W + 6, 10);
  ctx.nodes.push({ t: 'path', d: smoothLine(crest) + smoothLine([...under].reverse()).replace(/^M/, 'L') + 'Z', fill: mix(pal.water, pal.land, 0.25) });
  ctx.nodes.push({ t: 'path', d: smoothLine(crest), stroke: foam, sw: sw(ctx, 1.4, 2), fill: 'none', opacity: 0.95 });
  });
  // Wet-sand glint below the last wash
  ctx.nodes.push({ t: 'ellipse', cx: f(sx), cy: f(H * 0.86), rx: 18, ry: f(H * 0.02), fill: softFill(ctx, pal.sun, dark ? 0.35 : 0.5) });
  // Foam lace left on the wet sand
  let lace = '';
  for (let i = 0; i < (ctx.lite ? 3 : 7); i++) {
    const x = range(rng, 0, W);
    const y = H * range(rng, 0.82, 0.9) + slope(x);
    lace += `M${f(x)} ${f(y)}q${f(3)} ${f(-0.8)} ${f(6)} 0t${f(6)} 0`;
  }
  ctx.nodes.push({ t: 'path', d: lace, stroke: foam, sw: sw(ctx, 0.35, 0.6), fill: 'none', opacity: 0.55 });
  // A few shells / pebbles on the dry sand
  let peb = '';
  for (let i = 0; i < (ctx.lite ? 2 : 5); i++) peb += ell(range(rng, 5, W - 5), H * range(rng, 0.93, 0.98), H * range(rng, 0.008, 0.016), H * 0.006);
  ctx.nodes.push({ t: 'path', d: peb, fill: mix(sand, pal.land, 0.35), opacity: 0.8 });
  if (ctx.has('birds')) drawBirds(ctx, W * 0.3, H * 0.2, layerColor(ctx, 3, 4), 0.7);
}

function drawRows(ctx: Ctx, nearPts: Pt[], color: string) {
  const { W, H, pal } = ctx;
  const clipId = newId(ctx, 'c');
  ctx.defs.push({ t: 'clip', id: clipId, children: [{ t: 'path', d: closeTo(smoothLine(nearPts), nearPts, H + 2), fill: '#000' }] });
  const vx = W * 0.5;
  const vy = Math.min(...nearPts.map((p) => p[1])) - H * 0.08;
  let d = '';
  for (let i = -8; i <= 8; i++) d += `M${f(vx + i * 1.5)} ${f(vy)}L${f(vx + i * 16)} ${f(H + 2)}`;
  ctx.nodes.push({ t: 'g', clip: clipId, children: [{ t: 'path', d, stroke: mix(color, pal.glow, 0.35), sw: sw(ctx, 0.5, 0.8), fill: 'none', opacity: 0.55 }] });
}

// ─── Healing-tone motifs (Dawn Wash, Deep Roots, Valley Mist, Lantern Glow, Moonset, Heartwood)

/** Soft horizontal brush stroke across the frame (watercolour band). */
function washStroke(ctx: Ctx, y: number, thick: number, color: string, alpha: number, target: SvgNode[] = ctx.nodes) {
  const { W, rng } = ctx;
  const top: Pt[] = [];
  const bot: Pt[] = [];
  const ph = range(rng, 0, Math.PI * 2);
  const ph2 = range(rng, 0, Math.PI * 2);
  for (let i = 0; i <= 8; i++) {
    const x = -8 + ((W + 16) * i) / 8;
    const u = i / 8;
    const swell = 0.55 + 0.45 * Math.sin(Math.PI * u);
    top.push([x, y - thick * 0.5 * swell + Math.sin(u * 5 + ph) * thick * 0.12]);
    bot.push([x, y + thick * 0.5 * swell + Math.sin(u * 4 + ph2) * thick * 0.14]);
  }
  const back = [...bot].reverse();
  const d = `${smoothLine(top)}L${f(back[0]![0])} ${f(back[0]![1])}${smoothLine(back).replace(/^M[^C]*/, '')}Z`;
  const fill = linear(ctx, 0, 0, W, 0, [
    { o: 0, c: color, a: 0 },
    { o: 0.18, c: color, a: alpha },
    { o: 0.8, c: color, a: alpha * 0.85 },
    { o: 1, c: color, a: 0 },
  ]);
  target.push({ t: 'path', d, fill });
}

/** Dawn Wash — watercolour bands of dawn colour washing across the sky over a still sea. */
function buildWash(ctx: Ctx) {
  const { W, H, pal, tok, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.64;
  drawSky(ctx, hy);
  drawStars(ctx, hy);
  drawGlow(ctx);
  if (!ctx.has('noSun')) drawSun(ctx);
  const bands: [number, number, string, number][] = [
    [0.16, 0.1, mix(pal.skyMid, tok.accent, 0.35), dark ? 0.3 : 0.4],
    [0.3, 0.13, mix(pal.glow, tok.sunrise, 0.3), dark ? 0.32 : 0.45],
    [0.44, 0.09, mix(pal.skyLow, tok.calm, 0.3), dark ? 0.28 : 0.38],
    [0.55, 0.07, mix(pal.horizon, pal.sun, 0.4), dark ? 0.35 : 0.5],
  ];
  moving(ctx, { k: 'wave', period: 14000, dx: 4, dy: 0.5 }, () => {
    for (const [y, t, c, a] of bands) washStroke(ctx, H * y, H * t, c, a);
  });
  drawWater(ctx, hy, true);
  // The same washes, faint and stretched, in the water.
  moving(ctx, { k: 'wave', period: 14000, delay: 1200, dx: -3 }, () => {
    for (const [y, t, c, a] of bands.slice(1)) {
      const ry = hy + (hy - H * y) * 0.55;
      if (ry < H) washStroke(ctx, ry, H * t * 0.5, c, a * 0.45);
    }
  });
}

/** Branching tapered roots (recursive), heading downward. */
function rootTree(ctx: Ctx, x: number, y: number, ang: number, len: number, w: number, depth: number, out: string[]) {
  const { rng } = ctx;
  const pts: Pt[] = [[x, y]];
  let cx = x;
  let cy = y;
  let a = ang;
  const n = 4;
  for (let i = 0; i < n; i++) {
    a += range(rng, -0.28, 0.28);
    cx += Math.cos(a) * (len / n);
    cy += Math.sin(a) * (len / n);
    pts.push([cx, cy]);
  }
  out.push(taper(pts, w, Math.max(0.15, w * 0.25)));
  if (depth <= 0) return;
  const kids = depth > 1 ? 2 : 1 + Math.round(rng());
  for (let k = 0; k < kids; k++) {
    const p = pts[1 + Math.floor(rng() * (pts.length - 2))]!;
    const side = k % 2 === 0 ? -1 : 1;
    rootTree(ctx, p[0], p[1], ang + side * range(rng, 0.35, 0.8), len * range(rng, 0.5, 0.7), w * 0.55, depth - 1, out);
  }
}

/** Deep Roots — a broad tree on a low horizon, its roots spreading deep through layered soil. */
function buildRoots(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const gy = H * 0.46;
  skyAndSun(ctx, gy);
  const far = sample(rollingRidge(rng, W, gy - H * 0.02, H * 0.03, 1.2), -6, W + 6, 10);
  ridgeLayer(ctx, far, layerColor(ctx, 1, 4), 0.4);
  // Soil cross-section with strata.
  const soil = mix(pal.land, tok.sunrise, dark ? 0.16 : 0.28);
  ctx.nodes.push({
    t: 'rect', x: -1, y: f(gy), w: W + 2, h: f(H - gy + 1),
    fill: linear(ctx, 0, gy, 0, H, [
      { o: 0, c: mix(soil, pal.glow, dark ? 0.1 : 0.2) },
      { o: 1, c: mix(soil, '#000000', dark ? 0.35 : 0.2) },
    ]),
  });
  let strata = '';
  for (let k = 1; k <= 4; k++) {
    const y = gy + (H - gy) * (k / 5) ** 0.9;
    const pts = sample(rollingRidge(rng, W, y, H * 0.012, 2), -6, W + 6, 12);
    strata += smoothLine(pts);
  }
  ctx.nodes.push({ t: 'path', d: strata, stroke: mix(soil, pal.haze, 0.35), sw: sw(ctx, 0.5, 0.8), fill: 'none', opacity: 0.45 });
  // Pebbles
  let pebbles = '';
  for (let i = 0; i < (ctx.lite ? 5 : 12); i++) {
    const r = H * range(rng, 0.006, 0.014);
    pebbles += ell(range(rng, 2, W - 2), range(rng, gy + H * 0.06, H - 2), r * 1.5, r);
  }
  ctx.nodes.push({ t: 'path', d: pebbles, fill: mix(soil, pal.haze, 0.45), opacity: 0.7 });
  // Grass lip along the surface
  const lipC = mix(pal.land, tok.calm, dark ? 0.15 : 0.2);
  ctx.nodes.push({ t: 'rect', x: -1, y: f(gy - H * 0.012), w: W + 2, h: f(H * 0.026), fill: lipC });
  // Roots
  const tx = W * 0.5;
  const rootC = mix(soil, pal.land, dark ? 0.55 : 0.6);
  const roots: string[] = [];
  const main = ctx.lite ? 3 : 5;
  const reach = H - gy;
  for (let i = 0; i < main; i++) {
    const u = i / (main - 1);
    const ang = Math.PI * (0.2 + 0.6 * u) + range(rng, -0.06, 0.06);
    rootTree(ctx, tx + (u - 0.5) * W * 0.06, gy + H * 0.005, ang, reach * range(rng, 0.55, 0.8), H * 0.03, ctx.lite ? 1 : 2, roots);
  }
  ctx.nodes.push({ t: 'path', d: roots.join(''), fill: rootC });
  // Tree: trunk flaring into the ground + broad crown
  const th = H * 0.3;
  const trunkC = mix(pal.land, soil, 0.25);
  const tw = W * 0.035;
  const trunk = `M${f(tx - tw * 2.2)} ${f(gy + H * 0.01)}C${f(tx - tw)} ${f(gy - H * 0.01)} ${f(tx - tw * 0.8)} ${f(gy - th * 0.35)} ${f(tx - tw * 0.6)} ${f(gy - th * 0.7)}L${f(tx + tw * 0.6)} ${f(gy - th * 0.7)}C${f(tx + tw * 0.8)} ${f(gy - th * 0.35)} ${f(tx + tw)} ${f(gy - H * 0.01)} ${f(tx + tw * 2.2)} ${f(gy + H * 0.01)}Z`;
  ctx.nodes.push({ t: 'path', d: trunk, fill: trunkC });
  const crownC = mix(pal.land, tok.calm, dark ? 0.2 : 0.28);
  const cr = Math.min(W * 0.2, th * 0.55);
  const cy = gy - th * 0.8;
  const crown =
    dot(tx, cy, cr) + dot(tx - cr * 0.9, cy + cr * 0.25, cr * 0.72) + dot(tx + cr * 0.95, cy + cr * 0.2, cr * 0.7) +
    dot(tx - cr * 0.4, cy - cr * 0.45, cr * 0.66) + dot(tx + cr * 0.45, cy - cr * 0.4, cr * 0.62);
  moving(ctx, { k: 'wave', period: 6800, deg: 1.3, ox: tx, oy: gy - th * 0.7 }, () =>
    ctx.nodes.push({ t: 'path', d: crown, fill: linear(ctx, 0, cy - cr * 1.2, 0, cy + cr, [{ o: 0, c: mix(crownC, pal.glow, 0.3) }, { o: 1, c: mix(crownC, pal.land, 0.35) }]) }),
  );
}

/** Valley Mist — steep slopes folding into a valley floor filled with layered mist. */
function buildValley(ctx: Ctx) {
  const { W, H, pal, rng } = ctx;
  const hy = H * 0.5;
  skyAndSun(ctx, hy, { cloudCount: 0 });
  const [sx] = sunPos(ctx);
  // Far range, then alternating spurs that step down toward the valley floor.
  mountainRange(ctx, 0, 6, H * 0.5, H * 0.22, clamp(sx + 22, 20, 85), false, 16);
  moving(ctx, { k: 'wave', period: 13000, dx: 5 }, () => drawMist(ctx, H * 0.5, 1));
  const n = ctx.lite ? 3 : 4;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const fromLeft = i % 2 === 0;
    const base = H * (0.52 + 0.14 * t);
    const top = H * (0.3 + 0.12 * t);
    const reach = W * (0.62 - 0.1 * t);
    const pts: Pt[] = [];
    for (let k = 0; k <= 10; k++) {
      const u = k / 10;
      const x = fromLeft ? -6 + (reach + 6) * u : W + 6 - (reach + 6) * u;
      const y = top + (base - top) * (u ** 1.6) + Math.sin(u * 7 + i) * H * 0.008 + range(rng, -0.4, 0.4);
      pts.push([x, y]);
    }
    // Run the spur's foot out flat across the valley floor to the far edge (no hard ends).
    for (let k = 1; k <= 4; k++) {
      const u = k / 4;
      const last = pts[pts.length - 1]!;
      const edge = fromLeft ? W + 6 : -6;
      pts.push([last[0] + (edge - last[0]) * (u === 1 ? 1 : 0.4), base + H * 0.01 * Math.sin(k + i)]);
    }
    const color = layerColor(ctx, i + 1, n + 2);
    const ordered = fromLeft ? pts : [...pts].reverse();
    ridgeLayer(ctx, ordered, color, (i + 2) / (n + 2));
    // Mist pooling in the fold below each spur
    drawMist(ctx, base + H * 0.02, 1.1);
    const pool = mix(pal.haze, '#FFFFFF', ctx.mode === 'dark' ? 0.08 : 0.3);
    ctx.nodes.push({ t: 'ellipse', cx: f(W * 0.5), cy: f(base + H * 0.03), rx: f(W * 0.75), ry: f(H * 0.05), fill: softFill(ctx, pool, 0.75), opacity: 0.8 });
  }
  // Valley floor: a thin river of mist
  const floor = sample(rollingRidge(rng, W, H * 0.9, H * 0.02), -6, W + 6, 10);
  ridgeLayer(ctx, floor, layerColor(ctx, n + 1, n + 2), 1);
  moving(ctx, { k: 'wave', period: 11000, delay: 1500, dx: -6, min: 0.75 }, () => drawMist(ctx, H * 0.88, 0.9));
}

/** One floating paper lantern: body, cap, glow and optional reflection. */
function drawLantern(ctx: Ctx, x: number, y: number, s: number, body: string, glow: string, reflect: number | null) {
  const w = s;
  const h = s * 1.25;
  ctx.nodes.push({ t: 'circle', cx: f(x), cy: f(y - h * 0.45), r: f(s * 2.2), fill: softFill(ctx, glow, 0.55) });
  const d = `M${f(x - w * 0.42)} ${f(y - h)}L${f(x + w * 0.42)} ${f(y - h)}Q${f(x + w * 0.62)} ${f(y - h * 0.5)} ${f(x + w * 0.4)} ${f(y)}L${f(x - w * 0.4)} ${f(y)}Q${f(x - w * 0.62)} ${f(y - h * 0.5)} ${f(x - w * 0.42)} ${f(y - h)}Z`;
  ctx.nodes.push({ t: 'path', d, fill: linear(ctx, 0, y - h, 0, y, [{ o: 0, c: mix(body, '#FFFFFF', 0.35) }, { o: 1, c: body }]) });
  ctx.nodes.push({ t: 'rect', x: f(x - w * 0.46), y: f(y - h - s * 0.08), w: f(w * 0.92), h: f(s * 0.12), rx: f(s * 0.05), fill: mix(body, '#000000', 0.35) });
  if (reflect != null) {
    ctx.nodes.push({ t: 'ellipse', cx: f(x), cy: f(y + h * 0.5), rx: f(w * 0.4), ry: f(h * 0.45), fill: softFill(ctx, glow, 0.5), opacity: reflect });
  }
}

/** Lantern Glow — paper lanterns drifting on still water at dusk, a few rising. */
function buildLanterns(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.52;
  skyAndSun(ctx, hy);
  const far = sample(rollingRidge(rng, W, hy - H * 0.01, H * 0.025, 1.4), -6, W + 6, 12);
  ridgeLayer(ctx, far, layerColor(ctx, 1, 4), 0.45);
  drawWater(ctx, hy, true);
  const body = dark ? mix(tok.warning, tok.sunrise, 0.35) : mix(tok.sunrise, tok.warning, 0.4);
  const glow = mix(body, pal.sun, 0.45);
  // On the water: perspective rows, small far → big near.
  const lanterns: [number, number, number][] = [];
  const nW = ctx.lite ? 5 : 9;
  for (let i = 0; i < nW; i++) {
    const u = (i + range(rng, 0.1, 0.9)) / nW;
    const y = hy + (H - hy) * (0.12 + 0.8 * u ** 1.3);
    const x = range(rng, 6, W - 6);
    lanterns.push([x, y, (1.4 + 4.4 * u) * (H / 100) * (ctx.lite ? 1.3 : 1)]);
  }
  lanterns.sort((a, b) => a[1] - b[1]);
  moving(ctx, { k: 'wave', period: 5000, dy: 0.7, dx: 0.4, min: 0.85 }, () => {
    for (const [x, y, s] of lanterns) drawLantern(ctx, x, y, s, body, glow, dark ? 0.55 : 0.4);
  });
  // A few lifting into the sky
  const nS = ctx.lite ? 2 : 4;
  moving(ctx, { k: 'wave', period: 9000, delay: 800, dy: -2.4, dx: 0.8, min: 0.75 }, () => {
    for (let i = 0; i < nS; i++) {
      drawLantern(ctx, range(rng, 12, W - 12), hy * range(rng, 0.2, 0.8), range(rng, 1.2, 2.2) * (H / 100) * (ctx.lite ? 1.4 : 1), body, glow, null);
    }
  });
}

/** Moonset — a large moon sinking toward a far ridge before dawn, its light laid across water. */
function buildMoonset(ctx: Ctx) {
  const { W, H, pal, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.64;
  drawSky(ctx, hy);
  drawStars(ctx, hy);
  const [mx, my] = sunPos(ctx);
  const r = Math.min(W, H) * 0.2;
  const moonC = mix(pal.sun, '#FFFFFF', dark ? 0.3 : 0.2);
  ctx.nodes.push({ t: 'circle', cx: f(mx), cy: f(my), r: f(r * 3), fill: softFill(ctx, mix(pal.glow, moonC, 0.5), dark ? 0.35 : 0.45) });
  const moonBody: SvgNode[] = [];
  moonBody.push({ t: 'circle', cx: f(mx), cy: f(my), r: f(r), fill: radial(ctx, mx - r * 0.3, my - r * 0.3, r * 1.4, [{ o: 0, c: moonC }, { o: 1, c: mix(moonC, pal.skyLow, 0.35) }]) });
  const shade = mix(moonC, pal.skyMid, 0.4);
  let craters = '';
  for (let i = 0; i < (ctx.lite ? 3 : 7); i++) {
    const a = range(rng, 0, Math.PI * 2);
    const dd = r * Math.sqrt(rng()) * 0.7;
    craters += dot(mx + Math.cos(a) * dd, my + Math.sin(a) * dd, r * range(rng, 0.07, 0.2));
  }
  moonBody.push({ t: 'path', d: craters, fill: shade, opacity: 0.35 });
  // Clip the moon at the horizon so it reads as setting.
  const clipId = newId(ctx, 'c');
  ctx.defs.push({ t: 'clip', id: clipId, children: [{ t: 'rect', x: -1, y: -1, w: W + 2, h: f(hy + 1), fill: '#000' }] });
  ctx.nodes.push({ t: 'g', clip: clipId, children: moonBody });
  // Far ridge the moon sinks behind
  const ridge = sample(rollingRidge(rng, W, hy - H * 0.015, H * 0.02, 1.5), -6, W + 6, 12);
  ridgeLayer(ctx, ridge, layerColor(ctx, 1, 4), 0.5);
  // Water + moon path
  ctx.nodes.push({
    t: 'rect', x: -1, y: f(hy), w: W + 2, h: f(H - hy + 1),
    fill: linear(ctx, 0, hy, 0, H, [{ o: 0, c: mix(pal.horizon, pal.water, 0.5) }, { o: 1, c: mix(pal.water, pal.land, dark ? 0.55 : 0.35) }]),
  });
  let path = '';
  const rows = ctx.lite ? 7 : 16;
  for (let k = 0; k < rows; k++) {
    const u = (k + 0.5) / rows;
    const y = hy + 0.8 + (H - hy - 1) * u ** 1.4;
    const spread = r * (0.5 + 1.4 * u);
    const len = range(rng, 1.2, 4) * (0.5 + u) * (ctx.lite ? 1.4 : 1);
    const x = mx + (rng() - 0.5) * spread - len / 2;
    path += `M${f(x)} ${f(y)}h${f(len)}v${f((0.25 + 0.4 * u) * (ctx.lite ? 1.6 : 1))}h${f(-len)}Z`;
  }
  moving(ctx, { k: 'wave', period: 2600, min: 0.45, dx: 0.6 }, () => ctx.nodes.push({ t: 'path', d: path, fill: moonC, opacity: 0.75 }));
  ctx.nodes.push({ t: 'rect', x: -1, y: f(hy - 0.15), w: W + 2, h: 0.4, fill: mix(pal.horizon, '#FFFFFF', 0.4), opacity: 0.4 });
  drawMist(ctx, hy + H * 0.03, 0.5);
}

/** Heartwood — a cut stump on the forest floor, its growth rings spreading from the heart. */
function buildRings(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.36;
  skyAndSun(ctx, hy);
  // Forest edge behind
  const trees = sample(rollingRidge(rng, W, hy, H * 0.03, 2.4), -6, W + 6, 16);
  ridgeLayer(ctx, trees, layerColor(ctx, 1, 4), 0.45);
  drawMist(ctx, hy + H * 0.02, 0.7);
  // Forest floor
  const floorC = mix(pal.land, tok.calm, dark ? 0.12 : 0.18);
  ctx.nodes.push({
    t: 'rect', x: -1, y: f(hy + H * 0.02), w: W + 2, h: f(H),
    fill: linear(ctx, 0, hy, 0, H, [{ o: 0, c: mix(floorC, pal.haze, 0.45) }, { o: 1, c: mix(floorC, '#000000', dark ? 0.3 : 0.1) }]),
  });
  // Stump: side (cylinder) then the cut face
  const cx = W * 0.5;
  const rx = Math.min(W * 0.36, H * 0.5);
  const ry = rx * 0.4;
  const topY = H * 0.66;
  const sideH = Math.min(H * 0.16, rx * 0.45);
  const bark = mix(pal.land, tok.sunrise, dark ? 0.15 : 0.22);
  ctx.nodes.push({ t: 'ellipse', cx: f(cx), cy: f(topY + sideH + ry * 0.2), rx: f(rx * 1.25), ry: f(ry * 0.8), fill: softFill(ctx, pal.land, 0.55) });
  const side = `M${f(cx - rx)} ${f(topY)}L${f(cx - rx * 1.06)} ${f(topY + sideH)}A${f(rx * 1.06)} ${f(ry * 1.06)} 0 0 0 ${f(cx + rx * 1.06)} ${f(topY + sideH)}L${f(cx + rx)} ${f(topY)}Z`;
  ctx.nodes.push({ t: 'path', d: side, fill: linear(ctx, cx - rx, 0, cx + rx, 0, [{ o: 0, c: mix(bark, '#000000', 0.25) }, { o: 0.4, c: mix(bark, pal.glow, 0.15) }, { o: 1, c: mix(bark, '#000000', 0.3) }]) });
  // Bark furrows
  let furrows = '';
  for (let i = 1; i < 9; i++) {
    const u = i / 9;
    const a = Math.PI * u;
    const x = cx - Math.cos(a) * rx;
    const y = topY + Math.sin(a) * ry;
    furrows += `M${f(x)} ${f(y)}L${f(x + range(rng, -0.6, 0.6))} ${f(y + sideH * range(rng, 0.6, 0.95))}`;
  }
  ctx.nodes.push({ t: 'path', d: furrows, stroke: mix(bark, '#000000', 0.35), sw: sw(ctx, 0.45, 0.8), fill: 'none', opacity: 0.6 });
  // Cut face
  const wood = dark ? mix(tok.sunrise, pal.haze, 0.5) : mix(tok.sunrise, pal.sun, 0.45);
  ctx.nodes.push({ t: 'ellipse', cx: f(cx), cy: f(topY), rx: f(rx), ry: f(ry), fill: mix(bark, pal.glow, 0.2) });
  ctx.nodes.push({ t: 'ellipse', cx: f(cx), cy: f(topY), rx: f(rx * 0.93), ry: f(ry * 0.9), fill: radial(ctx, 0.5, 0.5, 0.5, [{ o: 0, c: mix(wood, tok.sunrise, 0.35) }, { o: 1, c: wood }], 'obb') });
  // Growth rings (slightly off-centre heart, wobbly)
  const hx = cx + rx * 0.08;
  const hyy = topY + ry * 0.04;
  const nR = ctx.lite ? 5 : 10;
  let rings = '';
  for (let k = 1; k <= nR; k++) {
    const t = k / (nR + 0.6);
    const pts: Pt[] = [];
    for (let j = 0; j <= 24; j++) {
      const a = (Math.PI * 2 * j) / 24;
      const wob = 1 + Math.sin(a * 3 + k) * 0.025 + range(rng, -0.012, 0.012);
      const ox = (cx - hx) * t;
      const oy = (topY - hyy) * t;
      pts.push([hx + ox + Math.cos(a) * rx * 0.9 * t * wob, hyy + oy + Math.sin(a) * ry * 0.88 * t * wob]);
    }
    pts[pts.length - 1] = pts[0]!;
    rings += smoothLine(pts);
  }
  moving(ctx, { k: 'wave', period: 5400, s: 0.03, min: 0.75, ox: hx, oy: hyy }, () =>
    ctx.nodes.push({ t: 'path', d: rings, stroke: mix(wood, bark, 0.55), sw: sw(ctx, 0.4, 0.7), fill: 'none', opacity: 0.75 }),
  );
  ctx.nodes.push({ t: 'ellipse', cx: f(hx), cy: f(hyy), rx: f(rx * 0.05), ry: f(ry * 0.06), fill: mix(bark, tok.sunrise, 0.3) });
  // A radial check crack from the heart
  ctx.nodes.push({ t: 'path', d: `M${f(hx)} ${f(hyy)}L${f(hx - rx * 0.35)} ${f(hyy - ry * 0.55)}`, stroke: mix(bark, '#000000', 0.3), sw: sw(ctx, 0.35, 0.6), fill: 'none', opacity: 0.6 });
  // Sprout + moss at the base
  const sprout = mix(tok.calm, pal.land, dark ? 0.35 : 0.2);
  const bx = cx + rx * 1.12;
  const by = topY + sideH * 0.95;
  moving(ctx, { k: 'wave', period: 4400, deg: 4, ox: bx, oy: by, pri: 2 }, () => {
    ctx.nodes.push({ t: 'path', d: taper([[bx, by], [bx + 0.6, by - H * 0.05], [bx + 1.8, by - H * 0.09]], H * 0.008, H * 0.003), fill: sprout });
    ctx.nodes.push({ t: 'path', d: leafShape(bx + 3.2, by - H * 0.1, H * 0.05, -0.5) + leafShape(bx - 0.6, by - H * 0.075, H * 0.04, -2.6), fill: sprout });
  });
  let moss = '';
  for (let i = 0; i < (ctx.lite ? 4 : 9); i++) {
    const a = Math.PI * range(rng, 0.1, 0.9);
    moss += ell(cx - Math.cos(a) * rx * 1.05, topY + sideH + Math.sin(a) * ry * 0.9, H * range(rng, 0.018, 0.03), H * 0.012);
  }
  ctx.nodes.push({ t: 'path', d: moss, fill: mix(sprout, pal.land, 0.3), opacity: 0.9 });
}

// ─── Library expansion motifs (Low Cloud, Quiet Hours, Golden Hour, Velvet Night, Starlit, Drift,
//     Night crickets, Snow morning, Night stream, Distant thunder, After the rain, Hearth, Rain on the eaves)

/** Four-point sparkle star as a path fragment. */
function sparkle(x: number, y: number, r: number): string {
  const k = r * 0.22;
  return `M${f(x)} ${f(y - r)}L${f(x + k)} ${f(y - k)}L${f(x + r)} ${f(y)}L${f(x + k)} ${f(y + k)}L${f(x)} ${f(y + r)}L${f(x - k)} ${f(y + k)}L${f(x - r)} ${f(y)}L${f(x - k)} ${f(y - k)}Z`;
}

/** Crescent (lit on the right) as a path fragment. */
function crescent(x: number, y: number, r: number, thin = 1.25): string {
  return `M${f(x)} ${f(y - r)}A${f(r)} ${f(r)} 0 1 1 ${f(x)} ${f(y + r)}A${f(r * thin)} ${f(r * thin)} 0 0 0 ${f(x)} ${f(y - r)}Z`;
}

/** Row of pointed conifers along a ground line (union path). */
function pineRow(ctx: Ctx, ground: RidgeFn, hMin: number, hMax: number, step: number): { d: string; minY: number } {
  const { W, H, rng } = ctx;
  let d = '';
  let minY = H;
  for (let x = -4; x < W + 6; x += step * range(rng, 0.6, 1.3)) {
    const h = range(rng, hMin, hMax);
    const by = ground(x) + 0.5;
    const w = h * range(rng, 0.26, 0.34);
    const tiers = 3;
    for (let k = 0; k < tiers; k++) {
      const t0 = by - h * (k / tiers) * 0.8;
      const t1 = by - h * ((k + 1) / tiers) - h * 0.12;
      const ww = w * (1 - k * 0.25);
      d += `M${f(x - ww)} ${f(t0)}L${f(x)} ${f(t1)}L${f(x + ww)} ${f(t0)}Z`;
    }
    minY = Math.min(minY, by - h * 1.12);
  }
  const base = sample(ground, -6, W + 6, 12);
  d += closeTo(smoothLine(base), base, H + 2);
  return { d, minY };
}

/** Low Cloud — a heavy, soft cloud deck hanging low over flat fields, a thin seam of light beneath. */
function buildLowCloud(ctx: Ctx) {
  const { W, H, pal, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.7;
  drawSky(ctx, hy);
  drawGlow(ctx, ctx.nodes, 0.9);
  const [sx] = sunPos(ctx);
  if (!ctx.has('noSun')) drawSun(ctx, ctx.nodes, [sx, hy - H * 0.035], 0.75);
  // Cloud deck: rows of overlapping puffs, lit from below toward the seam
  const deckTop = mix(pal.cloudShade, pal.skyTop, 0.4);
  ctx.nodes.push({ t: 'rect', x: -1, y: -1, w: W + 2, h: f(H * 0.34), fill: linear(ctx, 0, 0, 0, H * 0.34, [{ o: 0, c: deckTop, a: 0.95 }, { o: 1, c: deckTop, a: 0 }]) });
  const rows = ctx.lite ? 3 : 4;
  moving(ctx, { k: 'wave', period: 17000, dx: 3, dy: 0.4 }, () => {
  for (let k = 0; k < rows; k++) {
    const u = k / (rows - 1);
    const baseY = H * (0.2 + 0.4 * u);
    const lit = mix(pal.cloud, pal.glow, 0.1 + 0.3 * u);
    const shade = mix(pal.cloudShade, dark ? pal.skyTop : pal.skyMid, 0.35 * (1 - u));
    let x = range(rng, -14, -6);
    while (x < W + 8) {
      const w = range(rng, 28, 42) * (ctx.lite ? 1.15 : 1);
      cloudPuff(ctx, x + w / 2, baseY, w, lit, shade, { lumps: 5, tall: 0.75 - 0.2 * u });
      x += w * range(rng, 0.55, 0.72);
    }
  }
  });
  // Glowing seam under the deck
  moving(ctx, { k: 'wave', period: 6000, min: 0.65, sx: 0.05, ox: sx, oy: hy - H * 0.04 }, () =>
    ctx.nodes.push({ t: 'ellipse', cx: f(sx), cy: f(hy - H * 0.04), rx: f(W * 0.6), ry: f(H * 0.05), fill: softFill(ctx, mix(pal.sun, pal.glow, 0.4), dark ? 0.55 : 0.7) }),
  );
  // Flat fields with a thin far treeline
  const far = sample(rollingRidge(rng, W, hy, H * 0.008, 3), -6, W + 6, 20);
  ridgeLayer(ctx, far, layerColor(ctx, 1, 4), 0.45);
  const fieldC = layerColor(ctx, 2.5, 4);
  ctx.nodes.push({ t: 'rect', x: -1, y: f(hy + H * 0.012), w: W + 2, h: f(H - hy), fill: linear(ctx, 0, hy, 0, H, [{ o: 0, c: mix(fieldC, pal.haze, 0.3) }, { o: 1, c: mix(fieldC, pal.land, 0.4) }]) });
  let rowsD = '';
  for (let i = 1; i <= (ctx.lite ? 4 : 7); i++) {
    const y = hy + (H - hy) * (i / 8) ** 1.5 + H * 0.012;
    rowsD += `M-2 ${f(y)}L${f(W + 2)} ${f(y + H * 0.004)}`;
  }
  ctx.nodes.push({ t: 'path', d: rowsD, stroke: mix(fieldC, pal.glow, 0.3), sw: sw(ctx, 0.35, 0.6), fill: 'none', opacity: 0.55 });
  drawMist(ctx, hy + H * 0.02, 0.8);
}

/** Quiet Hours — an hourglass on a sill at first light, a thin stream of sand still falling. */
function buildHours(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const sill = H * 0.8;
  const hy = H * 0.66;
  skyAndSun(ctx, hy);
  const far = sample(rollingRidge(rng, W, hy, H * 0.04, 1.2), -6, W + 6, 10);
  ridgeLayer(ctx, far, layerColor(ctx, 1, 5), 0.3);
  drawMist(ctx, hy + H * 0.02, 0.8);
  const near = sample(rollingRidge(rng, W, hy + H * 0.06, H * 0.03, 1), -6, W + 6, 10);
  ridgeLayer(ctx, near, layerColor(ctx, 2, 5), 0.5);
  // Window frame edges + sill
  const frame = dark ? mix(pal.land, tok.bg, 0.3) : mix(pal.land, tok.sunrise, 0.35);
  ctx.nodes.push({ t: 'rect', x: -1, y: -1, w: f(W * 0.06), h: f(H + 2), fill: frame, opacity: 0.9 });
  ctx.nodes.push({ t: 'rect', x: f(W * 0.94), y: -1, w: f(W * 0.07), h: f(H + 2), fill: frame, opacity: 0.9 });
  const wood = dark ? mix(tok.sunrise, pal.land, 0.7) : mix(tok.sunrise, pal.land, 0.45);
  ctx.nodes.push({ t: 'rect', x: -1, y: f(sill), w: W + 2, h: f(H - sill + 1), fill: linear(ctx, 0, sill, 0, H, [{ o: 0, c: mix(wood, pal.glow, 0.35) }, { o: 0.12, c: wood }, { o: 1, c: mix(wood, '#000000', 0.25) }]) });
  // Hourglass
  const cx = W * 0.5;
  const hh = H * 0.46;
  const bw = Math.min(W * 0.13, hh * 0.3);
  const top = sill - hh;
  const neck = sill - hh * 0.5;
  // Soft shadow + light pool
  ctx.nodes.push({ t: 'ellipse', cx: f(cx + bw * 0.6), cy: f(sill + H * 0.02), rx: f(bw * 1.8), ry: f(H * 0.02), fill: softFill(ctx, '#000000', dark ? 0.45 : 0.25) });
  const glass = (y0: number, y1: number) => `M${f(cx - bw)} ${f(y0)}C${f(cx - bw)} ${f(y0 + (y1 - y0) * 0.55)} ${f(cx - bw * 0.12)} ${f(y1 - (y1 - y0) * 0.12)} ${f(cx - bw * 0.1)} ${f(y1)}L${f(cx + bw * 0.1)} ${f(y1)}C${f(cx + bw * 0.12)} ${f(y1 - (y1 - y0) * 0.12)} ${f(cx + bw)} ${f(y0 + (y1 - y0) * 0.55)} ${f(cx + bw)} ${f(y0)}Z`;
  const capH = hh * 0.06;
  const upper = glass(top + capH, neck);
  const lowerRaw = glass(sill - capH, neck);
  const glassC = mix(pal.skyLow, '#FFFFFF', dark ? 0.15 : 0.55);
  ctx.nodes.push({ t: 'path', d: upper + lowerRaw, fill: glassC, opacity: dark ? 0.28 : 0.42 });
  // Sand: remaining in the top bulb, a mound in the bottom, the falling thread
  const sand = dark ? mix(tok.sunrise, tok.warning, 0.4) : mix(tok.sunrise, tok.warning, 0.5);
  const sTop = neck - hh * 0.16;
  ctx.nodes.push({ t: 'path', d: `M${f(cx - bw * 0.62)} ${f(sTop)}Q${f(cx)} ${f(sTop + hh * 0.03)} ${f(cx + bw * 0.62)} ${f(sTop)}C${f(cx + bw * 0.4)} ${f(neck - hh * 0.05)} ${f(cx + bw * 0.14)} ${f(neck - hh * 0.01)} ${f(cx + bw * 0.08)} ${f(neck)}L${f(cx - bw * 0.08)} ${f(neck)}C${f(cx - bw * 0.14)} ${f(neck - hh * 0.01)} ${f(cx - bw * 0.4)} ${f(neck - hh * 0.05)} ${f(cx - bw * 0.62)} ${f(sTop)}Z`, fill: sand });
  const mB = sill - capH;
  ctx.nodes.push({ t: 'path', d: `M${f(cx - bw * 0.97)} ${f(mB)}Q${f(cx - bw * 0.5)} ${f(mB - hh * 0.07)} ${f(cx)} ${f(mB - hh * 0.17)}Q${f(cx + bw * 0.5)} ${f(mB - hh * 0.07)} ${f(cx + bw * 0.97)} ${f(mB)}Z`, fill: linear(ctx, 0, mB - hh * 0.17, 0, mB, [{ o: 0, c: mix(sand, pal.sun, 0.3) }, { o: 1, c: mix(sand, '#000000', 0.15) }]) });
  moving(ctx, { k: 'wave', period: 1200, min: 0.35, sx: 0.4, ox: cx, oy: neck }, () =>
    ctx.nodes.push({ t: 'path', d: `M${f(cx)} ${f(neck)}L${f(cx)} ${f(mB - hh * 0.17)}`, stroke: sand, sw: sw(ctx, 0.35, 0.6), fill: 'none' }),
  );
  // Glass outline + highlight
  ctx.nodes.push({ t: 'path', d: upper + lowerRaw, stroke: mix(glassC, pal.sun, 0.4), sw: sw(ctx, 0.4, 0.7), fill: 'none', opacity: 0.8 });
  ctx.nodes.push({ t: 'path', d: `M${f(cx - bw * 0.72)} ${f(top + capH + hh * 0.05)}Q${f(cx - bw * 0.7)} ${f(top + capH + hh * 0.2)} ${f(cx - bw * 0.35)} ${f(neck - hh * 0.08)}`, stroke: '#FFFFFF', sw: sw(ctx, 0.5, 0.8), fill: 'none', opacity: dark ? 0.35 : 0.6 });
  // Frame: caps + posts
  const brass = dark ? mix(tok.sunrise, pal.land, 0.5) : mix(tok.sunrise, pal.land, 0.55);
  const capW = bw * 1.25;
  ctx.nodes.push({ t: 'rect', x: f(cx - capW), y: f(top), w: f(capW * 2), h: f(capH), rx: f(capH * 0.3), fill: brass });
  ctx.nodes.push({ t: 'rect', x: f(cx - capW), y: f(sill - capH), w: f(capW * 2), h: f(capH), rx: f(capH * 0.3), fill: brass });
  const postW = Math.max(0.6, bw * 0.08);
  ctx.nodes.push({ t: 'rect', x: f(cx - capW * 0.92), y: f(top + capH), w: f(postW), h: f(hh - capH * 2), fill: brass });
  ctx.nodes.push({ t: 'rect', x: f(cx + capW * 0.92 - postW), y: f(top + capH), w: f(postW), h: f(hh - capH * 2), fill: brass });
}

/** Golden Hour — a big amber sun low behind soft ridges, warm haze, tall grass rim-lit in front. */
function buildGoldenHour(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.66;
  drawSky(ctx, hy);
  drawGlow(ctx, ctx.nodes, 1.2);
  drawRays(ctx);
  const [sx, sy] = sunPos(ctx);
  drawSun(ctx, ctx.nodes, [sx, sy], 1.5);
  drawCloudWisps(ctx, hy, ctx.lite ? 1 : 3);
  const n = 3;
  for (let i = 0; i < n; i++) {
    const pts = sample(rollingRidge(rng, W, hy + H * 0.05 * i, H * (0.05 - 0.01 * i), 0.9), -6, W + 6, 10);
    ridgeLayer(ctx, pts, layerColor(ctx, i, n + 2), (i + 1) / (n + 2));
    drawMist(ctx, hy + H * (0.03 + 0.05 * i), 0.8);
  }
  // Warm haze band across the sun line
  ctx.nodes.push({ t: 'ellipse', cx: f(sx), cy: f(hy), rx: f(W * 0.8), ry: f(H * 0.08), fill: softFill(ctx, mix(pal.glow, tok.warning, 0.3), dark ? 0.4 : 0.55) });
  // Foreground grass bank with seed-head stalks, rim-lit
  const bankC = dark ? mix(pal.land, '#000000', 0.1) : mix(pal.land, tok.sunrise, 0.12);
  const bank = sample((x) => H * 0.9 + Math.sin(x / 10) * H * 0.012, -6, W + 6, 14);
  ridgeLayer(ctx, bank, bankC, 1);
  let stems = '';
  let heads = '';
  let rim = '';
  const count = ctx.lite ? 9 : 20;
  for (let i = 0; i < count; i++) {
    const x = range(rng, 0, W);
    const h = H * range(rng, 0.2, 0.42);
    const lean = range(rng, -4, 5);
    const y0 = H + 1;
    const tip: Pt = [x + lean, y0 - h];
    stems += taper([[x, y0], [x + lean * 0.4, y0 - h * 0.55], tip], H * 0.009, H * 0.003);
    if (i % 3 !== 2) {
      heads += leafShape(tip[0] + lean * 0.05, tip[1] - H * 0.02, H * 0.05, -Math.PI / 2 + lean * 0.04);
      rim += `M${f(tip[0] + H * 0.006)} ${f(tip[1] - H * 0.04)}L${f(tip[0] + H * 0.006)} ${f(tip[1])}`;
    }
  }
  moving(ctx, { k: 'wave', period: 5800, deg: 1, ox: W / 2, oy: H + 3 }, () => {
    ctx.nodes.push({ t: 'path', d: stems + heads, fill: bankC });
    ctx.nodes.push({ t: 'path', d: rim, stroke: mix(pal.sun, tok.warning, 0.3), sw: sw(ctx, 0.35, 0.6), fill: 'none', opacity: 0.7 });
  });
}

/** Velvet Night — a thin crescent over soft, folded hills with a velvet sheen along each crest. */
function buildVelvet(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.62;
  drawSky(ctx, hy);
  drawStars(ctx, hy);
  const [mx, my] = sunPos(ctx);
  const r = Math.min(W, H) * 0.11;
  const moonC = mix(pal.sun, '#FFFFFF', 0.25);
  moving(ctx, { k: 'wave', period: 6400, s: 0.04, min: 0.85, ox: mx, oy: my }, () => {
    ctx.nodes.push({ t: 'circle', cx: f(mx), cy: f(my), r: f(r * 3.2), fill: softFill(ctx, mix(pal.glow, moonC, 0.4), dark ? 0.3 : 0.4) });
    ctx.nodes.push({ t: 'path', d: crescent(mx, my, r, 1.3), fill: moonC });
  });
  // Folded velvet hills: deep plum/indigo, each with a soft sheen line on its crest
  const velvet = mix(pal.land, tok.accent, dark ? 0.22 : 0.18);
  const n = ctx.lite ? 3 : 4;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const fn = rollingRidge(rng, W, H * (0.62 + 0.11 * t), H * (0.06 + 0.02 * t), 0.8);
    const pts = sample(fn, -6, W + 6, 14);
    const col = mix(pal.haze, velvet, 0.35 + 0.65 * t);
    ridgeLayer(ctx, pts, col, (i + 1) / n);
    const sheen = sample((x) => fn(x) + H * 0.012, -6, W + 6, 14);
    ctx.nodes.push({ t: 'path', d: smoothLine(sheen), stroke: mix(col, moonC, 0.45), sw: sw(ctx, 0.6, 0.9), fill: 'none', opacity: 0.45 });
  }
}

/** Starlit — a deep star field and a faint galactic band over a still lake mirroring the stars. */
function buildStarlit(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.6;
  drawSky(ctx, hy);
  // Milky band (diagonal)
  const bandC = mix(pal.skyLow, '#FFFFFF', dark ? 0.2 : 0.45);
  const x0 = W * 0.05;
  const x1 = W * 0.95;
  ctx.nodes.push({ t: 'path', d: `M${f(x0 - 14)} ${f(hy)}L${f(x0 + 10)} ${f(hy)}L${f(x1 + 14)} -2L${f(x1 - 10)} -2Z`, fill: linear(ctx, x0, hy, x1 + 10, 0, [{ o: 0, c: bandC, a: 0 }, { o: 0.4, c: bandC, a: dark ? 0.2 : 0.3 }, { o: 0.7, c: bandC, a: dark ? 0.14 : 0.2 }, { o: 1, c: bandC, a: 0 }]) });
  const starC = dark ? '#EAF1FF' : '#FFF6EE';
  let small = '';
  let mid = '';
  const nS = ctx.lite ? 40 : 110;
  const stars: Pt[] = [];
  for (let i = 0; i < nS; i++) {
    const x = range(rng, 0, W);
    const y = range(rng, 0, hy - 2) * (0.3 + 0.7 * rng());
    const r = range(rng, 0.14, 0.4) * (ctx.lite ? 1.6 : 1);
    stars.push([x, y]);
    if (i % 5 === 0) mid += dot(x, y, r * 1.4);
    else small += dot(x, y, r);
  }
  moving(ctx, { k: 'wave', period: 3400, min: 0.45 }, () => {
    ctx.nodes.push({ t: 'path', d: small, fill: starC, opacity: 0.75 });
    ctx.nodes.push({ t: 'path', d: mid, fill: starC, opacity: 0.95 });
  });
  // Bright sparkle stars
  let spark = '';
  const sp: [number, number, number][] = [[0.22, 0.16, 2.6], [0.7, 0.1, 2], [0.84, 0.3, 1.6], [0.44, 0.34, 1.3]];
  moving(ctx, { k: 'wave', period: 2300, delay: 700, min: 0.3 }, () => {
    for (const [u, v, s] of sp) {
      spark += sparkle(W * u, H * v, s * (ctx.lite ? 1.4 : 1));
      ctx.nodes.push({ t: 'circle', cx: f(W * u), cy: f(H * v), r: f(s * 1.3), fill: softFill(ctx, mix(starC, tok.accent, 0.2), 0.5) });
    }
    ctx.nodes.push({ t: 'path', d: spark, fill: starC });
  });
  // Far shore with pines
  const shore = pineRow(ctx, (x) => hy - Math.sin(x / 13) * H * 0.01, H * 0.05, H * 0.12, 4.5);
  const shoreC = dark ? mix(pal.land, '#000000', 0.1) : pal.land;
  ctx.nodes.push({ t: 'path', d: shore.d, fill: shoreC });
  // Still lake mirroring the sky
  ctx.nodes.push({ t: 'rect', x: -1, y: f(hy + 0.5), w: W + 2, h: f(H - hy), fill: linear(ctx, 0, hy, 0, H, [{ o: 0, c: mix(pal.skyLow, pal.water, 0.4) }, { o: 1, c: mix(pal.skyTop, pal.water, 0.3) }]) });
  let refl = '';
  for (const [x, y] of stars) {
    const ry = hy + (hy - y) * 0.9 + 1;
    if (ry < H - 0.5 && rng() < 0.7) refl += dot(x, ry, ctx.lite ? 0.35 : 0.22);
  }
  ctx.nodes.push({ t: 'path', d: refl, fill: starC, opacity: 0.4 });
  for (const [u, v, s] of sp) {
    const ry = hy + (hy - H * v) * 0.9 + 1;
    if (ry < H) ctx.nodes.push({ t: 'path', d: sparkle(W * u, ry, s * 0.6), fill: starC, opacity: 0.4 });
  }
  let lines = '';
  for (let i = 0; i < (ctx.lite ? 3 : 6); i++) {
    const y = hy + (H - hy) * range(rng, 0.1, 0.95);
    const x = range(rng, 0, W - 20);
    lines += `M${f(x)} ${f(y)}h${f(range(rng, 8, 22))}`;
  }
  moving(ctx, { k: 'wave', period: 8000, dx: 2, min: 0.5, pri: 2 }, () =>
    ctx.nodes.push({ t: 'path', d: lines, stroke: mix(pal.skyLow, '#FFFFFF', 0.3), sw: sw(ctx, 0.25, 0.45), fill: 'none', opacity: 0.4 }),
  );
}

/** Drift — a small empty rowboat drifting on calm, misty water, a long soft wake behind it. */
function buildDrift(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.5;
  skyAndSun(ctx, hy, { cloudCount: ctx.lite ? 1 : 2 });
  const far = sample(rollingRidge(rng, W, hy - H * 0.01, H * 0.035, 1.1), -6, W + 6, 12);
  ridgeLayer(ctx, far, layerColor(ctx, 0, 5), 0.25);
  drawWater(ctx, hy, true);
  moving(ctx, { k: 'wave', period: 12000, dx: 4, pri: 2 }, () => {
    drawMist(ctx, hy + H * 0.03, 1);
    drawMist(ctx, hy + H * 0.12, 0.6);
  });
  // Boat
  const bx = W * 0.56;
  const by = H * 0.74;
  const L = W * 0.3;
  const d = H * 0.06;
  const hull = `M${f(bx - L / 2)} ${f(by - d * 0.9)}Q${f(bx - L * 0.3)} ${f(by + d * 0.2)} ${f(bx)} ${f(by + d * 0.25)}Q${f(bx + L * 0.35)} ${f(by + d * 0.2)} ${f(bx + L / 2)} ${f(by - d * 1.2)}L${f(bx + L * 0.42)} ${f(by - d * 0.7)}Q${f(bx)} ${f(by - d * 0.45)} ${f(bx - L * 0.44)} ${f(by - d * 0.55)}Z`;
  const wood = dark ? mix(tok.sunrise, pal.land, 0.62) : mix(tok.sunrise, pal.land, 0.5);
  // Reflection first — the boat group bobs gently on the water
  moving(ctx, { k: 'wave', period: 5600, dx: 0.9, dy: 0.35, deg: 0.9, ox: bx, oy: by }, () => {
  ctx.nodes.push({ t: 'path', d: `M${f(bx - L * 0.45)} ${f(by + d * 0.3)}Q${f(bx)} ${f(by + d * 1.6)} ${f(bx + L * 0.46)} ${f(by + d * 0.3)}Z`, fill: mix(wood, pal.water, 0.55), opacity: 0.45 });
  ctx.nodes.push({ t: 'path', d: hull, fill: linear(ctx, 0, by - d * 1.2, 0, by + d * 0.3, [{ o: 0, c: mix(wood, pal.glow, 0.35) }, { o: 1, c: mix(wood, '#000000', 0.25) }]) });
  // Gunwale line + an oar resting across
  ctx.nodes.push({ t: 'path', d: `M${f(bx - L * 0.47)} ${f(by - d * 0.72)}Q${f(bx)} ${f(by - d * 0.35)} ${f(bx + L * 0.46)} ${f(by - d * 1.0)}`, stroke: mix(wood, pal.sun, 0.35), sw: sw(ctx, 0.45, 0.7), fill: 'none', opacity: 0.8 });
  ctx.nodes.push({ t: 'path', d: `M${f(bx - L * 0.18)} ${f(by - d * 0.95)}L${f(bx + L * 0.62)} ${f(by + d * 0.2)}`, stroke: mix(wood, '#000000', 0.2), sw: sw(ctx, 0.7, 1), fill: 'none' });
  ctx.nodes.push({ t: 'path', d: ell(bx + L * 0.6, by + d * 0.18, L * 0.07, d * 0.18), fill: mix(wood, '#000000', 0.2) });
  });
  // Wake: long soft V trailing left, plus ripple rings
  const foam = mix(pal.sun, '#FFFFFF', dark ? 0.1 : 0.4);
  let wake = '';
  for (let k = 0; k < (ctx.lite ? 2 : 4); k++) {
    const s = 1 + k * 0.6;
    wake += `M${f(bx - L * 0.48)} ${f(by)}Q${f(bx - L * (0.9 + 0.2 * k))} ${f(by - H * 0.03 * s)} ${f(bx - L * (1.3 + 0.35 * k))} ${f(by - H * 0.05 * s)}`;
    wake += `M${f(bx - L * 0.48)} ${f(by + d * 0.2)}Q${f(bx - L * (0.9 + 0.2 * k))} ${f(by + H * 0.035 * s)} ${f(bx - L * (1.3 + 0.35 * k))} ${f(by + H * 0.06 * s)}`;
  }
  ctx.nodes.push({ t: 'path', d: wake, stroke: foam, sw: sw(ctx, 0.35, 0.6), fill: 'none', opacity: 0.5 });
  let rip = '';
  for (let k = 0; k < 2; k++) rip += ell(bx, by + d * 0.3, L * (0.62 + 0.18 * k), d * (0.8 + 0.5 * k));
  moving(ctx, { k: 'ripple', period: 5600, s: 0.12, ox: bx, oy: by + d * 0.3, pri: 2 }, () => ctx.nodes.push({ t: 'path', d: rip, stroke: foam, sw: sw(ctx, 0.3, 0.5), fill: 'none', opacity: 0.3 }));
  // A few drifting leaves
  let leaves = '';
  for (let i = 0; i < (ctx.lite ? 2 : 4); i++) leaves += leafShape(range(rng, 8, W - 8), H * range(rng, 0.6, 0.95), H * 0.03, range(rng, -0.5, 0.5));
  moving(ctx, { k: 'wave', period: 9000, dx: 1.5, deg: 3, pri: 3 }, () => ctx.nodes.push({ t: 'path', d: leaves, fill: mix(tok.sunrise, pal.land, 0.4), opacity: 0.7 }));
}

/** Night crickets — a moonlit summer meadow, a cricket on a grass blade, fireflies drifting. */
function buildCrickets(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.62;
  skyAndSun(ctx, hy);
  const far = sample(rollingRidge(rng, W, hy, H * 0.04, 1.2), -6, W + 6, 10);
  ridgeLayer(ctx, far, layerColor(ctx, 1, 5), 0.3);
  drawMist(ctx, hy + H * 0.02, 0.7);
  const meadow = sample(rollingRidge(rng, W, H * 0.76, H * 0.02), -6, W + 6, 12);
  ridgeLayer(ctx, meadow, layerColor(ctx, 2.5, 5), 0.6);
  // Tall grass silhouettes
  const grassC = dark ? mix(pal.land, '#000000', 0.15) : pal.land;
  let grass = '';
  for (let i = 0; i < (ctx.lite ? 14 : 34); i++) {
    const x = range(rng, -2, W + 2);
    const h = H * range(rng, 0.14, 0.34);
    const lean = range(rng, -5, 5);
    grass += taper([[x, H + 1], [x + lean * 0.3, H - h * 0.5], [x + lean, H - h]], H * 0.012, H * 0.001);
  }
  moving(ctx, { k: 'wave', period: 6600, deg: 1, ox: W / 2, oy: H + 2, pri: 2 }, () => ctx.nodes.push({ t: 'path', d: grass, fill: grassC }));
  // The perch: one long blade arcing in from the right
  const blade: Pt[] = [[W * 0.9, H + 2], [W * 0.78, H * 0.78], [W * 0.6, H * 0.64], [W * 0.4, H * 0.62]];
  ctx.nodes.push({ t: 'path', d: taper(blade, H * 0.03, H * 0.004), fill: grassC });
  // Cricket on the blade (facing left)
  const cx = W * 0.6;
  const cy = H * 0.62;
  const s = H * (ctx.lite ? 0.075 : 0.062);
  const bug = dark ? mix(pal.land, tok.calm, 0.12) : mix(pal.land, '#000000', 0.1);
  let body = ell(cx + s * 0.4, cy - s * 0.35, s * 1.25, s * 0.42); // abdomen + wings
  body += dot(cx - s * 0.95, cy - s * 0.45, s * 0.36); // head
  body += ell(cx - s * 0.45, cy - s * 0.42, s * 0.42, s * 0.34); // thorax
  ctx.nodes.push({ t: 'path', d: body, fill: bug });
  const legs =
    `M${f(cx + s * 0.5)} ${f(cy - s * 0.5)}L${f(cx + s * 1.3)} ${f(cy - s * 1.25)}L${f(cx + s * 1.7)} ${f(cy + s * 0.05)}` + // big hind leg
    `M${f(cx - s * 0.3)} ${f(cy - s * 0.2)}L${f(cx - s * 0.55)} ${f(cy + s * 0.12)}M${f(cx - s * 0.6)} ${f(cy - s * 0.25)}L${f(cx - s * 1.0)} ${f(cy + s * 0.1)}` +
    `M${f(cx - s * 1.2)} ${f(cy - s * 0.65)}Q${f(cx - s * 2.2)} ${f(cy - s * 2.2)} ${f(cx - s * 0.6)} ${f(cy - s * 3)}` + // antennae
    `M${f(cx - s * 1.15)} ${f(cy - s * 0.7)}Q${f(cx - s * 2.6)} ${f(cy - s * 1.6)} ${f(cx - s * 2.8)} ${f(cy - s * 2.6)}`;
  ctx.nodes.push({ t: 'path', d: legs, stroke: bug, sw: sw(ctx, 0.45, 0.7), fill: 'none' });
  // Moonlit rim on the back + wing vein
  const rimC = mix(pal.sun, '#FFFFFF', 0.2);
  ctx.nodes.push({ t: 'path', d: `M${f(cx - s * 0.7)} ${f(cy - s * 0.78)}Q${f(cx + s * 0.4)} ${f(cy - s * 0.95)} ${f(cx + s * 1.5)} ${f(cy - s * 0.5)}`, stroke: rimC, sw: sw(ctx, 0.35, 0.55), fill: 'none', opacity: 0.6 });
  // Fireflies
  const fly = mix(tok.warning, pal.sun, 0.35);
  // Fireflies twinkle and drift in two out-of-step sets.
  const flies: Pt[] = [];
  for (let i = 0; i < (ctx.lite ? 4 : 9); i++) flies.push([range(rng, 4, W - 4), H * range(rng, 0.45, 0.85)]);
  const drawFlies = (set: Pt[]) => {
    for (const [x, y] of set) {
      ctx.nodes.push({ t: 'circle', cx: f(x), cy: f(y), r: f(H * 0.025), fill: softFill(ctx, fly, 0.6) });
      ctx.nodes.push({ t: 'circle', cx: f(x), cy: f(y), r: f(ctx.lite ? 0.8 : 0.5), fill: fly });
    }
  };
  moving(ctx, { k: 'wave', period: 2600, min: 0.15, dy: -1.6, dx: 0.8 }, () => drawFlies(flies.filter((_, i) => i % 2 === 0)));
  moving(ctx, { k: 'wave', period: 3100, delay: 1300, min: 0.15, dy: 1.4, dx: -1 }, () => drawFlies(flies.filter((_, i) => i % 2 === 1)));
}

/** Snow morning — soft snowfall over drifts and snowy pines, a small bird on a snow-capped branch. */
function buildSnow(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.62;
  skyAndSun(ctx, hy);
  const snowC = dark ? mix(pal.cloud, '#DCE8FF', 0.55) : mix('#FFFFFF', pal.skyLow, 0.18);
  const snowShade = dark ? mix(snowC, pal.skyTop, 0.45) : mix(snowC, pal.cloudShade, 0.45);
  // Far pines, softened by falling snow
  const farPines = pineRow(ctx, (x) => hy + Math.sin(x / 11) * H * 0.012, H * 0.08, H * 0.16, 5);
  ctx.nodes.push({ t: 'path', d: farPines.d, fill: mix(layerColor(ctx, 1, 4), snowShade, 0.35) });
  drawMist(ctx, hy + H * 0.01, 1);
  // Drifts
  for (let i = 0; i < 2; i++) {
    const pts = sample(rollingRidge(rng, W, H * (0.72 + 0.12 * i), H * 0.03, 0.9), -6, W + 6, 12);
    const top = Math.min(...pts.map((p) => p[1]));
    ctx.nodes.push({ t: 'path', d: closeTo(smoothLine(pts), pts, H + 2), fill: linear(ctx, 0, top, 0, H, [{ o: 0, c: mix(snowC, pal.glow, i ? 0.12 : 0.2) }, { o: 1, c: mix(snowC, snowShade, i ? 0.3 : 0.6) }]) });
  }
  // Branch from the right edge with snow caps
  const bark = dark ? mix(pal.land, '#000000', 0.1) : mix(pal.land, tok.sunrise, 0.15);
  const branch: Pt[] = [[W + 3, H * 0.34], [W * 0.78, H * 0.4], [W * 0.56, H * 0.43], [W * 0.36, H * 0.42]];
  ctx.nodes.push({ t: 'path', d: taper(branch, H * 0.04, H * 0.01), fill: bark });
  const twig: Pt[] = [[W * 0.7, H * 0.415], [W * 0.62, H * 0.33], [W * 0.58, H * 0.27]];
  ctx.nodes.push({ t: 'path', d: taper(twig, H * 0.014, H * 0.004), fill: bark });
  let caps = '';
  for (const [x, y, l] of [[W * 0.86, H * 0.365, 0.12], [W * 0.66, H * 0.405, 0.1], [W * 0.46, H * 0.415, 0.08], [W * 0.62, H * 0.325, 0.05]] as const) {
    caps += `M${f(x - W * l * 0.5)} ${f(y)}Q${f(x)} ${f(y - H * 0.035)} ${f(x + W * l * 0.5)} ${f(y)}Z`;
  }
  ctx.nodes.push({ t: 'path', d: caps, fill: snowC });
  // Bird on the branch (robin-like breast from the calm/sunrise token)
  drawPerchedBird(ctx, W * 0.52, H * 0.43 - H * 0.01, H * 0.055, 1, bark);
  // Falling snow
  let flakes = '';
  let big = '';
  for (let i = 0; i < (ctx.lite ? 26 : 80); i++) {
    const x = range(rng, 0, W);
    const y = range(rng, 0, H);
    const r = range(rng, 0.2, 0.55) * (ctx.lite ? 1.6 : 1);
    if (i % 6 === 0) big += dot(x, y, r * 1.6);
    else flakes += dot(x, y, r);
  }
  const flakeC = dark ? '#EEF4FF' : '#FFFFFF';
  // Snow falls: the flake field loops by the frame height, drifting a little sideways.
  moving(ctx, { k: 'loop', period: 16000, dx: 3, dy: H }, () => {
    // A faint cool shadow keeps white flakes readable over white snow
    if (!dark) ctx.nodes.push({ t: 'path', d: flakes + big, fill: pal.cloudShade, opacity: 0.35 });
    ctx.nodes.push({ t: 'path', d: flakes, fill: flakeC, opacity: 0.9 });
    ctx.nodes.push({ t: 'path', d: big, fill: flakeC, opacity: 0.65 });
  });
}

/** Night stream — a small stream running over stones between dark pines, moonlight glinting. */
function buildStream(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.46;
  skyAndSun(ctx, hy);
  const pinesFar = pineRow(ctx, (x) => hy + Math.sin(x / 9) * H * 0.015, H * 0.12, H * 0.22, 4.5);
  ctx.nodes.push({ t: 'path', d: pinesFar.d, fill: layerColor(ctx, 1.5, 4) });
  drawMist(ctx, hy + H * 0.05, 0.8);
  const bankC = layerColor(ctx, 2.5, 4);
  ctx.nodes.push({ t: 'rect', x: -1, y: f(hy + H * 0.04), w: W + 2, h: f(H), fill: linear(ctx, 0, hy, 0, H, [{ o: 0, c: mix(bankC, pal.haze, 0.2) }, { o: 1, c: mix(bankC, pal.land, 0.5) }]) });
  // The stream: narrow at the back, wide in front, snaking
  const [sx] = sunPos(ctx);
  const steps = 14;
  const Lp: Pt[] = [];
  const Rp: Pt[] = [];
  const ph = range(rng, 0, Math.PI);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = hy + H * 0.05 + (H + 2 - hy - H * 0.05) * t ** 1.2;
    const x = W * 0.5 + Math.sin(t * Math.PI * 2 + ph) * W * 0.12 * (0.3 + t);
    const w = 1 + t * W * 0.5;
    Lp.push([x - w / 2, y]);
    Rp.push([x + w / 2, y]);
  }
  const streamD = `${smoothLine(Lp)}L${f(Rp[Rp.length - 1]![0])} ${f(Rp[Rp.length - 1]![1])}${smoothLine([...Rp].reverse()).replace(/^M[^C]*/, '')}Z`;
  ctx.nodes.push({ t: 'path', d: streamD, fill: linear(ctx, 0, hy, 0, H, [{ o: 0, c: mix(pal.horizon, pal.water, 0.3) }, { o: 1, c: mix(pal.water, pal.skyMid, 0.3) }]) });
  // Stones in and along the water
  const stone = mix(pal.land, pal.haze, dark ? 0.2 : 0.3);
  const foam = mix(pal.sun, '#FFFFFF', dark ? 0.2 : 0.5);
  let flecks = '';
  const nSt = ctx.lite ? 6 : 11;
  for (let i = 0; i < nSt; i++) {
    const t = 0.25 + (0.75 * i) / nSt + range(rng, -0.03, 0.03);
    const k = Math.min(steps, Math.round(t * steps));
    const l = Lp[k]!;
    const r = Rp[k]!;
    const x = i % 3 === 0 ? l[0] + range(rng, -2, 2) : i % 3 === 1 ? r[0] + range(rng, -2, 2) : l[0] + (r[0] - l[0]) * range(rng, 0.3, 0.7);
    const y = l[1];
    const rx = (0.8 + t * 5) * range(rng, 0.8, 1.2) * (ctx.lite ? 1.2 : 1);
    const ry = rx * 0.55;
    ctx.nodes.push({ t: 'ellipse', cx: f(x), cy: f(y), rx: f(rx), ry: f(ry), fill: linear(ctx, 0, y - ry, 0, y + ry, [{ o: 0, c: mix(stone, pal.sun, 0.3) }, { o: 1, c: mix(stone, '#000000', 0.25) }]) });
    flecks += `M${f(x - rx * 1.3)} ${f(y + ry * 0.6)}q${f(rx * 0.4)} ${f(-ry * 0.4)} ${f(rx * 0.8)} 0M${f(x + rx * 0.5)} ${f(y + ry * 0.7)}q${f(rx * 0.4)} ${f(-ry * 0.3)} ${f(rx * 0.9)} 0`;
  }
  moving(ctx, { k: 'wave', period: 2200, dx: 0.9, dy: 0.4, min: 0.4 }, () => ctx.nodes.push({ t: 'path', d: flecks, stroke: foam, sw: sw(ctx, 0.35, 0.6), fill: 'none', opacity: 0.8 }));
  // Moon glint on the water
  const gx = clamp(sx, W * 0.35, W * 0.65);
  moving(ctx, { k: 'wave', period: 3600, delay: 600, min: 0.55, sx: 0.12, ox: gx, oy: H * 0.7 }, () =>
    ctx.nodes.push({ t: 'ellipse', cx: f(gx), cy: f(H * 0.7), rx: f(W * 0.12), ry: f(H * 0.03), fill: softFill(ctx, pal.sun, dark ? 0.4 : 0.55) }),
  );
  // Near pines framing both sides
  const nearC = dark ? mix(pal.land, '#000000', 0.2) : pal.land;
  for (const side of [0, 1]) {
    const x = side ? W * 0.95 : W * 0.04;
    const h = H * 0.7;
    let d = '';
    for (let k = 0; k < 5; k++) {
      const t0 = H + 2 - h * (k / 5) * 0.85;
      const t1 = H + 2 - h * ((k + 1) / 5) - h * 0.08;
      const ww = W * 0.12 * (1 - k * 0.16);
      d += `M${f(x - ww)} ${f(t0)}L${f(x)} ${f(t1)}L${f(x + ww)} ${f(t0)}Z`;
    }
    ctx.nodes.push({ t: 'path', d, fill: nearC });
  }
  void tok;
}

/** Distant thunder — a far storm cell over the hills, lit from within, rain curtains trailing below. */
function buildThunder(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.64;
  drawSky(ctx, hy);
  drawGlow(ctx, ctx.nodes, 0.4);
  // Storm cell: tall cloud mass on the horizon
  const cx = W * 0.58;
  const lit = mix(pal.cloud, pal.glow, 0.15);
  const shade = mix(pal.cloudShade, pal.skyTop, 0.3);
  const cells: [number, number, number][] = [[-0.32, 0.46, 30], [0.02, 0.4, 40], [0.34, 0.47, 30], [-0.1, 0.3, 30], [0.16, 0.26, 26]];
  for (const [u, v, w] of cells) cloudPuff(ctx, cx + u * W, H * v, w * (ctx.lite ? 1.1 : 1), lit, shade, { lumps: 5, tall: 1.1 });
  // Inner glow
  const flash = mix(tok.warning, pal.sun, 0.5);
  moving(ctx, { k: 'flash', period: 5600, min: 0.35 }, () =>
    ctx.nodes.push({ t: 'ellipse', cx: f(cx + W * 0.06), cy: f(H * 0.34), rx: f(W * 0.18), ry: f(H * 0.12), fill: softFill(ctx, flash, dark ? 0.45 : 0.5) }),
  );
  // Rain curtains trailing under the cell
  const rainC = mix(pal.cloudShade, pal.skyLow, 0.3);
  for (let i = 0; i < 3; i++) {
    const x = cx - W * 0.3 + i * W * 0.2 + range(rng, -3, 3);
    const w = range(rng, 12, 20);
    ctx.nodes.push({ t: 'path', d: `M${f(x)} ${f(H * 0.46)}L${f(x + w)} ${f(H * 0.46)}L${f(x + w - 6)} ${f(hy + 1)}L${f(x - 6)} ${f(hy + 1)}Z`, fill: linear(ctx, 0, H * 0.46, 0, hy, [{ o: 0, c: rainC, a: dark ? 0.45 : 0.5 }, { o: 1, c: rainC, a: 0.1 }]) });
  }
  // Faint forked bolt, far away
  const bx = cx + W * 0.12;
  const bolt = `M${f(bx)} ${f(H * 0.44)}L${f(bx - 2)} ${f(H * 0.5)}L${f(bx + 1)} ${f(H * 0.52)}L${f(bx - 1.5)} ${f(H * 0.6)}M${f(bx + 1)} ${f(H * 0.52)}L${f(bx + 4)} ${f(H * 0.57)}`;
  moving(ctx, { k: 'flash', period: 5600, min: 0 }, () =>
    ctx.nodes.push({ t: 'path', d: bolt, stroke: mix(flash, '#FFFFFF', 0.5), sw: sw(ctx, 0.5, 0.8), fill: 'none', opacity: 0.85 }),
  );
  // Hills + quiet meadow in front
  for (let i = 0; i < 2; i++) {
    const pts = sample(rollingRidge(rng, W, hy + H * 0.05 * i, H * 0.04, 1), -6, W + 6, 10);
    ridgeLayer(ctx, pts, layerColor(ctx, i, 4), (i + 1) / 4);
    drawMist(ctx, hy + H * (0.02 + 0.05 * i), 0.8);
  }
  const meadow = sample(rollingRidge(rng, W, H * 0.86, H * 0.02), -6, W + 6, 12);
  ridgeLayer(ctx, meadow, layerColor(ctx, 3, 4, mix(pal.land, tok.calm, 0.1)), 1);
  // Light near rain
  let streaks = '';
  for (let i = 0; i < (ctx.lite ? 18 : 60); i++) {
    const x = range(rng, -4, W + 6);
    const y = range(rng, -4, H * 0.9);
    const l = range(rng, 3, 6);
    streaks += `M${f(x)} ${f(y)}l${f(-l * 0.1)} ${f(l)}`;
  }
  const fallY = H * 0.9 + 4;
  moving(ctx, { k: 'loop', period: 1300, dx: -fallY * 0.1, dy: fallY, clip: [-12, -4, W + 24, fallY + 6] }, () =>
    ctx.nodes.push({ t: 'path', d: streaks, stroke: dark ? mix(pal.cloud, tok.accent, 0.2) : mix(pal.cloudShade, pal.water, 0.35), sw: ctx.lite ? 0.5 : 0.28, fill: 'none', opacity: 0.45 }),
  );
}

/** After the rain — close glossy leaves beaded with drops, light breaking through the wet forest. */
function buildAfterRain(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.7;
  drawSky(ctx, hy);
  drawGlow(ctx, ctx.nodes, 1);
  drawRays(ctx);
  // Soft out-of-focus forest behind
  const bok = layerColor(ctx, 1, 4, mix(pal.land, tok.calm, 0.2));
  for (let i = 0; i < (ctx.lite ? 6 : 14); i++) {
    ctx.nodes.push({ t: 'circle', cx: f(range(rng, -5, W + 5)), cy: f(H * range(rng, 0.3, 0.95)), r: f(H * range(rng, 0.08, 0.2)), fill: softFill(ctx, bok, 0.7) });
  }
  const [sx, sy] = sunPos(ctx);
  moving(ctx, { k: 'wave', period: 3200, min: 0.45, dy: -0.8, pri: 2 }, () => {
    for (let i = 0; i < (ctx.lite ? 3 : 7); i++) {
      ctx.nodes.push({ t: 'circle', cx: f(sx + range(rng, -25, 25)), cy: f(sy + range(rng, -10, 25)), r: f(H * range(rng, 0.02, 0.05)), fill: softFill(ctx, pal.sun, 0.55) });
    }
  });
  // Big leaves from the lower-left and upper-right
  const leafC = dark ? mix(pal.land, tok.calm, 0.3) : mix(pal.land, tok.calm, 0.3);
  const leafLit = mix(leafC, pal.glow, dark ? 0.25 : 0.35);
  const bigLeaf = (x: number, y: number, l: number, a: number) => {
    const d = leafShape(x, y, l, a);
    ctx.nodes.push({ t: 'path', d, fill: linear(ctx, x - l / 2, y - l / 3, x + l / 2, y + l / 3, [{ o: 0, c: leafLit }, { o: 1, c: mix(leafC, '#000000', 0.2) }]) });
    const c = Math.cos(a);
    const s = Math.sin(a);
    ctx.nodes.push({ t: 'path', d: `M${f(x - (l / 2) * c)} ${f(y - (l / 2) * s)}L${f(x + (l / 2) * c)} ${f(y + (l / 2) * s)}`, stroke: mix(leafLit, pal.sun, 0.3), sw: sw(ctx, 0.35, 0.6), fill: 'none', opacity: 0.7 });
    return { tip: [x + (l / 2) * c, y + (l / 2) * s] as Pt };
  };
  const stem: Pt[] = [[-2, H * 0.98], [W * 0.18, H * 0.78], [W * 0.34, H * 0.66]];
  ctx.nodes.push({ t: 'path', d: taper(stem, H * 0.02, H * 0.008), fill: leafC });
  const l1 = bigLeaf(W * 0.44, H * 0.6, H * 0.5, 0.35);
  bigLeaf(W * 0.2, H * 0.72, H * 0.34, -0.9);
  const l3 = bigLeaf(W * 0.82, H * 0.2, H * 0.42, 2.6);
  // Drops: hanging from tips, beads on the leaves
  const dropC = mix(pal.skyLow, '#FFFFFF', 0.5);
  const drop = (x: number, y: number, r: number) => {
    ctx.nodes.push({ t: 'path', d: `M${f(x)} ${f(y - r * 1.8)}Q${f(x + r * 0.2)} ${f(y - r * 0.9)} ${f(x + r)} ${f(y)}A${f(r)} ${f(r)} 0 1 1 ${f(x - r)} ${f(y)}Q${f(x - r * 0.2)} ${f(y - r * 0.9)} ${f(x)} ${f(y - r * 1.8)}Z`, fill: dropC, opacity: dark ? 0.7 : 0.8 });
    ctx.nodes.push({ t: 'circle', cx: f(x - r * 0.35), cy: f(y - r * 0.2), r: f(r * 0.3), fill: '#FFFFFF', opacity: 0.85 });
  };
  const dr = H * 0.028 * (ctx.lite ? 1.3 : 1);
  moving(ctx, { k: 'wave', period: 2800, sy: 0.12, ox: l1.tip[0] + dr * 0.3, oy: l1.tip[1] + dr * 0.2, pri: 2 }, () => drop(l1.tip[0] + dr * 0.3, l1.tip[1] + dr * 2, dr));
  drop(l3.tip[0], l3.tip[1] + dr * 2, dr * 0.85);
  let beads = '';
  for (let i = 0; i < (ctx.lite ? 4 : 10); i++) {
    const u = range(rng, -0.35, 0.35);
    const x = W * 0.44 + Math.cos(0.35) * H * 0.5 * u + range(rng, -2, 2);
    const y = H * 0.6 + Math.sin(0.35) * H * 0.5 * u + range(rng, -2, 2);
    beads += dot(x, y, H * range(rng, 0.006, 0.013));
  }
  ctx.nodes.push({ t: 'path', d: beads, fill: dropC, opacity: 0.85 });
  // Falling drop
  moving(ctx, { k: 'rise', period: 2400, dy: H * 0.09 }, () => drop(W * 0.62, H * 0.9, dr * 0.6));
}

/** Hearth — a stone fireplace indoors, logs burning low under the mantel, warm light on the floor. */
function buildHearth(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const floorY = H * 0.84;
  // Room wall
  const wall = dark ? mix(tok.bg, tok.sunrise, 0.1) : mix('#FFF4EA', tok.sunrise, 0.22);
  ctx.nodes.push({ t: 'rect', x: -1, y: -1, w: W + 2, h: f(H + 2), fill: linear(ctx, 0, 0, 0, floorY, [{ o: 0, c: mix(wall, '#000000', dark ? 0.25 : 0.08) }, { o: 1, c: wall }]) });
  // Floor boards
  const floorC = dark ? mix(tok.bg, tok.sunrise, 0.2) : mix(tok.sunrise, pal.land, 0.4);
  ctx.nodes.push({ t: 'rect', x: -1, y: f(floorY), w: W + 2, h: f(H - floorY + 1), fill: linear(ctx, 0, floorY, 0, H, [{ o: 0, c: mix(floorC, tok.warning, 0.2) }, { o: 1, c: mix(floorC, '#000000', 0.3) }]) });
  let boards = '';
  for (let i = -6; i <= 6; i++) boards += `M${f(W / 2 + i * 3)} ${f(floorY)}L${f(W / 2 + i * 14)} ${f(H + 1)}`;
  ctx.nodes.push({ t: 'path', d: boards, stroke: mix(floorC, '#000000', 0.3), sw: sw(ctx, 0.3, 0.5), fill: 'none', opacity: 0.4 });
  // Stone surround
  const cx = W / 2;
  const sw0 = W * 0.64;
  const top = H * 0.24;
  const stone = dark ? mix(pal.haze, tok.bg, 0.3) : mix(pal.haze, '#FFFFFF', 0.2);
  ctx.nodes.push({ t: 'rect', x: f(cx - sw0 / 2), y: f(top), w: f(sw0), h: f(floorY - top), fill: mix(stone, '#000000', 0.2) });
  let blocks = '';
  const rows = ctx.lite ? 5 : 7;
  const rh = (floorY - top) / rows;
  for (let r = 0; r < rows; r++) {
    let x = cx - sw0 / 2 + (r % 2 ? -rh * 0.6 : 0);
    while (x < cx + sw0 / 2) {
      const w = rh * range(rng, 1.3, 2.1);
      const x0 = Math.max(x, cx - sw0 / 2) + 0.4;
      const x1 = Math.min(x + w, cx + sw0 / 2) - 0.4;
      if (x1 > x0 + 0.5) blocks += `M${f(x0 + 0.6)} ${f(top + r * rh + 0.4)}H${f(x1 - 0.6)}Q${f(x1)} ${f(top + r * rh + 0.4)} ${f(x1)} ${f(top + r * rh + 1)}V${f(top + (r + 1) * rh - 1)}Q${f(x1)} ${f(top + (r + 1) * rh - 0.4)} ${f(x1 - 0.6)} ${f(top + (r + 1) * rh - 0.4)}H${f(x0 + 0.6)}Q${f(x0)} ${f(top + (r + 1) * rh - 0.4)} ${f(x0)} ${f(top + (r + 1) * rh - 1)}V${f(top + r * rh + 1)}Q${f(x0)} ${f(top + r * rh + 0.4)} ${f(x0 + 0.6)} ${f(top + r * rh + 0.4)}Z`;
      x += w;
    }
  }
  ctx.nodes.push({ t: 'path', d: blocks, fill: linear(ctx, 0, top, 0, floorY, [{ o: 0, c: stone }, { o: 1, c: mix(stone, tok.warning, 0.25) }]) });
  // Mantel beam
  const beam = dark ? mix(tok.sunrise, tok.bg, 0.6) : mix(tok.sunrise, pal.land, 0.5);
  ctx.nodes.push({ t: 'rect', x: f(cx - sw0 * 0.6), y: f(top - H * 0.05), w: f(sw0 * 1.2), h: f(H * 0.06), rx: 0.6, fill: linear(ctx, 0, top - H * 0.05, 0, top + H * 0.01, [{ o: 0, c: mix(beam, '#FFFFFF', 0.15) }, { o: 1, c: mix(beam, '#000000', 0.25) }]) });
  // Candle on the mantel
  const cX = cx + sw0 * 0.4;
  ctx.nodes.push({ t: 'rect', x: f(cX - 1.2), y: f(top - H * 0.13), w: 2.4, h: f(H * 0.08), rx: 0.4, fill: mix('#FFFFFF', tok.sunrise, 0.15) });
  moving(ctx, { k: 'flicker', period: 1600, s: 0.12, min: 0.8, ox: cX, oy: top - H * 0.13, pri: 2 }, () => {
    ctx.nodes.push({ t: 'circle', cx: f(cX), cy: f(top - H * 0.15), r: f(H * 0.04), fill: softFill(ctx, tok.warning, 0.5) });
    ctx.nodes.push({ t: 'path', d: leafShape(cX, top - H * 0.15, H * 0.035, -Math.PI / 2), fill: mix(tok.warning, pal.sun, 0.4) });
  });
  // Arched firebox
  const ow = sw0 * 0.56;
  const oTop = top + (floorY - top) * 0.28;
  const oBot = floorY - H * 0.02;
  const arch = `M${f(cx - ow / 2)} ${f(oBot)}V${f(oTop + ow * 0.3)}Q${f(cx - ow / 2)} ${f(oTop)} ${f(cx)} ${f(oTop)}Q${f(cx + ow / 2)} ${f(oTop)} ${f(cx + ow / 2)} ${f(oTop + ow * 0.3)}V${f(oBot)}Z`;
  ctx.nodes.push({ t: 'path', d: arch, fill: linear(ctx, 0, oTop, 0, oBot, [{ o: 0, c: dark ? '#05070C' : mix(pal.land, '#000000', 0.5) }, { o: 1, c: mix(tok.sunrise, '#000000', 0.55) }]) });
  // Fire glow + flames + logs
  const fire = tok.sunrise;
  const hot = tok.warning;
  const baseY = oBot - H * 0.03;
  moving(ctx, { k: 'flicker', period: 1500, min: 0.7, s: 0.04, ox: cx, oy: baseY, pri: 2 }, () =>
    ctx.nodes.push({ t: 'ellipse', cx: f(cx), cy: f(baseY - H * 0.06), rx: f(ow * 0.5), ry: f(H * 0.14), fill: softFill(ctx, mix(hot, fire, 0.3), 0.6) }),
  );
  const fh = (oBot - oTop) * 0.62;
  const flame = (w: number, h: number, dx: number, lean: number) => {
    const x0 = cx + dx;
    const y0 = baseY - H * 0.01;
    return `M${f(x0 - w)} ${f(y0)}C${f(x0 - w * 1.05)} ${f(y0 - h * 0.45)} ${f(x0 - w * 0.2 + lean * 0.5)} ${f(y0 - h * 0.6)} ${f(x0 + lean)} ${f(y0 - h)}C${f(x0 + w * 0.35 + lean * 0.4)} ${f(y0 - h * 0.62)} ${f(x0 + w * 1.05)} ${f(y0 - h * 0.42)} ${f(x0 + w)} ${f(y0)}Z`;
  };
  const flameBase = baseY - H * 0.01;
  moving(ctx, { k: 'flicker', period: 1300, s: 0.07, min: 0.85, ox: cx, oy: flameBase }, () =>
    ctx.nodes.push({ t: 'path', d: flame(ow * 0.2, fh, 0, 1.5) + flame(ow * 0.13, fh * 0.7, -ow * 0.18, -2) + flame(ow * 0.13, fh * 0.66, ow * 0.18, 2.5), fill: fire, opacity: 0.95 }),
  );
  moving(ctx, { k: 'flicker', period: 1000, delay: 400, s: 0.1, min: 0.9, ox: cx, oy: flameBase }, () => {
    ctx.nodes.push({ t: 'path', d: flame(ow * 0.12, fh * 0.66, 0, 1) + flame(ow * 0.07, fh * 0.45, -ow * 0.14, -1.5), fill: mix(hot, fire, 0.2) });
    ctx.nodes.push({ t: 'path', d: flame(ow * 0.06, fh * 0.4, ow * 0.01, 0.8), fill: mix(pal.sun, hot, 0.25) });
  });
  const wood = mix(tok.sunrise, '#000000', 0.5);
  ctx.nodes.push({ t: 'path', d: taper([[cx - ow * 0.4, baseY + H * 0.01], [cx, baseY - H * 0.005], [cx + ow * 0.4, baseY - H * 0.02]], H * 0.035, H * 0.03), fill: wood });
  ctx.nodes.push({ t: 'path', d: taper([[cx + ow * 0.38, baseY + H * 0.012], [cx, baseY + H * 0.004], [cx - ow * 0.36, baseY - H * 0.016]], H * 0.032, H * 0.028), fill: mix(wood, hot, 0.15) });
  // Hearth stone + warm pool of light on the floor
  ctx.nodes.push({ t: 'rect', x: f(cx - sw0 * 0.58), y: f(floorY - H * 0.01), w: f(sw0 * 1.16), h: f(H * 0.035), rx: 0.5, fill: mix(stone, '#000000', 0.15) });
  ctx.nodes.push({ t: 'ellipse', cx: f(cx), cy: f(floorY + H * 0.08), rx: f(W * 0.45), ry: f(H * 0.08), fill: softFill(ctx, mix(hot, fire, 0.3), dark ? 0.4 : 0.35) });
}

/** Rain on the eaves — under a porch roof: rain streaming off the shingle edge, a garden softened by rain. */
function buildEaves(ctx: Ctx) {
  const { W, H, pal, tok, rng, mode } = ctx;
  const dark = mode === 'dark';
  const hy = H * 0.66;
  drawSky(ctx, hy);
  drawGlow(ctx, ctx.nodes, 0.5);
  const far = sample(rollingRidge(rng, W, hy, H * 0.05), -6, W + 6, 10);
  ridgeLayer(ctx, far, layerColor(ctx, 0, 5), 0.2);
  drawMist(ctx, hy, 1);
  canopyRow(ctx, rollingRidge(rng, W, H * 0.76, H * 0.02), H * 0.05, 7, layerColor(ctx, 1, 4.5), 0.45);
  drawMist(ctx, H * 0.76, 0.9);
  const lawn = sample((x) => H * 0.84 + Math.sin(x / 13) * H * 0.006, -6, W + 6, 14);
  ridgeLayer(ctx, lawn, layerColor(ctx, 2.2, 4.5, mix(pal.land, tok.calm, 0.1)), 0.75);
  // Distant rain streaks
  let fine = '';
  for (let i = 0; i < (ctx.lite ? 20 : 70); i++) {
    const x = range(rng, -4, W + 6);
    const y = range(rng, H * 0.2, H * 0.95);
    const l = range(rng, 2.5, 5);
    fine += `M${f(x)} ${f(y)}l${f(-l * 0.06)} ${f(l)}`;
  }
  const rainC = dark ? mix(pal.cloud, tok.accent, 0.2) : mix(pal.cloudShade, pal.water, 0.35);
  const fineY = H * 0.75;
  moving(ctx, { k: 'loop', period: 1500, dx: -fineY * 0.06, dy: fineY, clip: [-12, H * 0.2, W + 24, H * 0.8] }, () =>
    ctx.nodes.push({ t: 'path', d: fine, stroke: rainC, sw: ctx.lite ? 0.45 : 0.25, fill: 'none', opacity: 0.45 }),
  );
  // Roof edge across the top: underside, fascia board, shingle scallops, gutter
  const roofC = dark ? mix(pal.land, '#000000', 0.25) : mix(pal.land, tok.sunrise, 0.12);
  const eaveY = H * 0.2;
  ctx.nodes.push({ t: 'path', d: `M-2 -2H${f(W + 2)}V${f(eaveY - H * 0.06)}L-2 ${f(eaveY + H * 0.01)}Z`, fill: mix(roofC, pal.haze, 0.15) });
  let scallop = '';
  const n = ctx.lite ? 7 : 12;
  for (let i = 0; i <= n; i++) {
    const x = (W / n) * i;
    const y = eaveY - H * 0.06 + ((eaveY + H * 0.01) - (eaveY - H * 0.06)) * (1 - i / n);
    scallop += ell(x, y - H * 0.02, W / n / 2, H * 0.03);
  }
  ctx.nodes.push({ t: 'path', d: scallop, fill: roofC });
  // Gutter (slightly below the scallops, sloping)
  const g0 = eaveY + H * 0.025;
  const g1 = eaveY - H * 0.045;
  const gutterC = dark ? mix(pal.haze, tok.bg, 0.4) : mix(pal.haze, '#FFFFFF', 0.25);
  ctx.nodes.push({ t: 'path', d: `M-2 ${f(g0)}L${f(W + 2)} ${f(g1)}L${f(W + 2)} ${f(g1 + H * 0.04)}L-2 ${f(g0 + H * 0.04)}Z`, fill: gutterC });
  ctx.nodes.push({ t: 'path', d: `M-2 ${f(g0 + H * 0.04)}L${f(W + 2)} ${f(g1 + H * 0.04)}`, stroke: mix(gutterC, '#000000', 0.3), sw: sw(ctx, 0.4, 0.7), fill: 'none', opacity: 0.6 });
  // Water spilling over the gutter lip: long streams + drips
  const waterC = mix(pal.skyLow, '#FFFFFF', dark ? 0.25 : 0.5);
  let streams = '';
  let drips = '';
  const nS = ctx.lite ? 5 : 9;
  for (let i = 0; i < nS; i++) {
    const x = (W / nS) * (i + 0.5) + range(rng, -3, 3);
    const y0 = g0 + (g1 - g0) * (x / W) + H * 0.04;
    // A short spill off the lip, then a broken train of drops falling away
    const len = H * range(rng, 0.05, 0.14);
    streams += `M${f(x)} ${f(y0)}q${f(0.4)} ${f(len * 0.5)} ${f(0.2)} ${f(len)}`;
    let y = y0 + len;
    const fall = H * range(rng, 0.3, 0.6);
    while (y < y0 + len + fall) {
      const seg = H * range(rng, 0.02, 0.05);
      streams += `M${f(x + 0.2)} ${f(y + H * 0.02)}l0 ${f(seg)}`;
      y += seg + H * range(rng, 0.03, 0.06);
    }
    drips += dot(x + 0.2, y + H * 0.03, ctx.lite ? 0.8 : 0.55);
  }
  // Water keeps spilling off the gutter: the drip trains slide down and fade, then refill.
  moving(ctx, { k: 'rise', period: 1300, dy: H * 0.06 }, () => {
    ctx.nodes.push({ t: 'path', d: streams, stroke: waterC, sw: sw(ctx, 0.45, 0.75), fill: 'none', opacity: 0.85 });
    ctx.nodes.push({ t: 'path', d: drips, fill: waterC, opacity: 0.85 });
  });
  // Splash puddle along the bottom
  const py = H * 0.94;
  ctx.nodes.push({ t: 'path', d: ell(W * 0.5, py, W * 0.55, H * 0.045), fill: linear(ctx, 0, py - H * 0.045, 0, py + H * 0.045, [{ o: 0, c: mix(pal.skyLow, pal.horizon, 0.4) }, { o: 1, c: mix(pal.water, pal.skyMid, 0.3) }]) });
  let rip = '';
  for (let i = 0; i < (ctx.lite ? 3 : 6); i++) {
    const x = range(rng, W * 0.1, W * 0.9);
    for (let k = 0; k < 2; k++) rip += ell(x, py + range(rng, -1, 1), H * (0.02 + 0.02 * k), H * (0.006 + 0.005 * k));
  }
  moving(ctx, { k: 'wave', period: 1400, min: 0.3, s: 0.05, ox: W * 0.5, oy: py }, () =>
    ctx.nodes.push({ t: 'path', d: rip, stroke: mix(pal.skyLow, '#FFFFFF', 0.5), sw: sw(ctx, 0.3, 0.55), fill: 'none', opacity: 0.75 }),
  );
}

const BUILDERS: Record<SceneType, (ctx: Ctx) => void> = {
  hills: buildHills,
  ocean: buildOcean,
  lake: buildLake,
  dunes: buildDunes,
  mountains: buildMountains,
  clouds: buildClouds,
  window: buildWindow,
  forest: buildForest,
  rain: buildRain,
  balloons: buildBalloons,
  bowl: buildBowl,
  piano: buildPiano,
  strings: buildStrings,
  drone: buildDrone,
  waves: buildWaves,
  branch: buildBranch,
  raincloud: buildRaincloud,
  meadow: buildMeadow,
  haze: buildHaze,
  coast: buildCoast,
  sunburst: buildSunburst,
  beams: buildBeams,
  river: buildRiver,
  cairn: buildCairn,
  dandelion: buildDandelion,
  puffs: buildPuffs,
  windtree: buildWindtree,
  pond: buildPond,
  campfire: buildCampfire,
  forestbirds: buildForestBirds,
  softrain: buildSoftRain,
  shoreline: buildShoreline,
  wash: buildWash,
  roots: buildRoots,
  valley: buildValley,
  lanterns: buildLanterns,
  moonset: buildMoonset,
  rings: buildRings,
  lowcloud: buildLowCloud,
  hours: buildHours,
  goldenhour: buildGoldenHour,
  velvet: buildVelvet,
  starlit: buildStarlit,
  drift: buildDrift,
  crickets: buildCrickets,
  snow: buildSnow,
  stream: buildStream,
  thunder: buildThunder,
  afterrain: buildAfterRain,
  hearth: buildHearth,
  eaves: buildEaves,
};

// ─── Public API ──────────────────────────────────────────────────────────────

export function sceneKey(spec: SceneSpec, opts: SceneOptions): string {
  return [
    spec.type,
    spec.timeOfDay,
    f(spec.sunX),
    f(spec.sunY),
    f(spec.hueShift),
    spec.seed,
    (spec.details ?? []).join('.'),
    opts.mode,
    f(opts.aspect ?? 1),
    opts.lod ?? 'full',
    opts.accent ?? '',
    opts.tokens ? [opts.tokens.accent, opts.tokens.calm, opts.tokens.sunrise, opts.tokens.warning, opts.tokens.bg].join(',') : '',
  ].join('|');
}

export function buildScene(spec: SceneSpec, opts: SceneOptions): SceneModel {
  const W = 100;
  const H = f(100 * (opts.aspect ?? 1));
  const details = new Set(spec.details ?? []);
  const idp = opts.idPrefix ?? `sc${hashString(sceneKey(spec, opts)).toString(36)}`;
  const pal = scenePalette(spec.timeOfDay, opts.mode, spec.hueShift, opts.accent, spec.type === 'rain' || spec.type === 'raincloud' || spec.type === 'softrain' || spec.type === 'thunder' || spec.type === 'eaves');
  const valid = (c?: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : undefined);
  const tk = opts.tokens;
  const tok: SceneTokens = {
    accent: valid(tk?.accent) ?? valid(opts.accent) ?? pal.glow,
    calm: valid(tk?.calm) ?? pal.glow,
    sunrise: valid(tk?.sunrise) ?? pal.glow,
    warning: valid(tk?.warning) ?? pal.sun,
    bg: valid(tk?.bg) ?? pal.land,
  };
  if (opts.mode === 'dark' && valid(tk?.bg)) {
    // Sink night scenes toward the app background so they read dark and moody, not washed out.
    pal.skyTop = mix(pal.skyTop, tok.bg, 0.3);
    pal.skyMid = mix(pal.skyMid, tok.bg, 0.2);
    pal.skyLow = mix(pal.skyLow, tok.bg, 0.1);
    pal.haze = mix(pal.haze, tok.bg, 0.12);
    pal.water = mix(pal.water, tok.bg, 0.15);
    pal.land = mix(pal.land, tok.bg, 0.35);
    pal.cloudShade = mix(pal.cloudShade, tok.bg, 0.15);
  }
  const ctx: Ctx = {
    W,
    H,
    rng: mulberry32(spec.seed),
    pal,
    tok,
    mode: opts.mode,
    lite: opts.lod === 'lite',
    spec,
    defs: [],
    nodes: [],
    idp,
    n: 0,
    has: (d) => details.has(d),
  };
  BUILDERS[spec.type](ctx);
  drawVignette(ctx);
  drawGrain(ctx);
  return { w: W, h: H, defs: ctx.defs, nodes: ctx.nodes };
}

const CACHE = new Map<string, SceneModel>();
const CACHE_MAX = 160;

/** Memoised `buildScene` — models are immutable, ids derive from the key so sharing is safe. */
export function buildSceneCached(spec: SceneSpec, opts: SceneOptions): SceneModel {
  const key = sceneKey(spec, opts) + (opts.idPrefix ?? '');
  const hit = CACHE.get(key);
  if (hit) return hit;
  const model = buildScene(spec, opts);
  if (CACHE.size >= CACHE_MAX) {
    const first = CACHE.keys().next().value;
    if (first !== undefined) CACHE.delete(first);
  }
  CACHE.set(key, model);
  return model;
}

/** Derive a stable, unique spec from any id (fallback for tracks without a hand-tuned spec). */
export function deriveSceneSpec(id: string): SceneSpec {
  const seed = hashString(id);
  const rng = mulberry32(seed);
  const type = LANDSCAPE_TYPES[Math.floor(rng() * LANDSCAPE_TYPES.length)]!;
  // Weighted toward the brand's morning hours.
  const times: TimeOfDay[] = ['predawn', 'dawn', 'dawn', 'sunrise', 'sunrise', 'sunrise', 'morning', 'morning', 'golden', 'dusk'];
  const timeOfDay = times[Math.floor(rng() * times.length)]!;
  const pool: SceneDetail[] = ['birds', 'clouds', 'mist', 'rays', 'tree', 'headland', 'waves', 'peak'];
  const details = pool.filter(() => rng() < 0.3);
  const high = type === 'clouds' || type === 'window';
  return {
    type,
    timeOfDay,
    sunX: f(range(rng, 0.25, 0.75)),
    sunY: f(high ? range(rng, 0.3, 0.45) : range(rng, 0.42, 0.6)),
    hueShift: f(range(rng, -12, 12)),
    seed,
    details,
  };
}

// ─── Standard SVG serialiser (Node previews / tests) ─────────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function stopsXml(stops: GradStop[]) {
  return stops
    .map((s) => `<stop offset="${s.o}" stop-color="${s.c}"${s.a !== undefined ? ` stop-opacity="${f(s.a)}"` : ''}/>`)
    .join('');
}

function nodeXml(n: SvgNode): string {
  const op = (o?: number) => (o !== undefined && o < 1 ? ` opacity="${f(o)}"` : '');
  switch (n.t) {
    case 'rect':
      return `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}"${n.rx ? ` rx="${n.rx}"` : ''} fill="${n.fill}"${op(n.opacity)}/>`;
    case 'circle':
      return `<circle cx="${n.cx}" cy="${n.cy}" r="${n.r}" fill="${n.fill}"${op(n.opacity)}/>`;
    case 'ellipse':
      return `<ellipse cx="${n.cx}" cy="${n.cy}" rx="${n.rx}" ry="${n.ry}" fill="${n.fill}"${op(n.opacity)}/>`;
    case 'path':
      return `<path d="${esc(n.d)}" fill="${n.fill ?? 'none'}"${
        n.stroke ? ` stroke="${n.stroke}" stroke-width="${n.sw ?? 1}" stroke-linecap="round" stroke-linejoin="round"` : ''
      }${op(n.opacity)}/>`;
    case 'g':
      return `<g${n.clip ? ` clip-path="url(#${n.clip})"` : ''}${op(n.opacity)}>${n.children.map(nodeXml).join('')}</g>`;
  }
}

export function sceneToSvgString(model: SceneModel, px: number, opts: { radius?: number } = {}): string {
  const { w, h } = model;
  const pxH = Math.round((px * h) / w);
  const defs = model.defs
    .map((d) => {
      if (d.t === 'linear')
        return `<linearGradient id="${d.id}" gradientUnits="userSpaceOnUse" x1="${d.x1}" y1="${d.y1}" x2="${d.x2}" y2="${d.y2}">${stopsXml(d.stops)}</linearGradient>`;
      if (d.t === 'radial')
        return `<radialGradient id="${d.id}" gradientUnits="${d.units === 'user' ? 'userSpaceOnUse' : 'objectBoundingBox'}" cx="${d.cx}" cy="${d.cy}" r="${d.r}">${stopsXml(d.stops)}</radialGradient>`;
      return `<clipPath id="${d.id}">${d.children.map(nodeXml).join('')}</clipPath>`;
    })
    .join('');
  const rr = opts.radius ? (opts.radius * w) / px : 0;
  const clip = rr ? `<clipPath id="__round"><rect width="${w}" height="${h}" rx="${f(rr)}"/></clipPath>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${pxH}" viewBox="0 0 ${w} ${h}"><defs>${defs}${clip}</defs><g${
    rr ? ' clip-path="url(#__round)"' : ''
  }>${model.nodes.map(nodeXml).join('')}</g></svg>`;
}
