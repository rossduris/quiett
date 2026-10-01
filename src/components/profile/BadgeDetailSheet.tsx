import { useEffect, useMemo } from 'react';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { MedalSheen } from '@/components/MedalSheen';
import { hapticSoft } from '@/lib/haptics';
import { DURATION, EASE, SPRING_BOUNCY } from '@/lib/motion';
import { useReduceMotion } from '@/lib/use-reduce-motion';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Badge } from '@/constants/badges';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { BadgeMedallion } from './BadgeMedallion';

type Props = { badge: Badge | null; earned: boolean; onClose: () => void };

/** Small bottom sheet with a milestone's medallion, name, and how it's earned. */
export function BadgeDetailSheet({ badge, earned, onClose }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  useEffect(() => {
    if (badge && earned) hapticSoft();
  }, [badge, earned]);
  return (
    <Modal visible={badge != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
        <View />
      </Pressable>
      {badge ? (
        <Animated.View
          entering={reduce ? undefined : FadeInDown.duration(DURATION.slow).easing(EASE).withInitialValues({ opacity: 0, transform: [{ translateY: 60 }] })}
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          accessibilityViewIsModal
        >
          <View style={styles.grabber} />
          <Animated.View entering={reduce ? undefined : ZoomIn.delay(80).springify().damping(SPRING_BOUNCY.damping ?? 11).stiffness(SPRING_BOUNCY.stiffness ?? 220)}>
            <MedalSheen size={120} play={earned} delay={380} id={`sheen-sheet-${badge.id}`}>
              <BadgeMedallion badge={badge} earned={earned} size={120} colors={colors} idPrefix={`sheet-${badge.id}`} />
            </MedalSheen>
          </Animated.View>
          <Text style={styles.status}>{earned ? 'Earned' : 'Not yet'}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {badge.label}
          </Text>
          <Text style={styles.body}>{badge.description}</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.done, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      gap: spacing.sm,
      paddingTop: spacing.md,
      paddingHorizontal: spacing.lg,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      backgroundColor: colors.bgElevated,
    },
    grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
    status: { ...typography.eyebrow, fontSize: 11, color: colors.calm, marginTop: spacing.sm },
    title: { ...typography.title, color: colors.text, textAlign: 'center' },
    body: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
    done: {
      marginTop: spacing.md,
      alignSelf: 'stretch',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderRadius: radii.full,
      backgroundColor: colors.accentStrong,
    },
    doneText: { ...typography.body, color: colors.onAccent, fontWeight: '600' },
  });
}
