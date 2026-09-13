# Map camera and furnished room repair v403

The close GPS map could aim below its real terrain, placing a nearby building above the screen. A separate room frame failure (`api.collected is not a function`) prevented map-side furnishings from rendering. The earlier v402 canvas/visited checks missed this caught error; that release report was explicitly corrected and is not valid furnished-room acceptance evidence.

The map renderer now uses MapLibre's public covering-tile terrain query for centre elevation after terrain loads. On the reproduced real-provider location, the automatic clamp was 0 m while the query returned 293.9679 m: the projected centre was y=-435.4 instead of y=509. The correction changes elevation only, leaving the real GPS coordinate, bearing, zoom and existing padding authority intact. Work waits for movement/pointer release, is keyed to centre/zoom/DEM revisions and runs outside rendering. Unknown terrain retains the last valid height. Flat/hidden/unavailable/disposed states restore the original automatic clamp; maps owned by another manual camera are not taken over. Existing route fitting checks its actual corrected projection.

Building rooms now attach inhabitants only when an actual inhabitants capability exists. NPC-only rooms cannot fabricate collection rewards; pickups and talk controls require their real callbacks. Owned village/Academy rooms retain their authoritative callbacks. Walking exposes its existing read-only diagnostic snapshot so public acceptance can detect caught frame failures. No player-placement setter was added to production.

Runtime changes: geographic_map_3d.js, building_rooms.js, interior_life.js, village_walk.js and their consuming/cache URLs. BUILD and all three worker lists use map-camera-v403-20260914 for those changed files. Existing updater entries already contain every runtime file. No new runtime dependency.

## Validation

- 75 map renderer behavior groups, including source/style/worker lifecycle, terrain failure, conservative unknown heights, gestures, manual-camera ownership and elevation restore.
- 3 real-Three room capability groups: map-only, NPC-only and owned rooms. Owned finite finds remain visible; unsupported finds do not exist.
- All 20 cabin and 13 civic/service plans: reachability, collision, finite geometry, bounded draws/triangles and disposal.
- Geographic place/GPS and route-fitting behavior groups; 17 selected Python installation/cache/integration checks.
- Native local real-provider journey: distant GPS rejects entry; loaded terrain brings the close building into view; the furnished room produces actual triangles and advancing frames with no error overlay; native walking and turning change pose; Escape returns; phone portrait/landscape and desktop remain usable; rotate/zoom and 2D/3D retry retain alignment; Home return preserves currency and shared inventory.
- Fresh room and close-exterior images visually inspected. The previous blank/error image is preserved, not replaced or relabelled.

Local evidence: `/home/yaan/Documents/Codex/2026-09-13/realtime-voice-chat/outputs/map-camera-v403/local/`. Before experiment: sibling `before/`. The native harness is `tests/run_map_camera_v403.cjs`; pass EVIDENCE_DIR, MAP_SEED and PLAYWRIGHT_MODULE. Optional LIVE_URL verifies unmodified deployed modules using the same controls and read-only diagnostics.

These are laptop Chromium tests with simulated GPS and phone viewport/touch settings, not physical phone or physical walking tests. This fixes framing and room failure; the substantial underlying real-map performance limitation documented in v402 is not claimed resolved. Production bytes, installed worker, cold offline/restart and fresh native public screenshots must pass after deployment before the release is called verified.
