# Quiett

**Wake. Meditate. Begin.**


An alarm that won’t fully let go until you sit upright and still — then it turns into a short morning meditation.

> **MVP shell** — session loop is demoable with **mock pose controls**. Real on-device pose comes later.

## Product rules

See [`docs/MVP-BRIEF.md`](./docs/MVP-BRIEF.md).

## Run on device

From the project root on your Mac:

```bash
cd /Users/rossduris/Development/quiett

# Install Expo SDK 57–compatible deps (after applying this MVP shell)
npx expo install expo-camera expo-audio @react-native-async-storage/async-storage @react-native-community/datetimepicker

npx expo start
# then press `i` for iOS simulator, or scan the QR with a dev build / Expo Go
# Camera needs a **development build** or device with camera permissions:
npx expo run:ios
```

### Native rebuild

`expo-camera` and `expo-audio` use config plugins (already listed in `app.json`). After adding them the first time:

```bash
npx expo prebuild --clean   # only if you regenerate native projects
npx expo run:ios
```

If `ios/` / `android/` already exist (they do), prefer `npx expo run:ios` so native permission strings from the plugins are applied.

### Demo the loop

1. Home → set alarm time (persisted) → **Start demo session**
2. Allow camera when prompted (preview is real; pose is mocked)
3. DEV panel: **Hold pose** → wait ~2.5s confirm → meditation audio + timer (`0:20` in `__DEV__`, `3:00` in production)
4. **Break pose** → harsh alarm returns
5. Hold again → finish timer → success + streak
6. Or **Hold to emergency dismiss** (~2s) → streak resets

## Quiett Premium (RevenueCat)

In-app purchases go through RevenueCat (`react-native-purchases`), wrapped in
`src/lib/purchases.ts` and exposed via `usePremium()` (`src/lib/premium-provider.tsx`).

- **Safe on any build:** the SDK is only required when `NativeModules.RNPurchases` exists and an
  API key is set. Older dev builds, Expo Go and web run in "purchases unavailable" mode (free
  tier, paywall shows "Subscriptions aren't available yet", no prices).
- **Keys:** copy `.env.example` → `.env.local` and set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (public
  `appl_…` key). Restart Metro with `npx expo start -c` after changing it.
- **Entitlement:** `premium`. The paywall renders the **current Offering** — no product ids in code.
- **Suggested App Store product ids:** `quiett_premium_monthly`, `quiett_premium_annual`
  (attach both to the `premium` entitlement; add them to the current offering as the
  `$rc_monthly` / `$rc_annual` packages).
- **What Premium unlocks today:** the premium guided tracks (`locked: true` in
  `src/constants/guides.ts`) in Library, the morning track picker and Surprise me rotation.
- **Dev preview:** Settings → dev-only card → "Force premium (dev)" (ignored in release builds).
- **Native rebuild required** after installing the package: `npx expo prebuild --clean` (or
  `cd ios && pod install`), then `npx expo run:ios --device`.
- Legal links live in `src/constants/legal.ts` (privacy URL is a TODO placeholder).

## Architecture notes

| Piece | Status |
|-------|--------|
| Session state machine | Real (`src/lib/session-machine.ts`) |
| Front camera preview | Real (`expo-camera`) |
| Pose detection | **Mock** (`src/lib/pose`) — swap detector later |
| Alarm / meditation audio | Placeholder remote tones via `expo-audio` |
| Persistence | AsyncStorage (alarm time + streak) |
| Scheduled OS alarms | Not yet (demo session from Home) |

## Apply this shell onto the Mac project

If these files live in a staging folder, copy them over the blank Expo app (keep existing `assets/`, `ios/`, `android/`, `node_modules`):

```bash
# from staging → Mac project
rsync -av --exclude node_modules --exclude ios --exclude android \
  ./src ./docs ./app.json ./README.md \
  /Users/rossduris/Development/quiett/
```

Then install packages and run as above.
