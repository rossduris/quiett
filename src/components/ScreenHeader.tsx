import { useCallback, useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';

/** router.back() when there is history, otherwise replace to a sensible fallback. */
export function useSafeBack(fallbackHref: Href = '/') {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallbackHref);
  }, [router, fallbackHref]);
}

type Props = {
  /** Centered title. Omit on pages whose content already has a hero title. */
  title?: string;
  /** Where to go if the page was opened without history (deep link / reload). */
  fallbackHref?: Href;
  /** Optional right-side control (kept the same width as the back button so the title stays centered). */
  right?: ReactNode;
};

const BTN = 36;

/**
 * Shared header for every pushed (non-tab) screen. The native Stack header is hidden
 * app-wide, so this is the only header: back button, centered title, optional right slot,
 * and the safe-area top inset.
 */
export function ScreenHeader({ title, fallbackHref = '/', right }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const goBack = useSafeBack(fallbackHref);

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        onPress={goBack}
        style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title ?? ''}
      </Text>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: colors.bg,
    },
    backBtn: {
      width: BTN,
      height: BTN,
      borderRadius: BTN / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      flex: 1,
      textAlign: 'center',
      color: colors.text,
      fontSize: 17,
      fontWeight: '600',
    },
    side: { width: BTN, height: BTN, alignItems: 'center', justifyContent: 'center' },
    pressed: { opacity: 0.75 },
  });
}
