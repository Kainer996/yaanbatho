# Woodland trees and gathering v372

Real-map dark-green woods now display the existing faceted oak/pine tree meshes, with cel shading and ink outlines. They are illustrative trees inside provider woodland polygons, not individually surveyed trees. The missed initial MapLibre style event is recovered on idle when the style is ready.

## Playing

- Woodland timber bundles appear on verified woodland ground near your location; each gives six timber. Finds renew daily and use the existing map collection range (440 m), so paths beside woods remain useful. A live GPS fix is required. These are fictional game supplies, not real-world logging instructions.
- Enter first-person walking from a village and face a nearby tree or mossy boulder. Tap **Chop wood** / **Chip stone**, or press **E**, three times. Wood chips/stone chips and the counter show each hit. A tree gives three timber; a boulder gives two stone.
- Each actual object supplies one bundle per UTC day. Trees and rocks stay in place, preserving scenery and collision. Gathered resources go to the existing timber/stone stores. Failed saves restore both the supply and the balance, with a retry message.
- Rooms, dialogs and Academy flight retain their existing interactions. The gathering button is hidden indoors; leaving walking removes its controls and temporary chip mesh.

## Implementation

`geographic_forest_core.timber` uses the same strict polygon validation and hole handling as tree placement, with fixed zoom-14 anchors, 96 maximum results and a 4,000-candidate bound. It does not use habitat centroids, generic parks or screen pixels. Resource IDs and quantities are independent of tree detail/zoom/route clearings. The existing dedicated worker computes both trees and supplies; stale/hidden replies do not update gameplay. The index adapter owns daily claims, range/GPS checks and durable rewards.

`village_harvest_core.js` owns stable object IDs, reach/heading/height checks and daily claims. `village_harvest.js` reads original detailed-tree anchors and explicit instanced tree/boulder metadata, so permanent scenery batches remain intact. One six-instance chip mesh runs only in the existing walking frame loop; target selection is throttled to 120 ms and rechecked on every strike. Three deliberate strikes are required, with a 280 ms repeat guard. No renderer, shadow system, additional population, or independent animation loop is created.

New modules and all revised walking/geographic URL pins are included in all three service-worker shell lists and `scripts/update-live-burbz.sh`. The release appends the existing cache lineage and preserves old saved state.

## Performance and verification

A map container no wider than 600 CSS pixels starts with at most 360 trees and DPR 1.25. It still uses no more than four instanced tree draws. Sustained moving-frame stalls reduce DPR/tree budget and pause the terrain mesh, keeping pitched trees and real-elevation hillshade; a 2D→3D toggle retries terrain. Holding a stationary finger defers placement but does not count as slow movement. Delayed frames requested by actual camera movement still count even after 400 ms.

Real provider geometry near longitude -1.786, latitude 53.349 reproduced the original failure: the old controller remained pending with zero trees despite 40 loaded woodland features. After repair the same scene rendered 360 trees in four draws and found 24 six-timber bundles. Worker build was about 17 ms, preparation about 4 ms in the recorded software-rendered browser.

The 390×844 Chromium/SwiftShader comparison measured the final 40 rotation frames at mean 73.3 ms / p90 100.1 ms, compared with the broken pre-change map at 77.5 ms / p90 100.0 ms. This is a software-GPU regression check, not a phone FPS measurement. The initial terrain workload was slower until adaptation paused the mesh; physical-phone/outdoor performance is unmeasured.

Focused verification: 115 Node cases across forest, map lifecycle and harvesting; all three Python wrappers pass. Browser coverage includes actual village wood/stone rewards, duplicates, failed-save retry, narrow/landscape layouts, disposal and reload. Installed v371→v372 activation preserves old saves, caches new modules, supports offline gathering, interiors and flight, and retains gathered wood after reload. Forest collection additionally checks GPS absence, distance, failed-save rollback, duplicate claims and reload.

Commands:

```sh
node --test tests/test_geographic_forest_20260907.cjs tests/test_geographic_map_3d_20260907.cjs tests/test_village_harvest_v372.cjs
node tests/run_woodland_harvest_v372.cjs
node tests/run_woodland_harvest_pwa_v372.cjs
```

Browser runners need `PLAYWRIGHT_MODULE`, `CHROME_PATH` and the local preview on port 8872 (PWA runner serves its own port 8876). Evidence: `/root/burbz-woodland-v372-evidence/`. Broad suite: 2,105 passed and five skipped; the same 42 failing cases reproduce on v371, with no newly failing case. Publication and public verification are recorded separately by the release owner.
