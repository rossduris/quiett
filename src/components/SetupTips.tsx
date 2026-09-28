import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { SETUP_LEAD, SETUP_NOTE, SETUP_TIPS } from '@/constants/setup-tips';
import { useThemeColors } from '@/lib/theme-provider';

/** Collapsible camera setup tips (Settings → Help). Styled to match the Settings link rows. */
export function SetupTips() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={styles.left}>
          <Ionicons name="camera-outline" size={20} color={colors.text} />
          <Text style={styles.headerText}>Camera setup tips</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textDim} />
      </Pressable>
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
            <Ionicons name="warning-outline" size={14} color={colors.warning} style={styles.noteIcon} />
            <Text style={styles.note}>{SETUP_NOTE}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: {
      borderRadius: radii.md,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    headerText: { ...typography.body, fontSize: 15, fontWeight: '500', color: colors.text },
    content: {
      paddingHorizontal: 12,
      paddingBottom: 12,
      gap: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    lead: { ...typography.body, fontSize: 15, lineHeight: 22, color: colors.textMuted, marginTop: 12 },
    tip: {
      backgroundColor: colors.bg,
      borderRadius: radii.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
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
