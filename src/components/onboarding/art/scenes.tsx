/**
 * Pure SVG building blocks for the onboarding scenes (react-native-svg only, no RN views or
 * animation) so the same shapes render in the app and in the box preview script.
 * Animated wrappers live in OnboardingArt.tsx and move whole layers (transform / opacity).
 */
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { ArtPalette } from './art-palette';

type Box = { w: number; h: number };

/** Soft vertical sky gradient. */
export function SkyLayer({ w, h, p, id = 'sky' }: Box & { p: ArtPalette; id?: string }) {
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.skyTop} />
          <Stop offset="1" stopColor={p.skyBottom} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill={`url(#${id})`} />
    </Svg>
  );
}

/** Sun disc with a radial glow; drawn centred in a (size × size) box. */
export function SunLayer({ size, p, id = 'sun' }: { size: number; p: ArtPalette; id?: string }) {
  const c = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={p.glow} stopOpacity={0.55} />
          <Stop offset="0.45" stopColor={p.glow} stopOpacity={0.18} />
          <Stop offset="1" stopColor={p.glow} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}-disc`} cx="45%" cy="40%" r="60%">
          <Stop offset="0" stopColor={p.sunCore} />
          <Stop offset="1" stopColor={p.sun} />
        </RadialGradient>
      </Defs>
      <Circle cx={c} cy={c} r={c} fill={`url(#${id}-glow)`} />
      <Circle cx={c} cy={c} r={size * 0.19} fill={`url(#${id}-disc)`} />
    </Svg>
  );
}

/** Thin sun rays around the centre of a (size × size) box. */
export function RaysLayer({ size, p }: { size: number; p: ArtPalette }) {
  const c = size / 2;
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const r1 = size * 0.27;
    const r2 = size * (i % 2 === 0 ? 0.42 : 0.36);
    return `M${(c + Math.cos(a) * r1).toFixed(1)} ${(c + Math.sin(a) * r1).toFixed(1)} L${(c + Math.cos(a) * r2).toFixed(1)} ${(c + Math.sin(a) * r2).toFixed(1)}`;
  }).join(' ');
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Path d={rays} stroke={p.sun} strokeWidth={2.5} strokeLinecap="round" opacity={0.45} />
    </Svg>
  );
}

