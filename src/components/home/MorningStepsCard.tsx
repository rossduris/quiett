import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LibraryTrackMark } from '@/components/LibraryTrackMark';
import { TrackCover } from '@/components/TrackCover';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { meditationSoundById, type SoundOption } from '@/constants/sounds';
import { kindLabel, type UnlockTrack } from '@/constants/unlock-tracks';
import { previewIds, usePreviewPlayer } from '@/lib/audio';
import { previewA11yActions, previewButtonA11yHidden } from '@/lib/preview-a11y';
import { SurpriseOffNote } from '@/components/SurpriseOffNote';
import type { CoverStyle } from '@/lib/scene-cover-pref';
import { useThemeColors } from '@/lib/theme-provider';
import { homeCard, pressedStyle } from './home-styles';

const ART = 48;

type Props = {
  alarmSound: SoundOption;
  unlockTrack: UnlockTrack;
  isPremium: boolean;
  surpriseMe: boolean;
  /** Bumps when a pick turned Surprise me off. */
  surpriseOffTick: number;
  coverStyle: CoverStyle;
  onOpenAlarmSound: () => void;
  onOpenTrack: () => void;
  onToggleSurprise: () => void;
};

/** "Your morning": step 1 wake-up alarm, step 2 meditation, plus Surprise me. */
export function MorningStepsCard({
  alarmSound,
  unlockTrack,
  isPremium,
  surpriseMe,
  surpriseOffTick,
  coverStyle,
  onOpenAlarmSound,
  onOpenTrack,
  onToggleSurprise,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const preview = usePreviewPlayer();

  const alarmUrl = alarmSound.url;
  const trackUrl = unlockTrack.locked && !isPremium ? null : meditationSoundById(unlockTrack.playbackSoundId).url;
  const alarmPreviewId = previewIds.alarm(alarmSound.id);
  const trackPreviewId = previewIds.track(unlockTrack.id);
  const kind = kindLabel(unlockTrack.kind);

  const trackArt =
    coverStyle !== 'classic' ? (
      <View style={[styles.art, { borderColor: colors.border }]}>
        <TrackCover trackId={unlockTrack.id} size={ART - 2} radius={radii.md - 1} />
      </View>
    ) : (
      <View style={[styles.art, { backgroundColor: unlockTrack.accentSoft, borderColor: unlockTrack.accent }]}>
        <LibraryTrackMark trackId={unlockTrack.id} kind={unlockTrack.kind} color={unlockTrack.accent} size={30} />
      </View>
    );

  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <Text style={styles.cardLabel}>Your morning</Text>
        <SurpriseOffNote trigger={surpriseOffTick} style={styles.note} />
      </View>

      <View>
        <StepRow
          styles={styles}
          colors={colors}
          step={1}
          art={
            <View style={[styles.art, styles.artAlarm]}>
              <Ionicons name="alarm-outline" size={24} color={colors.sunrise} />
            </View>
          }
          eyebrow="Wake-up alarm"
          title={alarmSound.label}
          meta="Rings until you're still"
          a11yLabel={`Step 1, wake-up alarm: ${alarmSound.label}. Rings until you're still.`}
          a11yHint="Choose your wake-up alarm"
          onPress={onOpenAlarmSound}
          previewPlaying={preview.playingId === alarmPreviewId}
          onPreview={alarmUrl != null ? () => preview.toggle(alarmPreviewId, alarmUrl, 'alarm') : undefined}
        />

        <View style={styles.connector} />

        <StepRow
          styles={styles}
          colors={colors}
          step={2}
          art={trackArt}
          eyebrow="Meditation"
          title={unlockTrack.title}
          meta={`${kind}${surpriseMe ? ' · rotating' : ''} · 2 min`}
          a11yLabel={`Step 2, meditation: ${unlockTrack.title}. ${kind}, 2 minutes${surpriseMe ? ', rotating' : ''}.`}
          a11yHint="Choose your meditation"
          onPress={onOpenTrack}
          previewPlaying={preview.playingId === trackPreviewId}
          onPreview={trackUrl != null ? () => preview.toggle(trackPreviewId, trackUrl, 'track') : undefined}
        />
      </View>

      <View style={styles.surpriseRow}>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Surprise me"
          accessibilityHint="Picks a different meditation each morning"
          accessibilityState={{ checked: surpriseMe }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={onToggleSurprise}
          style={({ pressed }) => [styles.surprisePill, surpriseMe && styles.surprisePillOn, pressed && pressedStyle]}
        >
          <Ionicons name="shuffle-outline" size={14} color={surpriseMe ? colors.calm : colors.textDim} />
          <Text style={[styles.surpriseText, surpriseMe && styles.surpriseTextOn]}>Surprise me</Text>
        </Pressable>
      </View>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

function StepRow({
  styles,
  colors,
  step,
  art,
  eyebrow,
  title,
  meta,
  a11yLabel,
  a11yHint,
  onPress,
  previewPlaying,
  onPreview,
}: {
  styles: Styles;
  colors: ColorTokens;
  step: number;
  art: ReactNode;
  eyebrow: string;
  title: string;
  meta: string;
  a11yLabel: string;
  a11yHint: string;
  onPress: () => void;
  previewPlaying: boolean;
  onPreview?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={a11yHint}
      onPress={onPress}
      {...previewA11yActions(previewPlaying, onPreview)}
      style={({ pressed }) => [styles.stepRow, pressed && pressedStyle]}
    >
      <View style={styles.artWrap}>
        {art}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{step}</Text>
        </View>
      </View>
      <View style={styles.stepBody}>
        <Text style={styles.stepEyebrow}>{eyebrow}</Text>
        <Text style={styles.stepTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.stepMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {onPreview ? (
        <Pressable
          {...previewButtonA11yHidden}
          hitSlop={8}
          onPress={onPreview}
          style={({ pressed }) => [styles.previewBtn, previewPlaying && styles.previewBtnActive, pressed && pressedStyle]}
        >
          <Ionicons name={previewPlaying ? 'stop' : 'play'} size={14} color={previewPlaying ? colors.calm : colors.text} />
        </Pressable>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </Pressable>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { ...homeCard(colors), gap: spacing.md },
    cardLabel: { ...typography.eyebrow, color: colors.textDim },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    artWrap: { width: ART, height: ART },
    art: {
      width: ART,
      height: ART,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      overflow: 'hidden',
    },
    artAlarm: { backgroundColor: colors.sunriseSoft, borderColor: colors.sunrise },
    badge: {
      position: 'absolute',
      left: -6,
      bottom: -6,
      width: 22,
      height: 22,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.calm,
      borderWidth: 2,
      borderColor: colors.bgCard,
    },
    // Numeral inside a 22pt badge: intentionally below the type scale.
    badgeText: { color: colors.bg, fontSize: 11, fontWeight: '800' },
    stepBody: { flex: 1, gap: 1 },
    stepEyebrow: { ...typography.eyebrow, color: colors.textDim },
    stepTitle: { ...typography.subtitle, color: colors.text, fontWeight: '600' },
    stepMeta: { ...typography.caption, color: colors.textMuted },
    connector: {
      width: 2,
      height: 18,
      borderRadius: 1,
      marginLeft: ART / 2 - 1,
      marginVertical: 6,
      backgroundColor: colors.border,
    },
    previewBtn: {
      width: 34,
      height: 34,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewBtnActive: { backgroundColor: colors.calmSoft, borderColor: colors.calm },
    surpriseRow: { flexDirection: 'row', paddingLeft: ART + spacing.md },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    note: { ...typography.eyebrow, color: colors.calm },
    surprisePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 28,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.full,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    surprisePillOn: { backgroundColor: colors.calmSoft, borderColor: colors.calm },
    surpriseText: { ...typography.caption, color: colors.textDim, fontWeight: '700' },
    surpriseTextOn: { color: colors.calm },
  });
}
