import { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';
import type { ColorTokens } from '@/constants/themes';
import { openOsAlarmSettings } from '@/lib/os-alarm';

type HelpSection = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  tips: string[];
  actions?: { label: string; onPress: () => void }[];
};

const HELP_SECTIONS: HelpSection[] = [
  {
    icon: 'alarm-outline',
    title: 'Alarm not working?',
    tips: [
      'Make sure you\'ve allowed Quiett to schedule alarms in iPhone Settings > Quiett.',
      'Check that Do Not Disturb and Focus modes allow alarms to sound.',
      'Go to Settings > Sounds & Haptics and drag Ringer and Alerts to max volume.',
      'On the same screen, turn off "Change with Buttons" so the side buttons can\'t lower your alarm.',
      'Confirm your alarm is enabled on the Home screen (toggle should be green).',
    ],
  },
  {
    icon: 'camera-outline',
    title: 'Camera or lighting trouble?',
    tips: [
      'Make sure you\'ve allowed Quiett camera access in iPhone Settings > Quiett.',
      'Prop your phone upright (not flat) so the camera can see your face. Holding it in bed won\'t work.',
      'Face the camera directly - profile or looking away won\'t count (same idea as Face ID).',
      'Bedroom light is fine. Avoid pointing a bright lamp straight into the lens.',
      'Go to Settings > Face ID & Passcode and turn off "Attention Aware Features" so iOS won\'t lower alarm volume when you look at the camera.',
    ],
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const onReliabilityCheck = () => {
    router.push('/reliability-check');
  };

  const onTestMorning = () => {
    router.push('/test-morning');
  };

  const onOpenSettings = () => {
    void Linking.openSettings();
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Help</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {HELP_SECTIONS.map((section, index) => (
          <View key={index} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name={section.icon} size={24} color={colors.calm} />
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <View style={styles.tipsList}>
              {section.tips.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <View style={styles.tipBullet} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.actionsCard}>
          <Text style={styles.actionsLabel}>Quick actions</Text>
          <PrimaryButton
            label="Check alarm reliability"
            variant="secondary"
            onPress={onReliabilityCheck}
          />
          <PrimaryButton
            label="Test your morning"
            variant="secondary"
            onPress={onTestMorning}
          />
          <PrimaryButton
            label="Open iPhone Settings"
            variant="secondary"
            onPress={onOpenSettings}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    headerTitle: {
      ...typography.title,
      color: colors.text,
    },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: spacing.lg,
      gap: spacing.xl,
    },
    section: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.calmSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 18,
      fontWeight: '600',
    },
    tipsList: {
      gap: spacing.md,
    },
    tipRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    tipBullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.calm,
      marginTop: 7,
    },
    tipText: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 21,
    },
    actionsCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
    },
    actionsLabel: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
  });
}