/** One rolling hill band filling the bottom of a (w × h) box. `crest` is 0..1 of h. */
export function HillLayer({
  w,
  h,
  fill,
  crest,
  phase = 0,
  amp = 0.08,
}: Box & { fill: string; crest: number; phase?: number; amp?: number }) {
  const y0 = h * crest;
  const a = h * amp;
  const pts: string[] = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const y = y0 + Math.sin((i / steps) * Math.PI * 2 + phase) * a;
    pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  // Smooth-ish curve through the points (quadratic midpoints).
  let d = `M0 ${h} L${pts[0]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1]!.split(' ').map(Number);
    const [x, y] = pts[i]!.split(' ').map(Number);
    d += ` Q${px!.toFixed(1)} ${py!.toFixed(1)} ${((px! + x!) / 2).toFixed(1)} ${((py! + y!) / 2).toFixed(1)}`;
  }
  d += ` L${w} ${pts[pts.length - 1]!.split(' ')[1]} L${w} ${h} Z`;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Path d={d} fill={fill} />
    </Svg>
  );
}

/** Upright standing figure silhouette, drawn in a (w × h) box, feet at the bottom. */
export function FigureLayer({ w, h, fill }: Box & { fill: string }) {
  const cx = w / 2;
  const head = w * 0.17;
  const top = h * 0.06;
  const shoulders = top + head * 2 + h * 0.04;
  const d = [
    `M${cx - w * 0.3} ${h}`,
    `L${cx - w * 0.27} ${shoulders + h * 0.16}`,
    `Q${cx - w * 0.3} ${shoulders} ${cx - w * 0.12} ${shoulders - h * 0.01}`,
    `L${cx + w * 0.12} ${shoulders - h * 0.01}`,
    `Q${cx + w * 0.3} ${shoulders} ${cx + w * 0.27} ${shoulders + h * 0.16}`,
    `L${cx + w * 0.3} ${h}`,
    'Z',
  ].join(' ');
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Circle cx={cx} cy={top + head} r={head} fill={fill} />
      <Path d={d} fill={fill} />
    </Svg>
  );
}

/** Phone propped on a small stand, camera dot at the top. (w × h) box. */
export function ProppedPhoneLayer({ w, h, p }: Box & { p: ArtPalette }) {
  const pw = w * 0.62;
  const ph = h * 0.86;
  const x = (w - pw) / 2;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <G transform={`rotate(-8 ${w / 2} ${h})`}>
        <Rect x={x} y={0} width={pw} height={ph} rx={pw * 0.18} fill={p.phone} />
        <Rect x={x + pw * 0.08} y={ph * 0.05} width={pw * 0.84} height={ph * 0.9} rx={pw * 0.12} fill={p.phoneScreen} />
        <Circle cx={w / 2} cy={ph * 0.1} r={pw * 0.06} fill={p.accent} />
      </G>
      <Path d={`M${w * 0.18} ${h} L${w * 0.5} ${h * 0.8} L${w * 0.82} ${h} Z`} fill={p.line} />
    </Svg>
  );
}

/** Phone lying flat-ish with notification pills (the "snooze and scroll" morning). */
export function BusyPhoneLayer({ w, h, p }: Box & { p: ArtPalette }) {
  const pw = w * 0.5;
  const ph = h * 0.92;
  const x = (w - pw) / 2;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Rect x={x} y={h - ph} width={pw} height={ph} rx={pw * 0.16} fill={p.phone} />
      <Rect x={x + pw * 0.07} y={h - ph + ph * 0.04} width={pw * 0.86} height={ph * 0.92} rx={pw * 0.11} fill={p.phoneScreen} />
      <Rect x={x + pw * 0.3} y={h - ph + ph * 0.3} width={pw * 0.4} height={pw * 0.13} rx={pw * 0.06} fill={p.line} />
      <Rect x={x + pw * 0.2} y={h - ph + ph * 0.3 + pw * 0.2} width={pw * 0.6} height={pw * 0.09} rx={pw * 0.045} fill={p.line} opacity={0.7} />
    </Svg>
  );
}

/** A notification pill (w × h): icon dot + two text bars. */
export function NotificationPill({ w, h, p, tone }: Box & { p: ArtPalette; tone: string }) {
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Rect x={0} y={0} width={w} height={h} rx={h * 0.32} fill={p.card} stroke={p.line} strokeWidth={1} />
      <Circle cx={h * 0.5} cy={h * 0.5} r={h * 0.24} fill={tone} />
      <Rect x={h} y={h * 0.28} width={w * 0.5} height={h * 0.15} rx={h * 0.07} fill={p.inkMuted} opacity={0.55} />
      <Rect x={h} y={h * 0.56} width={w * 0.34} height={h * 0.13} rx={h * 0.06} fill={p.inkMuted} opacity={0.3} />
    </Svg>
  );
}

/** Concentric ring (stroke only), centred in a (size × size) box. */
export function RingLayer({ size, stroke, width = 2, opacity = 1 }: { size: number; stroke: string; width?: number; opacity?: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - width} stroke={stroke} strokeWidth={width} fill="none" opacity={opacity} />
    </Svg>
  );
}

/** Filled soft disc (breathing core), centred in a (size × size) box. */
export function DiscLayer({ size, fill, opacity = 1 }: { size: number; fill: string; opacity?: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={fill} opacity={opacity} />
    </Svg>
  );
}

/** Alarm clock glyph (bells + face + hands), centred in a (size × size) box. */
export function AlarmClockLayer({ size, p }: { size: number; p: ArtPalette }) {
  const c = size / 2;
  const r = size * 0.3;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Path d={`M${c - r * 1.05} ${c - r * 0.55} A${r * 0.5} ${r * 0.5} 0 0 1 ${c - r * 0.45} ${c - r * 1.08} Z`} fill={p.sun} />
      <Path d={`M${c + r * 1.05} ${c - r * 0.55} A${r * 0.5} ${r * 0.5} 0 0 0 ${c + r * 0.45} ${c - r * 1.08} Z`} fill={p.sun} />
      <Circle cx={c} cy={c} r={r} fill={p.card} stroke={p.sun} strokeWidth={size * 0.05} />
      <Path d={`M${c} ${c} L${c} ${c - r * 0.55} M${c} ${c} L${c + r * 0.4} ${c + r * 0.2}`} stroke={p.ink} strokeWidth={size * 0.035} strokeLinecap="round" />
      <Path d={`M${c - r * 0.6} ${c + r * 1.1} L${c - r * 0.8} ${c + r * 1.35} M${c + r * 0.6} ${c + r * 1.1} L${c + r * 0.8} ${c + r * 1.35}`} stroke={p.sun} strokeWidth={size * 0.04} strokeLinecap="round" />
    </Svg>
  );
}

/** Waveform line across a (w × h) box. amp 0 = flat (calm), 1 = jagged (ringing). */
export function WaveLayer({ w, h, stroke, amp }: Box & { stroke: string; amp: number }) {
  const mid = h / 2;
  const n = 24;
  let d = `M0 ${mid}`;
  for (let i = 1; i <= n; i++) {
    const x = (i / n) * w;
    const env = Math.sin((i / n) * Math.PI);
    const y = mid + (i % 2 === 0 ? -1 : 1) * env * amp * (h * 0.42) * (0.55 + ((i * 7) % 5) / 10);
    d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Path d={d} stroke={stroke} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Soft ground shadow ellipse. */
export function ShadowLayer({ w, h, fill }: Box & { fill: string }) {
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={fill} opacity={0.35} />
    </Svg>
  );
}

/** Small "z" glyph for the snooze scene. */
export function ZLayer({ size, stroke }: { size: number; stroke: string }) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Path d={`M${s * 0.2} ${s * 0.22} L${s * 0.8} ${s * 0.22} L${s * 0.2} ${s * 0.78} L${s * 0.8} ${s * 0.78}`} stroke={stroke} strokeWidth={s * 0.12} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Checkmark badge (camera "you're settled"). */
export function CheckBadgeLayer({ size, p }: { size: number; p: ArtPalette }) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Circle cx={s / 2} cy={s / 2} r={s / 2} fill={p.accent} />
      <Path d={`M${s * 0.3} ${s * 0.52} L${s * 0.45} ${s * 0.66} L${s * 0.72} ${s * 0.38}`} stroke={p.card} strokeWidth={s * 0.1} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Camera view cone from the phone toward the figure. */
export function ViewConeLayer({ w, h, p, id = 'cone' }: Box & { p: ArtPalette; id?: string }) {
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={p.accent} stopOpacity={0.35} />
          <Stop offset="1" stopColor={p.accent} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={`M0 ${h * 0.5} L${w} 0 L${w} ${h} Z`} fill={`url(#${id})`} />
    </Svg>
  );
}
