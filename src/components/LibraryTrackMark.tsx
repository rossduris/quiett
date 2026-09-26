import Svg, { Circle, Path, Rect, Line, G, Ellipse } from 'react-native-svg';
import type { UnlockTrackKind } from '@/constants/unlock-tracks';

type Props = {
  trackId: string;
  kind: UnlockTrackKind;
  /** Stroke / fill tint — typically track.accent */
  color: string;
  size?: number;
};

/**
 * Themeable vector cover mark for Library / morning-sound tiles.
 * One mark per track id (with kind fallbacks) — recolors with `color`.
 */
export function LibraryTrackMark({ trackId, kind, color, size = 56 }: Props) {
  const stroke = color;
  const sw = Math.max(1.5, size * 0.045);
  const common = { stroke, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  const body = (() => {
    switch (trackId) {
      case 'guided:first-light':
        return (
          <G>
            <Circle cx="32" cy="34" r="10" {...common} />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
              const r = (deg * Math.PI) / 180;
              const x1 = 32 + Math.cos(r) * 16;
              const y1 = 34 + Math.sin(r) * 16;
              const x2 = 32 + Math.cos(r) * 22;
              const y2 = 34 + Math.sin(r) * 22;
              return <Line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} {...common} />;
            })}
          </G>
        );
      case 'guided:open-eyes':
        return (
          <G>
            <Path d="M12 32 Q32 18 52 32 Q32 46 12 32 Z" {...common} />
            <Circle cx="32" cy="32" r="6" {...common} />
          </G>
        );
      case 'guided:still-horizon':
        return (
          <G>
            <Line x1="10" y1="36" x2="54" y2="36" {...common} />
            <Circle cx="44" cy="24" r="7" {...common} />
          </G>
        );
      case 'guided:warm-window':
        return (
          <G>
            <Rect x="16" y="14" width="32" height="36" rx="2" {...common} />
            <Line x1="32" y1="14" x2="32" y2="50" {...common} />
            <Line x1="16" y1="32" x2="48" y2="32" {...common} />
          </G>
        );
      case 'guided:quiet-rise':
        return (
          <G>
            <Path d="M14 44 C22 44 24 28 32 28 C40 28 42 16 50 16" {...common} />
            <Path d="M14 50 C24 50 26 36 34 36 C42 36 44 24 52 24" {...common} strokeOpacity={0.55} />
          </G>
        );
      case 'guided:clear-morning':
        return (
          <G>
            <Circle cx="32" cy="28" r="11" {...common} />
            <Line x1="12" y1="46" x2="52" y2="46" {...common} />
            <Line x1="18" y1="50" x2="46" y2="50" {...common} strokeOpacity={0.5} />
          </G>
        );
      case 'music:soft-pad':
        return (
          <G>
            <Path d="M12 36 Q20 24 28 36 Q36 48 44 36 Q50 28 54 34" {...common} />
            <Path d="M12 28 Q20 16 28 28 Q36 40 44 28 Q50 20 54 26" {...common} strokeOpacity={0.55} />
          </G>
        );
      case 'music:dawn-keys':
        return (
          <G>
            <Rect x="14" y="18" width="10" height="28" rx="1.5" {...common} />
            <Rect x="27" y="18" width="10" height="28" rx="1.5" {...common} />
            <Rect x="40" y="18" width="10" height="28" rx="1.5" {...common} />
            <Rect x="21" y="18" width="6" height="16" rx="1" fill={stroke} stroke="none" opacity={0.35} />
            <Rect x="34" y="18" width="6" height="16" rx="1" fill={stroke} stroke="none" opacity={0.35} />
          </G>
        );
      case 'music:warm-drone':
        return (
          <G>
            <Circle cx="32" cy="32" r="8" {...common} />
            <Circle cx="32" cy="32" r="14" {...common} strokeOpacity={0.7} />
            <Circle cx="32" cy="32" r="20" {...common} strokeOpacity={0.4} />
          </G>
        );
      case 'music:clear-bell':
        return (
          <G>
            <Path d="M32 14 L32 18" {...common} />
            <Path d="M20 28 C20 20 44 20 44 28 L46 40 H18 Z" {...common} />
            <Line x1="18" y1="40" x2="46" y2="40" {...common} />
            <Circle cx="32" cy="46" r="3" {...common} />
          </G>
        );
      case 'ambient:calm_waves':
        return (
          <G>
            <Circle cx="42" cy="18" r="5" {...common} strokeOpacity={0.7} />
            <Line x1="8" y1="26" x2="56" y2="26" {...common} strokeOpacity={0.55} />
            <Path d="M8 36 Q14 32 20 36 T32 36 T44 36 T56 36" {...common} />
            <Path d="M8 46 Q16 42 24 46 T40 46 T56 46" {...common} strokeOpacity={0.75} />
            <Path d="M12 54 L20 54 M28 55 L40 55 M46 54 L52 54" {...common} strokeOpacity={0.45} />
          </G>
        );
      case 'ambient:morning_birds':
        return (
          <G>
            <Line x1="18" y1="54" x2="18" y2="28" {...common} />
            <Circle cx="18" cy="20" r="10" {...common} />
            <Path d="M18 42 Q32 38 52 38" {...common} />
            <Path d="M34 38 C31 32 36 28 40 30 L45 28.5 L42 32 C42 36 38 38 34 38 Z" {...common} />
            <Path d="M40 16 Q44 12 48 16 Q52 12 56 16" {...common} strokeOpacity={0.6} />
          </G>
        );
      case 'ambient:soft_rain':
        return (
          <G>
            {[14, 24, 34, 44, 54].map((x, i) => (
              <Line key={x} x1={x} y1={i % 2 ? 14 : 10} x2={x - 2} y2={i % 2 ? 30 : 26} {...common} strokeOpacity={0.75} />
            ))}
            {[19, 29, 39, 49].map((x) => (
              <Line key={x} x1={x} y1={24} x2={x - 1.5} y2={36} {...common} strokeOpacity={0.5} />
            ))}
            <Path d="M8 44 Q20 38 32 43 T58 42" {...common} />
            <Ellipse cx="34" cy="53" rx="9" ry="2.5" {...common} strokeOpacity={0.6} />
          </G>
        );
      case 'ambient:wind_in_trees':
        return (
          <G>
            <Line x1="26" y1="52" x2="26" y2="34" {...common} />
            <Circle cx="26" cy="26" r="11" {...common} />
            <Path d="M40 20 Q48 16 54 20" {...common} strokeOpacity={0.7} />
            <Path d="M42 30 Q50 26 56 30" {...common} strokeOpacity={0.55} />
            <Path d="M40 40 Q46 37 50 40" {...common} strokeOpacity={0.4} />
          </G>
        );
      case 'ambient:morning_pond':
        return (
          <G>
            <Ellipse cx="34" cy="40" rx="18" ry="6" {...common} />
            <Ellipse cx="34" cy="40" rx="26" ry="10" {...common} strokeOpacity={0.45} />
            <Line x1="14" y1="36" x2="14" y2="14" {...common} />
            <Ellipse cx="14" cy="20" rx="2.5" ry="5" {...common} />
          </G>
        );
      case 'ambient:campfire':
        return (
          <G>
            <Path d="M32 14 C24 24 22 32 26 40 C28 44 36 44 38 40 C42 32 38 24 32 14 Z" {...common} />
            <Path d="M32 28 C29 33 29 37 32 40 C35 37 35 33 32 28 Z" {...common} strokeOpacity={0.6} />
            <Line x1="16" y1="50" x2="48" y2="42" {...common} />
            <Line x1="16" y1="42" x2="48" y2="50" {...common} />
          </G>
        );
      default:
        if (kind === 'guided') {
          return (
            <G>
              <Circle cx="32" cy="30" r="10" {...common} />
              <Line x1="14" y1="48" x2="50" y2="48" {...common} />
            </G>
          );
        }
        if (kind === 'music') {
          return (
            <G>
              <Path d="M24 18 L24 42" {...common} />
              <Ellipse cx="20" cy="42" rx="6" ry="4" {...common} />
              <Path d="M24 18 L40 14 L40 38" {...common} />
              <Ellipse cx="36" cy="38" rx="6" ry="4" {...common} />
            </G>
          );
        }
        return (
          <G>
            <Path d="M12 34 Q22 24 32 34 T52 34" {...common} />
            <Path d="M16 42 Q26 34 36 42 T56 42" {...common} strokeOpacity={0.55} />
          </G>
        );
    }
  })();

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {body}
    </Svg>
  );
}
