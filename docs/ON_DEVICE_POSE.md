# On-device sit / in-frame detection (fuller live pipeline)

## How it works

### Primary: live frame pipeline

1. Session mounts **`QuiettPoseCameraView`** (Expo native view) when live pose is available on iOS.
2. The view owns an **`AVCaptureSession`** (front camera) and shows the same preview used for detection — no JPEG stills required.
3. `AVCaptureVideoDataOutput` delivers `CMSampleBuffer`s; Vision is throttled to **~8–10 fps**.
4. Each tick runs on-device:
   - `VNDetectHumanBodyPoseRequest` (shoulders / hips / nose / neck …)
   - `VNDetectFaceRectanglesRequest`
5. The view emits **`onPoseFrame`** → `{ joints, faceCount, available, timestamp }` to JS.
6. `QuiettPoseCameraView` also fans out through `notifyLivePoseFrame` so `createOnDevicePoseDetector({ mode: 'live' })` can subscribe via `subscribeToLivePoseFrames` (or a custom `subscribeToNativeEvents`).

### Fallback: still capture

If the live view is not available (simulator / missing native rebuild / Android stub):

1. `expo-camera` `CameraView` preview
2. ~2.5×/sec `takePictureAsync` → `analyzeImage` / `analyzeBase64`
3. Same JS classifier + hysteresis

Nothing is uploaded. No cloud vision.

## Classifier (stronger)

| Status | Meaning |
|--------|---------|
| `absent` | No face and no usable upper-body joints |
| `not_upright` | Present but not sit-ready — **includes face-only** (shoulders required for holding) |
| `fidgeting` | Shoulders in frame + upright, but motion above stillness |
| `holding` | Shoulders + upright + multi-point still, after enter hysteresis |

Rules:

- **`holding` requires both shoulders** in frame. Face-only → `present` but `not_upright` (chip: “sit up”). Never reaches `holding`.
- **Prefer hips** when available for torso upright (shoulders above hips).
- **Multi-point stillness**: mid-shoulders + nose when available.
- **Hysteresis** (bias against false alarm dismissals; responsive break once holding):
  - `ENTER_HOLDING_FRAMES = 3` consecutive raw `holding` to publish `holding`
  - `LEAVE_HOLDING_FRAMES = 2` consecutive non-holding to leave `holding`

Session machine still requires **`CONFIRM_HOLD_MS = 2500`** of continuous *published* `holding` before meditation.

## Detector API

```ts
// Preferred — live view mounted in session
createOnDevicePoseDetector({ mode: 'live' })
// optional: { mode: 'live', subscribeToNativeEvents: (cb) => unsubscribe }

// Fallback stills
createOnDevicePoseDetector({
  mode: 'capture',
  captureFrame: captureFromCameraRef(cameraRef),
})
```

## Rebuild requirement

QuiettPose is a **native** local module under `modules/quiett-pose`.

After applying the patch on the Mac:

```bash
cd /Users/rossduris/Development/quiett
bash /path/to/quiett-pose-full/APPLY.sh   # or APPLY.sh already copied next to project
npm install
npx pod-install                            # or: cd ios && pod install
npx expo run:ios                           # device recommended for front camera
```

Expo Go will **not** include QuiettPose. Use a **dev client** / `run:ios`.

Simulator: live camera is typically unavailable (`isLiveCameraAvailable` → false); capture fallback / DEV simulate still work.

## Tuning thresholds

Edit `src/lib/pose/thresholds.ts`.

| Symptom | Try |
|--------|-----|
| Often `absent` while visible | Lower `MIN_JOINT_CONFIDENCE` / `MIN_FACE_FOR_PRESENT` |
| `sit up` while shoulders visible & tall | Raise `MAX_SHOULDER_TILT_RATIO` or lower `MIN_HEAD_ABOVE_SHOULDERS` / `MIN_SHOULDER_ABOVE_HIP` |
| `hold still` while trying to hold | Raise `STILLNESS_MAX_MOTION` |
| Flickers into holding | Raise `ENTER_HOLDING_FRAMES` |
| Slow to break holding when leaving | Lower `LEAVE_HOLDING_FRAMES` (min 1) |
| Slow confirm after holding chip | `CONFIRM_HOLD_MS` in `session-machine.ts` |

## Android

Stub `QuiettPoseCameraView` + `analyzeImage` / `analyzeBase64` return `available: false`. Files are structured for a later CameraX + ML Kit landing. DEV simulate still works. iOS-first is OK.

## Known limits

- Side angle / profile: body pose confidence drops.
- Blankets / heavy hoodies: shoulders occluded → face-only → `not_upright` (alarm stays).
- Low light: more `absent`.
- Front selfie crop: hips often missing — upright uses shoulders + head; hips preferred when present.
- Live path needs a real device camera.

## DEV override

In `__DEV__`, DevPoseControls can force statuses. **Use camera / Vision** clears the override. Status chip shows optional confidence in `__DEV__`.


## Product gate (updated)

**In-frame is enough.** Face and/or body present → `holding` → sit timer. Upright/stillness heuristics are not required for dismiss. Confidence % is DEV-only and informational.
