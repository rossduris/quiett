import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SceneCover } from '@/components/SceneCover';
import { TrackCover } from '@/components/TrackCover';
import { Image } from 'expo-image';
import { TRACK_COVER_IMAGES, trackCoverKeyFor, type TrackCoverKey } from '@/constants/track-covers';
import { radii, spacing } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { sceneSpecFor } from '@/constants/scene-covers';
import { UNLOCK_TRACKS } from '@/constants/unlock-tracks';
import {
  mulberry32,
  SCENE_TYPES,
  TIMES_OF_DAY,
  type SceneDetail,
  type SceneMode,
  type SceneSpec,
} from '@/lib/scene-gen';
import { useThemeColors } from '@/lib/theme-provider';

type ModeChoice = 'theme' | SceneMode;

const DETAIL_POOL: SceneDetail[] = ['birds', 'clouds', 'mist', 'rays', 'tree', 'headland', 'peak', 'waves'];

function randomSpecs(seed: number, count: number): { label: string; spec: SceneSpec }[] {
  const rng = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => {
    const type = SCENE_TYPES[i % SCENE_TYPES.length]!;
    const timeOfDay = TIMES_OF_DAY[Math.floor(rng() * TIMES_OF_DAY.length)]!;
    const high = type === 'clouds' || type === 'window';
    return {
      label: `${type} · ${timeOfDay}`,
      spec: {
        type,
        timeOfDay,
        sunX: 0.25 + rng() * 0.5,
        sunY: high ? 0.3 + rng() * 0.25 : 0.4 + rng() * 0.2,
        hueShift: (rng() - 0.5) * 24,
        seed: Math.floor(rng() * 1e9),
        details: DETAIL_POOL.filter(() => rng() < 0.3),
      },
    };
  });
}

/** Dev-only: art covers + generative scene covers (every track plus random seeds across types / times). */
export default function CoverGalleryScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<ModeChoice>('theme');
  const [seed, setSeed] = useState(7);

  const cols = 3;
  const cell = Math.floor((width - spacing.lg * 2 - spacing.sm * (cols - 1)) / cols);
  const forced = mode === 'theme' ? undefined : mode;

  const trackItems = useMemo(
    () => UNLOCK_TRACKS.map((t) => ({ key: t.id, label: t.title, spec: sceneSpecFor(t.id), locked: t.locked })),
    [],
  );
  const randomItems = useMemo(() => randomSpecs(seed, 18), [seed]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Cover gallery" fallbackHref="/settings" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.row}>
          {(['theme', 'light', 'dark'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[styles.pill, mode === m && styles.pillOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === m }}
            >
              <Text style={[styles.pillText, mode === m && styles.pillTextOn]}>
                {m === 'theme' ? 'Current theme' : m === 'light' ? 'Peach' : 'Night'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>Art covers · tracks</Text>
        <View style={styles.grid}>
          {trackItems.map((it) => (
            <View key={`art-${it.key}`} style={{ width: cell }}>
              <TrackCover trackId={it.key} size={cell} radius={radii.md} locked={it.locked} variant="art" />
              <Text style={styles.label} numberOfLines={1}>
                {it.label} · {trackCoverKeyFor(it.key)}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>All 20 art covers</Text>
        <View style={styles.grid}>
          {(Object.keys(TRACK_COVER_IMAGES) as TrackCoverKey[]).map((k) => (
            <View key={`img-${k}`} style={{ width: cell }}>
              <Image source={TRACK_COVER_IMAGES[k]} style={{ width: cell, height: cell, borderRadius: radii.md }} contentFit="cover" />
              <Text style={styles.label}>cover-{k}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>Scene covers · tracks</Text>
        <View style={styles.grid}>
          {trackItems.map((it) => (
            <View key={it.key} style={{ width: cell }}>
              <SceneCover scene={it.spec} size={cell} radius={radii.md} mode={forced} />
              <Text style={styles.label} numberOfLines={1}>
                {it.label}
                {it.locked ? ' · Premium' : ''}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>Scene thumbnails (48pt)</Text>
        <View style={styles.grid}>
          {trackItems.map((it) => (
            <SceneCover key={it.key} scene={it.spec} size={48} radius={12} mode={forced} />
          ))}
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.section}>Scene random seeds</Text>
          <Pressable onPress={() => setSeed((s) => s + 1)} style={styles.pill} accessibilityRole="button">
            <Text style={styles.pillText}>Shuffle</Text>
          </Pressable>
        </View>
        <View style={styles.grid}>
          {randomItems.map((it, i) => (
            <View key={`${seed}-${i}`} style={{ width: cell }}>
              <SceneCover scene={it.spec} size={cell} radius={radii.md} mode={forced} />
              <Text style={styles.label} numberOfLines={1}>
                {it.label}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },
    row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    section: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: spacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    label: { color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 4 },
    pill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radii.full,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillOn: { backgroundColor: colors.calmSoft, borderColor: colors.calm },
    pillText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
    pillTextOn: { color: colors.calm },
  });
}
