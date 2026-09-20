# Quiett Session UI polish brief (locked 2026-09-19)

## Product gate
- **In frame** (face/body present → pose `holding`) = holding / meditation can run
- **Out of frame** = alarm back
- Emergency = long-press only (no snooze on main UI)

## Brand
| Token | Hex |
|---|---|
| bg | `#0B0F14` |
| elevated | `#141A22` |
| card | `#1A222D` |
| mist | `#A8C5D4` |
| accent | `#5B8CFF` |
| calm | `#3DCFB0` |
| alarm | `#FF5C5C` |

Voice: **Wake. Meditate. Begin.**

## States (Mobbin energy)
- **Alarming** — Pillow “Shake”: full-bleed dark camera, one verb **Get in frame**, pulsing circular ring (alarm red)
- **Detecting** — ring fills while confirming (~2.5s), accent blue, verb **Hold still**
- **Meditating** — Breathwrk concentric/ring timer, huge remaining time, soft scrim, calm teal
- **PoseStatusChip** — `in frame` / `out of frame` only
- Hide DEV clutter unless `__DEV__`

## Refs
- Pillow alarm shake ring
- Breathwrk concentric breath UI
