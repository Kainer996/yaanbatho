# Crafted Academy and attached flock wings, v358

The Academy's 13 buildings are rebuilt in the existing manga/cel-shaded 3D style. Shaped roofs, separate tiles, bevelled joinery, plaster bays, fabric awnings, visible observing equipment and room-specific silhouettes replace the former primitive shells. Existing room IDs/ownership/anchors, game mechanics, saves and 2D artwork are unchanged. No new downloaded artwork or dependencies.

The settlement wing bug was reproduced before editing: at the first sampled pose, the inner wing edge was outside the torso (normalised ellipsoid radius squared 3.160). Centre-pivot boxes are replaced by tapered, closed shoulder-space geometry, sharing three meshes per bird and one geometry set per flock. Both scenes use the same corrected factory. Route direction, flock bounds and reduced-motion scheduling are unchanged. The butterflies already used correct wing-root pivots and did not need changes.

## Verification

- `node public/burbz/tests/test_flock_shoulders_v358.cjs`: passes full-wave attachment for 2/5/9-member flocks and both route directions; fails on the unmodified old factory. Actual rendered old/new extremes are in `before-wing-stroke.png` and `crafted-wing-stroke.png`.
- `node public/burbz/tests/test_academy_geometry_v358.cjs`: all 13 models have finite positions/normals, bounded dimensions, one merged static shell, glow hooks and independently animated props. Approximately 109,031 building triangles in total, under the 125,000-triangle guard.
- `tests/run_academy_models_v358.cjs`: actual software WebGL, v357 versus new geometry with the same lighting and cel shader; all 13 close-ups, real canvas room taps, overview, magnified wing strokes and phone night-light checks. No page/shader/GL errors. Geometry detail increases; resolution, shadow-map and light budgets are not raised. The desktop test overview is about 129,000 triangles versus 75,865 before, with only three extra visible meshes (two windows and a telescope lens). This is not a physical-phone frame-rate guarantee or a claim of console-AAA parity.
- `tests/run_manga_world_v356.cjs`: village/town day/night, real building taps, phone portrait/landscape and full Academy scene pass. This runner's `before` mode disables cel shading; it is not the old-geometry comparison above. A stopped local preview initially made the Merlin script unavailable; restarting that preview resolved it, without any app workaround.
- Renderer lifecycle/material tests pass. `manga_render_core.js` is byte-unchanged from v357, preserving the explicit highp depth-sampler fix for horizontal stripes.
- Full Python suite after release pins: **2,073 passed, 12 skipped, 34 failed**. Exact failing test IDs match the untouched v355 baseline: no new failures. These are previously documented stale copy/core-pin assertions, missing local Python alias/LFS artwork and the existing BirdNET boundary case. The two new geometry/wing tests are included in the passing total.
- A controlled installed v357 browser automatically updates to v358, caches the new Academy module, preserves seeded coins/branches/save marker and reloads offline without page errors. This checks a test save, not a populated user account.

Evidence: `/root/burbz-academy-v358-evidence/`, including `models-results.json`, model/wing screenshots, `game/results.json`, phone/night images and the pre-release `predeploy-v357.tgz` recovery archive. The local PWA proof is `/root/burbz-academy-v358-pwa-proof.cjs`.

## Reproduce the visual tests

Provide Playwright and a Chromium executable via `PLAYWRIGHT_MODULE` and `CHROME_PATH`; set `EVIDENCE_DIR` to an empty evidence directory. Run `node public/burbz/tests/run_academy_models_v358.cjs` from the repository. It reads the immutable v357 baseline commit locally; it makes no network requests. The game integration runner separately expects a local preview at `http://127.0.0.1:8765/burbz/` with real same-origin artwork (not LFS pointers).

Release pin: `crafted-academy-v358-20260907`. The changed Academy URL is registered in all three service-worker shell lists. The inline flock change ships with the updated HTML/cache. The existing updater already includes the Academy module; there are no new runtime assets to register. Publish through the usual GitHub PR and guarded Burbz sync, never by overwriting live files directly.
