import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useThemeColors } from '@/lib/theme-provider';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL, isPlaceholder } from '@/constants/legal';
import { openLegalUrl } from '@/lib/support';
import { SettingsCard } from './SettingsCard';
import { SettingsLinkRow } from './SettingsLinkRow';
import { createSettingsStyles } from './settings-styles';

export function LegalCard() {
  const colors = useThemeColors();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);
  return (
    <SettingsCard label="Legal">
      <SettingsLinkRow
        icon="shield-checkmark-outline"
        label="Privacy Policy"
        kind="link"
        onPress={() => openLegalUrl(PRIVACY_POLICY_URL)}
      />
      <SettingsLinkRow
        icon="document-text-outline"
        label="Terms of Use"
        kind="link"
        onPress={() => openLegalUrl(TERMS_OF_USE_URL)}
      />
      {__DEV__ && isPlaceholder(PRIVACY_POLICY_URL) ? (
        <View style={styles.block}>
          <Text style={[styles.hint, { color: colors.warning }]}>
            Dev: Privacy Policy URL is still a placeholder (src/constants/legal.ts).
          </Text>
        </View>
      ) : null}
    </SettingsCard>
  );
}
