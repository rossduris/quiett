/** "HH:mm" alarm-time helpers shared by Home. Display follows the device locale (12h or 24h). */

export function parseHhMmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(h || 7, m || 0, 0, 0);
  return d;
}

export function toHhMm(d: Date): string {
  return `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
}

/** Locale-formatted time, e.g. "7:00 AM" or "07:00". */
export function displayHhMm(hhmm: string): string {
  return parseHhMmToDate(hhmm).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

let uses24hCache: boolean | null = null;

/**
 * True when the device locale formats times on a 24-hour clock. Derived from the same
 * formatter the card uses, so the Android picker and the card always agree. (iOS's native
 * picker reads the system setting directly.)
 */
export function deviceUses24h(): boolean {
  if (uses24hCache === null) {
    const probe = new Date(2000, 0, 1, 13, 0).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    uses24hCache = /13/.test(probe);
  }
  return uses24hCache;
}
