# Quiett — MVP Brief

**Working title:** Quiett  
**Platform:** iOS + Android (Expo / React Native)  
**One-liner:** An alarm that won’t fully let go until you sit upright and still for 3 minutes — then it turns into a short morning meditation.

## Problem
People snooze or slap alarms off and start the day scattered. Push-up-to-dismiss apps prove a hard gate works. We use the same gate for a calm sit instead of a workout.

## Core loop
1. Alarm fires with a normal wake sound; front camera starts watching.
2. User sits upright and still in frame (phone propped facing them).
3. After a short confirm window, harsh alarm crossfades into meditation audio and a 3:00 timer starts.
4. Break pose / leave frame / get too fidgety → alarm returns.
5. Complete 3:00 → full dismiss + day counts toward streak.
6. **Emergency only:** long-press dismiss skips the sit and breaks the streak. No casual snooze on the alarm screen.

## Detection (v1)
- **In:** upright seated pose + stillness (on-device pose estimation).
- **Out:** eyes-closed (later version).
- Must work in typical bedroom light; camera permission + setup guidance the night before.

## Product defaults
| Knob | v1 default |
|------|------------|
| Required sit | 3 minutes |
| Confirm pose before fade | a few seconds of stable upright + still |
| Early out | long-press emergency (breaks streak) |
| Snooze | none on main alarm UI |

## Must-have screens
- Set alarm (time, optional label)
- Night-before camera setup / placement tip
- Active alarm + live pose feedback (simple: not ready / holding / meditating)
- Sit progress (timer + audio)
- Success (streak) / emergency-dismiss confirmation

## Out of scope for v1
Eyes-closed detection · social · accounts · paid audio library · Apple Watch · smart home · cloud vision on every frame · fancy coaching content

## Technical stance
- Alarms and detection must work offline; do not depend on a ChatGPT-style API for the gate.
- On-device pose is primary; keep the session reliable under iOS/Android background limits.
- Local-first for the alarm path.

## Success for this MVP
A user can set a morning alarm, get forced into a 3-minute upright sit with audio, finish or emergency-exit once, and understand the streak rule — without reading a manual.
