import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';

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

/** Calm-style floating pill — real Expo Router tab bar (no stack push / swipe). */
export function QuiettTabBar({ state, descriptors, navigation }: QuiettTabBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: colors.bgElevated,
            borderColor: colors.border,
          },
        ]}
      >
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
              style={({ pressed }) => [
                styles.item,
                focused && { backgroundColor: colors.calmSoft },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={focused ? meta.iconFocused : meta.icon}
                size={22}
                color={focused ? colors.calm : colors.textMuted}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
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
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
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
