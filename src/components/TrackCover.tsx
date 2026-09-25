import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { SceneCover, SceneLockBadge } from '@/components/SceneCover';
import { sceneSpecFor } from '@/constants/scene-covers';
import { trackCoverFor } from '@/constants/track-covers';
import type { ColorTokens } from '@/constants/themes';
import { useCoverStyle } from '@/lib/scene-cover-pref';
import { useThemeColors } from '@/lib/theme-provider';

type Props = {
  trackId: string;
  /** Width in pt (and height unless `height` is given). */
  size: number;
  height?: number;
  radius?: number;
  /** Premium and not unlocked: shows a small frosted lock badge. */
  locked?: boolean;
  /** Force a variant; defaults to the dev cover-style setting ('classic' renders as art). */
  variant?: 'art' | 'scenes';
  style?: StyleProp<ViewStyle>;
};

/**
 * Track cover: illustrated art (primary) or the generative scene fallback.
 * In the dark theme the warm art gets a faint night wash so it sits into the UI.
 */
function TrackCoverBase({ trackId, size, height, radius = 0, locked, variant, style }: Props) {
  const colors = useThemeColors();
  const pref = useCoverStyle();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const h = height ?? size;
  const mode = variant ?? (pref === 'scenes' ? 'scenes' : 'art');
  const badge = Math.max(18, Math.min(26, Math.round(Math.min(size, h) * 0.38)));
  const inset = Math.max(3, Math.round(Math.min(size, h) * 0.06));

  return (
    <View style={[styles.frame, { width: size, height: h, borderRadius: radius }, style]}>
      {mode === 'scenes' ? (
        <SceneCover scene={sceneSpecFor(trackId)} size={size} height={h} />
      ) : (
        <>
          <Image
            source={trackCoverFor(trackId)}
            style={styles.fill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
            accessible={false}
          />
          <View style={[styles.fill, styles.wash]} pointerEvents="none" />
        </>
      )}
      {locked ? (
        <SceneLockBadge size={badge} style={[styles.lock, { right: inset, bottom: inset }]} />
      ) : null}
    </View>
  );
}

export const TrackCover = memo(TrackCoverBase);

function createStyles(colors: ColorTokens) {
  const dark = colors.statusBarStyle === 'light';
  return StyleSheet.create({
    frame: { overflow: 'hidden', backgroundColor: colors.bgCard },
    fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    wash: { backgroundColor: dark ? 'rgba(10,18,32,0.16)' : 'transparent' },
    lock: { position: 'absolute' },
  });
}
