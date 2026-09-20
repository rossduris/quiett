# Quiett OS alarms (AlarmKit)

## What this is
Home’s Alarm on/off schedules a **real OS alarm** via `react-native-alarm-scheduler`:
- **iOS 26+** — Apple AlarmKit (rings on Lock Screen through Silent / Focus)
- **Android** — `AlarmManager.setAlarmClock` + full-screen ring UI

In-app demo session audio is separate. The OS alarm opens Quiett into `/session`; the ring only fully clears after `completeNativeAlarmAsync` (successful sit or emergency escape). On iOS, system Stop re-arms via `stopIntentBehavior: 'rescheduleImmediate'`.

## Rebuild required
Config plugin + native module — Metro reload is not enough:

```sh
cd /Users/rossduris/Development/quiett
npx expo run:ios --device
```

Do **not** delete `ios/` (keeps `quiett-pose`). Prefer `expo run:ios` so plugins apply without a destructive clean prebuild.

## Device
AlarmKit needs **iOS 26+** on a physical device (Ross’s 15 Pro Max is on 26.6.2). Simulator may lack full AlarmKit behavior / custom sounds.

## Permission
First enable prompts AlarmKit / exact-alarm permission. If denied, Home shows an alert with Open Settings (`openAlarmSettingsAsync`).

## Files
- `src/lib/os-alarm.ts` — sync / handoff / complete+reschedule
- `src/components/AlarmHandoffGate.tsx` — launch/foreground → `/session`
- Home calls `syncOsAlarm` on time change and toggle
- Session calls `completeOsAlarmAndReschedule` on sit complete and emergency

## Dual audio + Slide to stop (iOS)

AlarmKit owns the lock-screen UI. iOS may still show **Slide to stop**; we cannot remove that system affordance.

Quiett behavior:
1. Lock screen rings via AlarmKit (audible through Silent/Focus).
2. When `/session` opens, `silenceOsRingForSession()` calls `completeNativeAlarmAsync` so **only** Quiett’s harsh alarm plays during sit detection.
3. If they leave without finishing the sit, `rearmOsAlarmAfterBail()` resets completion and schedules a near-immediate backup ring.
4. Successful sit / emergency clears the mission and re-schedules tomorrow’s daily alarm.

Slide to stop without opening the app still depends on AlarmKit invoking our stop intent (`rescheduleImmediate`). If iOS stops without that intent, public APIs cannot fully block the bypass.


## Custom Quiett tone (bundled)

- `assets/audio/quiett-harsh.caf` — AlarmKit (`iosAlarmSounds` + `soundName`)
- `assets/audio/quiett-harsh.m4a` — in-app sit wall + `soundUri` import on schedule
- Android: `res/raw/quiett_harsh.wav` (when `android/` exists) and/or `soundUri`

Schedule uses `soundUri` (durable Library/Sounds copy) and `soundName: quiett-harsh.caf` as fallback.

Rebuild required after adding the CAF to the plugin:

```sh
npx expo run:ios --device
```

Then toggle Alarm off/on once so the native schedule picks up the new sound.
