import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { hapticSuccess } from '@/lib/haptics';
import { syncEveningReminder } from '@/lib/notifications';
import { hasScheduledOsAlarm, turnOffOsAlarm } from '@/lib/os-alarm';
import { useThemeColors } from '@/lib/theme-provider';

/** How long the "Your alarm is off" confirmation stays before the row goes away. */
const CONFIRM_MS = 5000;

type Status = 'idle' | 'busy' | 'done';

/**
 * Small text link on the gate paywall so someone without Premium can still stop Quiett's alarm
 * (Home is behind the paywall). Only shown while an OS alarm is set. Asks once, then cancels it
 * through turnOffOsAlarm (persists "off", clears wake leftovers) and confirms briefly.
 */
export function TurnOffAlarmLink() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [scheduled, setScheduled] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const alive = useRef(true);

  const check = useCallback(() => {
    void hasScheduledOsAlarm().then((on) => {
      if (alive.current) setScheduled(on);
    });
  }, []);

  useEffect(() => {
    alive.current = true;
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      alive.current = false;
      sub.remove();
    };
  }, [check]);

  useEffect(() => {
    if (status !== 'done') return;
    const t = setTimeout(() => {
      setStatus('idle');
      check();
    }, CONFIRM_MS);
    return () => clearTimeout(t);
  }, [status, check]);

  const turnOff = async () => {
    setStatus('busy');
    setMessage(null);
    const result = await turnOffOsAlarm();
    if (!alive.current) return;
    if (result.ok) {
      hapticSuccess();
      // The evening note says "Tomorrow's wake-up is set for…": drop it with the alarm.
      void syncEveningReminder();
      setScheduled(false);
      setStatus('done');
    } else {
      setStatus('idle');
      setMessage(result.reason === 'ringing' ? result.message : 'Couldn\u2019t turn off the alarm. Please try again.');
    }
  };

  const confirm = () => {
    if (status !== 'idle') return;
    Alert.alert('Turn off your alarm?', 'Quiett won\u2019t ring until you set an alarm again.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Turn off', style: 'destructive', onPress: () => void turnOff() },
    ]);
  };

  if (status === 'done') {
    return (
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.row} accessibilityLiveRegion="polite">
        <Ionicons name="checkmark-circle" size={16} color={colors.calm} />
        <Text style={styles.confirm}>Your alarm is off. Quiett won’t ring until you set it again.</Text>
      </Animated.View>
    );
  }

  if (!scheduled) return null;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Turn off my alarm"
        accessibilityHint="Stops Quiett's scheduled alarm"
        onPress={confirm}
        disabled={status === 'busy'}
        hitSlop={8}
        style={({ pressed }) => [styles.linkHit, pressed && styles.pressed]}
      >
        <Text style={[styles.link, status === 'busy' && styles.linkBusy]}>
          {status === 'busy' ? 'Turning off\u2026' : 'Turn off my alarm'}
        </Text>
      </Pressable>
      {message ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: { alignItems: 'center', gap: 2 },
    linkHit: { minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.md },
    link: { color: colors.textDim, fontSize: 13, fontWeight: '500', textDecorationLine: 'underline' },
    linkBusy: { opacity: 0.6 },
    pressed: { opacity: 0.7 },
    error: { color: colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      minHeight: 32,
      paddingHorizontal: spacing.sm,
    },
    confirm: { color: colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center', flexShrink: 1 },
  });
}
