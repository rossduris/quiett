import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';

const MESSAGE = 'Surprise me is off';
const SHOW_MS = 2400;

/**
 * Brief, quiet note shown when picking a track turns Surprise me off.
 * Bump `trigger` (a counter) to show it; 0 = never shown. Also announced to screen readers.
 * `fallback` renders in the same spot while the note is hidden (so nothing shifts).
 */
export function SurpriseOffNote({
  trigger,
  style,
  fallback = null,
}: {
  trigger: number;
  style?: StyleProp<TextStyle>;
  fallback?: ReactNode;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const opacity = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    setShown(true);
    AccessibilityInfo.announceForAccessibility(MESSAGE);
    opacity.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(SHOW_MS),
      Animated.timing(opacity, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => {
      if (finished) setShown(false);
    });
    return () => anim.stop();
  }, [trigger, opacity]);

  if (!shown) return <>{fallback}</>;
  return (
    <Animated.Text style={[styles.note, style, { opacity }]} accessibilityElementsHidden importantForAccessibility="no">
      {MESSAGE}
    </Animated.Text>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    note: { ...typography.caption, color: colors.textDim, fontWeight: '600' },
  });
}
