import type { ReactElement } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import type { Badge } from '@/constants/badges';
import type { ColorTokens } from '@/constants/themes';

/**
 * Illustrated milestone medallion (pure SVG, no hooks, so the box preview can render it too).
 * Earned: warm gradient disc, soft rim, glyph in `onAccent`. Locked: outline only.
 */
type Props = {
  badge: Badge;
  earned: boolean;
  size: number;
  colors: ColorTokens;
  /** Unique per instance (gradient ids). */
  idPrefix: string;
};

type Ink = { fill: string; stroke: string; solid: boolean };

function starPath(cx: number, cy: number, r: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : inner;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

const FLAME =
  'M50 20 C57 29 66 36 65 49 C64 59 57 65 50 65 C43 65 36 59 35 50 C34 42 40 37 43 29 C45 35 47 37 50 38 C50 32 48 26 50 20 Z';

function numberLabel(n: string, ink: Ink, y = 82): ReactElement {
  return (
    <SvgText x="50" y={y} textAnchor="middle" fontSize="15" fontWeight="800" fill={ink.solid ? ink.fill : 'none'} stroke={ink.solid ? 'none' : ink.stroke} strokeWidth={ink.solid ? 0 : 0.9}>
      {n}
    </SvgText>
  );
}

function glyph(badge: Badge, ink: Ink): ReactElement {
  const sw = 3;
  const fillOr = (solid: boolean) => (solid ? ink.fill : 'none');
  const id = badge.id;
  if (id === 'first-unlock') {
    const rays = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      const x1 = 50 + Math.cos(a) * 19;
      const y1 = 50 + Math.sin(a) * 19;
      const x2 = 50 + Math.cos(a) * 26;
      const y2 = 50 + Math.sin(a) * 26;
      return `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }).join(' ');
    return (
      <G>
        <Circle cx="50" cy="50" r="12" fill={fillOr(ink.solid)} stroke={ink.stroke} strokeWidth={sw} />
        <Path d={rays} stroke={ink.stroke} strokeWidth={sw} strokeLinecap="round" />
      </G>
    );
  }
  if (id.startsWith('streak-')) {
    return (
      <G>
        <G transform="translate(50 42) scale(0.82) translate(-50 -42)">
          <Path d={FLAME} fill={fillOr(ink.solid)} stroke={ink.stroke} strokeWidth={sw} strokeLinejoin="round" />
        </G>
        {numberLabel(id.replace('streak-', ''), ink)}
      </G>
    );
  }
  if (id.startsWith('mornings-')) {
    return (
      <G>
        <Path d={starPath(50, 42, 17, 7.5)} fill={fillOr(ink.solid)} stroke={ink.stroke} strokeWidth={sw - 0.5} strokeLinejoin="round" />
        {numberLabel(id.replace('mornings-', ''), ink)}
      </G>
    );
  }
  if (id === 'perfect-week') {
    const dots = Array.from({ length: 7 }, (_, i) => {
      const a = Math.PI * (1.1 + (i / 6) * 0.8);
      return <Circle key={i} cx={50 + Math.cos(a) * 24} cy={58 + Math.sin(a) * 24} r="3.2" fill={ink.solid ? ink.fill : 'none'} stroke={ink.stroke} strokeWidth={1.4} />;
    });
    return (
      <G>
        {dots}
        <Path d="M38 56 L47 65 L64 46" fill="none" stroke={ink.stroke} strokeWidth={sw + 0.5} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    );
  }
  if (id === 'tried-guided') {
    return (
      <G>
        <Path d="M43 34 a7 7 0 0 1 14 0 v14 a7 7 0 0 1 -14 0 Z" fill={fillOr(ink.solid)} stroke={ink.stroke} strokeWidth={sw} />
        <Path d="M36 46 a14 14 0 0 0 28 0 M50 60 v8 M43 68 h14" fill="none" stroke={ink.stroke} strokeWidth={sw} strokeLinecap="round" />
      </G>
    );
  }
  if (id === 'tried-ambient') {
    return (
      <G>
        <Path d="M50 30 C62 36 66 50 58 62 C54 67 46 67 42 62 C34 50 38 36 50 30 Z" fill={fillOr(ink.solid)} stroke={ink.stroke} strokeWidth={sw} strokeLinejoin="round" />
        <Path d="M50 36 V66" stroke={ink.solid ? ink.stroke : ink.stroke} strokeOpacity={ink.solid ? 0.45 : 1} strokeWidth={2} strokeLinecap="round" />
        <Path d="M30 72 q5 -4 10 0 t10 0 t10 0 t10 0" fill="none" stroke={ink.stroke} strokeWidth={2.4} strokeLinecap="round" />
      </G>
    );
  }
  // tried-healing: tones
  return (
    <G>
      <Path d="M28 50 C33 36 39 36 44 50 S 55 64 60 50 S 67 38 72 50" fill="none" stroke={ink.stroke} strokeWidth={sw} strokeLinecap="round" />
      <Circle cx="50" cy="50" r="22" fill="none" stroke={ink.stroke} strokeOpacity={0.35} strokeWidth={1.5} />
    </G>
  );
}

function gradientFor(badge: Badge, c: ColorTokens): [string, string] {
  if (badge.category === 'streak') return [c.sunrise, c.calm];
  if (badge.category === 'variety') return [c.calm, c.accentStrong];
  return [c.sunrise, c.accentStrong];
}

export function BadgeMedallion({ badge, earned, size, colors, idPrefix }: Props) {
  const gid = `${idPrefix}-g`;
  const sid = `${idPrefix}-s`;
  const [top, bottom] = gradientFor(badge, colors);
  if (earned) {
    const ink: Ink = { fill: colors.onAccent, stroke: colors.onAccent, solid: true };
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor={top} />
            <Stop offset="1" stopColor={bottom} />
          </LinearGradient>
          <LinearGradient id={sid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.35} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Circle cx="50" cy="50" r="47" fill={`url(#${gid})`} />
        <Circle cx="50" cy="50" r="47" fill={`url(#${sid})`} />
        <Circle cx="50" cy="50" r="40" fill="none" stroke={colors.onAccent} strokeOpacity={0.3} strokeWidth={1.5} />
        {glyph(badge, ink)}
      </Svg>
    );
  }
  const ink: Ink = { fill: 'none', stroke: colors.textDim, solid: false };
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" opacity={0.75}>
      <Circle cx="50" cy="50" r="46" fill="none" stroke={colors.textDim} strokeOpacity={0.55} strokeWidth={2} />
      <Circle cx="50" cy="50" r="40" fill="none" stroke={colors.textDim} strokeOpacity={0.35} strokeWidth={1.2} strokeDasharray="3 4" />
      {glyph(badge, ink)}
    </Svg>
  );
}
