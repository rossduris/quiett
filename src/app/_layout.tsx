import { Stack, ThemeProvider, DarkTheme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AlarmHandoffGate } from '@/components/AlarmHandoffGate';
import { colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <StatusBar style="light" />
      <AlarmHandoffGate />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Settings',
            headerBackTitle: 'Back',
            animation: 'slide_from_right',
          }}
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
          name="emergency"
          options={{
            headerShown: false,
            animation: 'fade',
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
