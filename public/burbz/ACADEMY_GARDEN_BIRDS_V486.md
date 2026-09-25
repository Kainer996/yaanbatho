# Academy tree and garden birds v486

Build: `academy-garden-birds-v486-20260925`.
Status: pushed on `claude/burbz-academy-tree-birds-0z4meh`, built on main at v484. Not merged. v485 belongs to smooth-sky-plain-plot on its own branch, so this takes v486.

## What Yaan asked for

- Beside the built house, a tree a little bigger than the rest, with more detail. The tree is the Academy. Its little buildings match what the player has built, so the player sees every wing in 3D. Same stylised look.
- Little birds flying about as real birds do in the wind. A robin and others.
- Real-sounding tweets, made with ElevenLabs, that match the birds you see.

## The Academy tree

- Once the house is built, the Academy grows beside it as a tree. It is the same tree and the same treehouses as the 3D Academy screen, grown to garden size (0.56 scale). It stands about 11 m tall, a little taller than the woodland.
- Only the buildings the player has built hang on its boughs. The other boughs wait, bare, just as on the Academy screen. It reads the game's own list (`academyBuiltRoomIds`), so the two always agree. The Roost was retired in v302, so it never shows.
- Its canopy is drawn the way the Alderwing woodland draws its trees: lumpy leaf masses in the woodland's own greens, with warm brown bark. The Academy screen's own tree is unchanged.
- It turns its best side to the front of the house, where the player arrives.
- After dusk the windows and a lantern string wound up the trunk glow. The Kitchen chimney smokes. The crown leans a little downwind and shivers in gusts; the trunk and houses stay put.
- Its spot is chosen once, clear of the house, path, finds and anything already in the garden, then saved with the next change. Nothing a player has placed is ever moved or removed. New furniture and farm plots keep its roots clear, and the player cannot walk into the trunk, roots or low treehouses.
- In the Build view the canopy fades, so the garden below stays visible.

## Garden birds

Twelve birds of seven UK garden species live round the house:

- one European robin (robins hold a territory alone),
- a pair of blue tits and a great tit,
- a chaffinch pair (the male and female look different),
- a charm of three goldfinches,
- a wren,
- a blackbird pair (black male, brown female).

Each is modelled from field-guide plumage in the game's style: body, head and two wings, four draws on one shared material. They are a touch larger than life (1.5×), so they read on a phone.

How they behave:

- They perch on the Academy tree (twig tips, bare boughs, deck rails, rooftops and chimneys, the treetop), the house ridge, and garden things a real bird would use: the birdbath rim, the feeder tray, bench backs, lantern posts, the stump and the welcome stone.
- On the ground a robin hops and pauses, a blackbird runs and stops to listen, and a chaffinch shuffles and pecks.
- Perched birds glance in quick jerks, preen, tilt their heads, and bob (robin, wren). Blue and great tits sometimes hang upside down from a twig.
- Tits and finches fly in bounds: a burst of beats to climb, then wings closed to dip. Robins, wrens and blackbirds fly straight; a blackbird glides into a long landing. Every bird drops off a perch, swoops up to the next and flares to land.
- Wind: in a side wind a bird crabs, its body turned into the wind while it tracks to its perch. A headwind slows it over the ground. Gusts jostle it. Perched birds turn to face into a strong wind. The wind comes from the game's weather and blows the same way as the clouds.
- Come too close and a bird flies off, often with an alarm call (robin tick, blackbird chink) and a flutter of wings.
- At dusk every bird flies to roost in the Academy tree, fluffed up with its head tucked, and stays until dawn. In rain they shelter in the tree and sing less.
- They fly round the house, never through it, and clear the trunk.
- With reduced motion they stay where they are.

## Birdsong

- Ten sounds, made with ElevenLabs Sound Effects v2 in Yaan's account (flow `cBW4FEqBZuAXVPWcNMl7`): robin song, robin tick, blue tit song, great tit song, chaffinch song, goldfinch twitter, wren song, blackbird song, blackbird alarm and wing flutter. 28 files, 750 KB, in `assets/audio/garden-birds/`, each measured and mastered (see its `manifest.json`). About 350 credits.
- Each bird sings its own species' song. Songs follow the season as the real birds do: robins and wrens sing through autumn; chaffinches and blackbirds sing mostly in spring and early summer, and only now and then in autumn. Dawn brings the most song, midday less, rain and strong wind less again. At night only a robin sometimes sings on.
- Songs are placed in space: louder and brighter close by, softer and duller far off, and panned left or right as the player turns.
- **Merlin's wand never hears them.** Burbz identifies wild birds by ear, so the birds go silent the moment the microphone opens and stay silent while it listens. They also stay silent with sounds off or the page hidden. No button, card or scan plays a bird; the songs live only in the garden.

## Files

- `garden_birds.js` (new): species, models, behaviour, flight, wind and spatial song.
- `academy_3d_core.js`: `buildHomeTree` and the woodland-style `leafMasses` canopy; tree materials shared with the Academy screen.
- `player_home_core.js`: the tree's spot, its clear roots and its walk block.
- `player_home_scene.js`: places the tree and the flock in the garden, in Alderwing and in the Build view.
- `player_home.js`, `village_world.js`: pass the player's ear, the sound gate and reduced motion each frame.
- `index.html`: `BurbzAcademyBuiltRooms`, the `birds()` sound gate and the microphone hush.
- Pins: `index.html`, `village_walk.js`, all three worker lists and the cache name in `sw.js`, and `scripts/update-live-burbz.sh`.

## Checks

- `node tests/test_garden_birds_v486.cjs`: 13 groups. Tree spot and rules; the tree grows from the 3D Academy; twelve birds, seven species; perching, foraging and flights that land; bounding versus direct flight; crabbing in a side wind; facing the wind; fleeing; roosting; seasons and distance; every sound on disk and checksummed; the microphone gate; recovery after a hush; release pins.
- Browser: `node tests/run_garden_birds_v486.cjs` (real game page, software WebGL, synthetic map), 11 checks with screenshots: the house with its tree, the tree close up, the flock, a robin on the birdbath, the Build view.
- Node suite: the same failures as main, plus the new test passing. Five older release tests list v486 as a later build.
- Python suite: 324 failed, 1945 passed on both main and this branch, with the same failing tests.
- `tests/run_home_ground_20260923.cjs` now ignores the tree's lantern glows when it checks for stray sprites. It fails on main before that check (a ground ray), with or without this change.

## Not checked

- A physical phone, frame rate or battery.
- The songs by ear inside the game: headless audio never unlocks. The gate and the files are checked; how they sound in the garden is Yaan's call.
