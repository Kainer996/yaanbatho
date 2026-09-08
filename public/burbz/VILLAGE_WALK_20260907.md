# Walk around the actual village

Implementation handoff, 2026-09-07. Release/cache promotion belongs to the coordinating Burbz owner. This additive commit does not itself enable the button until its companion index patch is applied.

This records the original walking implementation. Later integrated features include [village discoveries](VILLAGE_DISCOVERIES_V367.md), [building interiors](WALKABLE_INTERIORS_V368.md), [Academy flight and indoor life](ACADEMY_FLIGHT_V370.md), and [v372 wood/stone gathering](WOODLAND_HARVEST_V372.md); their current modules and save/reward contracts extend the original dependency list and behavior below.

## Integration

Apply `VILLAGE_WALK_INTEGRATION.patch` to `index.html` (based on main 59708118bfc23811d6950ae977e0d96ba9ac5d73). The patch was exercised in the implementation task's isolated checkout. It adds the small **👣 Walk** button beside the village camera reset, a lazy controller loader, a scene adapter, terrain metadata, an optional animation-only argument, and lifecycle/back guards. Preserve any newer Stores/navigation gate while integrating the `switchScreen` hunk. The adapter borrows the exact current `villageScene`, `villageRenderer`, `villageCamera` and `villageBuildings`; nothing is regenerated into a different village.

Register all four files in **all three** service-worker shell lists and the live updater, then promote the owner’s release/cache stamp:

- `village_walk.js?v=village-walk-v1-20260907`
- `village_walk_core.js?v=village-walk-v1-20260907`
- `village_walk_scene.js?v=village-walk-v1-20260907`
- `village_walk.css?v=village-walk-v1-20260907`

The updater uses the four bare filenames. No other runtime dependency or new raster asset is needed. Existing same-origin Three.js, settlement models, textures and manga renderer remain in their current shell registrations. Three.js was already present in Burbz; this feature adds no eager startup script or second engine/context.

## Behavior and ownership

The scene opens at eye height with no automatic camera travel, head bob, combat, interiors, rewards or save writes. WASD moves; mouse drag and arrow keys look. On touch devices the left thumbstick moves while the right side looks. Rotation preserves position and bearing. The viewport respects safe areas, uses native fullscreen where available, and has a full-viewport fallback plus an explicit fullscreen retry. **← Village**, Escape, browser back, native fullscreen exit and navigation all leave the mode. Focus returns to its entry button. Background/blur cancels the RAF and held inputs; focus/visibility resumes without a movement jump.

Completed building copies, model levels, works and remaining ruins are the existing ledger-backed scene objects. The mode snapshots their current presentation for the visit; normal game clocks remain authoritative, and the village refreshes on return. No real save or active tutorial is reset. Resident motion remains the existing needs simulation. Building footprints are transformed from the actual model geometry, stationary scenery is sliced into spatially indexed collision segments, the bank blocks entry into the river except over the real arched footbridge, and the meadow boundary prevents falling off the scene. The outer hills use the same `heightAt` function as the mesh.

The temporary static batches exclude resident/animal/cloth/bird/sign animation. They preserve vertex colors, roughness, shadows, original textures and the shared cel/ink treatment. They restore the original meshes and dispose their added geometry/materials on exit, including partial-build failures. The one borrowed canvas returns to its original parent; lens/DPR are restored and the enlarged manga render target is released. Pending module loads check cancellation before attaching anything. Missing WebGL, asset/CSS loading failures, context loss and render exceptions keep a visible return control.

`__burbzVillageWalkDebug` exists only on localhost/127.0.0.1. It exposes a read-only diagnostic snapshot and collider map plus a frame-sample reset for QA. The production API is `BurbzVillageWalk.open(options)`, `close(reason)`, `isOpen()`.

## Validation

All tests use disposable browser contexts at 127.0.0.1; outside requests and service workers are blocked. No production account, save or tutorial storage is accessed.

