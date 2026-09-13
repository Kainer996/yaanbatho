# A distant sky across Alderwing

Reviewed release candidate `distant-sky-v401-20260913`. Publication evidence is recorded separately after deployment.

The old village sky mixed a finite hemisphere with stars and moon sprites that were not consistently marked as sky. Continuous walking moved only some objects; others remained around the starting settlement or reappeared around prepared destinations. At flight altitude the finite dome skirt and low moon were visibly exposed.

The walking sky now uses camera rotation without camera translation, with far-depth geometry. The entire sphere covers the view, while actual terrain/buildings retain depth occlusion. Stars, sun, moon and existing cloud textures share that distant projection. Old sky objects are hidden during the walking lease and restored on exit. Every old celestial/cloud object is tagged, so prepared destination scenes do not add another sky.

Sunrise, noon, sunset and the moon follow the game's existing local-clock convention. This is a continuous illustrated daily path, not a latitude/date-specific astronomical ephemeris or lunar-phase simulation. Lighting and fog share the same clock grade throughout the retained world; shadows update on movement and at bounded minute intervals. No GPS quest state is read or changed.

Geometry/material ownership is bounded. Star positions are fixed and deterministic; animation updates uniforms, with no extra frame loop. Shared moon/cloud textures are not disposed by the walking lease. Original sky visibility, lights, fog, background and exposure are restored on disposal.

## Verification

Two actual Three browser layouts (landscape village and portrait town) pass shader compilation, same-canvas midnight/dawn/noon/dusk changes, full turns and altitude/travel invariance, and clean teardown. Node checks cover unit celestial directions, continuous seconds/day wrap, bounded geometry, shared texture ownership and idempotent restoration. The final lifecycle check also verifies the source settlement fog is restored after the walking lease.

Matched flight screenshots at exactly the same coordinates, yaw, pitch and altitude reproduce the old hemisphere skirt as the sharp dark curved edge. The new full distant projection removes it. Real OpenFreeMap/Mapterhorn journeys cover night outward/return/revisit and daytime desktop travel, actual destination rooms/quests and management, with no scene replacement, shader errors or streaming loading pauses. Terrain and tree generation are unchanged.

Controlled laptop Chromium measurements, 844×390 viewport, real providers, fixed local 23:00, no video/screenshots, eight-second stationary samples:

| Condition | Released v400 mean / p95 ms | Candidate mean / p95 ms |
|---|---:|---:|
| Inside starting settlement | 19.41 / 33.4 | 17.17 / 16.8 |
| Destination arrival | 17.35 / 16.8 | 16.88 / 16.8 |
| Returned to start | 16.88 / 16.7 | 17.27 / 16.8 |
| Moving outward, mean range | 17.64–22.38 | 16.86–19.08 |
| Moving return, mean range | 16.88–19.22 | 16.94–18.64 |

Both runs had zero loading pauses and moving p95 at most 33.4 ms. The unchanged governor selected pixel ratios 0.65–0.75 before and 0.75–0.85 after. Earlier video/screenshot runs were slower and variable: moving means reached 26.30 ms before, 28.75 ms after, and p95 reached 50 ms in both. A same-geometry alternating sky draw-order experiment showed no consistent benefit, so its speculative change was not retained. These observations show no reproducible added boundary cliff; they are not a guaranteed speedup, universal 60 fps, or physical-phone measurement.

Evidence: `outputs/sky-v401/{second,town-portrait,final-lifecycle,edge-before-v400,edge-after-v401,real-night-before-v400,real-night-after-v401,real-day-desktop-v401,performance-before-v400,performance-after-v401}` in the September 13 voice-task output directory. `controlled-performance-summary.json` retains the paired values; individual reports include source hashes and capture conditions.

All changed module consumers, three worker lists and the guarded updater include the same sky release. Public exact-byte, actual activated-worker and cold offline checks remain mandatory before reporting publication. Photo accuracy, physical GPS quest buildings, wayside quests/lore and construction commissioning/assistance remain separate unfinished work.
