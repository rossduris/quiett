/**
 * Scene layouts: each onboarding illustration is a list of positioned SVG layers plus an
 * optional animation spec per layer. Pure data (no RN views), so:
 *  - AnimatedScene.tsx renders them with reanimated (transform / opacity only, UI thread);
 *  - the box preview script renders the same layers as a still frame (rest pose).
 * x / y / w / h are in points inside the scene box.
 */
import type { ReactElement } from 'react';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import type { ArtPalette } from './art-palette';
import {
  AlarmClockLayer,
  BusyPhoneLayer,
  CheckBadgeLayer,
  DiscLayer,
  FigureLayer,
  HillLayer,
  NotificationPill,
  ProppedPhoneLayer,
  RaysLayer,
  RingLayer,
  ShadowLayer,
  SkyLayer,
  SunLayer,
  ViewConeLayer,
  WaveLayer,
  ZLayer,
} from './scenes';

export type AnimSpec =
  | { type: 'rise'; from: number; duration: number; delay?: number }
  | { type: 'rotate'; period: number }
  | { type: 'drift'; dx: number; period: number }
  | { type: 'bob'; dy: number; period: number; delay?: number }
  | { type: 'floatUp'; dy: number; period: number; delay?: number }
  | { type: 'pulse'; period: number; delay?: number; settleFrom?: number }
  | { type: 'breathe'; period: number; min: number; max: number; delay?: number }
  | { type: 'fadeIn'; delay: number; duration?: number }
  | { type: 'fadeOut'; delay: number; duration?: number }
  | { type: 'pop'; delay: number };

export type Layer = {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  node: ReactElement;
  anim?: AnimSpec;
};

export type SceneLayout = { w: number; h: number; layers: Layer[] };

/** Warm radial glow (same look as LockInAura: static gradient, animated by scale/opacity). */
export function GlowLayer({ size, color, id = 'glow' }: { size: number; color: string; id?: string }) {
  const c = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.6} />
          <Stop offset="0.55" stopColor={color} stopOpacity={0.2} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={c} cy={c} r={c} fill={`url(#${id})`} />
    </Svg>
  );
}

function hills(w: number, h: number, p: ArtPalette, crests: [number, number, number], drift = true): Layer[] {
  return [
    { key: 'hill-far', x: -24, y: 0, w: w + 48, h, node: <HillLayer w={w + 48} h={h} fill={p.hillFar} crest={crests[0]} phase={0.6} amp={0.05} />, anim: drift ? { type: 'drift', dx: 6, period: 9000 } : undefined },
    { key: 'hill-mid', x: -32, y: 0, w: w + 64, h, node: <HillLayer w={w + 64} h={h} fill={p.hillMid} crest={crests[1]} phase={2.2} amp={0.06} />, anim: drift ? { type: 'drift', dx: 10, period: 11000 } : undefined },
    { key: 'hill-near', x: -40, y: 0, w: w + 80, h, node: <HillLayer w={w + 80} h={h} fill={p.hillNear} crest={crests[2]} phase={4.1} amp={0.05} />, anim: drift ? { type: 'drift', dx: 14, period: 13000 } : undefined },
  ];
}

/** Welcome / commitment: sun rising over layered hills, optional breathing rings round the sun. */
export function sunriseLayout(w: number, h: number, p: ArtPalette, opts: { rings?: boolean } = {}): SceneLayout {
  const sun = Math.min(w, h) * 0.95;
  const sunX = w / 2 - sun / 2;
  const sunY = h * 0.6 - sun / 2;
  const layers: Layer[] = [
    { key: 'sky', x: 0, y: 0, w, h, node: <SkyLayer w={w} h={h} p={p} id="sunrise-sky" /> },
    { key: 'rays', x: sunX, y: sunY, w: sun, h: sun, node: <RaysLayer size={sun} p={p} />, anim: { type: 'rotate', period: 60000 } },
    { key: 'sun', x: sunX, y: sunY, w: sun, h: sun, node: <SunLayer size={sun} p={p} id="sunrise-sun" />, anim: { type: 'rise', from: h * 0.4, duration: 2600 } },
  ];
  if (opts.rings) {
    const r1 = sun * 0.62;
    const r2 = sun * 0.82;
    layers.push(
      { key: 'ring-1', x: w / 2 - r1 / 2, y: h * 0.6 - r1 / 2, w: r1, h: r1, node: <RingLayer size={r1} stroke={p.sun} width={1.5} opacity={0.55} />, anim: { type: 'breathe', period: 5000, min: 0.92, max: 1.06 } },
      { key: 'ring-2', x: w / 2 - r2 / 2, y: h * 0.6 - r2 / 2, w: r2, h: r2, node: <RingLayer size={r2} stroke={p.sun} width={1.2} opacity={0.3} />, anim: { type: 'breathe', period: 5000, min: 0.94, max: 1.04, delay: 400 } },
    );
  }
  return { w, h, layers: [...layers, ...hills(w, h, p, [0.64, 0.74, 0.86])] };
}

