import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { EmptyState } from '@/components/EmptyState';
import { SmallScene } from '@/components/SmallScene';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { ringPhrase, type HomeStatusMode } from '@/lib/home-status';
import { DURATION, EASE } from '@/lib/motion';
import { useThemeColors } from '@/lib/theme-provider';
import { formatClock } from '@/lib/time-format';
import { useReduceMotion } from '@/lib/use-reduce-motion';
import { cardDismiss } from './home-styles';

/** Night-before checklist (what the stillness gate needs in the morning). */
export const PREP_TIPS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'battery-charging-outline', text: 'Phone on the charger' },
  { icon: 'phone-portrait-outline', text: 'Held steady, facing you' },
  { icon: 'sunny-outline', text: 'Enough light to see you' },
];

type Props = {
  mode: HomeStatusMode;
  now: Date;
  nextRing: Date | null;
  /** After 6 PM with the next ring tomorrow (adds the prep tips to the first-day card). */
  evening: boolean;
  unlockAt: number | null;
  intention: string;
  onTurnOn: () => void;
  onDismiss: () => void;
};

/**
 * The one status card that leads Home: first morning, no alarm, evening prep or
 * "Morning unlocked at …". Copy only uses real data (next ring, logged unlock time).
 */
export function HomeStatusCard({ mode, now, nextRing, evening, unlockAt, intention, onTurnOn, onDismiss }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reduce = useReduceMotion();
  const entering = reduce ? FadeIn.duration(DURATION.fast) : FadeInDown.duration(DURATION.slow).easing(EASE);
  const exiting = FadeOut.duration(DURATION.fast);

  const tips = (
    <View style={styles.tips} accessibilityRole="list">
      {PREP_TIPS.map((t) => (
        <View key={t.text} style={styles.tip}>
          <View style={styles.tipIcon}>
            <Ionicons name={t.icon} size={16} color={colors.calm} />
          </View>
          <Text style={styles.tipText}>{t.text}</Text>
        </View>
      ))}
    </View>
  );

  let body: ReactNode = null;
  if (mode === 'off') {
    body = (
      <EmptyState
        scene="ring"
        title="No alarm set"
        body="Turn your alarm on and pick your days. Quiett takes it from there."
        actionLabel="Turn alarm on"
        onAction={onTurnOn}
      />
    );
  } else if (mode === 'firstDay' && nextRing) {
    body = (
      <EmptyState
        scene={evening ? 'evening' : 'sunrise'}
        title={`Your first morning is ${ringPhrase(nextRing, now, formatClock(nextRing))}`}
        body={
          evening
            ? 'A little prep tonight makes the morning easy.'
            : 'When it rings, hold still for a moment and your morning opens.'
        }
      >
        {evening ? tips : null}
      </EmptyState>
    );
  } else if (mode === 'evening' && nextRing) {
    body = (
      <View style={styles.card}>
        <SmallScene kind="evening" size={88} radius={radii.lg} />
        <View style={styles.textBlock}>
          <Text style={styles.eyebrow}>Tonight</Text>
          <Text style={styles.title}>Tomorrow, {formatClock(nextRing)}</Text>
          <Text style={styles.body}>Before bed, set up for an easy morning.</Text>
        </View>
        {tips}
      </View>
    );
  } else if (mode === 'unlocked') {
    const at = unlockAt != null ? formatClock(new Date(unlockAt)) : null;
    const text = intention.trim();
    body = (
      <View style={[styles.card, styles.unlockedCard]}>
        <Pressable onPress={onDismiss} style={[cardDismiss, styles.dismiss]} hitSlop={12} accessibilityRole="button" accessibilityLabel="Dismiss morning unlocked">
          <Ionicons name="close" size={20} color={colors.textDim} />
        </Pressable>
        <SmallScene kind="sunriseRings" size={88} radius={radii.lg} />
        <View style={styles.textBlock}>
          <Text style={[styles.eyebrow, { color: colors.calm }]}>Your day is open</Text>
          <Text style={styles.title}>{at ? `Morning unlocked at ${at}` : 'Morning unlocked'}</Text>
        </View>
        {text ? (
          <View style={styles.intention}>
            <Text style={styles.intentionLabel}>Today&apos;s intention</Text>
            <Text style={styles.intentionText}>{text}</Text>
          </View>
        ) : (
          <Text style={styles.body}>Nothing left to do here. Enjoy the morning.</Text>
        )}
      </View>
    );
  }

  if (!body) return null;
  return (
    <Animated.View key={mode} entering={entering} exiting={exiting}>
      {body}
    </Animated.View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { backgroundColor: colors.bgCard, borderRadius: radii.xl, padding: spacing.lg, gap: spacing.md },
    unlockedCard: { backgroundColor: colors.calmSoft },
    dismiss: { top: spacing.lg + spacing.xs, right: spacing.lg + spacing.xs, backgroundColor: colors.frostBg },
    textBlock: { gap: 4 },
    eyebrow: { ...typography.eyebrow, color: colors.textDim },
    title: { ...typography.subtitle, color: colors.text, fontWeight: '600' },
    body: { ...typography.caption, color: colors.textMuted, lineHeight: 19 },
    tips: { gap: spacing.sm },
    tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    tipIcon: {
      width: 28,
      height: 28,
      borderRadius: radii.full,
      backgroundColor: colors.calmSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tipText: { ...typography.body, color: colors.text, flexShrink: 1 },
    intention: {
      gap: 2,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.bgCard,
    },
    intentionLabel: { ...typography.caption, color: colors.textDim, fontWeight: '600' },
    intentionText: { ...typography.body, color: colors.text, fontStyle: 'italic', lineHeight: 22 },
  });
}
