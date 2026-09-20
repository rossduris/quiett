export const colors = {
  bg: '#0B0F14',
  bgElevated: '#141A22',
  bgCard: '#1A222D',
  border: '#2A3544',
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
