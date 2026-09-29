import { memo, useEffect, type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, G } from 'react-native-svg';
import type { SceneMotion, SvgNode } from '@/lib/scene-gen';

/** Max groups that animate at once per cover (by priority, then paint order). */
export const MAX_MOTION_GROUPS = 4;

export type MotionSegment =
  | { kind: 'static'; key: string; nodes: SvgNode[] }
  | { kind: 'motion'; key: string; node: SvgNode; motion: SceneMotion };

/**
 * Splits a scene's top-level nodes into static runs and animated groups, keeping paint order.
 * Only the highest-priority groups (up to MAX_MOTION_GROUPS) animate; the rest render statically.
 */
export function segmentScene(nodes: SvgNode[], max = MAX_MOTION_GROUPS): MotionSegment[] {
  const candidates = nodes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => n.t === 'g' && n.motion)
    .sort((a, b) => ((a.n as { motion: SceneMotion }).motion.pri ?? 1) - ((b.n as { motion: SceneMotion }).motion.pri ?? 1) || a.i - b.i)
    .slice(0, max);
  const chosen = new Set(candidates.map((c) => c.i));
  const out: MotionSegment[] = [];
  let run: SvgNode[] = [];
  nodes.forEach((n, i) => {
    if (chosen.has(i) && n.t === 'g' && n.motion) {
      if (run.length) out.push({ kind: 'static', key: `s${i}`, nodes: run });
      run = [];
      out.push({ kind: 'motion', key: `m${i}`, node: n, motion: n.motion });
    } else run.push(n);
  });
  if (run.length) out.push({ kind: 'static', key: 's-end', nodes: run });
  return out;
}

export type SceneFrame = {
  /** Frame size in pt. */
  width: number;
  height: number;
  /** viewBox size. */
  vbW: number;
  vbH: number;
};

/** viewBox → pt mapping for preserveAspectRatio="xMidYMid slice". */
function mapping(f: SceneFrame) {
  const k = Math.max(f.width / f.vbW, f.height / f.vbH);
  return { k, offX: (f.width - f.vbW * k) / 2, offY: (f.height - f.vbH * k) / 2 };
}

type LayerProps = {
  frame: SceneFrame;
  defs: ReactElement[];
  render: (n: SvgNode, key: number | string) => ReactElement;
  segment: Extract<MotionSegment, { kind: 'motion' }>;
  /** 0 = rest (identical to the static cover), 1 = full motion. Animated for smooth start/stop. */
  on: SharedValue<number>;
  playing: boolean;
};

const linear = Easing.linear;
const f2 = (n: number) => Math.round(n * 1000) / 1000;
const sine = Easing.inOut(Easing.sin);

function startDriver(m: SceneMotion, phase: number): number {
  const d = (m.delay ?? 0) + phase * m.period;
  switch (m.k) {
    case 'wave':
      // 0.5 = rest; ease to 1, then ping-pong 1 ↔ 0.
      return withDelay(
        d,
        withSequence(
          withTiming(1, { duration: m.period / 4, easing: sine }),
          withRepeat(withTiming(0, { duration: m.period / 2, easing: sine }), -1, true),
        ),
      );
    case 'loop':
    case 'ripple':
    case 'rise':
      return withDelay(d, withRepeat(withTiming(1, { duration: m.period, easing: linear }), -1, false));
    case 'flicker': {
      const t = m.period / 6;
      return withDelay(
        d,
        withRepeat(
          withSequence(
            withTiming(1, { duration: t * 0.9 }),
            withTiming(0.25, { duration: t * 0.7 }),
            withTiming(0.8, { duration: t * 1.2 }),
            withTiming(0, { duration: t * 0.8 }),
            withTiming(0.65, { duration: t * 1.3 }),
            withTiming(0.5, { duration: t * 1.1 }),
          ),
          -1,
          false,
        ),
      );
    }
    case 'flash': {
      const rest = Math.max(0, m.period - 1100);
      return withDelay(
        d,
        withRepeat(
          withSequence(
            withTiming(0, { duration: 400 }),
            withTiming(0, { duration: rest }),
            withTiming(1, { duration: 70 }),
            withTiming(0.3, { duration: 110 }),
            withTiming(0.95, { duration: 60 }),
            withTiming(0, { duration: 460, easing: Easing.out(Easing.quad) }),
          ),
          -1,
          false,
        ),
      );
    }
  }
}

function restValue(m: SceneMotion): number {
  if (m.k === 'wave' || m.k === 'flicker') return 0.5;
  if (m.k === 'flash') return 1;
  return 0;
}

