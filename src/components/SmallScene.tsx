import { memo, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { AnimatedScene } from '@/components/onboarding/art/AnimatedScene';
import { artPalette } from '@/components/onboarding/art/art-palette';
import { eveningLayout, miniLayout, sunriseLayout } from '@/components/onboarding/art/scene-layouts';
import { useThemeColors } from '@/lib/theme-provider';
import { useReduceMotion } from '@/lib/use-reduce-motion';

export type SmallSceneKind = 'sunrise' | 'sunriseRings' | 'evening' | 'ring' | 'still' | 'calm';

/** Wide banner scenes fill their container's width; the rest are square mini art. */
export const WIDE_SCENES: readonly SmallSceneKind[] = ['sunrise', 'sunriseRings', 'evening'];

type Props = {
  kind: SmallSceneKind;
  /** Banner height (wide kinds) or edge length (square kinds). */
  size: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Small themed illustration for empty / status cards. Reuses the onboarding scene layers
 * (reanimated transform/opacity loops; rest pose with Reduce Motion) and recolours with the
 * active theme. Wide kinds measure their width on layout.
 */
function SmallSceneBase({ kind, size, radius = 16, style }: Props) {
  const colors = useThemeColors();
  const reduce = useReduceMotion();
  const p = useMemo(() => artPalette(colors), [colors]);
  const wide = WIDE_SCENES.includes(kind);
  const [w, setW] = useState(0);

  const layout = useMemo(() => {
    if (!wide) return miniLayout(kind as 'ring' | 'still' | 'calm', size, p);
    if (w <= 0) return null;
    return kind === 'evening' ? eveningLayout(w, size, p) : sunriseLayout(w, size, p, { rings: kind === 'sunriseRings' });
  }, [wide, kind, size, p, w]);

  if (!wide) {
    return layout ? <AnimatedScene layout={layout} reduceMotion={reduce} style={style} /> : null;
  }
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next !== w) setW(next);
  };
  return (
    <View style={[{ height: size, alignSelf: 'stretch', borderRadius: radius, overflow: 'hidden' }, style]} onLayout={onLayout}>
      {layout ? <AnimatedScene layout={layout} reduceMotion={reduce} radius={radius} /> : null}
    </View>
  );
}

export const SmallScene = memo(SmallSceneBase);
