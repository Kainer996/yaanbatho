# Living Academy tree v473

Build: `academy-living-tree-v473-20260925`

Yaan wanted Home's Academy picture to show only what the player has built, where they built it, and to feel alive.

## What changed
- New painted tree with empty boughs, made with ElevenLabs (GPT Image 2) from Yaan's painted tree as the style guide.
- Twelve house cut-outs in the same style, one per building. Only built houses appear.
- Each house stands at the spot the player chose on the Academy screen.
- Wide boxes use a wide painting of the tree instead of a tall one in blur.
- Boughs sway, houses rock, leaves fall, light motes drift, birds fly past, the Kitchen chimney smokes.
- "🔨 N ready" chip when houses can be built. "Build your first house in the Academy" when none stand yet.
- Reduced motion turns all movement off.

## Files
- `scan_home.js`: `academyTree`, `treeSpot`, `TREE_HOUSES`
- `scan_home.css`: `.home-tree*` rules and keyframes
- `assets/academy-living-tree-20260925/`
- Pins in `index.html`, all three worker lists in `sw.js`, and `scripts/update-live-burbz.sh`

## Checks
- Unit: `test_separate_home_20260924`, `test_scan_home_v378`, `test_scan_home_v384`, `test_home_empire_v420`, `test_home_goal_v422`, `test_dashboard_banners` pass.
- `test_progressive_home_20260914` and `test_tavern_hall_pins` fail the same way on main.
- Browser (Chromium, 390×844 and 1280×800): none, some and all twelve houses built; no page errors; tapping a house opens its room.
