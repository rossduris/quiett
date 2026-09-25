import { Stack, ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AlarmHandoffGate } from '@/components/AlarmHandoffGate';
import { ThemeProvider, useTheme } from '@/lib/theme-provider';
import { PremiumProvider } from '@/lib/premium-provider';

function RootStack() {
  const { colors, theme } = useTheme();

  // Use light nav theme for light color schemes, dark for dark
  const navTheme = theme.colors.statusBarStyle === 'dark' ? DefaultTheme : DarkTheme;

  return (
    <>
      <StatusBar style={theme.colors.statusBarStyle === 'dark' ? 'dark' : 'light'} />
      <AlarmHandoffGate />
      <NavThemeProvider value={navTheme}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '600' },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
            // Every pushed screen renders its own <ScreenHeader />; the native header is off
            // app-wide so no page shows a double header. Pushes slide in from the right.
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="onboarding"
            options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
          />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen
            name="session"
            options={{
              headerShown: false,
              gestureEnabled: false,
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="success"
            options={{
              headerShown: false,
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="paywall"
            options={{ headerShown: false, presentation: 'modal', animation: 'default' }}
          />
          <Stack.Screen
            name="emergency"
            options={{
              headerShown: false,
              animation: 'fade',
            }}
          />
        </Stack>
      </NavThemeProvider>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      {/* RevenueCat initializes once here; falls back to "unavailable" on builds without it. */}
      <PremiumProvider>
        <RootStack />
      </PremiumProvider>
    </ThemeProvider>
  );
}
