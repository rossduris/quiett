import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { VOICE_OPTIONS } from '@/constants/voices';
import { useThemeColors } from '@/lib/theme-provider';
import { FilterChips } from './FilterChips';

/**
 * DEV ONLY (behind the "Voice guides (dev)" switch; VOICE_GUIDES is false for release).
 * Self-contained so it can be deleted in one go if voice guides don't ship.
 */
export function VoicePicker({ voiceId, onSelect }: { voiceId: string; onSelect: (id: string) => void }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const items = useMemo(() => VOICE_OPTIONS.map((v) => ({ id: v.id, label: v.title })), []);

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Voice (dev)</Text>
      <Text style={styles.lead}>
        A voice guide over your sound; the sound dips while it speaks. Placeholder clip for now.
      </Text>
      <FilterChips items={items} activeId={voiceId} onChange={onSelect} a11yPrefix="Voice:" />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    section: { gap: spacing.sm, marginTop: spacing.xs },
    title: { ...typography.subtitle, color: colors.text, fontWeight: '700', paddingHorizontal: spacing.lg },
    lead: { ...typography.caption, color: colors.textMuted, lineHeight: 18, paddingHorizontal: spacing.lg },
  });
}
