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
  | 'rain';

export const SCENE_TYPES: readonly SceneType[] = [
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

export type SceneOptions = {
  /** light = peachCream family, dark = nightTeal family. */
  mode: SceneMode;
  /** height / width. Default 1 (square). */
  aspect?: number;
  /** 'lite' drops grain + fine detail for tiny thumbnails (< ~64pt). */
  lod?: 'full' | 'lite';
  /** Theme accent — lightly harmonises the palette. */
  accent?: string;
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
  | { t: 'g'; opacity?: number; clip?: string; children: SvgNode[] };

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
  ctx.nodes.push({ t: 'path', d, fill });
}

function drawCloudWisps(ctx: Ctx, hy: number, count: number, target: SvgNode[] = ctx.nodes, box?: { x: number; w: number; y0: number; y1: number }) {
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
  ctx.nodes.push({ t: 'path', d, stroke: color, sw: f((ctx.lite ? 0.9 : 0.55) * scale), fill: 'none', opacity: 0.8 });
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
    if (i === 0 && (ctx.has('mist') || !ctx.lite)) drawMist(ctx, base + amp * 0.6, ctx.has('mist') ? 1 : 0.55);
    if (i === 1 && ctx.has('mist')) drawMist(ctx, base + amp * 0.8, 0.8);
    if (i === n - 1) nearPts = pts;
  }
  if (ctx.has('tree')) {
    // Place a lone tree on the highest point of the nearest ridge (within frame).
    const inFrame = nearPts.filter((p) => p[0] > 12 && p[0] < W - 12);
    const top = inFrame.reduce((a, b) => (b[1] < a[1] ? b : a), inFrame[0]!);
    drawLoneTree(ctx, top[0], top[1] + 1.2, H * 0.13, layerColor(ctx, n - 1, n));
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
    ctx.nodes.push({ t: 'path', d: dFar, fill: glint, opacity: 0.85 * sunVis });
    ctx.nodes.push({ t: 'path', d: dNear, fill: glint, opacity: 0.5 * sunVis });
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
  ctx.nodes.push({
    t: 'path',
    d,
    stroke: mix(pal.horizon, '#FFFFFF', 0.3),
    sw: ctx.lite ? 0.8 : 0.45,
    fill: 'none',
    opacity: calm ? 0.22 : 0.32,
  });
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
    if (i === 0) drawMist(ctx, hy - H * 0.03, 0.7);
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
  ctx.nodes.push({ t: 'path', d: streaks(ctx.lite ? 30 : 80, 2.5, 5), stroke: rainCol, sw: ctx.lite ? 0.45 : 0.25, fill: 'none', opacity: 0.35 });
  ctx.nodes.push({ t: 'path', d: streaks(ctx.lite ? 12 : 28, 6, 12), stroke: rainCol, sw: ctx.lite ? 0.7 : 0.4, fill: 'none', opacity: 0.4 });
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
  ].join('|');
}

export function buildScene(spec: SceneSpec, opts: SceneOptions): SceneModel {
  const W = 100;
  const H = f(100 * (opts.aspect ?? 1));
  const details = new Set(spec.details ?? []);
  const idp = opts.idPrefix ?? `sc${hashString(sceneKey(spec, opts)).toString(36)}`;
  const ctx: Ctx = {
    W,
    H,
    rng: mulberry32(spec.seed),
    pal: scenePalette(spec.timeOfDay, opts.mode, spec.hueShift, opts.accent, spec.type === 'rain'),
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
  const type = SCENE_TYPES[Math.floor(rng() * SCENE_TYPES.length)]!;
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
