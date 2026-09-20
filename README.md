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
