import { memo, useEffect, useMemo, useState, type ReactElement } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {
  buildSceneCached,
  type GradStop,
  type SceneMode,
  type SceneSpec,
  type SceneTokens,
  type SvgDef,
  type SvgNode,
} from '@/lib/scene-gen';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { useMotionActive } from '@/lib/use-motion-active';
import { useReduceMotion } from '@/lib/use-reduce-motion';
import { markCoverDrawn, scheduleCoverMount, wasCoverDrawn } from '@/lib/cover-mount-queue';
import { DURATION } from '@/lib/motion';
import { SceneMotionLayers, segmentScene } from '@/components/scene-motion-layers';

type Props = {
  scene: SceneSpec;
  /** Width in pt (and height, unless `height` is given). */
  size: number;
  height?: number;
  radius?: number;
  /** Force a palette family; defaults to the active theme. */
  mode?: SceneMode;
  /** Defaults to 'lite' below 72pt (no grain, bolder detail). */
  lod?: 'full' | 'lite';
  /**
   * Animate the scene's tagged layers (rain falls, flames flicker…). Pass a boolean only where a
   * cover can ever animate: the previewing track or the selected main sound. Motion runs only while
   * the screen is focused, the app is foregrounded and Reduce Motion is off.
   */
  animate?: boolean;
  /**
   * Lists with many covers (Library shelves, the track picker): show a flat sky-coloured
   * placeholder first and mount the SVG a couple of covers at a time once the screen has settled,
   * with a short fade (none under Reduce Motion). A scene already drawn this session mounts at once.
   */
  defer?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Theme → palette family: light UI (peachCream) = warm light scenes, dark UI = night palette. */
export function sceneModeFor(colors: ColorTokens): SceneMode {
  return colors.statusBarStyle === 'dark' ? 'light' : 'dark';
}

/** Theme tokens the scene generator uses for motif colours (balloons, flowers, brass, felt, night sky depth). */
export function sceneTokensFor(colors: ColorTokens): SceneTokens {
  return { accent: colors.accent, calm: colors.calm, sunrise: colors.sunrise, warning: colors.warning, bg: colors.bg };
}

/** Build options exactly as SceneCover does (shared with the background pre-warm). */
export function sceneOptionsFor(
  colors: ColorTokens,
  size: number,
  height?: number,
  over: { mode?: SceneMode; lod?: 'full' | 'lite' } = {},
): Parameters<typeof buildSceneCached>[1] {
  const h = height ?? size;
  return {
    mode: over.mode ?? sceneModeFor(colors),
    // Quantise aspect so similar tiles share a cached model.
    aspect: Math.round((h / size) * 20) / 20,
    lod: over.lod ?? (Math.min(size, h) < 72 ? 'lite' : 'full'),
    accent: colors.accent,
    tokens: sceneTokensFor(colors),
  };
}

type SceneContent = { vb: string; defs: ReactElement[]; nodes: ReactElement[]; placeholder: string };
/** React elements per cached model, shared by every cover showing that scene (and by remounts). */
const CONTENT = new WeakMap<object, SceneContent>();
export function sceneContentFor(model: ReturnType<typeof buildSceneCached>): SceneContent {
  let c = CONTENT.get(model);
  if (!c) {
    c = {
      vb: `0 0 ${model.w} ${model.h}`,
      defs: model.defs.map(renderDef),
      nodes: model.nodes.map((n, i) => renderNode(n, i)),
      placeholder: placeholderColor(model),
    };
    CONTENT.set(model, c);
  }
  return c;
}

/** Mid sky colour of the scene (first linear gradient), so the placeholder → scene fade is gentle. */
function placeholderColor(model: ReturnType<typeof buildSceneCached>): string {
  const sky = model.defs.find((d) => d.t === 'linear');
  if (sky && sky.t === 'linear' && sky.stops.length) return sky.stops[Math.floor(sky.stops.length / 2)]!.c;
  const rect = model.nodes.find((n) => n.t === 'rect');
  return rect && rect.t === 'rect' && rect.fill && !rect.fill.startsWith('url(') ? rect.fill : 'transparent';
}

function stops(list: GradStop[]) {
  return list.map((s, i) => (
    <Stop key={i} offset={s.o} stopColor={s.c} stopOpacity={s.a ?? 1} />
  ));
}

function renderNode(n: SvgNode, key: number | string): ReactElement {
  switch (n.t) {
    case 'rect':
      return <Rect key={key} x={n.x} y={n.y} width={n.w} height={n.h} rx={n.rx} fill={n.fill} opacity={n.opacity} />;
    case 'circle':
      return <Circle key={key} cx={n.cx} cy={n.cy} r={n.r} fill={n.fill} opacity={n.opacity} />;
    case 'ellipse':
      return <Ellipse key={key} cx={n.cx} cy={n.cy} rx={n.rx} ry={n.ry} fill={n.fill} opacity={n.opacity} />;
    case 'path':
      return (
        <Path
          key={key}
          d={n.d}
          fill={n.fill ?? 'none'}
          stroke={n.stroke}
          strokeWidth={n.stroke ? n.sw ?? 1 : undefined}
          strokeLinecap={n.stroke ? 'round' : undefined}
          strokeLinejoin={n.stroke ? 'round' : undefined}
          opacity={n.opacity}
        />
      );
    case 'g':
      return (
        <G key={key} clipPath={n.clip ? `url(#${n.clip})` : undefined} opacity={n.opacity}>
          {n.children.map((c, i) => renderNode(c, i))}
        </G>
      );
  }
}

function renderDef(d: SvgDef): ReactElement {
  if (d.t === 'linear') {
    return (
      <LinearGradient key={d.id} id={d.id} gradientUnits="userSpaceOnUse" x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}>
        {stops(d.stops)}
      </LinearGradient>
    );
  }
  if (d.t === 'radial') {
    return (
      <RadialGradient
        key={d.id}
        id={d.id}
        gradientUnits={d.units === 'user' ? 'userSpaceOnUse' : 'objectBoundingBox'}
        cx={d.cx}
        cy={d.cy}
        r={d.r}
        fx={d.cx}
        fy={d.cy}
      >
        {stops(d.stops)}
      </RadialGradient>
    );
  }
  return (
    <ClipPath key={d.id} id={d.id}>
      {d.children.map((c, i) => renderNode(c, i))}
    </ClipPath>
  );
}

