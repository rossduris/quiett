/** Monotone photoreal covers for Library / morning-sound tiles. */
export const LIBRARY_ART: Record<string, number> = {
  'guided:first-light': require('../../assets/images/library/guided-first-light.png'),
  'guided:open-eyes': require('../../assets/images/library/guided-open-eyes.png'),
  'guided:still-horizon': require('../../assets/images/library/guided-still-horizon.png'),
  'guided:warm-window': require('../../assets/images/library/guided-warm-window.png'),
  'guided:quiet-rise': require('../../assets/images/library/guided-quiet-rise.png'),
  'guided:clear-morning': require('../../assets/images/library/guided-clear-morning.png'),
  'music:soft-pad': require('../../assets/images/library/music-soft-pad.png'),
  'music:dawn-keys': require('../../assets/images/library/music-dawn-keys.png'),
  'music:warm-drone': require('../../assets/images/library/music-warm-drone.png'),
  'music:clear-bell': require('../../assets/images/library/music-clear-bell.png'),
  'ambient:calm_waves': require('../../assets/images/library/ambient-ocean.png'),
  'ambient:morning_birds': require('../../assets/images/library/ambient-forest-birds.png'),
  'ambient:soft_rain': require('../../assets/images/library/ambient-rain.png'),
};

export function libraryArtFor(trackId: string): number | undefined {
  return LIBRARY_ART[trackId];
}
