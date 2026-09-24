import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { spacing } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  loadEveningReminderPrefs,
  saveEveningReminderPrefs,
  type EveningReminderPrefs,
} from '@/lib/storage';
import {
  requestNotificationPermissions,
  scheduleEveningReminder,
  cancelEveningReminder,
} from '@/lib/notifications';
import type { ColorTokens } from '@/constants/themes';

function parseTime(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(h || 20, m || 0, 0, 0);
  return d;
}

function toHhMm(d: Date): string {
  return `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
}

function displayTime(hhmm: string): string {
  return parseTime(hhmm).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [prefs, setPrefs] = useState<EveningReminderPrefs>({ enabled: false, time: '20:00' });
  const [showPicker, setShowPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const loaded = await loadEveningReminderPrefs();
        if (!alive) return;
        setPrefs(loaded);
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const onToggle = async () => {
    const nextEnabled = !prefs.enabled;
    
    if (nextEnabled) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          'Notification Permission Required',
          'Please enable notifications for Quiett in Settings to receive evening reminders.',
          [{ text: 'OK' }],
        );
        return;
      }
    }
    
    const next = { ...prefs, enabled: nextEnabled };
    setPrefs(next);
    await saveEveningReminderPrefs(next);
    
    if (nextEnabled) {
      await scheduleEveningReminder();
    } else {
      await cancelEveningReminder();
    }
  };

  const onTimeChange = async (_event: unknown, date?: Date) => {
    if (!date) return;
    if (Platform.OS === 'android') setShowPicker(false);
    const next = { ...prefs, time: toHhMm(date) };
    setPrefs(next);
    await saveEveningReminderPrefs(next);
    
    if (prefs.enabled) {
      await scheduleEveningReminder();
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Notifications" fallbackHref="/settings" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="moon-outline" size={20} color={colors.text} />
              <Text style={styles.cardTitle}>Evening reminder</Text>
            </View>
            <Pressable
              onPress={() => void onToggle()}
              style={styles.switchRow}
              accessibilityRole="switch"
              accessibilityState={{ checked: prefs.enabled }}
            >
              <View style={[styles.switch, prefs.enabled && styles.switchOn]}>
                <View style={[styles.thumb, prefs.enabled && styles.thumbOn]} />
              </View>
            </Pressable>
          </View>

          <Text style={styles.cardBody}>
            Get a notification the night before a scheduled alarm day to remind you about tomorrow's
            wake-up.
          </Text>

          {prefs.enabled && (
            <>
              <Pressable
                onPress={() => setShowPicker(!showPicker)}
                style={({ pressed }) => [styles.timeRow, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Reminder time, ${displayTime(prefs.time)}`}
              >
                <Text style={styles.timeLabel}>Reminder time</Text>
                <View style={styles.timeRight}>
                  <Text style={styles.timeValue}>{displayTime(prefs.time)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
                </View>
              </Pressable>

              {showPicker && (
                <View style={styles.timePickerWrap}>
                  <DateTimePicker
                    value={parseTime(prefs.time)}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                    locale="en_US"
                    is24Hour={false}
                    minuteInterval={1}
                    onValueChange={onTimeChange}
                    onDismiss={() => setShowPicker(false)}
                    themeVariant={colors.statusBarStyle === 'dark' ? 'light' : 'dark'}
                    textColor={colors.text}
                  />
                  {Platform.OS === 'ios' && (
                    <View style={{ paddingTop: spacing.sm }}>
                      <PrimaryButton
                        label="Done"
                        variant="secondary"
                        onPress={() => setShowPicker(false)}
                      />
                    </View>
                  )}
                </View>
              )}

              <View style={styles.exampleCard}>
                <Text style={styles.exampleLabel}>Example notification</Text>
                <View style={styles.exampleNotif}>
                  <View style={styles.exampleHeader}>
                    <View style={styles.exampleAppIcon}>
                      <Ionicons name="alarm-outline" size={16} color={colors.calm} />
                    </View>
                    <Text style={styles.exampleAppName}>Quiett</Text>
                    <Text style={styles.exampleTime}>now</Text>
                  </View>
                  <Text style={styles.exampleTitle}>
                    Tomorrow's wake-up is set for{' '}
                    <Text style={styles.exampleBold}>7:00 AM</Text>
                  </Text>
                  <Text style={styles.exampleBody}>Morning Light · Meditation 2m</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
          <Text style={styles.infoText}>
            Notifications are sent locally on your device. Make sure Quiett notifications are
            allowed in your iPhone Settings.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: spacing.lg,
      gap: spacing.lg,
    },
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '600',
    },
    switchRow: { paddingVertical: 4, paddingHorizontal: 4 },
    switch: {
      width: 51,
      height: 31,
      borderRadius: 16,
      backgroundColor: colors.border,
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    switchOn: { backgroundColor: colors.calm },
    thumb: {
      width: 27,
      height: 27,
      borderRadius: 14,
      backgroundColor: colors.bg,
    },
    thumbOn: { alignSelf: 'flex-end' },
    cardBody: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 21,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 12,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    timeLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '500',
    },
    timeRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    timeValue: {
      color: colors.calm,
      fontSize: 15,
      fontWeight: '600',
    },
    timePickerWrap: {
      backgroundColor: colors.bgElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    exampleCard: {
      backgroundColor: colors.bg,
      borderRadius: 12,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    exampleLabel: {
      color: colors.textDim,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    exampleNotif: {
      backgroundColor: colors.bgElevated,
      borderRadius: 12,
      padding: spacing.md,
      gap: spacing.xs,
    },
    exampleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: spacing.xs,
    },
    exampleAppIcon: {
      width: 20,
      height: 20,
      borderRadius: 6,
      backgroundColor: colors.calmSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    exampleAppName: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
    },
    exampleTime: {
      color: colors.textDim,
      fontSize: 12,
    },
    exampleTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '500',
      lineHeight: 20,
    },
    exampleBold: {
      fontWeight: '700',
      color: colors.calm,
    },
    exampleBody: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    infoCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: 12,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoText: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    pressed: { opacity: 0.75 },
  });
}
