# World release integration intake — not yet published

Based on public `095ec945771147d0e7aa7f7b61a104f883f673e4`. This isolated branch integrates the existing authorized source scopes only. It does not implement the tomorrow zombie roster, vehicle, shoreline or biome backlog.

## Source/dependency reconciliation

1. Retained `3b63df91` camp roster/save/render hooks, house perimeter and swipe-to-Auto. Already-live Empire/direct-opening and title fixes were retained from v415; no older title or trailer behavior restored.
2. Shared permanent-light `d2274b20`/`38e99189` and camp reliability `13631de3`/`36687f95`.
3. Owner's latest uncommitted house preview cancellation and fixed-orientation footprint safeguards copied read-only as their own commit. Owner checkout untouched.
4. Exploration/camps `e9684dd`: preserved saved reveal, free tent/travel, five-timber fire, actual GPS-only visit receipts/bonus, separate additional homes and fullscreen close barrier.
5. Fireball `b17257a`: retained canonical light/source/segment and outpost HP/XP transactions while adding three-second modest burn, charge/audio/effects. Selectively applied the cloud result's reduced-motion and rebase cancellation plus impact manifest; did not copy stale index/SW/global build pins or its acceptance claims.

Retained-world collisions include both player camp and enemy outpost props. First-person minimap contains both sets of markers. Additional-house close resets its ephemeral selection without reintroducing the old skip-trailer mark. The same existing single world/combat frame handles all runtime work.

## Exploration versus liberation

The release owner resolved the earlier ambiguity from the original scope and later corrections: walking charts geography; it does not liberate all nearby wilderness. Player camps create small safe circles; defeated enemy camps create larger circles. Exploration's old full `destination-out` hole visually contradicted that rule.

Explored-only terrain now removes 48% of the darkness mask, remaining visibly dim. Canonical bright circles are fully revealed on the minimap and retain existing atlas rims, and the legend explicitly identifies bright territory as safe and dim explored land as still hostile. Persistent exploration bits/rewards are unchanged. New camps explicitly save their existing 80 m light radius; legacy explicit positive radii are preserved. The moving scout half-light remains separate and grants no protection.

## Verified so far

Pure/local tests on integrated runtime: nine Fireball core groups including uncapped host elapsed override; four native-control simulation groups; four FX/audio groups; eleven light safety groups; six camp reliability; six outpost; five atomic outpost save; three first-opening/Auto loading; six exploration/GPS/home groups; three exploration/light distinction groups; twelve combat; thirteen archery; nine Market; existing walking collision/bridge/input checks. Eight continuous-world terrain groups, seven farm groups, six houses/terrain groups and connected-home migration/handoff checks also pass. Changed JS and inline index parse. Audio file sizes and SHA-256 match the completed manifest. A focused Python selection returned four passed and three failures, all old global/module pin assertions (v410 global and v409 walk/world); those must be updated and rerun with the final combined release pins.

The existing Fireball refresh fixture injected a projectile without `token.origin`; it now carries its real launch origin required by the newer safe-segment guard. No production safety check was weakened. The Fireball source/cache proof has an explicit `BURBZ_RUNTIME_ONLY=1` skip for this intake because release pins are deliberately pending; default final release execution must not set that variable.

## Native acceptance on the combined intake

Native Chromium uses disposable local saves and the real retained scene/MapLibre decoder with explicit deterministic terrain/vector input. This is desktop software WebGL at phone/desktop dimensions, not physical-phone GPU verification or real GPS fieldwork.

Completed evidence under `/home/yaan/Documents/Codex/2026-09-06/burbz-visual-polish/outputs/world-release-intake/`:

