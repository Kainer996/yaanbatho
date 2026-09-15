# Remaining Burbz work — 15 September 2026

Status: implementation in progress; no new release.

## Authority and baseline

Yaan confirmed continuing the saved checklist and requested completion and merge/publication. The master checklist is `/root/obsidian-vaults/ava-yaan/04_Plans/Burbz - Tomorrow First Task - 15 September 2026.md`; its linked world and opening plans preserve detailed requirements. GitHub main and the production deployment marker both identify `314f0a3dd9b710c89457510cbe82456df1b4bc81`. No open Burbz PR was found. Last night's v417 release already completed 16 of 24 entries.

## Acceptance still required

- [ ] Parked original flapping-wing craft, visibly near home on first provision and wherever last left thereafter. Approach/board, fly, land and exit through desktop and touch controls; no arbitrary personal flight. No added price/crafting gate.
- [ ] One durable craft location across streaming, home moves, travel, reload and offline. Save/profile isolation, failed-save rollback, existing-save provision, reachable spawn and recovery. No duplicate or silently relocated vehicle.
- [ ] Preserve deliberate swipe/release Auto and manual steering; require aboard flight. Partial drag/cancel never latches. Landing, exit, pause/input capture, death and disposal clear all movement. Native multitouch and casting checks.
- [ ] Actual water classification/height; freshwater and stronger sea buoyancy with stable damping, safe transitions and boarding/exiting. Preserve health, equipment and saves; no new drowning system.
- [ ] Ground-bound Chickenz early; later actual flying zombie birds including Peregrinez, Ravenz and Eaglez, tied to existing upgrades/bird unlocks. Species-readable models without human arms/hands. Bounded coordinated flock tactics, warnings/recovery, original combat and persistent rosters, and all permanent-light safety boundaries. Exact thresholds/order are implementation decisions, not claimed user instructions.
- [ ] Smooth natural water/riverbanks/coasts/islands preserving actual contours, holes, narrow channels, collision and chunk boundaries. Comparable before/after frame times and resource counts with no regression; representative visual review.
- [ ] Investigate plains/moorland against actual terrain/woodland sources, document a concrete design finding. This is an investigation; arbitrary geographic replacement is not authorized.
- [ ] Fresh-main integration, appropriate baseline/candidate tests, combined native play, guarded deployment, exact public bytes, actual installed/offline update and save retention. Whole-backlog publication stays unfinished until all authorized implementation and acceptance are complete.

Rowan story remains paused for Yaan. Rejected assistant dialogue/escape/ending and Merlin 3D remain excluded. Preserve all shipped Home/opening/prerequisite, camp/light, farm, equipment and recognition systems, including the shared monthly Gemini cap.

## Source findings and integration map

- `village_world.js` currently owns unrestricted `toggleFlight`, movement, streamed terrain, pose saving and controls; the current button still says Spread wings. The vehicle must replace this entry path while retaining the shared renderer and existing flight integrator.
- `village_walk.js` owns keyboard F, movement, Auto, reset/capture/death conditions and world-entry handoff. Boarding restrictions must cover every route, not just the visible button.
- `continuousWalkingAdapter` and `saveGeographicPose` in `index.html` supply profile-scoped persistence and durable rollback. Vehicle and player transition saves must commit atomically; the craft's parking coordinates must not inherit home-anchor relocation.
- `geographic_world_core.js` owns metre projection and swept flight collision. Existing takeoff/landing assume dry walkable ground. Supply a coherent actual surface for vehicle use without weakening ordinary walking collision.
- `village_world.js` reads real water features but currently discards most water classification metadata; preserve lake/river/ocean information for buoyancy. Terrain material assignment and the feature mask must agree on shoreline geometry.
- `village_world_core.js` generates terrain chunks and deterministic trees; its existing habitat noise mostly varies woodland density. Investigate mapped land-cover authority before changing biome coverage.

## Execution record

Fresh isolated checkout: `/root/burbz-remaining-v418`, branch `codex/burbz-remaining-v418`. The clone uses Git LFS attributes on some ordinary tracked images; read status with filters disabled to avoid false artwork changes. Do not stage unrelated art normalization. Initial unconnected `flight_craft_core.js` now defines strict single-craft records, nearby boarding, full-hull berth validation, bounded dry-ground provisioning and stable freshwater/sea floating motion. Six Node groups pass; runtime integration, rendering, durable adapter, controls and all native/public acceptance remain unfinished. Baseline geographic movement 12, houses/terrain 6 and outpost reliability 6 groups pass. This module is not loaded by the game yet and no feature is marked complete.


### Aircraft integration checkpoint

