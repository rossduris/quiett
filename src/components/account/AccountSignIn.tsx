import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useAuth } from '@/lib/auth-provider';
import { hapticSuccess } from '@/lib/haptics';
import { useThemeColors } from '@/lib/theme-provider';
import { useReduceMotion } from '@/lib/use-reduce-motion';

type Props = {
  /**
   * 'onboarding': the "Create your account" step right before the trial paywall.
   * 'gate': the app-level gate for signed-out users (returning users, after sign-out).
   */
  context: 'onboarding' | 'gate';
};

const COPY = {
  onboarding: {
    title: 'Create your account',
    body: 'Your Quiett subscription stays with your account, on any iPhone you sign in on.',
  },
  gate: {
    title: 'Sign in to Quiett',
    body: 'Your subscription stays with your account. Sign in to pick up your mornings.',
  },
} as const;

/**
 * Sign in with Apple, required (no skip). Uses Apple's own button (HIG): black on light themes,
 * white on dark. Cancelling the Apple sheet does nothing; a real failure shows an inline error
 * with a retry. The screen moves on by itself once the Supabase session lands (the parent
 * watches auth state), so this never navigates.
 */
export function AccountSignIn({ context }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { signInWithApple } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState<boolean | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    void AppleAuthentication.isAvailableAsync()
      .then((ok) => {
        if (alive.current) setAppleAvailable(ok);
      })
      .catch(() => {
        if (alive.current) setAppleAvailable(false);
      });
    return () => {
      alive.current = false;
    };
  }, []);

  const signIn = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await signInWithApple();
      if (!alive.current) return;
      if (outcome.ok) hapticSuccess();
      else if (!outcome.canceled) setError(outcome.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const enter = (i: number) => (reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(80 + i * 80).duration(380));
  const lightTheme = colors.statusBarStyle === 'dark';
  const copy = COPY[context];

  return (
    <View style={[styles.root, context === 'gate' && { paddingTop: insets.top + spacing.lg }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View entering={enter(0)} style={styles.hero}>
          <View style={styles.badgeIcon}>
            <Ionicons name="person-circle-outline" size={30} color={colors.calm} />
          </View>
          <Text style={styles.kicker}>Quiett</Text>
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
            {copy.title}
          </Text>
          <Text style={styles.body}>{copy.body}</Text>
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle-outline" size={18} color={colors.textMuted} />
            <View style={styles.errorText}>
              <Text style={styles.errorTitle}>Couldn’t sign in</Text>
              <Text style={styles.errorBody}>{error}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try signing in again"
              onPress={() => void signIn()}
              disabled={busy}
              hitSlop={8}
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {appleAvailable === false ? (
          <Text style={styles.caption}>
            Sign in with Apple isn’t available on this device. Check that you’re signed in to iCloud
            in Settings.
          </Text>
        ) : appleAvailable ? (
          <View style={busy && styles.busy} pointerEvents={busy ? 'none' : 'auto'}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={
                lightTheme
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              }
              cornerRadius={radii.md}
              style={styles.appleBtn}
              onPress={() => void signIn()}
            />
          </View>
        ) : (
          <View style={styles.appleBtn} />
        )}

        <View style={styles.statusRow}>
          {busy ? (
            <>
              <ActivityIndicator size="small" color={colors.textMuted} />
              <Text style={styles.caption}>Signing in…</Text>
            </>
          ) : (
            <Text style={styles.caption}>Apple lets you keep your email private.</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1 },
    content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
    hero: { alignItems: 'center', gap: spacing.sm },
    badgeIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.calmSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    kicker: { ...typography.eyebrow, color: colors.calm },
    title: { ...typography.title, color: colors.text, textAlign: 'center' },
    body: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 23, maxWidth: 340 },
    footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
    appleBtn: { height: 50, alignSelf: 'stretch' },
    busy: { opacity: 0.6 },
    statusRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    caption: { ...typography.caption, color: colors.textDim, textAlign: 'center' },
    error: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
    },
    errorText: { flex: 1, gap: 2 },
    errorTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
    errorBody: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    retry: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.xs },
    retryText: { color: colors.calm, fontSize: 14, fontWeight: '600' },
    pressed: { opacity: 0.7 },
  });
}
