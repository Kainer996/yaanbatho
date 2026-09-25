# Academy manga v475

Build: `academy-manga-v475-20260925`

Yaan said the Academy 2D screen looked old: it was one of the first things he made. He asked for the crisp, colourful manga style of the bird cards, with new buildings too.

## What changed
- New Academy tree: a sunny, hand-inked manga oak with empty shelf boughs, blue sky and a green valley. Made with ElevenLabs (GPT Image 2), using the Blue Tit and Great Tit cards as the style guide.
- A wide painting of the same tree for tablets and laptops (container query on `.academy-treehouse`, 600 px and up).
- All twelve houses plus Aviary Gardens redrawn in the same style. The designs match the Home living tree. Every building has its own picture now: the Birdhouse no longer borrows the Training Hall, the Office no longer borrows the old Roost, and the Library is no longer a flat SVG.
- Four new swaying boughs. They reach in from the edges of the frame, so their sawn ends stay hidden.
- Lighter colour grade by day; a deeper night shade so evenings still read as night.
- Build cards show each house on a small sunny sky tile.
- `academy_alive_core.js`: glow, smoke, notes, sparks and thwack spots retuned to the new houses.
- Home's Academy heading banner and the Kitchen and Training icons use the new art.

## Files
- `assets/academy-manga-20260925/`: `tree.webp`, `tree-wide.webp`, `bough-a..d.webp`, one `.webp` per building id and `aviary-gardens.webp`
- `index.html`: `ACADEMY_BUILDING_ASSETS`, tree and bough CSS, bough markup, build-card art tile, night shade
- `academy_alive_core.js`: `ANCHORS`
- `scan_home.css`: heading banner
- Pins in `index.html`, all three worker lists in `sw.js`, and `scripts/update-live-burbz.sh`

## Checks
- Python Academy suites: same 10 failures as main (old release pins), none new. Art-path assertions in the library, canopy, magpie and alive tests now point at the new art.
- Node: `test_separate_home_20260924`, `test_scan_home_v378`, `test_scan_home_v384`, `test_home_empire_v420`, `test_home_goal_v422`, `test_dashboard_banners`, `test_alderwing_steady_v472`, `test_alderwing_nature_v470` and `test_academy_geometry_v358` pass.
- Browser (Chromium): phone 390×844 by day and night, laptop 1280×800, with some and all houses built. No page errors.
