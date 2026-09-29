import { memo, useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { SmallScene, WIDE_SCENES, type SmallSceneKind } from '@/components/SmallScene';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { hapticTap } from '@/lib/haptics';
import { useThemeColors } from '@/lib/theme-provider';

type Props = {
  scene: SmallSceneKind;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Extra content under the body (e.g. tips). */
  children?: ReactNode;
  /** Render without its own card surface (when placed inside an existing card). */
  bare?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Shared empty state: a small scene, a short warm title, one line of body and an optional
 * action. Wide scenes sit on top as a banner; square scenes sit left of the text.
 */
function EmptyStateBase({ scene, title, body, actionLabel, onAction, children, bare, style }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const wide = WIDE_SCENES.includes(scene);

  const text = (
    <View style={wide ? styles.textWide : styles.textRow}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );

  return (
    <View style={[bare ? styles.bare : styles.card, style]}>
      {wide ? (
        <>
          <SmallScene kind={scene} size={88} radius={radii.lg} />
          {text}
        </>
      ) : (
        <View style={styles.row}>
          <SmallScene kind={scene} size={56} />
          {text}
        </View>
      )}
      {children}
      {actionLabel && onAction ? (
        <PressableScale
          scaleTo={0.97}
          onPress={() => {
            hapticTap();
            onAction();
          }}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export const EmptyState = memo(EmptyStateBase);

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { backgroundColor: colors.bgCard, borderRadius: radii.xl, padding: spacing.lg, gap: spacing.md },
    bare: { gap: spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    textRow: { flex: 1, gap: 4 },
    textWide: { gap: 4 },
    title: { ...typography.subtitle, color: colors.text, fontWeight: '600' },
    body: { ...typography.caption, color: colors.textMuted, lineHeight: 19 },
    action: {
      alignSelf: 'flex-start',
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      borderRadius: radii.full,
      backgroundColor: colors.accentStrong,
    },
    actionText: { ...typography.body, fontWeight: '600', color: colors.onAccent },
  });
}
