import { memo, useMemo, type ReactElement } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import {
  buildSceneCached,
  type GradStop,
  type SceneMode,
  type SceneSpec,
  type SvgDef,
  type SvgNode,
} from '@/lib/scene-gen';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';

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
  style?: StyleProp<ViewStyle>;
};

/** Theme → palette family: light UI (peachCream) = warm light scenes, dark UI = night palette. */
export function sceneModeFor(colors: ColorTokens): SceneMode {
  return colors.statusBarStyle === 'dark' ? 'light' : 'dark';
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
function SceneCoverBase({ scene, size, height, radius = 0, mode, lod, style }: Props) {
  const colors = useThemeColors();
  const h = height ?? size;
  const sceneMode = mode ?? sceneModeFor(colors);
  const level = lod ?? (Math.min(size, h) < 72 ? 'lite' : 'full');
  // Quantise aspect so similar tiles share a cached model.
  const aspect = Math.round((h / size) * 20) / 20;

  const content = useMemo(() => {
    const model = buildSceneCached(scene, { mode: sceneMode, aspect, lod: level, accent: colors.accent });
    return {
      vb: `0 0 ${model.w} ${model.h}`,
      defs: model.defs.map(renderDef),
      nodes: model.nodes.map((n, i) => renderNode(n, i)),
    };
  }, [scene, sceneMode, aspect, level, colors.accent]);

  const frame = useMemo(
    () => [styles.frame, { width: size, height: h, borderRadius: radius }, style],
    [size, h, radius, style],
  );

  return (
    <View style={frame} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={h} viewBox={content.vb} preserveAspectRatio="xMidYMid slice">
        <Defs>{content.defs}</Defs>
        {content.nodes}
      </Svg>
    </View>
  );
}

export const SceneCover = memo(SceneCoverBase);

/** Small frosted lock badge that stays readable over any scene. */
export function SceneLockBadge({ size = 22, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const colors = useThemeColors();
  const badge = useMemo(() => createBadgeStyles(colors, size), [colors, size]);
  return (
    <View style={[badge.badge, style]}>
      <Ionicons name="lock-closed" size={Math.round(size * 0.52)} color={colors.text} />
    </View>
  );
}

function createBadgeStyles(colors: ColorTokens, size: number) {
  const dark = colors.statusBarStyle === 'light';
  return StyleSheet.create({
    badge: {
      width: size,
      height: size,
      borderRadius: size / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: dark ? 'rgba(18,28,42,0.72)' : 'rgba(255,248,244,0.78)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: dark ? 'rgba(232,238,245,0.28)' : 'rgba(42,24,16,0.14)',
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },
  });
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
});
