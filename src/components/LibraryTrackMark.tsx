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
            <Path d="M10 26 Q18 18 26 26 T42 26 T58 26" {...common} />
            <Path d="M10 36 Q18 28 26 36 T42 36 T58 36" {...common} />
            <Path d="M10 46 Q18 38 26 46 T42 46 T58 46" {...common} strokeOpacity={0.55} />
          </G>
        );
      case 'ambient:morning_birds':
        return (
          <G>
            <Path d="M14 30 Q22 22 30 30" {...common} />
            <Path d="M30 30 Q38 22 46 30" {...common} />
            <Path d="M22 42 Q30 34 38 42" {...common} strokeOpacity={0.55} />
          </G>
        );
      case 'ambient:soft_rain':
        return (
          <G>
            <Path d="M18 18 Q32 10 46 18 Q50 28 32 30 Q14 28 18 18 Z" {...common} />
            <Line x1="22" y1="36" x2="20" y2="48" {...common} />
            <Line x1="32" y1="34" x2="30" y2="50" {...common} />
            <Line x1="42" y1="36" x2="40" y2="48" {...common} />
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
