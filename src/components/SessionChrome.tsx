import { StyleSheet, Text, View } from 'react-native';
import { ProgressRing } from '@/components/ProgressRing';
import { colors, spacing, typography } from '@/constants/theme';
import type { SessionPhase } from '@/lib/session-machine';

type Props = {
  phase: SessionPhase;
  /** Confirm progress 0–1 while detecting */
  confirmProgress: number;
  /** Sit progress 0–1 while meditating */
  sitProgress: number;
  /** Huge remaining label (mm:ss) */
  timerLabel: string;
  ringColor: string;
};

function copyFor(phase: SessionPhase): { verb: string; hint: string } {
  switch (phase) {
    case 'alarming':
      return { verb: 'Face the camera', hint: 'Phone propped · look at the lens · hold still' };
    case 'detecting':
      return { verb: 'Hold still', hint: 'Looking good — unlocking your morning' };
    case 'meditating':
      return { verb: 'Stay still', hint: 'Wake. Stay. Begin.' };
    default:
      return { verb: '', hint: '' };
  }
}

export function SessionChrome({
  phase,
  confirmProgress,
  sitProgress,
  timerLabel,
  ringColor,
}: Props) {
  const copy = copyFor(phase);
  const isAlarm = phase === 'alarming';
  const isDetect = phase === 'detecting';
  const isMeditate = phase === 'meditating';

  const progress = isMeditate ? sitProgress : isDetect ? confirmProgress : 0;

  return (
    <View style={styles.root}>
      <ProgressRing
        size={292}
        strokeWidth={isMeditate ? 8 : 12}
        progress={progress}
        color={ringColor}
        trackColor={
          isAlarm
            ? 'rgba(255,92,92,0.18)'
            : isMeditate
              ? 'rgba(224,122,85,0.16)'
              : 'rgba(255,255,255,0.08)'
        }
        concentric={isMeditate}
        pulse={isAlarm}
      >
        {isMeditate ? (
          <View style={styles.meditateCenter}>
            <Text style={styles.hugeTime}>{timerLabel}</Text>
          </View>
        ) : isDetect ? (
          <Text style={[styles.confirmPct, { color: ringColor }]}>
            {Math.round(confirmProgress * 100)}
          </Text>
        ) : (
          <View style={[styles.glyph, { borderColor: ringColor }]}>
            <View style={[styles.glyphInner, { backgroundColor: ringColor }]} />
          </View>
        )}
      </ProgressRing>

      {isMeditate ? (
        <>
          <Text style={[styles.phaseLabel, { color: ringColor }]}>{copy.verb}</Text>
          <Text style={styles.hint}>{copy.hint}</Text>
        </>
      ) : (
        <>
          <Text style={[styles.verb, { color: ringColor }]}>{copy.verb}</Text>
          <Text style={styles.hint}>{copy.hint}</Text>
          <Text style={styles.sitMeta}>Unlock · {timerLabel}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  meditateCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hugeTime: {
    ...typography.hero,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  confirmPct: {
    fontSize: 56,
    fontWeight: '200',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  glyph: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    opacity: 0.9,
  },
  verb: {
    ...typography.verb,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  phaseLabel: {
    marginTop: spacing.md,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  hint: {
    ...typography.caption,
    color: colors.mist,
    textAlign: 'center',
    opacity: 0.9,
  },
  sitMeta: {
    ...typography.caption,
    color: colors.textDim,
    marginTop: spacing.xs,
    letterSpacing: 0.3,
  },
});
