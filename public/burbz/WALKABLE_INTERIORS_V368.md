# Walkable building interiors — v368

Release: `walkable-interiors-v368-20260908`.

Walk up to a completed building in the village and tap **Enter**, or press **F**. Its building card also offers **Walk inside · 3D**, in villages and town wards. Unbuilt plots retain their construction controls. Inside, use the existing thumbstick/drag or WASD/arrow controls. The door or **Outside** returns to the exact outdoor position; a visit started from a building card returns to that card. Escape and browser Back follow the same order.

## Rooms

Twenty distinct cabin plans: Hearthside, Herbalist, Weaver, Mapmaker, Fisher, Beekeeper, Woodcarver, Stargazer, Booklover, Baker, Musician, Potter, Gardener, Tailor, Traveller, Painter, Clockmaker, Bunkhouse, Teahouse and Winter retreat. They vary in dimensions, furniture, arrangement and fabric colours. Village seed, building ID and actual home ID select a stable plan; a building menu and its first physical home use the same identity. This is a selection of twenty variants, not a guarantee that successive villages never repeat one.

Thirteen additional service/civic rooms cover the pub, chapel, market hall, storehouse, foundry, gathering hall, farmhouse, food lodge, pump house, woodcutter's hut, miner's hut, sawmill and stone workshop. The pub has a serving counter, mugs and bottles, dining tables and a hearth. Approach the counter to open the existing bar; its actual ward is used for the building/discovery gate, and the Magpie Market trade gate remains in force. These furnished spaces create no residents, production, inventory, rewards or build unlocks.

## Rendering and lifecycle

`building_rooms_core.js` owns deterministic plans and furniture collision. `building_rooms_scene.js` builds real meshes using the outdoor settlement batching toolkit and shared manga renderer: timber/plaster walls, individual floorboards, exposed beams, framed windows, lanterns and detailed furniture. One room exists at a time. All 33 plans are below 11,000 triangles and 25 mesh draws in the geometry harness.

`building_rooms.js` attaches doors to real building/home metadata and selects clear approaches in the existing collision world. It swaps the walking world's player/collision and rendered scene, borrowing the existing canvas, renderer, camera and RAF. Outdoor discovery controls and animation pause indoors. Exit restores position and exposure and disposes indoor meshes/materials. Town RAF and pause timers are tracked and cancelled to prevent duplicate loops after visits. Graphics failure keeps its exit above other controls. No new WebGL context, artwork download or save schema is needed.

All three room modules and changed walking assets are in every service-worker shell list and the legacy updater. The cache and Settings build advance together. Historical module pins otherwise stay intact.

## Verification

- `node tests/test_building_rooms_v368.cjs`: twenty distinct floor plans, stable selection, all-room spawn/exit and furniture reachability, swept collision, finite geometry, rendering budgets and disposal.
- `tests/run_building_rooms_v368.cjs`: real exterior door and card entry, same cabin identity, movement, pub action, exact outside return, repeated resource bounds, town canvas restoration, touch walking/look, portrait/landscape layouts, unbuilt plots and graphics recovery.
- `tests/render_building_rooms_v368.cjs`: screenshots of all twenty cabins and thirteen service rooms using real meshes and the manga renderer.
- `tests/run_building_rooms_pwa_v368.cjs`: installed v367 automatically upgrades, retains save/currency, visits a room offline and reopens the same room after an offline reload.
- Existing walk/discovery core and browser suites preserve village quests, loot, lore and saved journal behaviour.

The full Python suite reports **2,104 passed, 5 skipped and 42 failed**. These are the same 42 failing cases as v367; none was introduced by interiors. Physical-phone performance has not been measured. Browser screenshots and interaction tests use Chromium with software WebGL and phone-shaped viewports.

Run the Node commands from `public/burbz`. For browser interaction and gallery runs, serve the repository's `public/` directory on `127.0.0.1:8871`; the interaction runner also accepts `QA_URL`. All three browser runners accept `PLAYWRIGHT_MODULE`, `CHROME_PATH` and `EVIDENCE_DIR`. The PWA runner starts its own server on port 8876 and needs `BASELINE_ROOT` pointing to a v367 `public/burbz` directory; it defaults to `/root/burbz-village-discoveries/public/burbz`.

Release evidence is in `/root/burbz-interiors-v368-evidence/`: `results.json`, `pwa/results.json`, the 33 images in `gallery/`, `pytest-final.txt`, and the baseline comparison in `release/test-summary.json`.