The working candidate now loads the aircraft core/controller, renders a compact original folding/flapping-wing pontoon craft, provisions it near home with a clear overhead column, exposes native Board / Take off / Land / Exit, gates Auto on occupancy, adds map location markers, and saves craft/player transitions atomically. Parking searches and flight clearance remain separate so ground obstacles do not become invisible walls at altitude. A pilot-view support-strut obstruction was corrected after screenshot inspection.

Evidence: `/tmp/burbz-flight-craft-v418/results.json` reports seven native groups with no page errors: provision/parking, no remote personal flight, rejected-save boarding rollback, board/takeoff, actual touch Auto movement/cancel/manual stop, land/exit, and scene reconstruction. `/tmp/burbz-craft-water-v418/results.json` reports actual freshwater and sea landing/float/deck-exit/reboard/takeoff groups, stronger measured sea bob and unchanged player/inventory. Geographic inputs are explicitly synthetic MapLibre-decoded tiles, not real-provider or physical-phone proof. Eleven core/save groups and the twelve original geographic movement groups pass.

Still unfinished: interruption/remote-flight recovery and full reload/home-move/profile behavior in the browser; aircraft clearance and parking under streamed geography changes; full camera/model review and screen-layout coverage; multitouch/casting/death/capture checks; real-provider and installed/offline acceptance; comparable performance; final current-byte reruns and release pin promotion. In particular, a flying aircraft left behind by another travel route must remain recoverable, and a saved boarded phase must not auto-board a player merely passing nearby. Do not mark the vehicle or water/Auto checklist complete yet.

No cache/build release promotion, merge or deployment has happened. Enemy progression, shoreline work and biome investigation remain untouched pending the aircraft integration checks.


### Recovery and zombie progression candidate

Aircraft recovery now distinguishes exact saved craft occupancy from merely returning near a parked craft. Enter Alderwing resumes an interrupted airborne/water-deck session at its saved craft; incompatible travel is refused until landing/shore exit, so a craft is not abandoned aloft. Five native recovery groups pass: no accidental boarding, browser reload/flight resume with Auto off, remote-travel refusal, failed-exit-save retry and unchanged parking after home relocation. Source/core tests also retain initial-home async races and atomic save rollback.

The candidate now has Chickenz, Ravenz, Peregrinez, Eaglez, Hawkez and Owlez. The chosen implementation rule (not a user-specified level ladder) requires the first Forge upgrade plus actual discovered/recruited birds of the matching family before flyers join new encounters. Camps save their selected species with their existing defender HP and reward receipts. Early Chickenz have gentler attack/readiness/defence tuning; saved HP is unchanged. Later birds climb, orbit in distinct flock slots, take turns warning and diving at a fixed dodgeable target, and recover before another attack. Actual 3D reach prevents ground pecks hitting an airborne player. Aboard world combat uses the same owned weapons/spells and permanent-light checks.

Six progression/flock/safety tests pass, including real damage through the original combat core. The existing 12 combat, 6 outpost reliability, 4 boundary and articulated-model checks pass. Standalone Chromium renders of all six runtime meshes were visually inspected; models have two wings/two feet, species details, actual extended animated flight wings and bounded draw counts. This is not full-world acceptance. `run_zombie_world_v418.cjs` is currently exercising natural camp discovery, aircraft approach, flying guards, native combat/liberation and saved return. No completion or publication claim yet.

### Shoreline investigation lead

`village_world.js:makeChunk` assigns one material to each entire 2m terrain triangle using its centre, while walking/water classification uses the actual polygon mask. This directly explains the visible jagged shore and its disagreement with collision. A candidate approach is a cached, padded, antialiased polygon coverage texture only on mixed shore chunks, with polygon holes retained, identical cross-chunk sampling, unchanged terrain/collision coordinates and a cheap water-colour/wave shader. Compare CPU/GPU frame distributions and resources against the baseline; do not assume this approach is faster or complete before measurements. Authored river ribbons already clip to chunk boundaries and should retain their geometry/connectivity. Plains/moorland remains a separate landscape-source investigation.

### Full-world zombie camp checkpoint — 15 September 2026

The native desktop Chromium world run now passes all 9 checks: natural discovery, genuine airborne defenders, native Fireball defeat/liberation, responsive camp UI, disposal, reload and friendly return with no repeated XP. The run exposed a real guard trapped beneath a canopy; bounded sideways takeoff routing fixes it and has a focused geometry test. Evidence: `/root/burbz-remaining-v418-evidence/zombie-world-passed`. Synthetic DEM/vector input and guarded flight/aim are explicitly recorded; this is not phone hardware or live-provider proof. Shoreline work is in progress and has not passed seam/performance acceptance yet.

### Shoreline and mapped open-land implementation checkpoint

