import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SceneCover, SceneLockBadge } from '@/components/SceneCover';
import { sceneSpecFor } from '@/constants/scene-covers';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';

type Props = {
  trackId: string;
  /** Width in pt (and height unless `height` is given). */
  size: number;
  height?: number;
  radius?: number;
  /** Premium and not unlocked: shows a small frosted lock badge. */
  locked?: boolean;
  /** Animate the scene (previewing / selected main sound). See SceneCover. */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Track cover: the generative scene for this track (recolours with the theme). */
function TrackCoverBase({ trackId, size, height, radius = 0, locked, animate, style }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const h = height ?? size;
  const badge = Math.max(18, Math.min(26, Math.round(Math.min(size, h) * 0.38)));
  const inset = Math.max(3, Math.round(Math.min(size, h) * 0.06));

  return (
    <View style={[styles.frame, { width: size, height: h, borderRadius: radius }, style]}>
      <SceneCover scene={sceneSpecFor(trackId)} size={size} height={h} animate={locked ? undefined : animate} />
      {locked ? (
        <SceneLockBadge size={badge} style={[styles.lock, { right: inset, bottom: inset }]} />
      ) : null}
    </View>
  );
}

export const TrackCover = memo(TrackCoverBase);

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    frame: { overflow: 'hidden', backgroundColor: colors.bgCard },
    lock: { position: 'absolute' },
  });
}
