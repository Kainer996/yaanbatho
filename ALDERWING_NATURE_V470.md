# Alderwing nature, water and craft v470

Build: `alderwing-nature-v470-20260925`.
Status: merged to main as PR #407 and live on yaanbatho.com since 25 September 2026. Its tree fades, sparse unmapped land and floating dashboard are replaced in [v472](ALDERWING_STEADY_V472.md).

## What Yaan asked for

More variety when exploring Alderwing. A better-looking flying machine. In first person, no wings in the way, and a free look down and around. Realistic water, with waterfalls on mountains linked to streams. Terrain as close to the real place as possible. All of it still smooth on a phone.

## What changed

### The land looks like the real place

- The ground takes its colour from the real map. OpenMapTiles land cover now reads woods, farmland, orchards, meadows, heath and fell, scrub, bare rock, scree, sand, wetland, ice, towns, parks and sports grounds.
- Real elevation shapes it too. Steep slopes and cliffs turn to grey rock. Trees thin out and stop at the natural treeline for the latitude: low in the damp British uplands, high in the Alps. Lying snow follows altitude, latitude and season.
- The season comes from today's date and the hemisphere. Heather blooms purple in August and rusts after. Bracken browns in autumn. Broadleaf crowns turn gold and red in autumn and go bare in winter.
- Unmapped ground stays honest. Where the map records plenty of land cover, gaps are open country. Where it records little, Alderwing's authored woodland fills in.
- Roads and paths fade into the ground by their mapped class, so a footpath never breaks into dots.
- `world_nature_core.js` holds these rules. It is pure and unit-tested.

### The view reaches the horizon

- Before, fog closed in at 104 m. Now real elevation draws out to about 4.5 km in two low-cost rings (`world_horizon.js`), coloured by the same rules. Woods rise as a canopy in the distance. Lakes and the sea mirror the sky.
- The detailed ground bends onto the distant surface at its edge, so the two meet with no crack. A long aerial haze replaces the short fog, and the ink outlines keep their own shorter range.
- Offline, or before the distant tiles arrive, the old fog stays. Nothing breaks.

### Much more variety

- Eighteen kinds of plants and stones: oak, silver birch, Scots pine, spruce, hawthorn, dead snags, bushes, flowering gorse, heather, bracken, reeds, grasses, wildflowers, mushrooms, logs, stumps, mossy boulders and small stones.
- Each place picks its own mix from its cover, height, slope, wetness and season. Positions stay fixed in metres, so a flower stays put across visits.
- Trees have a detailed form within 30 m and a simple form beyond. The two cross-fade by scale.

### Real water

- Lakes and the sea (`shore_water.js`) now have moving waves, deep and shallow colour, sky reflection that grows at low angles, sun and moon glints, and a soft foam line at the shore.
- Every mapped stream and river line flows as a continuous ribbon (`world_water_core.js`, `world_water.js`). Water runs faster and whiter on steep real ground.
- Where a mapped stream crosses a steep real drop of at least 3.5 m, it becomes a waterfall: a wider white curtain, a wet rock gully lined with boulders, a plunge pool and drifting spray. Glitches in the elevation data never become cliffs.
- Near Grasmere, Easedale Beck shows several falls. Grasmere itself shows its real island.

### The flying machine

- A new ornithopter (`flight_craft.js`): a clinker-built wooden hull with a brass rub rail and teal stripe, a padded cockpit, twin floats on brass struts, a feathered tail fan and a brass bird figurehead.
- Jointed feathered wings: covert rows and seven primaries on each hand. Parked, they fold back along the hull like a resting bird. In flight they beat with a lagging wrist.
- Aboard, only a slim dashboard stays: a compass, a clock and an altimeter. Its needles are live. The hull and wings never block the view.
- A pilot aloft can now look straight down (pitch to −1.5). The dashboard slides away as you look down. On foot, the old head range stays.
- The whole craft is nine meshes and one shared material.

## Phone performance

Measured in software WebGL at 390×844, same places and poses, old build against new. This is a relative proxy, not phone FPS.

| Place and view | Old frame | New frame | Old triangles | New triangles |
| --- | --- | --- | --- | --- |
| Grizedale Forest, walking | 82 ms | 86 ms | 58k | 101k |
| Lake District fell, walking | 57 ms | 67 ms | 35k | 69k |
| Lake District, flying (towards village) | 107 ms | 116 ms | 91k | 132k |

- Building one terrain chunk is 2–7 times faster than before (Clitheroe: 14.6 ms → 2.1 ms). Streaming the countryside is smoother.
- Draw calls are about the same or lower. Plants share instanced pools per kind per 96 m cell, so whole cells outside the view are skipped.
- The ground uses a matte diffuse material instead of the physical one. It looks the same for less work per pixel.
- Plants fade by distance per kind. Ground plants exist only within 30 m, and drop away on high flights.
- Pool uploads send only the changed range.
- The distant land rebuilds in 16-sample slices under a 3 ms budget, and backs off when offline.
- The existing adaptive resolution still protects the frame rate on weaker phones.

The new build shows about forty times more land. The cost is a modest rise in triangles. Real phone FPS still needs a check on Yaan's phone.

## Verification

- Merged with main at v469 and renumbered to v470. Main had used v462–v467, then took v469 for the paced tutorial. Only the release markers clashed: `AGENTS.md` keeps both notes, and `BURBZ_CACHE` adds this marker after main's.
- Python suite: 325 failures, all pre-existing and identical to main. No new failures.
- Node suite: 132 pass, 32 fail. The 32 match main. The new `tests/test_alderwing_nature_v470.cjs` passes 11 tests.
- `tests/test_village_walk_loading_v414.cjs` now lists the new loader modules.
- `tests/run_alderwing_nature_v470.cjs` proves 7 checks in the real renderer with synthetic offline input: horizon and haze, plant pools, a stream falling over a 30 m crag, spray, a lake, the parked craft, and the pilot view with a straight-down look.
- Live-provider tours ran at the Lake District fells, Grasmere, Easedale and Pendle Hill.
- `connected_world_fixture_v386.cjs` gains an optional waterway layer. Existing fixture tiles are byte-identical.

## Release integrity

- New modules: `world_nature_core.js`, `world_nature.js`, `world_horizon.js`, `world_water_core.js`, `world_water.js`.
- Changed modules: `flight_craft.js`, `shore_water.js`, `village_world.js`, `village_walk.js`, `manga_render_core.js`, `wilderness_combat.js`.
- All eleven use `?v=alderwing-nature-v470-20260925` in their consumers and in all three worker lists. The updater lists the new files. `BURBZ_CACHE` and `BURBZ_BUILD` carry the new marker.
- `open_land_core.js` still loads. Its grass and heath rules now live inside the richer nature core.

## Limits

- Software WebGL is not a phone. Please feel it on a real phone before publishing.
- Waterfalls come from mapped streams. Unmapped mountain streams have none.
- The village's own authored forest belt is unchanged. Seen from straight overhead, its dark pines read almost black.
- Distant settlements still appear at the old distance, so a village can pop in on a long clear view.
