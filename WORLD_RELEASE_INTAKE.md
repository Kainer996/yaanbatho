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

Pure/local tests on integrated runtime: nine Fireball core groups including uncapped host elapsed override; four native-control simulation groups; four FX/audio groups; eleven light safety groups; six camp reliability; six outpost; five atomic outpost save; three first-opening/Auto loading; six exploration/GPS/home groups; three exploration/light distinction groups; twelve combat; thirteen archery; nine Market; existing walking collision/bridge/input checks. Changed JS and inline index parse.

The existing Fireball refresh fixture injected a projectile without `token.origin`; it now carries its real launch origin required by the newer safe-segment guard. No production safety check was weakened. The Fireball source/cache proof has an explicit `BURBZ_RUNTIME_ONLY=1` skip for this intake because release pins are deliberately pending; default final release execution must not set that variable.

## Required before release acceptance

No native browser was started during the initial pure-test slot. The release owner controls the serialized browser queue. Prepared runners:

- `tests/run_fireball_intake.cjs`: actual integrated combat fixture at phone portrait, phone landscape and desktop, rendered phases, real damage, audio events, rebase, mute, flight/safety and reload. This is a flat fixture, not production geographic proof.
- `tests/run_enemy_outposts_v414.cjs`: actual retained renderer, natural camp, real approach/attacks/120 XP, save and friendly return; repeat with enhanced Fireball.
- `tests/run_exploration_camps_v413.cjs`: remaining fullscreen fast travel, ordinary tree timber, fire/reload, synthetic GPS through the real native adapter, bonus once, separate house/interior/return and phone atlas. No actual physical visit claim.
- `tests/run_home_perimeter_v415.cjs`: actual scene bounds, clear/rejected placement, persistence and asynchronous Cancel.

Further integrated coverage must include native camp placement while flying, save-failure retry, distant camp streaming/revisit, loaded versus offline-unknown travel, canonical bright/dim atlas/minimap appearance, input cleanup and reasonable resource/frame time behavior. Source handoffs and prior browser evidence remain useful but cannot certify these newly combined bytes.

The owner must reconcile v416 Home/bed changes, then supply final module consumers, all three service-worker lists, updater and global release markers. In particular enemy_outposts scripts/CSS were absent from the retained WIP's worker lists. Fireball three MP3s and new camp/exploration modules must all be installed. Retain exact v416 `building_rooms_core` lazy pin. Verify installed/offline save retention and real public behavior after the sole owner's guarded deployment.
