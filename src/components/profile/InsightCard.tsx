import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import type { Insight } from '@/lib/profile-insights';
import { useThemeColors } from '@/lib/theme-provider';
import { createProfileStyles } from './profile-styles';
import { SectionHeader } from './SectionHeader';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'avg-unlock': 'time-outline',
  'top-sound': 'musical-notes-outline',
};

/** Insights from recorded mornings only. Renders nothing until there's enough data. */
export function InsightCard({ insights }: { insights: readonly Insight[] }) {
  const colors = useThemeColors();
  const shared = useMemo(() => createProfileStyles(colors), [colors]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (insights.length === 0) return null;
  return (
    <View style={shared.section}>
      <SectionHeader label="Insight" />
      <View style={[shared.card, styles.card]}>
        {insights.map((i) => (
          <View key={i.id} style={styles.row} accessible accessibilityLabel={`${i.title}. ${i.detail}`}>
            <View style={styles.icon}>
              <Ionicons name={ICONS[i.id] ?? 'sparkles-outline'} size={18} color={colors.calm} />
            </View>
            <View style={styles.body}>
              <Text style={styles.title}>{i.title}</Text>
              <Text style={styles.detail}>{i.detail}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { gap: spacing.md },
    row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    icon: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: colors.calmSoft, alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1, gap: 2 },
    title: { ...typography.body, color: colors.text, fontWeight: '600' },
    detail: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  });
}
