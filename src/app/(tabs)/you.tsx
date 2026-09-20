import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, radii, spacing, typography } from '@/constants/theme';
import { TAB_BAR_CLEARANCE } from '@/components/QuiettTabBar';
import { SETUP_LEAD, SETUP_NOTE, SETUP_TIPS } from '@/constants/setup-tips';
import {
  loadAccount,
  signInWithAppleStub,
  signOut,
  type AccountData,
} from '@/lib/storage';

function initialFor(account: AccountData): string {
  const name = account.displayName?.trim();
  if (name) return name.charAt(0).toUpperCase();
  return 'Y';
}

export default function YouScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [account, setAccount] = useState<AccountData>({
    signedIn: false,
    provider: null,
    displayName: null,
    email: null,
  });

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const a = await loadAccount();
        if (!alive) return;
        setAccount(a);
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const onSignIn = async () => {
    setAccount(await signInWithAppleStub());
  };

  const onSignOut = async () => {
    setAccount(await signOut());
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_CLEARANCE + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>You</Text>

        <View style={styles.accountCard}>
          <Text style={styles.sectionLabel}>Account</Text>
          {account.signedIn ? (
            <>
              <View style={styles.accountRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initialFor(account)}</Text>
                </View>
                <View style={styles.accountMeta}>
                  <Text style={styles.accountName}>{account.displayName ?? 'You'}</Text>
                  {account.email ? (
                    <Text style={styles.accountEmail}>{account.email}</Text>
                  ) : null}
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => void onSignOut()}
                style={({ pressed }) => [styles.signOutPill, pressed && styles.pressed]}
              >
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.accountCopy}>Save streak across devices</Text>
              <PrimaryButton label="Sign in with Apple" onPress={() => void onSignIn()} />
            </>
          )}
        </View>

        <View style={styles.setupBlock}>
          <Text style={styles.sectionLabel}>Camera setup</Text>
          <Text style={styles.lead}>{SETUP_LEAD}</Text>
          {SETUP_TIPS.map((tip) => (
            <View key={tip.title} style={styles.tipCard}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipBody}>{tip.body}</Text>
            </View>
          ))}
          <Text style={styles.note}>{SETUP_NOTE}</Text>
          <PrimaryButton
            label="Try a demo session"
            onPress={() => router.push('/session')}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  screenTitle: {
    ...typography.title,
    color: colors.text,
  },
  accountCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  accountCopy: { ...typography.body, color: colors.textMuted },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontSize: 20, fontWeight: '600' },
  accountMeta: { flex: 1, gap: 2 },
  accountName: { ...typography.subtitle, color: colors.text },
  accountEmail: { color: colors.textMuted, fontSize: 14 },
  signOutPill: {
    marginTop: spacing.sm,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md - 2,
    borderRadius: radii.full,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.85 },
  setupBlock: { gap: spacing.md },
  lead: { ...typography.body, color: colors.textMuted, lineHeight: 24 },
  tipCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  tipTitle: { color: colors.text, fontWeight: '600', fontSize: 16 },
  tipBody: { color: colors.textMuted, lineHeight: 22 },
  note: { color: colors.warning, fontSize: 12 },
});
