import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { Stack, ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AlarmHandoffGate } from '@/components/AlarmHandoffGate';
import { ThemeProvider, useTheme } from '@/lib/theme-provider';
import { PremiumProvider } from '@/lib/premium-provider';
import { AuthProvider } from '@/lib/auth-provider';
import { syncEveningReminder } from '@/lib/notifications';
import { warnIfLegalPlaceholders } from '@/constants/legal';

function RootStack() {
  const { colors, theme } = useTheme();

  // Light / dark nav base, recoloured with the theme tokens so transitions, modal backdrops
  // and any native chrome use our backgrounds (DarkTheme's near-black + iOS blue looked off
  // against Night Teal).
  const navTheme = useMemo(() => {
    const base = theme.colors.statusBarStyle === 'dark' ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.calm,
        background: colors.bg,
        card: colors.bg,
        text: colors.text,
        border: colors.border,
        notification: colors.alarm,
      },
    };
  }, [theme.colors.statusBarStyle, colors]);

  // Evening reminders are one-shot and queued a week ahead: top the queue up (and refresh
  // the time / sound in the message) on launch and every foreground.
  useEffect(() => {
    warnIfLegalPlaceholders();
    void syncEveningReminder();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncEveningReminder();
    });
    return () => sub.remove();
  }, []);

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
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </PremiumProvider>
    </ThemeProvider>
  );
}
