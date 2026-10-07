import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SceneCover } from '@/components/SceneCover';
import { sceneSpecFor } from '@/constants/scene-covers';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';

type Props = {
  trackId: string;
  /** Width in pt (and height unless `height` is given). */
  size: number;
  height?: number;
  radius?: number;
  /** Animate the scene (previewing / selected main sound). See SceneCover. */
  animate?: boolean;
  /** Placeholder first, SVG mounted via the stagger queue (long lists). See SceneCover. */
  defer?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Track cover: the generative scene for this track (recolours with the theme). */
function TrackCoverBase({ trackId, size, height, radius = 0, animate, defer, style }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const h = height ?? size;

  return (
    <View style={[styles.frame, { width: size, height: h, borderRadius: radius }, style]}>
      <SceneCover scene={sceneSpecFor(trackId)} size={size} height={h} animate={animate} defer={defer} />
    </View>
  );
}

export const TrackCover = memo(TrackCoverBase);

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    frame: { overflow: 'hidden', backgroundColor: colors.bgCard },
  });
}
