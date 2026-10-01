import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { QuiettTabBar, type QuiettTabBarProps } from '@/components/QuiettTabBar';
import { resolveOnboardingComplete } from '@/lib/storage';
import { useThemeColors } from '@/lib/theme-provider';

type Gate = 'checking' | 'onboarding' | 'ready';

export default function TabsLayout() {
  const colors = useThemeColors();
  // First-run gate: brand-new installs go to /onboarding before any tab mounts (so Home's
  // alarm sync never triggers a permission prompt first). Existing users are auto-marked done.
  const [gate, setGate] = useState<Gate>('checking');

  useEffect(() => {
    let alive = true;
    void resolveOnboardingComplete().then((done) => {
      if (alive) setGate(done ? 'ready' : 'onboarding');
    });
    return () => {
      alive = false;
    };
  }, []);

  if (gate === 'checking') return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (gate === 'onboarding') return <Redirect href="/onboarding" />;

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
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