Yaan selected mapped grassland/heath. `open_land_core.js` accepts only explicit OpenMapTiles grass/grassland/meadow and heath/fell subclasses; unknown/urban subclasses retain existing scenery, mapped woodland takes priority. Open areas thin existing deterministic trees and tint existing vertices with gradual sampled edges; no extra scene objects or invented geography. Source: https://openmaptiles.org/schema/#landcover. Native mapped-area proof remains pending.

`shore_water.js` renders padded, cached antialiased polygon coverage into the existing terrain shader. No changed terrain positions, collision, connectivity or extra geometry; polygon holes and subpixel channels survive. The shared bilinear sample columns match exactly; the unused outer padding pixels can differ because of Canvas clipping. Textures/materials dispose with chunks. Actual freshwater/sea craft tests pass with the new shader and unchanged tree/terrain counts. First 3×60-frame comparison is noisy (freshwater median mean 56.4→51.4ms, p95 83.4→100ms; sea mean47.2→49.2ms, p95 unchanged66.7ms); longer 3×180-frame baseline/candidate runs are underway. Do not claim the no-regression requirement yet.

Code review also found that the craft blocked wounded players from returning to safety. Manual steering, landing and exit now remain available, while existing Auto death gating still cancels automatic movement. The real craft-controller test passes. All changes remain a local candidate: no new runtime publication or complete-checklist claim.

### Release-candidate checks — 15 September 2026

Local checkpoint commit8af4b6d7 records the mechanics. The candidate build is now `alderwing-flight-shores-v418-20260915`;14 runtime JS/CSS files have coordinated pins (13 JS plus flight-combat CSS). Fresh main remains314f0a3dd9b710c89457510cbe82456df1b4bc81. No push/merge/deploy yet.

Fourteen focused source suites pass, including craft/save/wounded recovery, flock/obstacle/light safety, initial home wait, geographic terrain, outpost reliability, common prerequisites and motivated opening. Full native opening passes six groups. Installed v417→v418, original movie and offline New Game/restart passed six groups after increasing the harness cold-navigation timeout to90s; that run predates the latest flight CSS and must be rerun for final byte acceptance. No game reset runtime was changed.

Long water comparison (3×180 frames per surface, software WebGL) measured median mean freshwater54.16→55.65ms (+2.7%), median p95 unchanged83.4ms; sea44.72→46.94ms (+5.0%), p95 83.3→66.7ms. Baseline between-round variance exceeded these mean differences. Same terrain/trees/geometries; visible water textures increased by4/fresh and3/sea, each64KiB. Subsequent optimization reuses shared material for fully-water chunks; only mixed shoreline chunks need coverage textures. Isolated shader/seam/disposal check passes after optimization; final real-scene sampling is still pending. No physical-phone FPS claim.

Mapped heath test passed with8 retained trees in its checked3000m² area and8211 total versus9063 without the extra mapped heath fixture. Actual screenshot shows open shore with distant woodland, and both water transition groups pass. Mapped classifier byte identity is recorded separately from the later water-memory optimization.

The integrated flight HUD revealed old flight-only CSS hiding health/loadout and landscape overrides overlapping attack/Auto controls. Health and readable warning priority are restored; lift/landing controls moved into free columns. The latest native screen-size/control rerun is pending. Remaining: finish final flight HUD/touch checks, real-provider candidate/public checks, final offline update/hash acceptance, review/release and public verification. Rowan story remains paused.

### Local acceptance completed

Runtime checkpointb57023e3 is unchanged through final tests. Native flight8 (including five sizes and simultaneous look/attack/Auto), airborne camp11, full opening6, live-provider candidate4, final water2, and exact final installed/offline6 pass. Final water medians are freshwater49.26ms versus54.16 baseline, sea45.46ms versus44.72; median p95 improves to66.8ms for both, with identical draws/geometry and only3/2 additional visible shoreline textures. No meaningful regression detected within the measured desktop variance; physical-phone performance remains unmeasured. The remaining work is release/public acceptance and saving completion. Exact local verification is in `reports/BURBZ_V418_VERIFICATION.json` and `ALDERWING_FLIGHT_SHORES_V418_RELEASE.md`.

### Published acceptance — 15 September 2026

PR355 merged as a005c4ccc1406980e51e28020e522d011224b93c and the guarded live marker matches. All16 public runtime files match tested hashes. Actual live-provider world passes4 groups and actual installed/offline public app passes6 groups, both complete with zero page errors. GitHub Pages workflow34953878564 succeeded. All seven remaining mechanical/publication checklist items are verified complete; Rowan story remains paused. Physical-phone FPS and actual GPS fieldwork remain unmeasured. This evidence update changes no runtime bytes.