- `node tests/test_village_walk_20260907.cjs`: swept movement, wall stopping/sliding, diagonal speed, rim, safe spawn, bridge/bank, terrain height, pitch limits and adaptive resolution.
- `run_village_walk_20260907.cjs`: actual saved building models/copies, native fullscreen and rejected-fullscreen fallback, keyboard/mouse, simultaneous touch movement/look, rotation, Escape/back, focus restore, state fidelity, pause/resume, repeated entry and graphics-error exit. No page/shader errors.
- `run_village_walk_edges_20260907.cjs`: actual touch-enabled mobile context, DPR 2, all five seeded layouts, empty/fully upgraded villages, actual river/bridge colliders, immediate exit during a delayed module load, real `history.back()`, night/reduced ambient motion and missing WebGL. The fallback case also ran independently with `ONLY_FALLBACK=1` after correcting its disposable village setup.
- 47 existing settlement, village layout, player construction, tutorial and browser-back regression tests passed.
- Four re-entries retained exactly **607 geometries / 22 textures** in the checked fixture. No second context is created. Runtime/inline JS parsing and `git diff --check` pass.

Run a loopback server for `public/` on port 8871. Set `PLAYWRIGHT_MODULE` and optionally `CHROME_PATH` to the available runtime, and `EVIDENCE_DIR` to a disposable output directory. Stop the server after QA; every test runner closes its browser in `finally`.

## Measured performance

Hardware: Intel Core i5-13500H, Intel Iris Xe (RPL-P), Linux, Mesa OpenGL ES 3.2 via ANGLE. Browser: Chromium 151 headless with hardware GPU enabled; WebGL renderer string confirmed Intel hardware, not SwiftShader. Other user tasks were active on the machine. These are desktop measurements and phone-layout emulation, **not physical-phone measurements or a universal 60 fps guarantee**.

The initial view submitted 310 draws before the feature's static batching and 217 after it. The mode caps its buffer to roughly 1.1 million pixels and DPR 1.5, then adapts in 0.15 steps down to 0.65 on sustained >19.2 ms intervals, with slower recovery. It retains existing instanced flora, cached shadows and a single shared ink pass. No extra postprocessing or live shadow pass is added.

| Test | Average FPS | Mean frame | p95 frame | Adapted DPR |
| --- | ---: | ---: | ---: | ---: |
| 1280×800, mixed entry / screenshots / walking | 51.0 | 19.62 ms | 33.4 ms | 0.65 |
| 1280×800, warmed 8-second continuous pan | 56.9 | 17.58 ms | 33.2 ms | 0.65 |
| 390×844, simultaneous touch input / fallback | 59.0 | 16.95 ms | 16.8 ms | 1.0 |
| 844×390, same rotated visit | 57.3 | 17.44 ms | 16.8 ms | 1.0 |
| DPR-2 mobile emulation, dense riverside | 59.0 | 16.95 ms | 16.8 ms | 1.45 |
| DPR-2 mobile emulation, dense crossroads | 59.6 | 16.78 ms | 16.7 ms | 1.5 |
| DPR-2 mobile emulation, empty green | 59.8 | 16.72 ms | 16.8 ms | 1.5 |
| DPR-2 mobile emulation, dense lane | 58.8 | 17.00 ms | 16.8 ms | 1.35 |
| DPR-2 mobile emulation, dense hamlet | 58.6 | 17.06 ms | 16.8 ms | 1.35 |

The five mobile samples use five-second continuous pans after warmup. The desktop wide view still misses some 16.7 ms budgets; this is recorded rather than claiming locked 60 fps. Screenshots and raw results are in the implementation task’s `outputs/`: `walk-desktop.png`, `walk-portrait.png`, `walk-landscape.png`, `walk-riverside-portrait.png`, `walk-night-portrait.png`, `village-entry-desktop.png`, `results.json`, `edges.json`, `fallback.json`.
