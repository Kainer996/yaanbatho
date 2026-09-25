# Alderwing steady v472

Build: `alderwing-steady-v472-20260925`.
Status: merged to main as PR #410 and live on yaanbatho.com. Replaced in part by [v474](ALDERWING_SEAMLESS_V474.md): trees now end by distance, the ground bends by distance, and canopy crowns carry the woods on.

## What Yaan asked for

- The dials on the flying machine's dashboard float. They should be part of it.
- Trees grow taller and shorter as you move, on foot and in the air. They should stay put.
- A lot of terrain pops. That needs fixing.
- The forests were better when they were denser. Make them dense again.

## What changed

### The cockpit is a real cockpit

- A padded leather coaming curves round the pilot over a polished walnut panel. It reaches both edges of a landscape phone screen.
- The three gauges sit in the panel's face, on a dark instrument plate edged in brass. Each has a brass bezel, tick marks, four screws and a centre cap. The compass has a red north mark. Two brass toggles sit either side.
- Each needle pivots on its own gauge's centre: compass, clock and altimeter, as before.
- The cockpit stays below the eye line. When the pilot looks down, it sinks out of sight, so the ground below is clear.
- From outside, the hull shows its own cockpit well, as before.

### Trees keep their size

- The cause: trees swapped between a detailed and a simple form by shrinking one and growing the other between 22 m and 30 m. Far trees also shrank into the ground between 100 m and 132 m. Walking or flying moved trees through those bands, so they grew and shrank.
- Now a tree is drawn whole or not at all. Each tree swaps forms at its own distance, 28–36 m from the eye, so no ring of trees changes at once.
- The simple forms now match the detailed ones: same height within 12%, same spread within 25%, same colours. The Scots pine keeps its umbrella crown far away.
- Far trees and boulders stand to the edge of the detailed ground. Each ends at its own point 12–28 m inside it.
- Only shrubs (70–100 m) and ground plants (under 30 m) still shrink away, where they are a few pixels tall.

### The land stops popping

- The cause: the square of detailed ground was rebuilt from whole rings around the viewer. Crossing a 32 m chunk moved a whole 32 m strip between detailed ground and distant land at once, all round the square. Retired chunks also left holes until rebuilt.
- Now the square grows side by side as whole new columns finish. The ring beyond is built ahead, so the square rarely waits.
- The shown square eases after its target at 80 m a second, shrinking first, so it never covers an unbuilt chunk.
- At its edge the ground becomes the distant land: height, colour and light bend onto the distant land's own triangles. The distant land is cut on the chunk-aligned square around it, where the two already match.
- Chunks whose map data changes rebuild in place. The old chunk stays until its replacement is ready.
- The distant land eases for 1.2 s from what it drew before after every rebuild: when it recentres, when new elevation tiles arrive and when new map data arrives.
- A v470 bug is fixed: distant ground uncovered after the square moved drew with no normals, as dark patches. Normals now come from the whole grid.
- The distant canopy no longer jumps at a density threshold, and it no longer rises or sinks near the viewer. It rises only far away, where the fine and coarse distant grids meet.

### Forests are dense again

- Mapped woods: 97% of tree spots grow a tree (was 82%).
- Unmapped land keeps Alderwing's own woodland: about 43% of it where the map records plenty nearby (was under 10%), about 78% where it records little.
- Copses 30–60 m across dot open country: about 16% of meadows, 13% of fields and 12% of lower heath.
- Scrub, wetland and orchards carry more trees too.
- The real limits stay: no trees above the treeline or on cliffs, and upland moors stay open.
- Distant woods look like woods: a darker, mottled canopy colour and a painted treetop pattern on the distant land and at the ground's edge. The pattern eases to its average between 260 m and 800 m, so it never shimmers.

## Phone performance

Measured in software WebGL at 390×844, same places and poses, main (v471) against this build. The adaptive resolution settled at 0.65 in both. This is a relative proxy, not phone FPS.

| Place and view | Main frame | New frame | Change | Main triangles | New triangles |
| --- | --- | --- | --- | --- | --- |
| Grizedale Forest, walking, facing the village | 169 ms | 201 ms | +19% | 199k | 243k |
| Grizedale Forest, walking, facing away | 109 ms | 134 ms | +23% | 125k | 193k |
| Grizedale Forest, flying at 60 m, facing the village | 166 ms | 170 ms | +3% | 200k | 243k |
| Grizedale Forest, flying at 60 m, looking down | 96 ms | 112 ms | +16% | 139k | 184k |
| Pendle Hill, walking, facing the village | 126 ms | 138 ms | +9% | 133k | 156k |
| Pendle Hill, walking, facing away | 75 ms | 83 ms | +10% | 70k | 90k |
| Pendle Hill, flying at 60 m, facing the village | 121 ms | 134 ms | +10% | 133k | 156k |
| Pendle Hill, flying at 60 m, looking down | 68 ms | 77 ms | +13% | 72k | 97k |

- Dense forest costs the most: up to about a fifth more per frame in Grizedale Forest, which now grows about a third more trees in the same square (7,232 against 5,318). Pendle Hill grows more than twice as many (907 against 387) for about a tenth more.
- Trees and bushes share their crown corners and shade flat on the GPU. They look the same for about a quarter of the vertices, which pays for much of the new density.
- The treetop pattern costs nothing measurable. Draw calls fell by 5–23%, because cells beyond the shown ground skip their draw.
- No new streaming hitches: building a chunk stays under 10 ms, as before.

## Verification

- `tests/test_alderwing_steady_v472.cjs`: 10 tests. Tree kinds are whole-or-nothing; simple forms match detailed ones in size; far trees stop at the shown ground; the density rules; the shown square never covers an unbuilt chunk while flying diagonally at full speed; the ground edge uses the distant land's own triangles; a rebuilt distant land starts from what it drew and is lit everywhere; the cockpit gauges are mounted in the panel and face the pilot; the flight look range; release integrity.
- `tests/test_alderwing_nature_v470.cjs` now accepts the v472 re-ship of its modules. Its unmapped-woodland check follows the new rule: there is still less woodland where the map records plenty.
- `tests/run_alderwing_steady_v472.cjs` proves 5 checks in the real renderer with synthetic offline input, including a flight with the real key where the ground edge eases and never uncovers a chunk.
- Live-provider tours ran at Grizedale Forest, Pendle Hill and the Lake District fells, on foot and in flight.
- Python suite: 325 failures, all pre-existing and identical to main. Node suite: 133 pass, 32 fail; the 32 match main, and the new test passes.

## Release integrity

- Changed modules: `world_nature_core.js`, `world_nature.js`, `world_horizon.js`, `flight_craft.js`, `village_world.js`, `village_world_core.js`, and `village_walk.js` (its loader pins).
- All seven use `?v=alderwing-steady-v472-20260925` in their consumers and in all three worker lists. `BURBZ_CACHE` and `BURBZ_BUILD` carry the new marker. The updater already lists every file.

## Limits

- Software WebGL is not a phone. Please feel it on a real phone before publishing.
- Dense forest costs more to draw. The adaptive resolution still protects the frame rate on weaker phones.
- A tree's swap between its forms is instant. The outline matches, but a watchful eye can still catch a crown's facets change at about 30 m.
- Beyond the detailed ground, about 130–160 m out, woods are painted treetops rather than single trees.
- Distant settlements still appear at the old distance.
