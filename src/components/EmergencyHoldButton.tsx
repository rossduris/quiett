import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '@/constants/theme';

const HOLD_MS = 2000;

type Props = { onConfirm: () => void };

export function EmergencyHoldButton({ onConfirm }: Props) {
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
        accessibilityLabel="Hold to emergency dismiss"
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
          {holding ? 'Keep holding…' : 'Hold to dismiss'}
        </Text>
      </Pressable>
      <Text style={styles.hint}>Emergency only · breaks your streak</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm, width: '100%' },
  btn: {
    overflow: 'hidden',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255,92,92,0.45)',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    minWidth: 220,
    width: '72%',
    maxWidth: 320,
    alignItems: 'center',
    backgroundColor: 'rgba(61,26,26,0.55)',
  },
  btnActive: { borderColor: colors.alarm },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,92,92,0.28)',
  },
  label: {
    color: 'rgba(255,92,92,0.9)',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  labelActive: { color: colors.text },
  hint: { color: colors.textDim, fontSize: 11, letterSpacing: 0.2 },
});
