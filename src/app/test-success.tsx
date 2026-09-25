import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';
import type { ColorTokens } from '@/constants/themes';

export default function TestSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const onDone = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.hero}>
        <View style={styles.iconRing}>
          <Ionicons name="checkmark-circle" size={80} color={colors.calm} />
        </View>
        <Text style={styles.title}>Practice complete</Text>
        <Text style={styles.body}>
          Nice — you settled in and finished a 30-second practice. On a real morning it works
          the same way, followed by 2 minutes of quiet.
        </Text>
        <Text style={styles.note}>Practice sessions don't count toward your streak or history.</Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Done" onPress={onDone} />
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingHorizontal: spacing.lg,
      justifyContent: 'center',
      gap: spacing.xl,
    },
    hero: {
      alignItems: 'center',
      gap: spacing.lg,
    },
    iconRing: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.calmSoft,
      borderWidth: 2,
      borderColor: colors.calm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      ...typography.title,
      color: colors.text,
      fontSize: 32,
      textAlign: 'center',
    },
    body: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: 340,
    },
    note: {
      color: colors.textDim,
      fontSize: 13,
      textAlign: 'center',
      maxWidth: 300,
      lineHeight: 19,
    },
    actions: {
      gap: spacing.md,
    },
  });
}
