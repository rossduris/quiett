import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import type { AccountData } from '@/lib/storage';
import { createProfileStyles } from './profile-styles';

type Props = {
  account: AccountData;
  onSignIn: () => void;
  onSignOut: () => void;
};

/**
 * Compact account row. Only rendered when the `accountUi` dev flag is on (see dev-flags.ts);
 * sign-in is a stub until real Sign in with Apple + sync ship.
 */
export function AccountRow({ account, onSignIn, onSignOut }: Props) {
  const colors = useThemeColors();
  const shared = useMemo(() => createProfileStyles(colors), [colors]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const name = account.displayName?.trim() || null;

  return (
    <View style={[shared.listCard, styles.row]}>
      <View style={styles.avatar} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text style={styles.avatarText}>{name ? name.charAt(0).toUpperCase() : '·'}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {account.signedIn ? (name ?? 'Signed in') : 'Not signed in'}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {account.signedIn ? (account.email ?? 'Apple ID') : 'Save streak across devices'}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={account.signedIn ? 'Sign out' : 'Sign in with Apple'}
        onPress={account.signedIn ? onSignOut : onSignIn}
        hitSlop={8}
        style={({ pressed }) => [styles.btn, pressed && shared.pressed]}
      >
        <Text style={styles.btnText}>{account.signedIn ? 'Sign out' : 'Sign in'}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
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
    },
    btnText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  });
}
