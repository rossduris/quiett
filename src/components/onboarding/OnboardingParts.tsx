import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import type { MorningGoal, MorningGoalId } from '@/constants/onboarding';
import type { UnlockTrack } from '@/constants/unlock-tracks';
import { sceneSpecFor } from '@/constants/scene-covers';
import { SceneCover } from '@/components/SceneCover';
import { useThemeColors } from '@/lib/theme-provider';
import { artPalette } from './art/art-palette';
import { miniLayout } from './art/scene-layouts';
import { AnimatedScene } from './art/AnimatedScene';

function useStyles() {
  const colors = useThemeColors();
  return { colors, styles: useMemo(() => createStyles(colors), [colors]) };
}

/** Title + body for a step. */
export function StepText({ eyebrow, title, body, center }: { eyebrow?: string; title: string; body?: string; center?: boolean }) {
  const { styles } = useStyles();
  return (
    <View style={[styles.textBlock, center && styles.center]}>
      {eyebrow ? <Text style={[styles.eyebrow, center && styles.textCenter]}>{eyebrow}</Text> : null}
      <Text style={[styles.title, center && styles.textCenter]} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={[styles.body, center && styles.textCenter]}>{body}</Text> : null}
    </View>
  );
}

type HowStep = { kind: 'ring' | 'still' | 'calm'; title: string; body: string };

export const HOW_STEPS: readonly HowStep[] = [
  { kind: 'ring', title: 'Your alarm rings', body: 'It keeps going until you’re up.' },
  { kind: 'still', title: 'Get up and be still', body: 'Prop your phone and face it. The camera sees you’re settled.' },
  { kind: 'calm', title: 'Two calm minutes', body: 'The alarm fades into your sound. Then your day begins.' },
];