/** The problem: a buzzing phone, notifications piling up, snooze z's drifting. */
export function snoozeLayout(w: number, h: number, p: ArtPalette): SceneLayout {
  const phoneW = Math.min(170, w * 0.46);
  const phoneH = h * 0.78;
  const px = w / 2 - phoneW / 2;
  const pillW = Math.min(170, w * 0.46);
  const pillH = 38;
  return {
    w,
    h,
    layers: [
      { key: 'sky', x: 0, y: 0, w, h, node: <SkyLayer w={w} h={h} p={p} id="snooze-sky" /> },
      { key: 'shadow', x: px - 10, y: h - 18, w: phoneW + 20, h: 16, node: <ShadowLayer w={phoneW + 20} h={16} fill={p.ink} /> },
      { key: 'phone', x: px, y: h - phoneH - 10, w: phoneW, h: phoneH, node: <BusyPhoneLayer w={phoneW} h={phoneH} p={p} />, anim: { type: 'bob', dy: 2, period: 180 } },
      { key: 'pill-1', x: w * 0.06, y: h * 0.18, w: pillW, h: pillH, node: <NotificationPill w={pillW} h={pillH} p={p} tone={p.sun} />, anim: { type: 'bob', dy: 5, period: 2400 } },
      { key: 'pill-2', x: w - pillW - w * 0.05, y: h * 0.38, w: pillW, h: pillH, node: <NotificationPill w={pillW} h={pillH} p={p} tone={p.accent} />, anim: { type: 'bob', dy: 6, period: 2800, delay: 300 } },
      { key: 'pill-3', x: w * 0.1, y: h * 0.58, w: pillW, h: pillH, node: <NotificationPill w={pillW} h={pillH} p={p} tone={p.inkMuted} />, anim: { type: 'bob', dy: 4, period: 2200, delay: 700 } },
      { key: 'z-1', x: w * 0.74, y: h * 0.12, w: 22, h: 22, node: <ZLayer size={22} stroke={p.inkMuted} />, anim: { type: 'floatUp', dy: 36, period: 3200 } },
      { key: 'z-2', x: w * 0.8, y: h * 0.2, w: 16, h: 16, node: <ZLayer size={16} stroke={p.inkMuted} />, anim: { type: 'floatUp', dy: 30, period: 3200, delay: 1000 } },
      { key: 'z-3', x: w * 0.7, y: h * 0.24, w: 12, h: 12, node: <ZLayer size={12} stroke={p.inkMuted} />, anim: { type: 'floatUp', dy: 26, period: 3200, delay: 2000 } },
    ],
  };
}

/** Alarm permission: ringing waves that slow and settle into a flat, calm line. */
export function alarmCalmLayout(w: number, h: number, p: ArtPalette): SceneLayout {
  const clock = Math.min(h * 0.62, 150);
  const cx = w / 2;
  const cy = h * 0.42;
  const ring = clock * 1.9;
  const waveW = Math.min(w * 0.8, 280);
  const rings: Layer[] = [0, 1, 2].map((i) => ({
    key: `pulse-${i}`,
    x: cx - ring / 2,
    y: cy - ring / 2,
    w: ring,
    h: ring,
    node: <RingLayer size={ring} stroke={p.sun} width={2} />,
    anim: { type: 'pulse', period: 3600, delay: i * 1200, settleFrom: 1200 },
  }));
  return {
    w,
    h,
    layers: [
      { key: 'glow', x: cx - ring / 2, y: cy - ring / 2, w: ring, h: ring, node: <GlowLayer size={ring} color={p.glow} id="alarm-glow" />, anim: { type: 'breathe', period: 5000, min: 0.9, max: 1.05 } },
      ...rings,
      { key: 'clock', x: cx - clock / 2, y: cy - clock / 2, w: clock, h: clock, node: <AlarmClockLayer size={clock} p={p} /> },
      { key: 'wave-loud', x: cx - waveW / 2, y: h * 0.8, w: waveW, h: 36, node: <WaveLayer w={waveW} h={36} stroke={p.sun} amp={1} />, anim: { type: 'fadeOut', delay: 3200, duration: 1400 } },
      { key: 'wave-calm', x: cx - waveW / 2, y: h * 0.8, w: waveW, h: 36, node: <WaveLayer w={waveW} h={36} stroke={p.accent} amp={0.12} />, anim: { type: 'fadeIn', delay: 3200, duration: 1400 } },
    ],
  };
}

