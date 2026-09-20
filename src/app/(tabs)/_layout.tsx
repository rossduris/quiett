import { Tabs } from 'expo-router';
import { colors } from '@/constants/theme';
import { QuiettTabBar, type QuiettTabBarProps } from '@/components/QuiettTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <QuiettTabBar {...(props as unknown as QuiettTabBarProps)} />}
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.bg },
        animation: 'none',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
    </Tabs>
  );
}
