import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { alertAuthFailure, useAuth, type AuthOutcome } from '@/lib/auth-provider';
import { createProfileStyles } from './profile-styles';

/**
 * Account card: Sign in with Apple (iOS) + Google, or Sign out when session exists.
 * Shown when ACCOUNT_UI / accountUi flag is on (see dev-flags.ts).
 */
export function AccountRow() {
  const colors = useThemeColors();
  const shared = useMemo(() => createProfileStyles(colors), [colors]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const auth = useAuth();
  const [busy, setBusy] = useState<'apple' | 'google' | 'out' | null>(null);

  const name = auth.account.displayName?.trim() || null;
  const providerLabel =
    auth.account.provider === 'apple'
      ? 'Apple'
      : auth.account.provider === 'google'
        ? 'Google'
        : null;

  const run = async (kind: 'apple' | 'google' | 'out', fn: () => Promise<AuthOutcome>) => {
    if (busy) return;
    setBusy(kind);
    try {
      const outcome = await fn();
      alertAuthFailure(outcome, kind === 'out' ? 'Sign out' : 'Sign in');
    } finally {
      setBusy(null);
    }
  };

  if (!auth.configured) {
    return (
      <View style={[shared.listCard, styles.column]}>
        <Text style={styles.name}>Account</Text>
        <Text style={styles.sub}>
          Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Metro.
        </Text>
      </View>
    );
  }

  if (auth.account.signedIn) {
    return (
      <View style={[shared.listCard, styles.row]}>
        <View style={styles.avatar} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Text style={styles.avatarText}>{name ? name.charAt(0).toUpperCase() : '·'}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {name ?? 'Signed in'}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {auth.account.email ?? providerLabel ?? 'Account'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={() => void run('out', auth.signOut)}
          hitSlop={8}
          disabled={busy !== null}
          style={({ pressed }) => [styles.btn, pressed && shared.pressed, busy === 'out' && styles.btnBusy]}
        >
          {busy === 'out' ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={styles.btnText}>Sign out</Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[shared.listCard, styles.column]}>
      <View style={styles.header}>
        <Text style={styles.name}>Account</Text>
        <Text style={styles.sub}>Save your streak across devices</Text>
      </View>
      {Platform.OS === 'ios' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in with Apple"
          onPress={() => void run('apple', auth.signInWithApple)}
          disabled={busy !== null}
          style={({ pressed }) => [styles.providerBtn, styles.appleBtn, pressed && shared.pressed]}
        >
          {busy === 'apple' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.appleBtnText}>Sign in with Apple</Text>
          )}
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign in with Google"
        onPress={() => void run('google', auth.signInWithGoogle)}
        disabled={busy !== null}
        style={({ pressed }) => [styles.providerBtn, styles.googleBtn, pressed && shared.pressed]}
      >
        {busy === 'google' ? (
          <ActivityIndicator size="small" color={colors.text} />
        ) : (
          <Text style={styles.googleBtnText}>Sign in with Google</Text>
        )}
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
    column: { gap: spacing.md, padding: spacing.md },
    header: { gap: spacing.xs / 2 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: radii.full,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { ...typography.subtitle, color: colors.text, fontWeight: '600' },
    body: { flex: 1, gap: spacing.xs / 2 },
    name: { ...typography.body, color: colors.text, fontWeight: '600' },
    sub: { ...typography.caption, color: colors.textMuted },
    btn: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
      minWidth: 72,
      alignItems: 'center',
    },
    btnBusy: { opacity: 0.7 },
    btnText: { ...typography.caption, color: colors.text, fontWeight: '600' },
    providerBtn: {
      paddingVertical: spacing.md,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    appleBtn: { backgroundColor: '#000' },
    appleBtnText: { ...typography.body, color: '#fff', fontWeight: '600' },
    googleBtn: {
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    googleBtnText: { ...typography.body, color: colors.text, fontWeight: '600' },
  });
}
