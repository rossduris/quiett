import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { SceneCover } from '@/components/SceneCover';
import { sceneSpecFor } from '@/constants/scene-covers';
import type { ColorTokens } from '@/constants/themes';
import { EASE, EASE_IN_OUT } from '@/lib/motion';

type Props = {
  trackId: string;
  width: number;
  height: number;
  /** Meditating: the scene rises over the (still running) camera. */
  shown: boolean;
  /** Cap on opacity (dev pose overlay keeps the camera readable underneath). */
  maxOpacity?: number;
  /** Early / late hours: night palette + a warmer, dimmer veil. */
  dim: boolean;
  colors: ColorTokens;
  reduceMotion: boolean;
};

/**
 * Full-screen, slow version of the selected track's cover. It is the only animated scene on the
 * session screen; its motion runs only while shown (UI-thread transforms, see SceneCover). The
 * camera keeps running underneath — the scene just covers it.
 */
export const SessionScene = memo(function SessionScene({ trackId, width, height, shown, maxOpacity = 1, dim, colors, reduceMotion }: Props) {
  const spec = useMemo(() => sceneSpecFor(trackId), [trackId]);
  const light = colors.statusBarStyle === 'dark';
  // Night palette at dawn / in the dark theme; the warm light palette only in daytime light theme.
  const mode = dim || !light ? 'dark' : 'light';
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withTiming(shown ? maxOpacity : 0, {
      duration: shown ? (reduceMotion ? 900 : 1600) : 260,
      easing: shown ? EASE_IN_OUT : EASE,
    });
  }, [shown, maxOpacity, reduceMotion, o]);
  const fade = useAnimatedStyle(() => ({ opacity: o.value }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fade]}>
      <SceneCover scene={spec} size={width} height={height} mode={mode} lod="lite" animate={shown && !reduceMotion} />
      {/* Quiet veil (dimmer at dawn) + soft scrims: the scene sits back, the prompt and ring read. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.sessionBgTop, opacity: dim ? 0.42 : light ? 0.32 : 0.26 }]} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sessionSceneScrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={colors.sessionBgTop} stopOpacity={0.55} />
            <Stop offset={0.2} stopColor={colors.sessionBgTop} stopOpacity={0} />
            <Stop offset={0.5} stopColor={colors.sessionBgTop} stopOpacity={0} />
            <Stop offset={0.74} stopColor={colors.sessionBgTop} stopOpacity={0.42} />
            <Stop offset={1} stopColor={colors.sessionBgTop} stopOpacity={0.78} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#sessionSceneScrim)" />
      </Svg>
    </Animated.View>
  );
});
