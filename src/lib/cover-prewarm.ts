import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { sceneContentFor, sceneOptionsFor } from '@/components/SceneCover';
import { CARD_W, SCENE_ART_H } from '@/components/library/library-styles';
import { sceneSpecFor } from '@/constants/scene-covers';
import type { ColorTokens } from '@/constants/themes';
import { unlockTracksByKind, visibleKinds } from '@/constants/unlock-tracks';
import { buildSceneCached } from '@/lib/scene-gen';

/** Wait after Home settles before warming, then build a few scenes per slice. */
const START_DELAY_MS = 1500;
const PER_SLICE = 3;
const SLICE_MS = 60;
/** Track picker thumbnails (UnlockTrackPicker). */
const PICKER_SIZE = 50;

let warmedKey: string | null = null;

/**
 * Background pre-warm of the Library covers: builds the scene models (and their SVG elements)
 * the shelves and track picker will ask for, in shelf order, a few at a time once Home is idle.
 * Nothing is mounted — this only fills the scene / element caches so the first Library open does
 * no generation work. Re-runs when the theme or the guided shelf changes.
 */
export function usePrewarmLibraryCovers(opts: { colors: ColorTokens; guidedOn: boolean; enabled: boolean }) {
  const { colors, guidedOn, enabled } = opts;
  useEffect(() => {
    if (!enabled) return;
    const key = `${colors.bg}|${colors.accent}|${colors.calm}|${guidedOn}`;
    if (warmedKey === key) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Shelf order, interleaved so the first cards of every shelf warm first.
    const shelves = visibleKinds(guidedOn).map((k) => unlockTracksByKind(k));
    const ids: string[] = [];
    for (let i = 0; i < Math.max(0, ...shelves.map((s) => s.length)); i++) {
      for (const s of shelves) if (s[i]) ids.push(s[i]!.id);
    }
    const shelfOpts = sceneOptionsFor(colors, CARD_W - 2, SCENE_ART_H);
    const pickerOpts = sceneOptionsFor(colors, PICKER_SIZE);
    const jobs = [...ids.map((id) => () => sceneContentFor(buildSceneCached(sceneSpecFor(id), shelfOpts))),
      ...ids.map((id) => () => sceneContentFor(buildSceneCached(sceneSpecFor(id), pickerOpts)))];

    const slice = () => {
      if (cancelled) return;
      for (let n = 0; n < PER_SLICE && jobs.length; n++) jobs.shift()!();
      if (jobs.length) timer = setTimeout(slice, SLICE_MS);
      else warmedKey = key;
    };
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(slice, START_DELAY_MS);
    });
    return () => {
      cancelled = true;
      task.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [colors, guidedOn, enabled]);
}
