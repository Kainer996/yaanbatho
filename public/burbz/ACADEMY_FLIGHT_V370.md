# Academy flight and living interiors — v370

Current controls: v371 (`bird-flight-controls-v371-20260908`); original interior release: v370. Publication authorized by Yaan; release verification is recorded separately from local implementation.

## Playing

In Academy, select **3D**, then **Fly around**. The left stick moves forward/back and strafes sideways. Drag with the right thumb to aim up/down/left/right; head pitch does not change altitude. The single right slider climbs/descends and springs back when released. Keyboard: WASD moves/strafe, drag or arrows look, Space climbs, Shift descends. Forward flight with ascent adds a gentle wingbeat bob and pitch; descending forward flight settles into a flat glide, and forward turns bank left/right. These are camera-only effects, disabled by reduced motion, reset on interruption and absent indoors or while landed.

Approach a green landing deck, select **Land** (F), then **Enter** (F). Explore with the walking stick or WASD, drag to look, and tap the nearby interaction or press E. **Leave through the door** or the top exit returns to the exact landing point; **Take off** resumes flight. A room card's **Explore inside · 3D** enters directly and returns to that card. The room's service counter opens its existing management screen.

All twelve current Academy buildings have interiors: Barracks, Training Hall, Hospital, Crowbar, Kitchen, Workshop, Nursery, Observatory, Library, Magpie Market, Manager's Office and Quest Roost. The retired Roost retains a compatibility plan but is not a thirteenth current building. Unbuilt buildings cannot be visited. Twenty stable cabin variants and thirteen settlement service rooms remain available.

Each room has two finite finds: a catalogue material pouch and a modest coin purse. Each can be collected once per actual room/home identity. Reward and claim flag save together; storage failure leaves both inventory and find unchanged for retry. Visiting alone does not grant rewards or bypass construction, trade or assignment gates.

Actual named residents follow their existing home and job identities. A staggered daily schedule includes home, work, meals, the green and entertainment, with thirst, hunger, fatigue and fun taking priority when necessary. They walk real outdoor paths before becoming visible inside the matching building, then move around reachable furniture and react to nearby visitors. Academy companions appear at their real assignments; free birds can visit open rooms. Conversations reflect identity, activity and needs and remember greetings during the current page session. These are local rules and routines, not a network language model. Existing economic production remains authoritative; offline absence creates no extra needs penalty.

The Library and Magpie Market now use generated paintings instead of inline placeholders. The Manager's Office receives its own painting. Other completed Academy art is preserved. Prompts and provenance: `assets/academy-rooms-v370/README.md`.

## Architecture and invariants

- `academy_flight_core.js` handles smoothed flight, substepped movement, swept collision and landing. `academy_flight.js` borrows the actual Academy scene and raycasts its opaque meshes; temporary decks and controls are disposed on exit. Bounds are a 32 m horizontal radius and 0.45–23 m altitude.
- `village_walk.js` and `building_rooms.js` retain one borrowed renderer and one frame loop. Academy orbit/resize/rebuild pause while borrowed. Room visits restore the exact flight position, exposure and source canvas; direct cards preserve their return route. Blur, backgrounding, navigation, input cancellation and rendering failure reset controls.
- `building_rooms_core.js` supplies deterministic plans; `building_rooms_scene.js` builds real meshes using the existing model toolkit. Bird-scale shelves, woven nests, training fixtures, work benches and service counters distinguish Academy purposes. Furniture and exits use the same collision graph as the player.
- `interior_life_core.js` supplies stable claims and reachable navigation; `interior_life.js` owns transient pickups and at most twelve visible indoor actors. The index adapter owns durable rewards, actual census/companion membership and existing service handoffs. Full resident brains run independently of the outdoor rendering budget.
- All four new modules and three WebPs are registered in every worker shell list and the legacy updater. Lazy walking/flight module URLs are pinned to v371; the cache suffix preserves all earlier lineage.

## Verification

Core runner: `node tests/test_academy_flight_v370.cjs`. Checks all 46 supported plans, reachable finds/furniture/exit paths, finite geometry, disposal, stable claims, flight collision and landing. Existing needs and interior cores remain covered.

Run the Node commands from `public/burbz`. Browser interaction runners use the disposable fixture from `tests/village_walk_fixture_20260907.cjs` and a local `public/` server on port 8871 (overridable with `QA_URL`). The PWA runner starts its own server on port 8876 and accepts `BASELINE_ROOT` pointing to a v369 `public/burbz` directory, defaulting to `/root/burbz-v369-baseline/public/burbz`. All browser runners accept `PLAYWRIGHT_MODULE`, `CHROME_PATH` and `EVIDENCE_DIR`; they use synthetic saves, not personal saves:

- `tests/run_academy_flight_v370.cjs`: all twelve real approaches, landing, entry, exact returns, collection and simultaneous touch/slider controls at 390×844, 320×568 and 844×390.
- `tests/run_interior_life_v370.cjs`: actual resident/home/work identity, assigned bird, dialogue, failed-save rollback/retry, invalid home/unbuilt claim refusal, direct-card return and decoded painting screenshots.
- `tests/run_academy_safety_v370.cjs`: Academy collision, service and interruption coverage.
- `tests/run_resident_routine_v370.cjs`: natural schedule/path and room-occupancy transitions.
- `tests/run_academy_flight_pwa_v370.cjs`: installed v369→v370 update, retained synthetic save, offline flight/interiors/art/collection and reload.
- `tests/run_building_rooms_v368.cjs`: existing village/town doors, cards, shop gates, touch, repeated visits and recovery regression.

Evidence is retained in `/root/burbz-academy-flight-v370-evidence/`; final browser and publication result files are authoritative. Full Python suite on the release candidate: **2,104 passed, 5 skipped, 42 failures**, with exactly the same failing test IDs as v369. The failures are existing historical assertions/runtime fixtures, not new regressions. Physical-phone performance is unmeasured; desktop touch emulation and software WebGL do not establish it.

## Publication and recovery

Use reviewed GitHub changes and the normal guarded `burbz-sync.service`; never overwrite managed live files directly. Preserve pre-release files and managed hashes, verify merge/source tree parity, public runtime bytes, deployed SHA, service health and a fresh public-browser flow. Keep `videos/friend-shaped.mp4` outside this release: its pre-existing LFS normalization is unrelated.

## Flight control revision v371

`tests/test_flight_controls_v371.cjs` proves four-way translation independent of head pitch, normalized diagonal speed, wingbeat oscillation, flat glide, signed banking/settling, reduced motion and unchanged body physics. `tests/run_flight_controls_v371.cjs` verifies real touch gestures and rendered camera transforms. `tests/run_flight_controls_pwa_v371.cjs` checks installed v370→v371 with `BASELINE_ROOT` pointing at a v370 `public/burbz` tree. Current evidence: `/root/burbz-flight-controls-v371-evidence/`.
