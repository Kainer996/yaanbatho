# Merlin flight artwork v2

164 generated raster frames replace the 64-frame animation for clients using v2 metadata: five directional flap clips with 16 frames each, six glide clips with eight frames each, and three pickup clips with 12 frames each. The original perched illustration and v1 asset remain available.

The 192px cells occupy a 2304×2688 lossless WebP (23.625 MiB decoded). `atlas-config.js` binds the asset URL to its rectangles, pivot, clip order and per-frame talon anchors. Flap frames 11 and12 in the generated sheet are played in the reviewed recovery order. Shared body/head registration keeps the torso steady. One quarter-view registration seed was corrected; the tucked foot in side frame8 is anchored beneath its occluding wing.

The game selects 16-pose flaps at roughly2.9–3.4 cycles/second and eight-pose glides lasting1.25seconds. The final0.6seconds of an approach extend the legs; contact frame5 is retained at pickup, followed by six closing/retraction drawings. The approach heading is retained during recovery before banking home. Small grip interpolation between painted frames keeps the carried pebble continuous. This supplements the new raster poses. It does not generate the added anatomy or wing frames.

Art was generated with the built-in ImageGen tool using the existing Merlin identity artwork and revised sprite reference. Seven source sheets preserve generated alpha; four use the requested flat-magenta fallback, technically keyed during packing. No Python image generation, paid API or image-model override was used. Raw sheets, prompts and the deterministic Sharp packer are supplied in the separate source package.

## Release integration

Ship `merlin_flight.js`, `atlas-config.js` and `merlin-flight-v2.webp` together. Update the two script query pins in `index.html`, its explicit `atlasUrl`, and the corresponding entries in all three `sw.js` lists. Add the new WebP to the coordinated offline release and follow the release owner's normal service-worker/cache epoch process. The v2 module also uses the metadata-owned URL when an older explicit URL is passed. Do not mix v2 metadata with the v1 renderer.

This scoped change intentionally leaves `index.html`, `sw.js` and release pins to the release owner. It does not alter save state, care rewards, inventory, currency or Play cost.

## Validation

Run both Node files in `public/burbz/tests`: `test_merlin_flight_20260907.cjs` (21checks) and `test_merlin_flight_v2_20260910.cjs` (5checks). The v2 Python pixel test verifies164different decoded sprites, near-opaque interiors and transparent cell borders; the existing v1 pixel test remains valid. The existing `run_merlin_flight_v1.cjs` integration runner exercises the consuming metadata and passes146full-game behavior checks with v2.

The full-game runner uses a disposable local context. Its sparse-checkout screenshots have unrelated missing background/UI artwork and are behavior evidence, not production-wide screenshot certification. A separate live art audit on2026-09-10 found1545/1545required images and434/435optional derived cutouts available; the missing optional rook cutout is unrelated.