/** "How it works": three beats with mini scenes; the highlight moves through them. */
export const HowSteps = memo(function HowSteps({ reduceMotion }: { reduceMotion: boolean }) {
  const { colors, styles } = useStyles();
  const p = useMemo(() => artPalette(colors), [colors]);
  const [active, setActive] = useState(0);
  // Stable layouts: a new object per render would restart every layer's animation.
  const minis = useMemo(() => HOW_STEPS.map((s) => miniLayout(s.kind, 56, p)), [p]);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setActive((a) => (a + 1) % HOW_STEPS.length), 2800);
    return () => clearInterval(id);
  }, [reduceMotion]);

  return (
    <View style={styles.howList}>
      {HOW_STEPS.map((s, i) => {
        const on = reduceMotion || i === active;
        return (
          <Animated.View
            key={s.kind}
            entering={reduceMotion ? FadeIn.duration(300) : FadeInDown.delay(150 + i * 180).duration(420)}
            style={[styles.howRow, on && styles.howRowOn]}
            accessible
            accessibilityLabel={`Step ${i + 1}. ${s.title}. ${s.body}`}
          >
            <View style={styles.howArt}>
              <AnimatedScene layout={minis[i]!} reduceMotion={reduceMotion} playing={on} />
            </View>
            <View style={styles.howText}>
              <Text style={styles.howNum}>{`0${i + 1}`}</Text>
              <Text style={styles.howTitle}>{s.title}</Text>
              <Text style={styles.howBody}>{s.body}</Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
});

/** Single-choice list (goal question). */
export function GoalChoices({
  goals,
  selected,
  onSelect,
}: {
  goals: readonly MorningGoal[];
  selected: MorningGoalId | null;
  onSelect: (id: MorningGoalId) => void;
}) {
  const { colors, styles } = useStyles();
  return (
    <View style={styles.choiceList} accessibilityRole="radiogroup">
      {goals.map((g) => {
        const on = g.id === selected;
        return (
          <Pressable
            key={g.id}
            onPress={() => onSelect(g.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={g.label}
            style={({ pressed }) => [styles.choice, on && styles.choiceOn, pressed && styles.pressed]}
          >
            <View style={[styles.choiceIcon, on && styles.choiceIconOn]}>
              <Ionicons name={g.icon} size={20} color={on ? colors.bg : colors.calm} />
            </View>
            <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{g.label}</Text>
            <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? colors.calm : colors.border} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** First-sound picker: free tracks with their scene covers; tap selects and previews. */
export function SoundChoices({
  tracks,
  selected,
  playingId,
  onSelect,
}: {
  tracks: readonly UnlockTrack[];
  selected: string;
  playingId: string | null;
  onSelect: (t: UnlockTrack) => void;
}) {
  const { colors, styles } = useStyles();
  return (
    <View style={styles.choiceList} accessibilityRole="radiogroup">
      {tracks.map((t) => {
        const on = t.id === selected;
        const playing = playingId === `track:${t.id}`;
        return (
          <Pressable
            key={t.id}
            onPress={() => onSelect(t)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${t.title}, ${t.mood}`}
            accessibilityHint={playing ? 'Playing a preview. Tap again to stop.' : 'Selects this sound and plays a preview'}
            style={({ pressed }) => [styles.choice, on && styles.choiceOn, pressed && styles.pressed]}
          >
            <SceneCover scene={sceneSpecFor(t.id)} size={48} radius={radii.md} />
            <View style={styles.soundText}>
              <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{t.title}</Text>
              <Text style={styles.soundMood} numberOfLines={1}>
                {t.blurb || t.mood}
              </Text>
            </View>
            <Ionicons
              name={playing ? 'pause-circle' : on ? 'checkmark-circle' : 'play-circle-outline'}
              size={26}
              color={on || playing ? colors.calm : colors.textDim}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Checkbox row (evening reminder opt-in on the alarm step). */
export function CheckRow({ checked, title, body, onToggle, disabled }: { checked: boolean; title: string; body: string; onToggle: () => void; disabled?: boolean }) {
  const { colors, styles } = useStyles();
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={`${title}. ${body}`}
      style={({ pressed }) => [styles.checkRow, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={checked ? colors.calm : colors.textDim} />
      <View style={styles.soundText}>
        <Text style={styles.checkTitle}>{title}</Text>
        <Text style={styles.soundMood}>{body}</Text>
      </View>
    </Pressable>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    textBlock: { gap: spacing.sm },
    center: { alignItems: 'center' },
    textCenter: { textAlign: 'center' },
    eyebrow: { ...typography.eyebrow, color: colors.calm, letterSpacing: 2 },
    title: { ...typography.title, color: colors.text },
    body: { ...typography.body, color: colors.textMuted, lineHeight: 24 },
    howList: { gap: spacing.sm },
    howRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgCard,
      opacity: 0.72,
    },
    howRowOn: { opacity: 1, borderColor: colors.calm },
    howArt: { width: 56, height: 56 },
    howText: { flex: 1, gap: 2 },
    howNum: { ...typography.eyebrow, color: colors.calm, fontSize: 11 },
    howTitle: { ...typography.subtitle, fontSize: 17, fontWeight: '600', color: colors.text },
    howBody: { ...typography.body, fontSize: 15, lineHeight: 21, color: colors.textMuted },
    choiceList: { gap: spacing.sm },
    choice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 64,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.bgCard,
    },
    choiceOn: { borderColor: colors.calm, backgroundColor: colors.calmSoft },
    choiceIcon: {
      width: 40,
      height: 40,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.calmSoft,
    },
    choiceIconOn: { backgroundColor: colors.calm },
    choiceText: { ...typography.body, flex: 1, fontWeight: '600', color: colors.text },
    choiceTextOn: { color: colors.text },
    soundText: { flex: 1, gap: 2 },
    soundMood: { ...typography.caption, color: colors.textMuted },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 56,
      padding: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgCard,
    },
    checkTitle: { ...typography.body, fontWeight: '600', color: colors.text },
    pressed: { opacity: 0.75 },
    disabled: { opacity: 0.5 },
  });
}
