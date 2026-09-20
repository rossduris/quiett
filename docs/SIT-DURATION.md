# Sit length picker

Home screen pills: **2 / 3 / 5 / 10** minutes (default **3**).

- Persisted as `quiett.sitMinutes` via AsyncStorage.
- Session loads minutes on mount and uses `sitDurationMs(minutes)` for the meditating unlock timer.
- DEV still unlocks after **20s** regardless of choice (same as prior `__DEV__ ? 20_000 : 3*60*1000` behavior).
- Pose gate unchanged; only unlock timer length changes.
