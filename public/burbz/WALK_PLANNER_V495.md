# Walk planner v495

Build: `walk-planner-v495-20260926`.
Branch: `claude/screen-styling-gps-features-bsbnx0`.

## What Yaan asked for

The Main Quests walk screen looked cheap. He wants it in the same style as Home.

- Press a button to start.
- Use my location, or tap the map.
- The button the player presses stays lit, so they know the start is set.
- Checkpoints between the start and the end, so players can make a more interesting walk.
- The game fills the route between checkpoints: footpaths first, then pavements and roads people can walk on.

## What changed

- **The Home look.** Charcoal boxes, muted gold edges, Rajdhani titles, and the glowing gold button from the Home Quests strip. The old brown gradients are gone.
- **Three steps, each a Home box.** Start, Checkpoints, Destination, each with its own painting.
- **Start.** Two buttons: My location and Tap the map. The one used stays lit with a gold edge and a tick. It says where the start came from and shows its coordinates.
- **My location asks the phone.** If the last fix is old, the game asks for a fresh one and shows "Finding you…". If location is refused, it says so and the button goes dark again.
- **Checkpoints.** Add checkpoint, then tap the map. Up to eight, numbered in order, each with a gold pin on the map and an ✕ to remove it. Adding or removing one routes the walk again.
- **The game fills the route.** One map request covers every stop. Each leg follows public footpaths first, then pavements and roads. A checkpoint within 40 m of a path sits on the path. One further away gets a dashed side trip to its exact spot.
- **Start walk.** One big gold button. Preview again and Cancel sit quietly beneath it.
- **Route ready.** A row of three chips (Start, Checkpoints, Destination) keeps the route in view. Tap Start or Destination to edit; tap Checkpoints to add one.
- **Route card.** Distance, XP, coins and the footpath share, then loot and climb in plain words ("Garden worms ×1", not `garden_worms x1`).
- **Your walk.** Once a walk begins, the sheet shows only the walk: stats, Finish my walk and the stops. No planning form under a live walk.
- **Finished walks** show a date ("26 Sep 2026") and the stop count, not a raw timestamp.
- **Short landscape.** The panel uses the bottom strip, since the dock sits on the right.

## Kept as it was

- Rewards, saves, stops and receipts work as before. Rewards stay capped.
- Map taps for the start still ask for the destination next.
- Any route to the destination still counts.

## Files

- `destination_route_core.js`: checkpoints (`opts.via`), one map box over every stop, leg-by-leg routing.
- `destination_quest_ui.js`: checkpoint state, the new screen, My location with a fresh fix.
- `destination_quest_ui.css`: the Home look.
- `index.html`: `destinationRequestPrecisePosition`, build marker and pins.
- `sw.js`: cache name and the three pins in all three worker lists.

## Checks

- `node --test tests/test_walk_planner_v495.cjs`: route engine (footpaths over roads, roads where no footpath goes, checkpoint order, side trips, limits) and the screen (lit buttons, fresh fix, checkpoint list, chips, stylesheet, release pins).
- Browser: `node tests/run_walk_planner_v495.cjs` (8 checks). Headless Chromium's location emulation times out on a fresh request, so the test stands in for the phone's GPS sensor; everything after the sensor is the real game.
- Release pin tests list v495 as a later build.
