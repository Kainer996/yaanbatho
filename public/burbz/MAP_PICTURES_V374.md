# Map pictures v374

Yaan preferred the original real-world map artwork. Quest offer pins again show `assets/ui/quest-compass-emblem.webp`, while Show Quests and Side Quests keep their original scroll/compass images. Pickup markers use each existing full-colour glyph, including the original wood symbol, instead of generic outlined SVG replacements. Terrain, route geometry, marker coordinates and keyboard/touch actions retain their existing behavior.

Woodland supplies now keep one in three original zoom-14 grid cells. Surviving keys and coordinates stay unchanged, so existing daily claims cannot be minted again. Each woodland tap gives one timber, transactionally; absent GPS, out-of-range, failed save and duplicate collection remain rejected. Dense forests show at most four nearby or eight wide-view woodland pickups so the old marker cap cannot hide the reduction. Starter tutorial bundles and the separate village tree/rock harvesting rules remain unchanged.

Build/cache: `map-pictures-v374-20260908`. All affected runtime URLs are in all three service-worker lists; no new artwork downloads or save migration. Existing updater entries cover the changed files. The old v373 suffix remains in cache history.

## Verification

Evidence: `/root/burbz-map-icons-v374-evidence/`. Real provider data produces 16 supplies versus 53 before (30.2%), at the original surviving coordinates. Browser screenshot inspection verifies the original pictures; actual marker click grants exactly one timber and duplicate/failed-save/GPS/distance/reload checks pass. The installed v373→v374 test activates automatically, retains an old save and decodes original artwork and collects/saves one timber offline. No page errors in either run. Physical-phone performance is not measured.

Forest/map/places and release wrappers: six pass, including 146 underlying forest/map/places Node cases. The separate field-map Node suite passes, including existing Stores gates. Broad suite: 2,111 passed, 5 skipped and the same 42 baseline failure IDs as v373 (2,106 passes in tests/ plus five root scan tests).

Run the two browser proofs with `node public/burbz/tests/run_map_pictures_v374.cjs` and `node public/burbz/tests/run_map_pictures_pwa_v374.cjs`. Both accept `PLAYWRIGHT_MODULE`, `CHROME_PATH` and `EVIDENCE_DIR`; the map runner uses captured actual walking evidence through `WALKING_EVIDENCE` and an older forest core through `BASELINE_ROOT`. The PWA runner instead takes a v373 public/burbz directory as `BASELINE_ROOT`. Defaults point to the release owner's retained v373 baseline and evidence. Pass `--public` to the map runner to verify public runtime hashes and interactions in a disposable browser; this does not modify a real user's save.
