# Merlin flight v475

Build: `merlin-flight-v475-20260925`

## What Yaan asked

1. Merlin is smaller on Home than on the Map. Make him the same everywhere.
2. He looks silly when he flies. Use ElevenLabs for a good sprite sheet and make him fly naturally.
3. Tapping to drop a stone sometimes presses a button and leaves the screen. Let the player drop a stone anywhere. After four pebbles he goes back to his perch.

## What changed

- **One size.** Home no longer scales the perch down (`scan_home.css`). The perch box is 92 px on Home, Map and Birds alike.
- **New art.** Two ElevenLabs sheets, keyed and registered on Merlin's eye, packed into a 223 KB atlas (the old one was 2.5 MB). One side view only: an 8-pose wing beat, reach, grab, lift and landing flare.
- **Natural flight.** Steering physics: speed and turn are limited, so he always flies arcs. He glides on the level-wing frame, beats faster when he climbs or carries, and tilts with his path. Turning round squeezes through a narrow profile rather than flipping.
- **Exact grabs and landings.** The last part of each swoop and the landing follow Hermite curves that end on the exact spot. Tests show talons within 1.5 px of the pebble.
- **Whole-screen play sky.** Every tap drops a pebble where the finger lands. Buttons, the dock and the header underneath cannot be pressed. The play bar (Care, Finish) sits just above the dock.
- **Four pebbles, then home.** Each pebble goes onto a small pile under the perch. After the fourth he flies home, flares and settles back on the branch.

## Checks

- `node --test tests/test_merlin_flight_v3_20260925.cjs` (17 tests)
- `node tests/run_merlin_flight_v3.cjs` (real game in Chromium at 360×780)
- `node tests/run_paced_tutorial_v469.cjs` still passes (Play closes Care, Care lands him first)
