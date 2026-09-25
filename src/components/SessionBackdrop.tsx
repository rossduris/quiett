import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useThemeColors } from '@/lib/theme-provider';

/**
 * Full-screen warm dusk backdrop for the session / practice screens:
 * deep plum-brown at the top easing into an ember-peach glow at the bottom.
 * Static SVG (no animation) so it costs nothing per frame.
 */
export function SessionBackdrop() {
  const colors = useThemeColors();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="quiettDusk" x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={colors.sessionBgTop} />
            <Stop offset={0.55} stopColor={colors.sessionBgMid} />
            <Stop offset={1} stopColor={colors.sessionBgBottom} />
          </LinearGradient>
          <RadialGradient id="quiettEmber" cx="50%" cy="100%" rx="75%" ry="45%">
            <Stop offset={0} stopColor={colors.sessionGlow} stopOpacity={0.35} />
            <Stop offset={1} stopColor={colors.sessionGlow} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="quiettHalo" cx="50%" cy="42%" rx="60%" ry="32%">
            <Stop offset={0} stopColor={colors.sessionGlow} stopOpacity={0.1} />
            <Stop offset={1} stopColor={colors.sessionGlow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#quiettDusk)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#quiettHalo)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#quiettEmber)" />
      </Svg>
    </View>
  );
}
