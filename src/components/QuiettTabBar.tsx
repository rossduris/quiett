import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '@/constants/theme';
import { hapticSelect } from '@/lib/haptics';
import { DURATION, EASE, SPRING_BOUNCY, SPRING_SOFT } from '@/lib/motion';
import { useThemeColors } from '@/lib/theme-provider';
import { useReduceMotion } from '@/lib/use-reduce-motion';
import { useReduceTransparency } from '@/lib/use-reduce-transparency';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type TabRoute = {
  key: string;
  name: string;
  params?: object;
};

/** Minimal shape from React Navigation's tabBar render prop (expo-router Tabs). */
export type QuiettTabBarProps = {
  state: {
    index: number;
    routes: TabRoute[];
  };
  descriptors: Record<
    string,
    {
      options: { title?: string };
    }
  >;
  navigation: {
    emit: (event: {
      type: string;
      target: string;
      canPreventDefault: boolean;
    }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

const TAB_META: Record<string, { label: string; icon: IconName; iconFocused: IconName }> = {
  index: { label: 'Home', icon: 'home-outline', iconFocused: 'home' },
  library: { label: 'Library', icon: 'book-outline', iconFocused: 'book' },
  profile: { label: 'Profile', icon: 'person-outline', iconFocused: 'person' },
};

/** Checked once: Liquid Glass needs iOS 26+ (false on older iOS / Android). */
const GLASS_OK = (() => {
  try {
    return Platform.OS === 'ios' && isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

/**
 * Floating pill tab bar. On iOS 26+ the pill is native Liquid Glass; with Reduce Transparency,
 * older iOS or Android it's the solid elevated pill it always was. The selection capsule slides
 * between tabs on a soft spring and the newly selected icon gives a small bounce + selection tick.
 */
export function QuiettTabBar({ state, descriptors, navigation }: QuiettTabBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const reduceMotion = useReduceMotion();
  const reduceTransparency = useReduceTransparency();
  const glass = GLASS_OK && !reduceTransparency;
  const dark = colors.statusBarStyle === 'light';

  // Item frames (x/width) measured on layout, so the capsule tracks real positions.
  const [frames, setFrames] = useState<{ x: number; w: number }[]>([]);
  const onItemLayout = (i: number) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setFrames((prev) => {
      if (prev[i]?.x === x && prev[i]?.w === width) return prev;
      const next = prev.slice();
      next[i] = { x, w: width };
      return next;
    });
  };

  const capX = useSharedValue(0);
  const capW = useSharedValue(0);
  const capShown = useSharedValue(0);
  const frame = frames[state.index];
  useEffect(() => {
    if (!frame) return;
    if (capShown.value === 0 || reduceMotion) {
      capX.value = frame.x;
      capW.value = frame.w;
      capShown.value = withTiming(1, { duration: DURATION.fast });
      return;
    }
    capX.value = withSpring(frame.x, SPRING_SOFT);
    capW.value = withSpring(frame.w, SPRING_SOFT);
  }, [frame, reduceMotion, capX, capW, capShown]);

  const capStyle = useAnimatedStyle(() => ({
    opacity: capShown.value,
    width: capW.value,
    transform: [{ translateX: capX.value }],
  }));

  const content = (
    <>
      <Animated.View pointerEvents="none" style={[styles.capsule, { backgroundColor: colors.calmSoft }, capStyle]} />
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const meta = TAB_META[route.name] ?? {
          label: descriptors[route.key]?.options.title ?? route.name,
          icon: 'ellipse-outline' as IconName,
          iconFocused: 'ellipse' as IconName,
        };

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            hapticSelect();
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
            onPress={onPress}
            onLayout={onItemLayout(index)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <TabIcon
              focused={focused}
              reduceMotion={reduceMotion}
              name={focused ? meta.iconFocused : meta.icon}
              color={focused ? colors.calm : colors.textMuted}
            />
          </Pressable>
        );
      })}
    </>
  );

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {glass ? (
        <GlassView glassEffectStyle="regular" colorScheme={dark ? 'dark' : 'light'} isInteractive style={[styles.pill, styles.glassPill]}>
          {content}
        </GlassView>
      ) : (
        <View style={[styles.pill, styles.solidPill, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>{content}</View>
      )}
    </View>
  );
}

function TabIcon({ focused, reduceMotion, name, color }: { focused: boolean; reduceMotion: boolean; name: IconName; color: string }) {
  const s = useSharedValue(1);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted || !focused || reduceMotion) return;
    s.value = withSequence(withTiming(0.82, { duration: 90, easing: EASE }), withSpring(1, SPRING_BOUNCY));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={a}>
      <Ionicons name={name} size={22} color={color} />
    </Animated.View>
  );
}

export const TAB_BAR_CLEARANCE = 88;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
    borderRadius: 999,
  },
  solidPill: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  glassPill: { overflow: 'hidden' },
  capsule: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    borderRadius: 999,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    minWidth: 56,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
});
