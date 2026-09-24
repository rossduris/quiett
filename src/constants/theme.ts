/**
 * DEPRECATED: Import from theme-provider instead.
 *
 * This export is kept for backwards compatibility during migration.
 * New code should use `useTheme()` or `useThemeColors()` from '@/lib/theme-provider'.
 *
 * @deprecated Use `useThemeColors()` hook instead for dynamic theming
 */
export const colors = {
  bg: '#FFF8F4',
  bgElevated: '#FFFFFF',
  bgCard: '#FFF1EA',
  border: '#F5D5C8',
  text: '#2A1810',
  textMuted: '#6B5248',
  textDim: '#9B8278',
  mist: '#E8C4B5',
  accent: '#E89B7A',
  calm: '#3DCFB0',
  calmSoft: 'rgba(61,207,176,0.12)',
  alarm: '#E8685C',
  alarmSoft: '#FDE8E6',
  warning: '#E8A850',
  sunrise: '#E8A06A',
  sunriseSoft: 'rgba(232,160,106,0.15)',
  sunriseDeep: 'rgba(200,120,80,0.20)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const typography = {
  hero: { fontSize: 64, fontWeight: '200' as const, letterSpacing: -2 },
  heroSm: { fontSize: 48, fontWeight: '300' as const, letterSpacing: -1 },
  title: { fontSize: 28, fontWeight: '600' as const, letterSpacing: -0.5 },
  verb: { fontSize: 28, fontWeight: '600' as const, letterSpacing: -0.3 },
  subtitle: { fontSize: 18, fontWeight: '500' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
};
