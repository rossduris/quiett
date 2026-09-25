import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';

const HOLD_MS = 2000;

type Props = { onConfirm: () => void };

export function EmergencyHoldButton({ onConfirm }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const clear = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    startRef.current = null;
    doneRef.current = false;
    setHolding(false);
    setProgress(0);
  };

  const tick = () => {
    if (startRef.current == null) return;
    const p = Math.min(1, (Date.now() - startRef.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1 && !doneRef.current) {
      doneRef.current = true;
      onConfirm();
      clear();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => clear(), []);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hold to end early"
        accessibilityHint="Hold for two seconds. For emergencies only — this resets your streak."
        onPressIn={() => {
          doneRef.current = false;
          startRef.current = Date.now();
          setHolding(true);
          rafRef.current = requestAnimationFrame(tick);
        }}
        onPressOut={clear}
        style={[styles.btn, holding && styles.btnActive]}
      >
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        <Text style={[styles.label, holding && styles.labelActive]}>
          {holding ? 'Keep holding\u2026' : 'Hold to end early'}
        </Text>
      </Pressable>
      <Text style={styles.hint}>For emergencies · resets your streak</Text>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: { alignItems: 'center', gap: spacing.sm, width: '100%' },
    btn: {
      overflow: 'hidden',
      borderRadius: radii.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.sessionHairline,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      minWidth: 220,
      width: '72%',
      maxWidth: 320,
      alignItems: 'center',
      backgroundColor: colors.sessionChipBg,
    },
    btnActive: { borderColor: colors.sessionGlow },
    fill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      backgroundColor: colors.sessionGlowSoft,
    },
    label: {
      color: colors.sessionTextMuted,
      fontWeight: '500',
      fontSize: 15,
      letterSpacing: 0.2,
    },
    labelActive: { color: colors.sessionText },
    hint: { color: colors.sessionTextMuted, opacity: 0.75, fontSize: 12, letterSpacing: 0.2 },
  });
}
