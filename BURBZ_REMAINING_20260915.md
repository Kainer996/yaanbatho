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
