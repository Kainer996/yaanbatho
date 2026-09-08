# Living map v373

Build/cache: `living-map-v373-20260908`.

The geographic forest keeps its initial density through zoom changes and rendering-quality reductions. Phones begin with 360 trees, desktops with 1000; slow frames adjust resolution and the established terrain fallback. Fixed dense placement is opt-in, so daily woodland timber IDs remain unchanged. Verified elevations survive DEM reloads, and identical placement requests do not rebuild the forest.

## Exploring

Plains gain light ground hatching. Actual mapped grass receives bounded tufts, flowers and pebbles; native water, woodland and built-area polygons cover the generic background hatch. Lakes have teal depth colours, pale shorelines and ripples. Mapped rivers have flowing highlights, excluding underground waterways. An illustrated cascade marks each explicitly mapped waterfall near your position.

Wayside cabins, trail shelters, ranger lodges and woodland sanctuaries appear at eligible mapped walking nodes. They use the existing village building geometry, including timber, plaster, shingles and window details. Tap the small house marker to open its card. Enter within 45 metres with a GPS fix no older than 2 minutes and accuracy within 50 metres. Entry rechecks your position after both asynchronous loaders. These are fictional Alderwing stops, not claims that an actual private building is open.

The rooms reuse the furnished walking interiors, including stable cabin variants. Walk and look with the existing touch or keyboard controls. Exit returns to the same map camera and place card. Visits and the last 240 catalogue entries persist in the existing game save; visits create no ownership, residents, currency, items or production. A failed save leaves the visit unclaimed. Existing quests, gathering, village rooms and Academy flight retain their own authority.

## Bounds and lifecycle

- At most 12 nearby buildings, 8 unique waterfalls and 96 mapped grass clusters. Models share the settlement factories and merge into two custom-layer draws. MapLibre owns map frames. Distant meshes are culled beyond a small approach margin; faceted ground plants stay inexpensive. Held pointers defer both meadow placement and geometry uploads even when immediate camera updates report isMoving=false.
- Pattern updates run every 400 ms, slowing to 1 second after slow map frames. They pause during map gestures, hidden views, reduced motion and views without water.
- The map renderer stays allocated during an indoor visit. One temporary indoor renderer is created on demand and disposed, including its context, when walking closes. There is no concurrent indoor/map animation loop.
- Path evidence requires complete, valid node coordinates and rejects restricted, conditional, barrier-blocked, bridge, tunnel, technical, ford, permissive and nonwalking ways. Explicit foot restrictions exclude their member ways. OpenStreetMap is community mapping, not a guarantee of current access.
- Cached catalogue/visit data and all new modules survive the installed update and offline reload. The external geographic basemap and elevation tiles still require availability; existing offline village walking, interiors, gathering and flight remain tested.

## Verification

Evidence is retained at `/root/burbz-living-map-v373-evidence/`.

`final-zoom.json` observes 360 actual tree IDs at every 16→15.5→14.5→16→14→16 step and 360/360 retained on return. The baseline dropped 360→140→360. `entry-results.json` exercises an actual OpenStreetMap walking node, nearby arrival, a furnished Weaver cabin, real movement, durable visit and exact camera return. `water-results.json` records provider lake geometry, actual Swallow Falls node 10230547556, and water animation pauses. The cascade respects terrain and tree occlusion; the terrain-off view also verifies its three stepped water faces. The same 390×844 software-GPU movement comparison measured a final 60-frame mean 71.7 ms versus 75.6 ms for v372; p90 83.4 ms versus 100 ms. Scenery preparation fell from 132 builds in the intermediate implementation to 6 after held-gesture deferral; rendered detail vertices fell from 221,400 to 69,096. This is regression evidence, not a physical-phone FPS claim.

146 focused Node cases cover forest identities, holes/routes/budgets, elevation caches, worker lifecycle, OSM exclusions, arrival gates, asynchronous cancellation, failed-save cleanup, model geometry and surface animation/disposal. The installed v372→v373 runner verifies automatic activation, old saves, all new cached modules, geographic catalogue/visit retention and offline village gathering, rooms, Academy flight and finds.

```sh
python3 -m pytest tests/test_geographic_forest_20260907.py tests/test_geographic_map_3d_20260907.py tests/test_geographic_places_20260908.py -q
node tests/run_living_map_v373.cjs
node tests/run_living_map_pwa_v373.cjs
```

The interaction runner uses a local preview on port 8872 and verifies repeated entry, unchanged active quest and saved reload. Final broad suite: 2,111 passed, 5 skipped and the exact same 42 baseline failures as v372.

The PWA runner accepts `PLAYWRIGHT_MODULE`, `CHROME_PATH`, `BASELINE_ROOT` and `EVIDENCE_DIR`. Browser performance uses Chromium/SwiftShader, not a physical phone. Publication and exact final validation are recorded by the release owner.

## Source references

Geometry uses provider landcover/water/waterway layers: <https://openmaptiles.org/schema/>. Waterfalls are queried explicitly because they are absent from the generic OpenMapTiles POI mapping: <https://github.com/openmaptiles/openmaptiles/blob/master/layers/poi/mapping.yaml>. Custom map geometry uses MapLibre's public custom layer matrix: <https://maplibre.org/maplibre-gl-js/docs/examples/add-a-custom-style-layer/>. Original terrain/source attribution remains on the map.
