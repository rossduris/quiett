import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import type { ColorTokens } from '@/constants/themes';
import { POSE_DETECTOR_LABELS } from '@/lib/pose-dev-pref';
import type { PoseCheck, PoseDiagnostics, PoseJoint } from '@/lib/pose/types';
import { useThemeColors } from '@/lib/theme-provider';

/**
 * DEV ONLY. Draws detected joints + skeleton over the camera circle.
 * Joints are Vision-normalized (origin bottom-left) in the oriented image; the preview is
 * aspect-filled into the square, so we map with the same fill scale + center crop.
 */

const MIN_DRAW_CONFIDENCE = 0.3;

/** 2D (Vision body pose) + 3D (pointInImage) joint names. Missing ends are skipped. */
const BONES: readonly [string, string][] = [
  ['leftShoulder', 'rightShoulder'],
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],
  ['neck', 'nose'],
  ['neck', 'head'],
  ['head', 'topHead'],
  ['nose', 'leftEye'],
  ['nose', 'rightEye'],
  ['neck', 'root'],
  ['neck', 'spine'],
  ['spine', 'root'],
  ['leftShoulder', 'leftHip'],
  ['rightShoulder', 'rightHip'],
  ['leftHip', 'rightHip'],
  ['leftHip', 'leftKnee'],
  ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee'],
  ['rightKnee', 'rightAnkle'],
];

type OverlayProps = {
  diagnostics?: PoseDiagnostics;
  children: ReactNode;
  /** Flip x if the preview and Vision image disagree on mirroring (verify on device). */
  mirrorX?: boolean;
};

export function PoseDebugOverlay({ diagnostics, children, mirrorX = false }: OverlayProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createOverlayStyles(colors), [colors]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  const mapped = useMemo(() => {
    if (!diagnostics || size.w === 0 || size.h === 0) return null;
    const iw = diagnostics.imageWidth && diagnostics.imageWidth > 0 ? diagnostics.imageWidth : 3;
    const ih = diagnostics.imageHeight && diagnostics.imageHeight > 0 ? diagnostics.imageHeight : 4;
    const scale = Math.max(size.w / iw, size.h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const ox = (size.w - dw) / 2;
    const oy = (size.h - dh) / 2;
    const pts: Record<string, { x: number; y: number }> = {};
    for (const [name, j] of Object.entries(diagnostics.joints ?? {})) {
      const joint = j as PoseJoint;
      if (!joint || joint.confidence < MIN_DRAW_CONFIDENCE) continue;
      const nx = mirrorX ? 1 - joint.x : joint.x;
      pts[name] = { x: ox + nx * dw, y: oy + (1 - joint.y) * dh };
    }
    return pts;
  }, [diagnostics, size.w, size.h, mirrorX]);

  const stroke = diagnostics?.pass ? colors.sessionGlow : colors.sessionText;

  return (
    <View style={styles.fill} onLayout={onLayout}>
      {children}
      {mapped ? (
        <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h} pointerEvents="none">
          {BONES.map(([a, b]) => {
            const pa = mapped[a];
            const pb = mapped[b];
            if (!pa || !pb) return null;
            return (
              <Line
                key={`${a}-${b}`}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke={stroke}
                strokeOpacity={0.75}
                strokeWidth={2}
                strokeLinecap="round"
              />
            );
          })}
          {Object.entries(mapped).map(([name, p]) => (
            <Circle
              key={name}
              cx={p.x}
              cy={p.y}
              r={3.5}
              fill={colors.sessionGlow}
              stroke={colors.sessionTextMuted}
              strokeWidth={1}
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

function fmt(c: PoseCheck): string {
  if (!c.available) return c.note ? `n/a (${c.note})` : 'n/a';
  if (c.value == null || !Number.isFinite(c.value)) return c.pass ? 'ok' : 'fail';
  const digits = Math.abs(c.value) >= 10 ? 0 : Math.abs(c.value) >= 1 ? 1 : 3;
  const v = c.value.toFixed(digits);
  if (c.kind === 'bool') return `${v} ${c.unit}`.trim();
  const op = c.kind === 'min' ? '≥' : '≤';
  const lim = c.limit.toFixed(Math.abs(c.limit) >= 10 ? 0 : Math.abs(c.limit) >= 1 ? 1 : 3);
  return `${v} ${op} ${lim} ${c.unit}`.trim();
}

type ReadoutProps = { diagnostics?: PoseDiagnostics; fps?: number };

/** DEV ONLY. Compact per-check readout: mode, score, ms/frame, each check. */
export function PoseDebugReadout({ diagnostics, fps }: ReadoutProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createReadoutStyles(colors), [colors]);

  if (!diagnostics) {
    return (
      <View style={styles.panel} pointerEvents="none">
        <Text style={styles.head}>pose debug · waiting for frames…</Text>
      </View>
    );
  }
  const d = diagnostics;
  const modeLabel =
    d.modeUsed === d.mode
      ? POSE_DETECTOR_LABELS[d.mode]
      : `${POSE_DETECTOR_LABELS[d.mode]} → ${POSE_DETECTOR_LABELS[d.modeUsed]}`;
  const ms = d.processingMs != null ? `${d.processingMs.toFixed(0)} ms` : '– ms';
  const rate = fps != null ? ` · ${fps.toFixed(1)} fps` : '';

  return (
    <View style={styles.panel} pointerEvents="none">
      <Text style={styles.head}>
        {modeLabel} · score {d.score} · {ms}
        {rate}
      </Text>
      <Text style={styles.sub}>
        raw {d.rawStatus}
        {d.phonePropped ? '' : ' · phone flat'}
        {d.orientation ? ` · ${d.orientation}` : ''}
        {d.imageWidth && d.imageHeight ? ` ${d.imageWidth}×${d.imageHeight}` : ''}
      </Text>
      {d.fallback ? <Text style={styles.sub}>fallback: {d.fallback}</Text> : null}
      {d.checks.map((c) => (
        <View key={c.name} style={styles.row}>
          <Text style={[styles.flag, c.pass ? styles.ok : styles.bad]}>
            {!c.available ? '·' : c.pass ? '✓' : '✗'}
          </Text>
          <Text style={styles.name}>{c.name}</Text>
          <Text style={styles.val} numberOfLines={1}>
            {fmt(c)}
          </Text>
        </View>
      ))}
      <Text style={styles.joints} numberOfLines={2}>
        joints ({d.jointsDetected.length}): {d.jointsDetected.join(', ') || 'none'}
      </Text>
    </View>
  );
}

function createOverlayStyles(_colors: ColorTokens) {
  return StyleSheet.create({
    fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  });
}

function createReadoutStyles(colors: ColorTokens) {
  return StyleSheet.create({
    panel: {
      alignSelf: 'center',
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.sessionHairline,
      backgroundColor: colors.sessionChipBg,
      minWidth: 240,
      maxWidth: 340,
    },
    head: { color: colors.sessionText, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
    sub: { color: colors.sessionTextMuted, fontSize: 11, marginTop: 1 },
    row: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    flag: { width: 14, fontSize: 11, fontWeight: '700' },
    ok: { color: colors.sessionGlow },
    bad: { color: colors.sessionTextMuted },
    name: { color: colors.sessionText, fontSize: 11, width: 96 },
    val: { color: colors.sessionTextMuted, fontSize: 11, flex: 1, fontVariant: ['tabular-nums'] },
    joints: { color: colors.sessionTextMuted, fontSize: 10, marginTop: 4 },
  });
}
