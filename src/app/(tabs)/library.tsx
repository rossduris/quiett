import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeaturedCard } from '@/components/library/FeaturedCard';
import { FilterChips } from '@/components/library/FilterChips';
import { LibraryHeader } from '@/components/library/LibraryHeader';
import { TrackShelf } from '@/components/library/TrackShelf';
import { VoicePicker } from '@/components/library/VoicePicker';
import { TAB_BAR_CLEARANCE } from '@/components/QuiettTabBar';
import { spacing } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { kindLabel } from '@/constants/unlock-tracks';
import { previewIds } from '@/lib/audio';
import { useCoverStyle } from '@/lib/scene-cover-pref';
import { useThemeColors } from '@/lib/theme-provider';
import { useLibraryState, type LibraryFilter } from '@/lib/use-library-state';

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scenes = useCoverStyle() !== 'classic';
  const lib = useLibraryState();

  const filterItems = useMemo(
    () => [
      { id: 'all' as LibraryFilter, label: 'All' },
      ...lib.kinds.map((k) => ({ id: k as LibraryFilter, label: kindLabel(k) })),
    ],
    [lib.kinds],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}
        showsVerticalScrollIndicator={false}
      >
        <LibraryHeader isPremium={lib.isPremium} onOpenPaywall={lib.openPaywall} />

        <FeaturedCard
          track={lib.selectedTrack}
          locked={lib.isLocked(lib.selectedTrack)}
          previewing={lib.playingId === previewIds.track(lib.selectedTrack.id)}
          scenes={scenes}
          surpriseMe={lib.surpriseMe}
          surpriseOffTick={lib.surpriseOffTick}
          onToggleSurprise={() => void lib.toggleSurprise()}
          onPreview={lib.previewTrack}
        />

        {lib.voiceOn ? <VoicePicker voiceId={lib.voiceId} onSelect={(id) => void lib.selectVoice(id)} /> : null}

        <FilterChips items={filterItems} activeId={lib.filter} onChange={lib.setFilter} a11yPrefix="Show" />

        {lib.sections.map((kind) => (
          <TrackShelf
            key={kind}
            kind={kind}
            isPremium={lib.isPremium}
            selectedId={lib.selectedId}
            playingId={lib.playingId}
            scenes={scenes}
            onSelect={lib.selectTrack}
            onPreview={lib.previewTrack}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    content: { gap: spacing.md },
  });
}
