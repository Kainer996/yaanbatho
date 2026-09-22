# House quest entry and craft landing

The “Build your house” quest now opens Home and invokes its existing “Enter Alderwing” button. The player stands in the home room instead of resuming a saved airborne craft. The quest and craft keep their saved state.

“Land craft” accepts clear ground or water from cruising height. It checks the existing full-hull berth plus the entire vertical descent at 25 cm intervals, then commits the boarded craft and player together using the existing camera easing. Unknown terrain, steep/narrow ground and obstacles still refuse landing. Failed saves restore position, velocity and occupancy.

A refused landing displays “Can't land here” for four seconds. World-loading updates no longer erase craft feedback immediately, and nearby-building/combat HUD rules no longer hide it. The compact message sits above the flight controls and clears after a successful action.

Build/cache: `house-entry-landing-v438-20260922`. Exact new pins cover flight_craft_core.js, flight_craft.js, village_walk.js, village_world.js and first_person_hud.css in consumers and all three worker lists. No save migration is needed.

## Verification

- Seven focused Node suites pass, covering entry routing, ground/freshwater/sea landings at 1/20/400 metres, obstacles in the descent column, unavailable terrain, retries, rollback, wounded controls, boarding/provisioning and existing movement controls.
- Native retained-world browser proof passes 12 groups: touch boarding/Auto, five viewport layouts, visible blocked-village warning after a full second, landing directly from 10 metres, exit/reconstruction, actual house quest GO, Home-button equivalence and saved reload.
- Installed v437-to-v438 and offline proof verifies the exact document and all five changed assets, preserved airborne craft/journey/inventory, and the actual offline house quest opening the home room.
- Inline and changed JavaScript syntax, worker pins and git diff whitespace checks pass.
- Three related Python suites produce 7 passes and 2 failures; the same two test IDs fail on unchanged v437 (an old Academy asset pin and a liberation fixture missing a current dependency).

Evidence: `/root/burbz-house-entry-landing-evidence/`, with native `results.json`, `blocked-landing.png`, `house-quest-entry.png`, and installed `pwa/results.json`.

These are local Chromium fixtures with synthetic geography and phone-size viewports, not physical-phone or public-deployment proof. Yaan approved publication on 22 September 2026; guarded deployment and public verification are the remaining release steps. The unrelated checkout-generated `videos/friend-shaped.mp4` pointer is excluded.
