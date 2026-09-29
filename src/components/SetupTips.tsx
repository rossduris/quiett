import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { SETUP_LEAD, SETUP_NOTE, SETUP_TIPS } from '@/constants/setup-tips';
import { useThemeColors } from '@/lib/theme-provider';

/** Collapsible camera setup tips (Settings → Help). A row inside the Help card, expanding in place. */
export function SetupTips() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.wrap}>
      <PressableScale
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((v) => !v)}
        style={styles.header}
      >
        <View style={styles.left}>
          <Ionicons name="camera-outline" size={20} color={colors.textMuted} />
          <Text style={styles.headerText}>Camera setup tips</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textDim} />
      </PressableScale>
      {expanded ? (
        <View style={styles.content}>
          <Text style={styles.lead}>{SETUP_LEAD}</Text>
          {SETUP_TIPS.map((tip) => (
            <View key={tip.title} style={styles.tip}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipBody}>{tip.body}</Text>
            </View>
          ))}
          <View style={styles.noteRow}>
            <Ionicons name="warning-outline" size={14} color={colors.accentStrong} style={styles.noteIcon} />
            <Text style={styles.note}>{SETUP_NOTE}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 52,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
    },
    left: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
    headerText: { ...typography.body, fontWeight: '500', color: colors.text },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
    lead: { ...typography.body, fontSize: 15, lineHeight: 22, color: colors.textMuted },
    tip: {
      backgroundColor: colors.bgElevated,
      borderRadius: radii.lg,
      padding: spacing.md,
      gap: spacing.xs,
    },
    tipTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
    tipBody: { ...typography.body, fontSize: 15, lineHeight: 22, color: colors.textMuted },
    noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
    noteIcon: { marginTop: 2 },
    note: { ...typography.caption, flex: 1, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    pressed: { opacity: 0.75 },
  });
}
