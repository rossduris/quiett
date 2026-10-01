/**
 * Pure geometry for the onboarding "Time lost to snoozing" chart (no React Native imports,
 * so the box still-frame renderer can reuse it). Illustrative shapes, not measured data.
 *
 * Values are normalised: x 0 → Day 1, x 1 → Day 30; y 0 = no time lost, 1 = the most.
 */

type Pt = { x: number; y: number };

/** Regular alarm: dips a little (good intentions), wobbles, then climbs back up. */
const REGULAR: readonly Pt[] = [
  { x: 0, y: 0.52 },
  { x: 0.14, y: 0.44 },
  { x: 0.28, y: 0.4 },
  { x: 0.42, y: 0.5 },
  { x: 0.56, y: 0.46 },
  { x: 0.72, y: 0.62 },
  { x: 0.86, y: 0.72 },
  { x: 1, y: 0.84 },
];

/** With Quiett: starts at the same place and eases down to zero, then stays there. */
const QUIETT: readonly Pt[] = [
  { x: 0, y: 0.52 },
  { x: 0.16, y: 0.4 },
  { x: 0.34, y: 0.22 },
  { x: 0.52, y: 0.09 },
  { x: 0.7, y: 0.02 },
  { x: 0.85, y: 0 },
  { x: 1, y: 0 },
];

/** Where the regular line's "rising end" fill starts. */
const RISE_FROM_X = 0.5;

export type ChartBox = { w: number; h: number; padX: number; padTop: number; padBottom: number };

export type SnoozeChartGeometry = {
  box: ChartBox;
  regularPath: string;
  regularLength: number;
  /** Area under the rising end of the regular line (from RISE_FROM_X to Day 30). */
  regularFillPath: string;
  quiettPath: string;
  quiettLength: number;
  quiettFillPath: string;
  regularEnd: Pt;
  quiettEnd: Pt;
  /** Horizontal guide lines (pixel y): top, start level, baseline. */
  guidesY: number[];
  /** Vertical guide lines (pixel x): Day 1 and Day 30. */
  guidesX: number[];
  baselineY: number;
};

function toPx(box: ChartBox, p: Pt): Pt {
  const iw = box.w - box.padX * 2;
  const ih = box.h - box.padTop - box.padBottom;
  return { x: box.padX + p.x * iw, y: box.padTop + (1 - p.y) * ih };
}

/** Catmull-Rom → cubic Bézier segments (tension 0.5) for a smooth line through every point. */
function smoothPath(pts: readonly Pt[]): string {
  const r = (n: number) => Math.round(n * 10) / 10;
  let d = `M${r(pts[0]!.x)} ${r(pts[0]!.y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${r(c1.x)} ${r(c1.y)} ${r(c2.x)} ${r(c2.y)} ${r(p2.x)} ${r(p2.y)}`;
  }
  return d;
}

/** Polyline length of the Catmull-Rom curve (sampled), padded a touch so the dash fully hides it. */
function curveLength(pts: readonly Pt[]): number {
  let len = 0;
  let prev = pts[0]!;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    for (let t = 0.05; t <= 1.0001; t += 0.05) {
      const t2 = t * t;
      const t3 = t2 * t;
      const q = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const cur = { x: q(p0.x, p1.x, p2.x, p3.x), y: q(p0.y, p1.y, p2.y, p3.y) };
      len += Math.hypot(cur.x - prev.x, cur.y - prev.y);
      prev = cur;
    }
  }
  return Math.ceil(len * 1.04) + 2;
}

/** Linear interpolation of a normalised series at x (for clipping the rising-end fill). */
function valueAt(pts: readonly Pt[], x: number): number {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (x >= a.x && x <= b.x) return a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
  }
  return pts[pts.length - 1]!.y;
}

export function snoozeChartGeometry(w: number, h: number): SnoozeChartGeometry {
  const box: ChartBox = { w, h, padX: 12, padTop: 26, padBottom: 10 };
  const reg = REGULAR.map((p) => toPx(box, p));
  const qt = QUIETT.map((p) => toPx(box, p));
  const baselineY = toPx(box, { x: 0, y: 0 }).y;

  const riseStart = { x: RISE_FROM_X, y: valueAt(REGULAR, RISE_FROM_X) };
  const riseTail = [riseStart, ...REGULAR.filter((p) => p.x > RISE_FROM_X)].map((p) => toPx(box, p));
  const regularFillPath = `${smoothPath(riseTail)} L${riseTail[riseTail.length - 1]!.x} ${baselineY} L${riseTail[0]!.x} ${baselineY} Z`;
  const quiettFillPath = `${smoothPath(qt)} L${qt[qt.length - 1]!.x} ${baselineY} L${qt[0]!.x} ${baselineY} Z`;

  return {
    box,
    regularPath: smoothPath(reg),
    regularLength: curveLength(reg),
    regularFillPath,
    quiettPath: smoothPath(qt),
    quiettLength: curveLength(qt),
    quiettFillPath,
    regularEnd: reg[reg.length - 1]!,
    quiettEnd: qt[qt.length - 1]!,
    guidesY: [toPx(box, { x: 0, y: 1 }).y, reg[0]!.y, baselineY],
    guidesX: [reg[0]!.x, reg[reg.length - 1]!.x],
    baselineY,
  };
}