- `fireball/results.json`: 9 groups at 390×844, 844×390 and 1280×800. Actual integrated combat modules, natural two-actor flat fixture, native hold/release, charge/travel/impact/burn render captures, damage receipts, audio playing events, rebase cancellation, mute, flight, bright-safety cancellation and reload. This isolated fixture does not establish geographic performance.
- `exploration-final/results.json`: 11 groups. Grounded 3D tent, ordinary walking/flight charting without physical rewards, fullscreen fast travel, zero-timber refusal, two genuinely chopped trees → 6 timber → fire costs exactly 5, fire/tent/fog reload, actual native GPS adapter with stale/imprecise refusal and fresh synthetic fix awarding 500 coins/250 XP/50 timber exactly once, separate home with original primary preserved, real home entry/exit, phone sheet/atlas, native flying placement, failed-save rollback/retry, >280 m continued flight unloading the old camp, both camp destinations reconstructing and a second full reload.
- `home-perimeter/results.json`: 6 groups. Preserve legacy home; reject new village/town centre and full-footprint perimeter overlap including attached rooms/yaw; valid wilderness relocate; durable failure rollback; native Cancel during asynchronous final check; location/rooms/possessions survive reload.
- `outposts-final/results.json` and `outposts-touch-final/results.json`: 8 groups each, with actual touch movement controls present in the final run. Natural camp discovery, native approach/three real Fireballs, exactly 120 XP, phone portrait/landscape controls clear, saved ownership and empty defender roster on a genuine return, same scene/input lifecycle and bounded actors/camps/projectiles/particles/chunks. Images were inspected.
- `terrain-auto-final`: native loaded-ground movement during failed DEM responses, unknown-terrain refusal, and partial/full/cancel/multitouch/manual-stop Auto gestures already passed. A subsequent menu tap exposed the portrait Camps/minimap overlap; the exploration-owned CSS fix and complete final rerun are pending browser-slot return.

Two strengthened test-fixture corrections did not change game rules: canonical home reload adds zero-count furniture/seed defaults, so the complete normalized home is compared while every camp ID/location/fire/receipt stays exact; valid tent ground is not necessarily a valid takeoff column, so flight setup verifies loaded vertical clearance and uses the actual Wings control. No collision or enemy check was disabled. An earlier rerun deliberately waiting at an obstructed takeoff was killed by live enemies; that rejected test is not counted as acceptance.

The first real phone outpost image exposed a status/quest overlap and a 38 px Collect control. `bfff0707` moves the outpost card into the existing combat HUD stack and provides a 44 px button, preserving the separate quest, look/cast, minimap and movement controls. It changes only outpost-owned DOM/CSS; the final native rerun asserts their actual bounds.

## Retained-renderer measurements

The final touch-enabled software run measured native approach walking at mean 74.44 ms/p95 83.4 ms (15 frame samples); active-camp turning 76.24/83.5 ms (47 samples); friendly-return turning 29.29/49.9 ms (103 samples). These are different activity/views, not an A/B optimization comparison. Initial settlement samples include loading and are not comparable steady-state baselines.

Combat update CPU at the active camp was mean 1.05 ms/p95 3.8 ms across its latest 180 updates. During the three real Fireball captures the highest rolling mean was 2.05 ms and p95 5.1 ms. Actual captured flame counts peaked at 26 in one shared draw; total allocation remains capped at 384. The fixture asserted at most 4 actors, 8 projectiles, 2 outposts and 121 terrain chunks; after exit the combat HUD/cast controls and walking session are removed. Observed draw counts were 154 during approach, 147 while turning at the hostile camp, and 90 on friendly return. The visible scene varies, so these figures do not establish absence of all frame drops or worldwide streaming stability.

## Final release owner obligations and limits

All runners accept `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and `EVIDENCE_DIR`; map runners also support `ASSET_CACHE`/`SUPPLEMENTAL_ASSET_CACHE`. Local fallback asset directories are test-only. Example from the checkout:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright EVIDENCE_DIR=/path/to/evidence node public/burbz/tests/run_enemy_outposts_v414.cjs
```

This intake does not claim a real provider/worldwide streaming sweep, physical GPS visitation, physical phone performance, subjective audio perception, or installed/public/offline verification. Native GPS fixtures exercise the genuine authority adapter; in-game movement, fast travel and camp creation must never substitute for GPS. Desktop software frame times are reported as measured without claiming a hardware speed improvement. A DEM outage check is distinct from a fully installed service-worker offline check.

The owner has already merged immutable `01c4159e` into the v416-based candidate as `148fcc82`, preserving v416 Home/bed changes and the exact `building_rooms_core` lazy pin. Take final commits after that checkpoint, then supply module consumers, all three service-worker lists, updater and global release markers. In particular enemy_outposts scripts/CSS were absent from the retained WIP's worker lists. Fireball three MP3s and new camp/exploration modules must all be installed. The committed audio manifest is `public/burbz/assets/audio/fireball-v412/manifest.json` (sparse checkouts may need hydration with `git restore --ignore-skip-worktree-bits`). Verify installed/offline save retention and real public behavior after the sole owner's guarded deployment. No deployment or global cache bump was performed in this checkout.
