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
      case 'music:low-cloud':
        return (
          <G>
            <Path d="M12 30 C12 24 18 21 23 23 C25 17 34 15 38 20 C42 16 50 18 50 25 C55 25 56 30 52 32 L14 32 C12 32 12 31 12 30 Z" {...common} />
            <Path d="M24 44 A8 8 0 0 1 40 44" {...common} strokeOpacity={0.7} />
            <Line x1="8" y1="44" x2="56" y2="44" {...common} />
            <Line x1="14" y1="51" x2="50" y2="51" {...common} strokeOpacity={0.5} />
          </G>
        );
      case 'music:quiet-hours':
        return (
          <G>
            <Line x1="18" y1="12" x2="46" y2="12" {...common} />
            <Line x1="18" y1="52" x2="46" y2="52" {...common} />
            <Path d="M22 12 C22 24 30 28 30 32 C30 36 22 40 22 52 M42 12 C42 24 34 28 34 32 C34 36 42 40 42 52" {...common} />
            <Path d="M26 48 Q32 40 38 48 Z" fill={stroke} stroke="none" opacity={0.45} />
            <Line x1="32" y1="33" x2="32" y2="42" {...common} strokeOpacity={0.6} />
          </G>
        );
      case 'music:golden-hour':
        return (
          <G>
            <Path d="M18 40 A14 14 0 0 1 46 40" {...common} />
            <Line x1="8" y1="40" x2="56" y2="40" {...common} />
            {[-60, -30, 0, 30, 60].map((deg) => {
              const r = ((deg - 90) * Math.PI) / 180;
              return <Line key={deg} x1={32 + Math.cos(r) * 18} y1={40 + Math.sin(r) * 18} x2={32 + Math.cos(r) * 24} y2={40 + Math.sin(r) * 24} {...common} strokeOpacity={0.7} />;
            })}
            <Path d="M14 56 Q15 48 13 44 M50 56 Q49 49 52 45" {...common} strokeOpacity={0.6} />
          </G>
        );
      case 'music:velvet-night':
        return (
          <G>
            <Path d="M36 12 A11 11 0 1 1 36 34 A13.5 13.5 0 0 0 36 12 Z" {...common} />
            <Path d="M8 48 C18 40 26 40 34 46 C42 52 50 48 56 42" {...common} />
            <Path d="M8 54 C20 48 32 50 40 54 C46 57 52 55 56 52" {...common} strokeOpacity={0.5} />
            <Circle cx="16" cy="20" r="1.2" fill={stroke} stroke="none" />
          </G>
        );
      case 'music:starlit':
        return (
          <G>
            <Path d="M24 12 L27 21 L36 24 L27 27 L24 36 L21 27 L12 24 L21 21 Z" {...common} />
            <Path d="M44 30 L46 36 L52 38 L46 40 L44 46 L42 40 L36 38 L42 36 Z" {...common} strokeOpacity={0.75} />
            <Circle cx="48" cy="14" r="1.4" fill={stroke} stroke="none" />
            <Circle cx="16" cy="46" r="1.2" fill={stroke} stroke="none" />
            <Circle cx="30" cy="52" r="1" fill={stroke} stroke="none" opacity={0.6} />
          </G>
        );
      case 'music:drift':
        return (
          <G>
            <Path d="M14 34 Q22 44 32 44 Q44 44 52 32 L46 36 Q32 38 18 36 Z" {...common} />
            <Path d="M8 50 Q14 46 20 50 T32 50 T44 50 T56 50" {...common} strokeOpacity={0.7} />
            <Path d="M4 42 Q8 40 12 42" {...common} strokeOpacity={0.45} />
            <Line x1="26" y1="30" x2="44" y2="46" {...common} strokeOpacity={0.6} />
          </G>
        );
      case 'ambient:night_crickets':
        return (
          <G>
            <Ellipse cx="34" cy="38" rx="12" ry="5" {...common} />
            <Circle cx="19" cy="37" r="4" {...common} />
            <Path d="M38 35 L46 26 L50 40" {...common} />
            <Path d="M16 34 Q10 22 20 14 M18 33 Q16 20 28 12" {...common} strokeOpacity={0.7} />
            <Path d="M8 48 Q30 44 58 50" {...common} />
            <Circle cx="50" cy="14" r="1.4" fill={stroke} stroke="none" />
          </G>
        );
      case 'ambient:snow_morning':
        return (
          <G>
            {[0, 60, 120].map((deg) => {
              const r = (deg * Math.PI) / 180;
              return <Line key={deg} x1={28 - Math.cos(r) * 14} y1={28 - Math.sin(r) * 14} x2={28 + Math.cos(r) * 14} y2={28 + Math.sin(r) * 14} {...common} />;
            })}
            {[0, 60, 120, 180, 240, 300].map((deg) => {
              const r = (deg * Math.PI) / 180;
              const bx = 28 + Math.cos(r) * 7;
              const by = 28 + Math.sin(r) * 7;
              return <Path key={deg} d={`M${bx + Math.cos(r + 0.75) * 5} ${by + Math.sin(r + 0.75) * 5} L${bx} ${by} L${bx + Math.cos(r - 0.75) * 5} ${by + Math.sin(r - 0.75) * 5}`} {...common} strokeOpacity={0.7} />;
            })}
            <Circle cx="48" cy="46" r="1.6" fill={stroke} stroke="none" />
            <Circle cx="14" cy="52" r="1.2" fill={stroke} stroke="none" opacity={0.7} />
            <Circle cx="54" cy="20" r="1.2" fill={stroke} stroke="none" opacity={0.7} />
          </G>
        );
      case 'ambient:night_stream':
        return (
          <G>
            <Path d="M28 10 C24 20 38 26 32 36 C28 44 18 48 16 56" {...common} />
            <Path d="M36 10 C34 20 46 26 42 36 C38 44 32 50 34 56" {...common} />
            <Ellipse cx="44" cy="48" rx="6" ry="3.5" {...common} strokeOpacity={0.75} />
            <Ellipse cx="14" cy="36" rx="5" ry="3" {...common} strokeOpacity={0.75} />
            <Path d="M30 26 Q33 24 36 26 M24 44 Q27 42 30 44" {...common} strokeOpacity={0.5} />
          </G>
        );
      case 'ambient:distant_thunder':
        return (
          <G>
            <Path d="M12 30 C10 22 18 18 23 21 C26 13 38 12 41 19 C47 16 54 21 52 28 C56 30 54 34 50 34 L16 34 C12 34 11 32 12 30 Z" {...common} />
            <Path d="M34 36 L29 45 L35 45 L30 55" {...common} />
            {[16, 22, 44, 50].map((x) => <Line key={x} x1={x} y1={40} x2={x - 2} y2={48} {...common} strokeOpacity={0.5} />)}
          </G>
        );
      case 'ambient:after_the_rain':
        return (
          <G>
            <Path d="M12 50 C12 30 26 16 50 14 C50 38 36 50 12 50 Z" {...common} />
            <Path d="M12 50 L40 24" {...common} strokeOpacity={0.6} />
            <Path d="M50 30 C47 35 46 38 48 40 C50 42 53 41 53 38 C53 36 52 34 50 30 Z" {...common} />
            <Circle cx="26" cy="38" r="1.3" fill={stroke} stroke="none" opacity={0.7} />
            <Circle cx="32" cy="30" r="1.1" fill={stroke} stroke="none" opacity={0.7} />
          </G>
        );
      case 'ambient:hearth':
        return (
          <G>
            <Line x1="8" y1="14" x2="56" y2="14" {...common} />
            <Path d="M12 14 V54 M52 14 V54" {...common} />
            <Path d="M20 54 V32 Q20 22 32 22 Q44 22 44 32 V54" {...common} />
            <Path d="M32 32 C28 38 27 43 30 47 C31 49 34 49 35 47 C37 43 36 38 32 32 Z" {...common} />
            <Line x1="24" y1="50" x2="40" y2="50" {...common} strokeOpacity={0.7} />
            <Line x1="6" y1="54" x2="58" y2="54" {...common} />
          </G>
        );
      case 'ambient:rain_on_eaves':
        return (
          <G>
            <Path d="M6 20 L58 12" {...common} />
            <Path d="M6 26 L58 18" {...common} strokeOpacity={0.7} />
            {[14, 24, 34, 44, 54].map((x, i) => (
              <Line key={x} x1={x} y1={26 - (x - 6) * 0.154 + 2} x2={x} y2={26 - (x - 6) * 0.154 + 16 + (i % 2) * 6} {...common} strokeOpacity={0.75} />
            ))}
            <Path d="M8 54 Q20 50 32 54 T56 54" {...common} strokeOpacity={0.6} />
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
