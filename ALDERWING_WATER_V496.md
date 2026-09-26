# Alderwing living water v496

Build: `alderwing-water-v496-20260926`.
Status: on branch `claude/water-effects-flowing-ta5pbp`, waiting for Yaan's look on his phone. It claims v496 because the unmerged walk-planner branch took v495 first.

## What Yaan asked for

Two screenshots. At Marlbourne the water sat flat and still, and the waterfalls looked crazy and weird. At a reservoir the lake split into two sections, as if it had not loaded. He asked for water that flows and looks as real as possible everywhere, with a water effect when the player is near a running river.

## Why it looked wrong

- The village river used an old shiny material. It only animated near the village, and its fine normal map broke into white noise at a distance.
- The "waterfalls" at Marlbourne were stepped cascades. Any river slope of 1.35 m over 10 m got flat stone shelves, short curtains and a thread pattern that aliased into static.
- Mapped waterfalls were the stream ribbon lifted up to 80 cm and laid on the slope, so they read as a floating white ramp.
- Lake chunks used their own material, so they never bent onto the distant land at the edge of the shown square. The distant water used a different colour formula too. The two met at a hard line.
- Stream pieces from neighbouring map tiles overlapped and fought each other, and a river's centre line was drawn again on top of its own river area.

## What changed

### One water look everywhere

- `shore_water.js` now holds one water shader for streams, rivers, lakes, the sea and the distant water. They share the same deep colour, the same sky reflection and the same sun and moon glints.
- Ripples come from one small tile made in code at load (`texture()` in `world_water_core.js`): ripple slopes, foam and caustic light. It is mipmapped, so distant water turns into a calm mirror and never shimmers.
- Ripples move with the water. Two phases of the flow crossfade, so the pattern travels without stretching. The pattern is anchored to the world, so it never jumps where one map tile's piece of river meets the next.
- Narrow becks mirror their banks. Wide rivers and lakes mirror the sky.

### Streams and rivers flow

- Stream ribbons sit on their own ground, 8 cm up. No part of a stream floats any more.
- The water runs quicker and whiter the steeper the ground. Rapids churn with foam, foam lines trail the banks, and shallow edges show dark stones and moving caustic light.
- The banks wander like real ones instead of ruled lines.
- Overlapping tile pieces now draw once. Where a river is mapped as an area, the area draws the water and flows along the mapped centre line.
- The village's own river, and each neighbour's, now runs on as a stream line. It flows, falls and sounds like a mapped one. The flat river planes and the stepped cascades are gone.

### Waterfalls

- A fall now leaves its lip in an arc and lands in a churning pool. The steeper the real drop, the further the sheet stands off the rock.
- The sheet is glassy where it bends over the lip, then breaks into white strands that stretch as the water speeds up. Gaps show the dark wet rock behind.
- Spray drifts over the pool, and droplets fly up where the water lands.

### The reservoir is one surface

- Lake and sea chunks now bend onto the distant water at the edge of the shown square, just as the ground does.
- The distant water uses the same shader and starts from the same deep colour. From the shore and from a 38 m hill the reservoir runs to its far side with no seam.

### Near running water

- Flecks of foam and fallen leaves ride the current near the player. They show which way the water goes and how fast, and never cross a waterfall's lip.
- The water is heard. Three loops made with ElevenLabs Sound Effects v2 play on the calm nature bus: a babbling brook, a broad river and a waterfall's roar. Each gets louder the closer and bigger the water is, sits on the side it is on, and softens with distance. Flying high, the sound fades. Indoors, with sound off, with the page hidden or while the microphone listens, it is silent.
- A wide river mapped as an area is heard from its own bank, not only from its centre line.

## Checks

- New unit test `tests/test_alderwing_water_v496.cjs`: 10 tests.
- Node suite: 60 failing subtests before and after, the same 60 as main (`8f108b8`). The older release tests list v496 as a later build.
- New browser proof `tests/run_alderwing_water_v496.cjs` in the real renderer with synthetic offline map data: 8 checks pass. They cover a beck, a 30 m waterfall, rapids, a 1 km reservoir from its shore and from a hill, a 40 m river area, and the village river. The shaders compile with no errors. Water pixels change between two frames half a second apart. The brook, river and waterfall loops play on the live Web Audio graph.
- Frame-time proxy in software WebGL, same poses, old against new (median ms): beck 108 → 108, meadow 200 → 208, reservoir 83 → 83, waterfall close-up 100 → 117.

## Release integrity

- Changed modules: `world_water_core.js`, `world_water.js`, `shore_water.js`, `world_horizon.js`, `village_world.js` and `village_walk.js`. All six carry `?v=alderwing-water-v496-20260926` in their loaders and in all three worker lists.
- New sounds in `assets/audio/water/` with `manifest.json` (prompts, hashes, processing) and a credit in `assets/audio/ATTRIBUTION.md`. They are cached for offline play and listed in the updater.
- `BURBZ_BUILD` and the end of `BURBZ_CACHE` carry the new marker.
- `tests/run_houses_terrain_v408.cjs` now looks for the river's new falls where it looked for cascades.

## Limits

- Software WebGL is not a phone. Please feel it on a real phone.
- Waterfalls still come from mapped streams crossing steep real drops. Unmapped mountain streams have none.
- Headless audio has no speakers. The check reads the audio graph, not what an ear hears. Please listen on the phone.
