# Home hub v491

Build: `home-hub-v491-20260925`.
Status: pushed to `claude/burbz-home-screen-hub-zvzfgl`, no PR yet.

## What Yaan asked for

Home is the main hub, the operating system of Burbz. Tap a box and its screen opens:

- Academy opens the Academy.
- Crafting opens Crafting.
- Kitchen opens the Kitchen.
- Training opens Training.
- Hospital opens the Hospital.
- Villages, Towns and Regions open their own pages.

He wants a Home the player loves to look at and runs everything from.

## What was wrong

- Training opened a pop-up sheet, not a screen.
- The Villages, Towns and Regions titles were plain labels. Tapping them did nothing.
- Only a box's title answered a tap. The rest of the box, most of it, did nothing.
- On a landscape phone the Training and Hospital boxes fell off the bottom of the screen.
- On a portrait phone the Empire tiles lost their bottom edge.

## What changed

- **Every box is one big button.** Tap anywhere in it and its screen opens. Rows and tiles inside keep their own jobs: a hungry bird still opens its meal, a village tile still opens that village.
- **Training opens the Training Hall.** A drill running in another room, the Library say, opens that room. The quick Training sheet stays for its other callers.
- **Villages, Towns and Regions are buttons** with their count and a chevron. Villages and Towns open their Empire pages. Regions opens the realm page and scrolls to the Counties list under the map. Tapping empty space in a column opens its page too.
- **A gold edge shows what wants you.** Crafting with gear to collect, a hungry bird in the Kitchen, a finished drill, a bird that needs care. Quiet boxes stay quiet.
- **Training tells the time.** "2 drills · next in 14m" instead of "2 active drills".
- **Landscape fits.** On short landscape phones the Empire, scanner and quest strip run down the left. The Academy tree stands tall on the right. Crafting, Kitchen, Training and Hospital share the bottom row. Empire tiles go wide: picture on the left, name and status beside it. On the smallest phones (740×360) the rooms keep just their titles.
- **Whole Empire tiles.** The Empire box is sized from its real heading and column titles, so the first tile always shows whole.
- Merlin perches over the Academy tree's top right in landscape, so its "ready" chip moves to the left.

## Kept as it was

- Screenshot B's layout (Yaan's choice, v423) stays in portrait: Empire, scanner, quests, rooms on the left, Academy on the right.
- Every game gate still decides. A locked room guides the player to build it; nothing unlocks from Home.
- The tutorial still points at the Academy heading.

## Files

- `scan_home.js`: box taps, column buttons, gold edges, the Training time line and the landscape layout.
- `scan_home_core.js`: a drill row carries its room.
- `scan_home.css`: the v491 block at the end.
- `index.html`: routes for Training and the three Empire pages; build marker and pins.
- `sw.js`: cache name and the three Home pins in all three worker lists.

## Checks

- `node --test tests/test_home_hub_v491.cjs` (7 groups).
- Browser: `node tests/run_home_hub_v491.cjs` (5 checks). It taps every box and lands on the right screen, page or room. Every box is whole and on screen at eight sizes, from 360×640 to 1280×800, both ways up.
- Release pin tests list v491 as a later build.