const MotionLayer = memo(function MotionLayer({ frame, defs, render, segment, on, playing, phase = 0, ghost = false }: LayerProps & { phase?: number; ghost?: boolean }) {
  const m = segment.motion;
  const p = useSharedValue(restValue(m));
  const { k, offX, offY } = mapping(frame);

  useEffect(() => {
    cancelAnimation(p);
    if (!playing) return;
    p.value = m.k === 'wave' ? 0.5 : 0;
    p.value = startDriver(m, phase);
    return () => cancelAnimation(p);
  }, [playing, m, phase, p]);

  const aStyle = useAnimatedStyle(() => {
    const o = on.value;
    const v = p.value;
    let tx = 0;
    let ty = 0;
    let rot = 0;
    let scX = 1;
    let scY = 1;
    let op = 1;
    switch (m.k) {
      case 'wave': {
        const a = v * 2 - 1;
        tx = (m.dx ?? 0) * a * k;
        ty = (m.dy ?? 0) * a * k;
        rot = (m.deg ?? 0) * a;
        scX = 1 + (m.sx ?? m.s ?? 0) * a;
        scY = 1 + (m.sy ?? m.s ?? 0) * a;
        if (m.min != null) op = m.min + (1 - m.min) * v;
        break;
      }
      case 'loop':
        tx = (m.dx ?? 0) * v * k;
        ty = (m.dy ?? 0) * v * k;
        break;
      case 'ripple': {
        const s = m.s ?? 0.15;
        scX = 1 + s * v;
        scY = scX;
        op = v < 0.2 ? v / 0.2 : (1 - v) / 0.8;
        break;
      }
      case 'rise':
        tx = (m.dx ?? 0) * v * k;
        ty = (m.dy ?? 0) * v * k;
        op = Math.sin(Math.PI * v);
        break;
      case 'flicker': {
        const a = v * 2 - 1;
        const s = m.s ?? 0.06;
        scY = 1 + s * a;
        scX = 1 - s * 0.35 * a;
        if (m.min != null) op = m.min + (1 - m.min) * v;
        break;
      }
      case 'flash':
        op = (m.min ?? 0.3) + (1 - (m.min ?? 0.3)) * v;
        break;
    }
    // Blend with the rest pose so starting / stopping never jumps. The ghost copy (second ripple)
    // is invisible at rest.
    const restOp = ghost ? 0 : 1;
    return {
      opacity: restOp + (op - restOp) * o,
      transform: [
        { translateX: tx * o },
        { translateY: ty * o },
        { rotate: `${rot * o}deg` },
        { scaleX: 1 + (scX - 1) * o },
        { scaleY: 1 + (scY - 1) * o },
      ],
    };
  }, [m, k, ghost]);

  const originX = offX + (m.ox ?? frame.vbW / 2) * k;
  const originY = offY + (m.oy ?? frame.vbH / 2) * k;
  // Overscan: the moving layer's own canvas is larger than the cover on every side, so while it
  // translates / scales its edge never enters view (it used to be exactly cover-sized, and the
  // drifting clouds / falling rain showed a hard rectangular edge sliding in). The viewBox grows
  // by the same amount, so the drawing maps to exactly the same place; only the cover's outer
  // frame (or the scene's own clip rect) clips it.
  const padX = Math.ceil(Math.abs(m.dx ?? 0) * k + frame.width * 0.12);
  const padY = Math.ceil(Math.abs(m.dy ?? 0) * k + frame.height * 0.12);
  const vb = `${f2((-offX - padX) / k)} ${f2((-offY - padY) / k)} ${f2((frame.width + padX * 2) / k)} ${f2((frame.height + padY * 2) / k)}`;
  const node = render(segment.node, 'n');
  const tile =
    m.k === 'loop' ? (
      <G transform={`translate(${-(m.dx ?? 0)} ${-(m.dy ?? 0)})`}>{render(segment.node, 't')}</G>
    ) : null;

  let clipBox = { left: 0, top: 0, width: frame.width, height: frame.height };
  if (m.clip) {
    const [x, y, w, h] = m.clip;
    const left = Math.max(0, offX + x * k);
    const top = Math.max(0, offY + y * k);
    clipBox = {
      left,
      top,
      width: Math.min(frame.width, offX + (x + w) * k) - left,
      height: Math.min(frame.height, offY + (y + h) * k) - top,
    };
  }

  return (
    <View pointerEvents="none" style={[styles.clip, clipBox]}>
      <Animated.View
        style={[
          { position: 'absolute', left: -clipBox.left, top: -clipBox.top, width: frame.width, height: frame.height, overflow: 'visible' },
          { transformOrigin: [originX, originY, 0] },
          aStyle,
        ]}
      >
        <Svg
          style={{ position: 'absolute', left: -padX, top: -padY }}
          width={frame.width + padX * 2}
          height={frame.height + padY * 2}
          viewBox={vb}
          preserveAspectRatio="none"
        >
          <Defs>{defs}</Defs>
          {node}
          {tile}
        </Svg>
      </Animated.View>
    </View>
  );
});

type Props = {
  frame: SceneFrame;
  defs: ReactElement[];
  segments: MotionSegment[];
  render: (n: SvgNode, key: number | string) => ReactElement;
  playing: boolean;
};

/** Layered scene: static runs are plain SVGs; moving groups animate transform/opacity on the UI thread. */
export const SceneMotionLayers = memo(function SceneMotionLayers({ frame, defs, segments, render, playing }: Props) {
  const on = useSharedValue(0);
  useEffect(() => {
    on.value = withTiming(playing ? 1 : 0, { duration: playing ? 700 : 450, easing: sine });
  }, [playing, on]);
  const vb = `0 0 ${frame.vbW} ${frame.vbH}`;
  return (
    <>
      {segments.map((s) =>
        s.kind === 'static' ? (
          <Svg key={s.key} style={StyleSheet.absoluteFill} width={frame.width} height={frame.height} viewBox={vb} preserveAspectRatio="xMidYMid slice">
            <Defs>{defs}</Defs>
            {s.nodes.map((n, i) => render(n, i))}
          </Svg>
        ) : s.motion.k === 'ripple' ? (
          [
            <MotionLayer key={s.key} frame={frame} defs={defs} render={render} segment={s} on={on} playing={playing} />,
            <MotionLayer key={`${s.key}b`} frame={frame} defs={defs} render={render} segment={s} on={on} playing={playing} phase={0.5} ghost />,
          ]
        ) : (
          <MotionLayer key={s.key} frame={frame} defs={defs} render={render} segment={s} on={on} playing={playing} />
        ),
      )}
    </>
  );
});

const styles = StyleSheet.create({
  clip: { position: 'absolute', overflow: 'hidden' },
});
