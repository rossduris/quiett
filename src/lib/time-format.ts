/**
 * Clock formatting that follows the device's 12/24-hour setting.
 *
 * Hermes' `toLocaleTimeString` only knows the *locale* (en-US → 12h), not the iOS Settings →
 * General → Date & Time → "24-Hour Time" switch, so an en-US phone set to 24-hour still saw
 * "7:00 AM". expo-localization reads the real setting (`uses24hourClock`). It is a native
 * module: until the app is rebuilt with it we fall back to the locale formatter.
 */

type LocalizationModule = { getCalendars?: () => { uses24hourClock?: boolean | null }[] };

let localization: LocalizationModule | null | undefined;
function loadLocalization(): LocalizationModule | null {
  if (localization !== undefined) return localization;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    localization = require('expo-localization') as LocalizationModule;
  } catch {
    localization = null;
  }
  return localization;
}

export function parseHhMmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const d = new Date();
  // `h || 7` used to turn midnight ("00:30") into 7:30.
  d.setHours(Number.isFinite(h) ? Math.min(23, Math.max(0, h!)) : 7, Number.isFinite(m) ? Math.min(59, Math.max(0, m!)) : 0, 0, 0);
  return d;
}

export function toHhMm(d: Date): string {
  return `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
}

let uses24hCache: boolean | null = null;

/** True when the device shows a 24-hour clock (system setting first, locale as fallback). */
export function deviceUses24h(): boolean {
  if (uses24hCache !== null) return uses24hCache;
  let v: boolean | null = null;
  try {
    const cal = loadLocalization()?.getCalendars?.()[0];
    if (typeof cal?.uses24hourClock === 'boolean') v = cal.uses24hourClock;
  } catch {
    v = null;
  }
  if (v === null) {
    const probe = new Date(2000, 0, 1, 13, 0).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    v = /13/.test(probe);
  }
  uses24hCache = v;
  return v;
}

/** Re-read the setting (call when the app returns to the foreground). */
export function refreshClockPreference(): void {
  uses24hCache = null;
}

/** Clock time for a Date: "07:00" / "19:30" on a 24-hour device, "7:00 AM" otherwise. */
export function formatClock(d: Date): string {
  if (deviceUses24h()) return toHhMm(d);
  try {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    const h = d.getHours() % 12 || 12;
    return `${h}:${`${d.getMinutes()}`.padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
  }
}

/** Locale-formatted alarm time, e.g. "7:00 AM" or "07:00". */
export function displayHhMm(hhmm: string): string {
  return formatClock(parseHhMmToDate(hhmm));
}

/** Clock time split for big-number layouts: { time: "8:02", period: "AM" } (period '' on 24h). */
export function splitClock(ts: number | Date): { time: string; period: string } {
  const s = formatClock(ts instanceof Date ? ts : new Date(ts));
  const m = /^(.*?)\s*([AaPp]\.?\s?[Mm]\.?)$/.exec(s);
  return m ? { time: m[1]!, period: m[2]!.replace(/[.\s]/g, '').toUpperCase() } : { time: s, period: '' };
}
