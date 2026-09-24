/**
 * Quiett theme packs.
 *
 * Each theme defines semantic color tokens used throughout the app.
 * Tokens stay stable across themes so screens don't break when switching.
 *
 * To add a new theme:
 * 1. Define a new theme object below matching the ColorTokens shape
 * 2. Add it to THEMES registry
 * 3. Add the theme ID to ThemeId union type
 */

export type ColorTokens = {
  /** Primary background (screen/page level). */
  bg: string;
  /** Elevated surface (modals, popovers). */
  bgElevated: string;
  /** Card / section background. */
  bgCard: string;
  /** Border / divider color. */
  border: string;
  /** Primary text. */
  text: string;
  /** Secondary / muted text. */
  textMuted: string;
  /** Tertiary / dim text. */
  textDim: string;
  /** Soft wash / hint color. */
  mist: string;
  /** General accent / link color. */
  accent: string;
  /** Primary calm / success accent (meditation, unlock, success). */
  calm: string;
  /** Calm soft background / tint. */
  calmSoft: string;
  /** Alarm / danger color. */
  alarm: string;
  /** Alarm soft background. */
  alarmSoft: string;
  /** Warning color. */
  warning: string;
  /** Warm wake energy (sunrise / alarm chrome). */
  sunrise: string;
  /** Sunrise soft background. */
  sunriseSoft: string;
  /** Sunrise deep / shadow. */
  sunriseDeep: string;
  /** Status bar style for this theme. */
  statusBarStyle: 'light' | 'dark';
};

export type ThemeId = 'peachCream' | 'nightTeal';

export type Theme = {
  id: ThemeId;
  name: string;
  colors: ColorTokens;
};

/**
 * Peach Cream (Default)
 * 
 * Soft morning palette matching the sunrise-clock icon.
 * Cream/white backgrounds with peachy highlights — calm, light, quiet.
 */
export const PEACH_CREAM: Theme = {
  id: 'peachCream',
  name: 'Peach Cream',
  colors: {
    bg: '#FFF8F4',
    bgElevated: '#FFFFFF',
    bgCard: '#FFF1EA',
    border: '#F5D5C8',
    text: '#2A1810',
    textMuted: '#6B5248',
    textDim: '#9B8278',
    mist: '#E8C4B5',
    accent: '#E89B7A',
    // Primary action / selected / success — warm peach (not teal)
    calm: '#E07A55',
    calmSoft: 'rgba(224,122,85,0.14)',
    alarm: '#E8685C',
    alarmSoft: '#FDE8E6',
    warning: '#E8A850',
    sunrise: '#E8A06A',
    sunriseSoft: 'rgba(232,160,106,0.15)',
    sunriseDeep: 'rgba(200,120,80,0.20)',
    statusBarStyle: 'dark',
  },
};

/**
 * Night Teal (Dark)
 * 
 * Original dark navy + teal palette.
 * Deep backgrounds with teal calm accent.
 */
export const NIGHT_TEAL: Theme = {
  id: 'nightTeal',
  name: 'Night Teal',
  colors: {
    bg: '#0A1220',
    bgElevated: '#121C2A',
    bgCard: '#162033',
    border: '#243247',
    text: '#E8EEF5',
    textMuted: '#8B9BB0',
    textDim: '#5C6B7E',
    mist: '#A8C5D4',
    accent: '#5B8CFF',
    calm: '#3DCFB0',
    calmSoft: 'rgba(61,207,176,0.14)',
    alarm: '#FF5C5C',
    alarmSoft: '#3D1A1A',
    warning: '#F0B429',
    sunrise: '#E8A06A',
    sunriseSoft: 'rgba(232,160,106,0.18)',
    sunriseDeep: 'rgba(180,90,40,0.28)',
    statusBarStyle: 'light',
  },
};

/** Theme registry — add new themes here. */
export const THEMES: Record<ThemeId, Theme> = {
  peachCream: PEACH_CREAM,
  nightTeal: NIGHT_TEAL,
};

export const DEFAULT_THEME_ID: ThemeId = 'peachCream';

/** Get theme by ID with fallback to default. */
export function getTheme(id: ThemeId | null | undefined): Theme {
  if (id && THEMES[id]) return THEMES[id];
  return PEACH_CREAM;
}
