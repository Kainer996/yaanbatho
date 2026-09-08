# Night questing and village return v376

The real-life quest map follows the same device-local clock as village daylight: dawn from 05:00–07:00, day, dusk from 17:00–19:00, then moonlight. Native ground, roads, water and labels change smoothly; custom trees and wayside buildings receive moonlight and nearby warm lamps. Controls stay readable. Modeled torches follow selected/active quest routes and nearby mapped footways, with soft native map light pools. Decorative lights never establish access rights, navigation, rewards or settlement ownership.

`geographic_daynight_core.js` bounds and spaces positions without changing route vertices. `geographic_daynight.js` owns the map lifecycle, native glow source/layer and two custom torch draws at night (one by day). Limit: 32 torches on narrow maps, 48 wide; eight nearest lamps shade custom scenery. Torch placement uses verified DEM heights or a genuine flat fallback. No additional images, network provider, save fields or renderer context. Flame updates run at most four times per second while visible and still; hidden/indoor maps, gestures and reduced motion pause animation. Existing geography budgets remain. Between-render geometry uploads preserve MapLibre's VAO/buffer bindings; otherwise native tile drawing can lose its expected buffer during new layer installation.

After a liberation victory, Return now clears the Empire-only/ward modes, selects and saves the Villages page, and scrolls to that village's birdhouse action. Previously the remembered Empire or Towns tab could hide the action. Once three villages are claimed, a compact progress message explains any missing merge stars or distance requirement. The existing economy remains authoritative: three unmerged villages within 5 km, each with at least 16 folk and 75% happiness, merge only when the player presses Merge. Existing eligible saves use the same button and durable charter transaction.

## Verification

- `tests/test_night_quests_v376.py` and `test_night_lifecycle_v376.cjs`: bounded/stable placement, invalid geography, day/night expression preservation, clock changes while tiles load, movement/hidden timers, DEM/flat placement, context restoration, clearing/disposal and all three offline shell lists.
- `tests/test_liberation_return_v376.py`: captured failing remembered-Empire return before the fix, now passes.
- `tests/run_liberation_return_v376.cjs`: real game victory record → return → visible birdhouse → third claim → progress → three eligible villages → click Merge → one town → reload retained. Uses disposable saves and completes the existing bird quiz through its controls.
- `tests/run_night_quests_v376.cjs`: actual provider terrain, day/dusk/night/dawn phone screenshots, modeled torches and smooth light pools, wide/flat views, reduced motion/hidden timers, unchanged route coordinates and coins, no page or WebGL errors. `--public` compares all seven runtime files before repeating checks.
- `tests/run_night_quests_pwa_v376.cjs`: installed v375 automatically activates v376, preserving old save/equipment and caching every changed module. Third-victory return, birdhouse claim and reload work offline; optional unauthenticated `api/auth/config` is absent in the fixture.
- Broad required suite: 2,115 passed, 5 skipped, 41 failures; the same 41 failure IDs as v375. Four focused night/return tests pass after adding the atomic offline contract.
- `tests/run_night_benchmark_v376.cjs`: retained v375 and current day/night movement samples use the same software Chromium and location. These are server comparisons, not physical-phone measurements.

Evidence: `/root/burbz-night-quests-v376-evidence/`, including screenshots, before-fix return failure, browser/PWA JSON, baseline comparison and release records. The distant village rendering artifact remains deferred as requested.

## Release

Build/cache suffix `night-quests-v376-20260908`. Both new modules plus the changed geographic renderer, details renderer and map CSS have matching entry-page and three worker-list pins; the guarded updater manages all five. Unchanged forest worker/core and other module pins retain their prior versions. Publish through a PR and the normal guarded `burbz-sync.service`, then verify the exact tested/merged tree, live marker, complete managed manifest, public hashes, Pages and backend/timer. Preserve unrelated video/LFS work and the retained v375 baseline.
