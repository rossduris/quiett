# Quiett Profile — brief

Lean Profile screen for streak + account stub. Entry from Home only (no bottom tabs).

## Mobbin refs

- **Calm week dots** — Mon–Sun row of hollow/filled circles with checks for completed sits; today gets a stronger outer ring. Informed by Calm progress / mood-week strips.
- **Hue sign-out placement** — Signed-in account shows identity, then a muted grey **Sign out** pill (not red-destructive). Matches Philips Hue account tone.
- **Home entry chip** — Circular top-right avatar/chip (“You” or initial) routes to `/profile`. Deliberately **not** a tab bar.

## Screens / storage

- `src/app/profile.tsx` — streak hero, week strip, account card (Apple sign-in stub / sign out).
- `src/components/WeekStreakStrip.tsx` — week UI; dates from `quiett.completedDays`.
- `src/lib/storage.ts` — `completedDays` JSON `YYYY-MM-DD[]` updated in `recordSuccessfulSit`; `breakStreak` clears count/last date only. Account stub: `quiett.account` + `signInWithAppleStub` / `signOut` (no Apple SDK).

## Reload

JS-only. Metro `r` is enough; no native rebuild. Do not commit.
