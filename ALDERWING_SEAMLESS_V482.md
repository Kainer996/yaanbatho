# Alderwing seamless v482

Build: `alderwing-seamless-v482-20260925`.
Status: pushed on `claude/alderwing-world-flying-machine-6mto0l`, built on main at v481. Not yet merged to main or published. Main shipped v474–v481 while this was made, so it takes the next number, v482.

## What Yaan asked for

- Trees and terrain still pop in. Fix it.
- It rains, but the sky has no clouds. Fix that too. (Later: the weather need not match the real sky, as long as it looks good.)
- Check how similar games stop or hide pop-in.

## How other games hide pop-in

A research pass checked talks, papers and engine docs. These methods work, best first:

1. **Morph by distance, never swap.** CDLOD terrain slides each vertex onto the coarser level across a band of distance, so the two match before they meet ([Strugar](https://aggrobird.com/files/cdlod_latest.pdf)). Geometry clipmaps and Far Cry 5 do the same.
2. **A random end for each tree.** Ghost of Tsushima drops far objects at a random distance each ([GDC 2021](https://media.gdcvault.com/GDC+2021/ghost_streaming_gdc2021.pdf)). A hard line becomes many small, scattered changes.
3. **Keep far trees, cheaply.** Fortnite and X-Plane draw cheap far forms. Microsoft Flight Simulator players see "a large circle" where trees stop.
4. **Match far colour to near.** The Witcher 3 and Far Cry 5 tint far forms from the ground beneath them.
5. **Haze and ink that fade with distance.** Sable fades its outlines with distance, and says its fog "had the biggest impact".
6. **Load ahead of the player's speed.** CesiumJS preloads where the camera is going.
7. **Shadows that snap to whole texels.** This is the standard "stable shadow map" fix for shimmering shadows.

Two common methods do not suit Alderwing. A dithered fade speckles the ink outlines. A timed grow-in makes trees change size, and Yaan asked for trees that never do.

## What was popping

A new probe flies the craft 50 m up at 36 m/s. After each frame it draws the scene again from the previous frame's camera, so every changed pixel is a pop, not movement. It found:

- The detailed ground moved in whole 32 m columns. Each move made a strip of trees appear at once, about 150 m ahead, every 0.9 s.
- The new column's grass texture appeared as a dotted grid.
- Every tree shadow jumped when the sun's shadow map moved, every 32 m.
- New trees at the far edge gained their shadows late.
- After any change to the tree pools, the GPU drew one frame from stale data, so a few trees blinked.
- Far treetops were built while already in view as a flight began.
- The distant land's heights flip-flopped when map tiles left the cache.

## What changed

### The land bends by distance

- The detailed ground bends onto the distant land between 84 m and 124 m from the viewer, as CDLOD terrain does. The shown ground always reaches at least 128 m, so its edge never shows. Its own edge still bends fully, should it ever come nearer.
- The grass texture fades out across the same band, so the ground matches the untextured distant land.
- Far trees and boulders ride the ground as it bends. Each keeps its own "drop": the distant land's height less the ground's, under it.
- The distant land bends from its fine grid to its coarse one by distance too, between 400 m and 472 m. Its fine grid always reaches 480 m.
- Moving the distant land now changes nothing drawn, so it needs no ease. Only new map data eases in, over 1.2 s, and the ground's bend eases with it.
- The distant land keeps the most detailed height it has ever read at each point, so a map tile leaving the cache never changes it back.

### Trees end one at a time, on a round edge

- Far trees and boulders end at their own distance, 100–124 m across the ground, not at the edge of the detailed ground. The edge is round, ragged and moves with the viewer.
- Trees are still whole or nothing. Nothing grows or shrinks.

### Canopy crowns carry the woods on

- Beyond the far trees, each wood is drawn crown by crown, out to 250–300 m. There the distant canopy has risen, so the woods never stop in a circle.
- Crowns start across the same band where far trees end. As one goes, another comes, so a wood stays as full.
- Crowns come from the distant land's own record of each wood: its density, its share of conifers and its crown colour. They sit on a jittered 6.4 m grid fixed in the world.
- A broadleaf crown is 20 triangles; a conifer is 12. Neither has a trunk, which would be under a pixel wide.
- Crown cells build 40 m before any crown in them can show, missing cells first.

### Shadows hold still

- The sun's shadow map follows the viewer in 16 m steps, each a whole number of shadow texels across the light. Shadows keep their places when it redraws.
- Shadows fade out between 70 m and 100 m, before any far tree ends. No shadow ever appears with a tree.

### No tree is drawn from stale data

- The pools reach the GPU once a frame, after the last change and before the draw.

### The ground ahead builds first

- New chunks build nearest to where the viewer will be a second from now.

### Rain brings clouds, and the weather is made to look good

Yaan said the weather need not match the real sky, as long as it looks good. So Alderwing now makes its own.

- Fair skies with drifting cloud most of the time: blue sky and big white clouds with grey-blue bellies.
- Now and then a passing shower: cloud gathers into grey masses for three minutes, rain falls from it for three to six, then it clears. About one shower an hour (26 a day); it rains about an eighth of the time.
- The weather follows the clock, so every screen agrees. It needs no weather service, so no position leaves the phone for it any more.
- The sky draws a layer of cloud as thick as the weather's cover. Cloud gathers into broad masses with sky between them; thick cloud is grey underneath and thin cloud glows. It drifts with the wind and thins toward the horizon.
- Blue shows between clouds until the cover is nearly whole. Then the sky and haze turn grey, the sun hides and the light softens. Rain darkens them further and always brings a covered sky.
- Rain thickens the haze, so the far land greys away as it does on a wet day.
- Rain now falls in flight too, and streams past the cockpit at the craft's own speed.

## Results

Pops per frame, as changed pixels at the 548×253 drawing size, flying 360 m at 36 m/s and 50 m up:

| Flight | v472 worst frame | v482 worst frame | v472 frames over 1,000 | v482 frames over 1,000 |
| --- | --- | --- | --- | --- |
| Pendle Hill | 2,732 | 604 | 22 | 0 |
| Grizedale Forest | 3,544 | 1,041 | 26 | 1 |

The typical frame now changes a little more: a few single trees at the far edge each frame, where v472 changed almost nothing between strips. The change is steady and small, so the eye reads it as distance, not popping.

The same probe runs in the real renderer on synthetic land with a dense wood. Main's worst frame changed 2.5% of the screen at once; this build's worst changed 0.8%.

## Phone performance

Measured in software WebGL at 390×844, same places and poses, main at v473 against this build before the merge. v474–v481 changed how the craft flies and the dock looks, not how the land and trees are drawn. The adaptive resolution settled at 0.65 in both. This is a relative proxy, not phone FPS.

| Place and view | Main frame | New frame | Change | Main triangles | New triangles |
| --- | --- | --- | --- | --- | --- |
| Grizedale Forest, walking, facing the village | 188 ms | 199 ms | +6% | 235k | 247k |
| Grizedale Forest, walking, facing away | 121 ms | 143 ms | +18% | 163k | 190k |
| Grizedale Forest, flying at 60 m, facing the village | 166 ms | 199 ms | +20% | 235k | 266k |
| Grizedale Forest, flying at 60 m, looking down | 108 ms | 120 ms | +11% | 175k | 192k |
| Pendle Hill, walking, facing the village | 144 ms | 159 ms | +10% | 156k | 170k |
| Pendle Hill, walking, facing away | 87 ms | 90 ms | +3% | 90k | 98k |
| Pendle Hill, flying at 60 m, facing the village | 132 ms | 141 ms | +7% | 156k | 167k |
| Pendle Hill, flying at 60 m, looking down | 77 ms | 87 ms | +12% | 97k | 108k |

- The canopy crowns cost the most: about 30k more triangles in dense forest. Dropping their trunks and ending them at 250–300 m cut that by a third.
- The clouds cost nothing measurable: a clear sky measured the same.
- Draw calls rose by about 5%.

## Verification

- `tests/test_alderwing_seamless_v482.cjs`: 12 tests. The distances fit together; trees are whole or nothing and end by distance; crowns and trees hand over across one band; pools share shapes and carry drops; crowns are cheap; the ground bends by distance and eases new data; the distant land keeps its best tile; a moved distant land draws the same; shadows snap to whole texels and fade before trees end; crowns build ahead and the pools reach the GPU after every change; rain brings clouds, grey light and haze; the game's own weather is mostly fair with passing showers, smooth, the same on every screen and never leaves the phone; release integrity.
- `tests/run_alderwing_seamless_v482.cjs` proves rain, crowns and the flight in the real renderer with synthetic offline input, using the same pop probe.
- `tests/test_alderwing_steady_v472.cjs` and `tests/test_alderwing_nature_v470.cjs` accept the v482 re-ship of their modules.
- Live-provider flights at Pendle Hill and Grizedale Forest, and a low flight 10 m over Grizedale Forest.
- After merging main (through the glide release, v481): Python suite 325 failures, all pre-existing and identical to main; Node suite 133 pass, 33 fail, the 33 matching main, and the new test passes. The v478 flight tests still pass.

## Release integrity

- Changed modules: `world_nature.js`, `world_horizon.js`, `village_world.js`, `village_world_core.js`, `world_sky.js`, `village_walk.js` (its loader pins), `exploration.js` and `index.html`.
- All seven modules use `?v=alderwing-seamless-v482-20260925` in their consumers and in all three worker lists. `BURBZ_CACHE` and `BURBZ_BUILD` carry the new marker. The updater already lists every file.

## Limits

- Software WebGL is not a phone. Please feel it on a real phone before publishing.
- Dense forest costs up to about a fifth more per frame, open country up to about a tenth. The adaptive resolution still protects the frame rate.
- Where map data truly changes, for example a wood mapped for the first time, its crowns appear at once.
- Streams and roads between 84 m and 124 m keep their own heights, so a stream can sink into the bending ground there.
- Distant settlements still appear at the old distance.