/**
 * Generative layered landscape cover (sky, sun/moon, parallax silhouettes, haze, grain).
 * Geometry comes from pure `buildScene` (seeded), memoised per spec + size class.
 * Gradient ids derive from a hash of the spec/options, so instances never collide
 * with a *different* scene; identical scenes share identical defs.
 */
function SceneCoverBase({ scene, size, height, radius = 0, mode, lod, animate, defer, style }: Props) {
  const colors = useThemeColors();
  const h = height ?? size;

  const model = useMemo(
    () => buildSceneCached(scene, sceneOptionsFor(colors, size, h, { mode, lod })),
    [scene, colors, size, h, mode, lod],
  );
  const content = sceneContentFor(model);

  // Deferred covers: placeholder until the mount queue gets to this one.
  const [shown, setShown] = useState(() => !defer || wasCoverDrawn(model));
  const [fade, setFade] = useState(false);
  // Already drawn elsewhere (or the model changed to one that was): show straight away.
  if (!shown && wasCoverDrawn(model)) setShown(true);
  useEffect(() => {
    if (shown) {
      markCoverDrawn(model);
      return;
    }
    return scheduleCoverMount(() => {
      setFade(true);
      setShown(true);
    });
  }, [shown, model]);
  const reduce = useReduceMotion();

  const frame = useMemo(
    () => [styles.frame, { width: size, height: h, borderRadius: radius }, style],
    [size, h, radius, style],
  );

  if (!shown) {
    return (
      <View
        style={[frame, { backgroundColor: content.placeholder }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  const svg =
    animate !== undefined ? (
        <AnimatedLayers model={model} defs={content.defs} width={size} height={h} animate={animate}>
          <Svg width={size} height={h} viewBox={content.vb} preserveAspectRatio="xMidYMid slice">
            <Defs>{content.defs}</Defs>
            {content.nodes}
          </Svg>
        </AnimatedLayers>
      ) : (
        <Svg width={size} height={h} viewBox={content.vb} preserveAspectRatio="xMidYMid slice">
          <Defs>{content.defs}</Defs>
          {content.nodes}
        </Svg>
      );

  return (
    <View
      style={fade ? [frame, { backgroundColor: content.placeholder }] : frame}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {fade && !reduce ? <Animated.View entering={FadeIn.duration(DURATION.base)}>{svg}</Animated.View> : svg}
    </View>
  );
}

/**
 * Static SVG until the cover first goes live; from then on the scene is drawn as layers (static
 * runs + moving groups) so starting/stopping only eases transforms — no redraw, no flash.
 */
function AnimatedLayers({
  model,
  defs,
  width,
  height,
  animate,
  children,
}: {
  model: ReturnType<typeof buildSceneCached>;
  defs: ReactElement[];
  width: number;
  height: number;
  animate: boolean;
  children: ReactElement;
}) {
  const live = useMotionActive(animate);
  // Sticky: once the cover has gone live, keep the segmented layers.
  const [layered, setLayered] = useState(false);
  if (live && !layered) setLayered(true);
  // Segmenting is only needed once the cover actually goes live (most never do).
  const segments = useMemo(() => (layered ? segmentScene(model.nodes) : null), [layered, model]);
  const hasMotion = !!segments && segments.some((s) => s.kind === 'motion');
  const frame = useMemo(() => ({ width, height, vbW: model.w, vbH: model.h }), [width, height, model]);
  if (!layered || !segments || !hasMotion) return children;
  return <SceneMotionLayers frame={frame} defs={defs} segments={segments} render={renderNode} playing={live} />;
}

export const SceneCover = memo(SceneCoverBase);

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
});