/** Camera rationale: phone propped, upright figure with the warm lock-in aura, check pops in. */
export function uprightLayout(w: number, h: number, p: ArtPalette): SceneLayout {
  const figH = h * 0.7;
  const figW = figH * 0.5;
  const fx = w * 0.64 - figW / 2;
  const fy = h * 0.92 - figH;
  const aura = figH * 1.05;
  const phoneW = Math.min(64, w * 0.17);
  const phoneH = phoneW * 1.9;
  const phx = w * 0.14;
  const phy = h * 0.92 - phoneH;
  const coneX = phx + phoneW * 0.7;
  const coneW = fx + figW * 0.4 - coneX;
  return {
    w,
    h,
    layers: [
      { key: 'sky', x: 0, y: 0, w, h, node: <SkyLayer w={w} h={h} p={p} id="upright-sky" /> },
      ...hills(w, h, p, [0.7, 0.8, 0.9], false),
      { key: 'aura', x: fx + figW / 2 - aura / 2, y: fy - aura * 0.18, w: aura, h: aura, node: <GlowLayer size={aura} color={p.glow} id="upright-aura" />, anim: { type: 'breathe', period: 5000, min: 0.9, max: 1.08, delay: 900 } },
      { key: 'cone', x: coneX, y: phy - phoneH * 0.35, w: Math.max(40, coneW), h: phoneH * 1.2, node: <ViewConeLayer w={Math.max(40, coneW)} h={phoneH * 1.2} p={p} id="upright-cone" />, anim: { type: 'fadeIn', delay: 500, duration: 900 } },
      { key: 'figure', x: fx, y: fy, w: figW, h: figH, node: <FigureLayer w={figW} h={figH} fill={p.figure} />, anim: { type: 'rise', from: 18, duration: 900 } },
      { key: 'phone', x: phx, y: phy, w: phoneW, h: phoneH, node: <ProppedPhoneLayer w={phoneW} h={phoneH} p={p} /> },
      { key: 'check', x: fx + figW * 0.78, y: fy + figH * 0.02, w: 30, h: 30, node: <CheckBadgeLayer size={30} p={p} />, anim: { type: 'pop', delay: 1700 } },
    ],
  };
}

/** Mini art for the "how it works" steps (square, ~64pt). */
export function miniLayout(kind: 'ring' | 'still' | 'calm', s: number, p: ArtPalette): SceneLayout {
  if (kind === 'ring') {
    const c = s * 0.62;
    return {
      w: s,
      h: s,
      layers: [
        ...[0, 1].map((i) => ({ key: `r${i}`, x: 0, y: 0, w: s, h: s, node: <RingLayer size={s} stroke={p.sun} width={1.5} />, anim: { type: 'pulse', period: 1600, delay: i * 800 } as AnimSpec })),
        { key: 'clock', x: (s - c) / 2, y: (s - c) / 2, w: c, h: c, node: <AlarmClockLayer size={c} p={p} /> },
      ],
    };
  }
  if (kind === 'still') {
    const fh = s * 0.74;
    const fw = fh * 0.5;
    return {
      w: s,
      h: s,
      layers: [
        { key: 'aura', x: 0, y: 0, w: s, h: s, node: <GlowLayer size={s} color={p.glow} id="mini-aura" />, anim: { type: 'breathe', period: 5000, min: 0.85, max: 1.08 } },
        { key: 'fig', x: (s - fw) / 2, y: s - fh - s * 0.06, w: fw, h: fh, node: <FigureLayer w={fw} h={fh} fill={p.figure} /> },
      ],
    };
  }
  const core = s * 0.42;
  return {
    w: s,
    h: s,
    layers: [
      { key: 'r1', x: 0, y: 0, w: s, h: s, node: <RingLayer size={s} stroke={p.accent} width={1.5} opacity={0.5} />, anim: { type: 'breathe', period: 5000, min: 0.86, max: 1 } },
      { key: 'r2', x: s * 0.14, y: s * 0.14, w: s * 0.72, h: s * 0.72, node: <RingLayer size={s * 0.72} stroke={p.accent} width={1.5} opacity={0.75} />, anim: { type: 'breathe', period: 5000, min: 0.88, max: 1.04, delay: 300 } },
      { key: 'core', x: (s - core) / 2, y: (s - core) / 2, w: core, h: core, node: <DiscLayer size={core} fill={p.accent} opacity={0.85} />, anim: { type: 'breathe', period: 5000, min: 0.9, max: 1.1, delay: 600 } },
    ],
  };
}
