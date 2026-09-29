import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { meditationSoundById } from '@/constants/sounds';
import {
  DEFAULT_UNLOCK_TRACK_ID,
  pickSurpriseTrack,
  unlockTrackById,
  visibleKinds,
  type UnlockTrack,
  type UnlockTrackKind,
} from '@/constants/unlock-tracks';
import { VOICE_OPTIONS } from '@/constants/voices';
import { followPreviewSelection, previewIds, stopPreview, usePreviewPlayer } from '@/lib/audio';
import { useShowGuided, useVoiceGuidesEnabled } from '@/lib/dev-flags';
import { syncEveningReminder } from '@/lib/notifications';
import { usePremium } from '@/lib/premium-provider';
import {
  loadSurpriseMe,
  loadUnlockTrackId,
  loadVoiceGuideId,
  markLibraryCategoryUsed,
  saveSurpriseMe,
  saveSurpriseTrackDate,
  saveUnlockTrackId,
  saveVoiceGuideId,
} from '@/lib/storage';

export type LibraryFilter = 'all' | UnlockTrackKind;

/** Library usage keys for milestones ('healing' is the legacy key for the Tones & music shelf). */
const USAGE_KEY: Record<UnlockTrackKind, 'guided' | 'healing' | 'ambient'> = {
  guided: 'guided',
  music: 'healing',
  ambient: 'ambient',
};

/**
 * Library tab state + actions. Track callbacks are stable (they read the latest state through
 * a ref) so memoised shelf cards only re-render when their own props change.
 */
export function useLibraryState() {
  const router = useRouter();
  const { isPremium, trackResetVersion } = usePremium();
  // Guided shelf is hidden for launch (dev switch brings it back); voice picker is dev-only.
  const guidedOn = useShowGuided();
  const voiceOn = useVoiceGuidesEnabled();
  const [filter, setFilterState] = useState<LibraryFilter>('all');
  const [selectedId, setSelectedId] = useState(DEFAULT_UNLOCK_TRACK_ID);
  const [surpriseMe, setSurpriseMe] = useState(false);
  const [surpriseOffTick, setSurpriseOffTick] = useState(0);
  const [voiceId, setVoiceId] = useState<string>(VOICE_OPTIONS[0]!.id);
  /** First saved-selection load finished (Library shows a placeholder until then). */
  const [ready, setReady] = useState(false);
  const { playingId, toggle: togglePreview } = usePreviewPlayer();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [id, surprise, voice] = await Promise.all([loadUnlockTrackId(), loadSurpriseMe(), loadVoiceGuideId()]);
        if (!alive) return;
        setSelectedId(id);
        setSurpriseMe(surprise);
        setVoiceId(voice);
        setReady(true);
      })().catch(() => {
        if (alive) setReady(true);
      });
      return () => {
        alive = false;
        // Leaving the tab (or unmounting) ends any preview.
        stopPreview();
      };
    }, []),
  );

  // Premium lapsed while this tab was open → show the free fallback the provider saved.
  useEffect(() => {
    if (trackResetVersion === 0) return;
    void loadUnlockTrackId().then(setSelectedId);
  }, [trackResetVersion]);

  const selectedTrack = useMemo(() => unlockTrackById(selectedId), [selectedId]);
  const isLocked = useCallback((track: UnlockTrack) => track.locked && !isPremium, [isPremium]);

  const openPaywall = useCallback(() => {
    stopPreview();
    router.push('/paywall');
  }, [router]);

  // Latest-state ref so the per-track callbacks below can stay referentially stable.
  const latest = useRef({ isPremium, surpriseMe, selectedId, guidedOn });
  useLayoutEffect(() => {
    latest.current = { isPremium, surpriseMe, selectedId, guidedOn };
  });

  const selectTrack = useCallback(
    async (track: UnlockTrack) => {
      const { isPremium: premium, surpriseMe: surprise } = latest.current;
      if (track.locked && !premium) {
        openPaywall(); // also stops any preview
        return;
      }
      // A playing preview follows the selection (crossfade); nothing playing → silent.
      followPreviewSelection(previewIds.track(track.id), meditationSoundById(track.playbackSoundId).url, 'track');
      const saved = await saveUnlockTrackId(track.id, { premium });
      setSelectedId(saved);
      if (surprise) {
        setSurpriseMe(false);
        setSurpriseOffTick((t) => t + 1);
        await saveSurpriseMe(false);
      }
      void syncEveningReminder();
      await markLibraryCategoryUsed(USAGE_KEY[track.kind]);
    },
    [openPaywall],
  );

  const previewTrack = useCallback(
    (track: UnlockTrack) => {
      if (track.locked && !latest.current.isPremium) return;
      const sound = meditationSoundById(track.playbackSoundId);
      if (sound.url == null) return;
      togglePreview(previewIds.track(track.id), sound.url, 'track');
    },
    [togglePreview],
  );

  const toggleSurprise = async () => {
    const next = !surpriseMe;
    if (next) {
      const picked = pickSurpriseTrack(selectedId, isPremium, guidedOn);
      const id = await saveUnlockTrackId(picked.id, { premium: isPremium });
      await saveSurpriseTrackDate();
      setSelectedId(id);
      const track = unlockTrackById(id);
      followPreviewSelection(
        previewIds.track(track.id),
        track.locked && !isPremium ? null : meditationSoundById(track.playbackSoundId).url,
        'track',
      );
    }
    setSurpriseMe(next);
    await saveSurpriseMe(next);
    void syncEveningReminder();
  };

  const selectVoice = async (id: string) => {
    setVoiceId(id);
    await saveVoiceGuideId(id);
  };

  const kinds = useMemo(() => visibleKinds(guidedOn), [guidedOn]);
  /** A filter for a hidden shelf (guided switched off) falls back to All. */
  const activeFilter: LibraryFilter = filter !== 'all' && kinds.includes(filter) ? filter : 'all';
  const sections = activeFilter === 'all' ? kinds : [activeFilter];

  // Changing the filter can unmount the card that's previewing, so end the preview.
  const setFilter = (next: LibraryFilter) => {
    if (next !== activeFilter) stopPreview();
    setFilterState(next);
  };

  return {
    ready,
    isPremium,
    guidedOn,
    voiceOn,
    kinds,
    sections,
    filter: activeFilter,
    setFilter,
    selectedId,
    selectedTrack,
    surpriseMe,
    surpriseOffTick,
    toggleSurprise,
    voiceId,
    selectVoice,
    playingId,
    isLocked,
    selectTrack,
    previewTrack,
    openPaywall,
  };
}
