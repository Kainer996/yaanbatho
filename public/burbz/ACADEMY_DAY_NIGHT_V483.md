# Academy day and night v483

Build: `academy-day-night-v483-20260925`

Yaan asked for the Academy screen and Home's little Academy to have day and night, the same as the rest of the game, and to be lit up and cosy at night.

## What changed
- Both Academy trees keep the game's clock (`daylight_core.js`): full sun by day, a golden dusk from 17:00, moonlight from 19:00, a pink dawn from 05:00.
- The day painting fades out as the sun sets. Under it waits a moonlit copy of the same tree with the sky cut away. Under that is a live night sky: stars that twinkle, a full moon and the odd shooting star.
- Every house fades to a lit-up night picture. Its windows, lanterns and hearth keep burning, and their light falls on the timber around them.
- Warm pools of lamplight glow on the bark around each house, wherever the player placed it.
- The manga boughs have moonlit copies too. The near boughs fall a shade darker at night.
- A soft golden wash covers the scene through dusk and dawn.
- The lamps come on through dusk, burn full from an hour after dark and go out through the dawn. The 2D and 3D Academies share this curve (`lampFactorForHour`).
- On Home, the light motes become fireflies at night, the birds go to roost and the falling leaves dim.
- Chimney smoke is a dim blue-grey wisp at night, not a white plume.
- Night art loads only from dusk, so daytime players never fetch it. It is cached for offline nights. If a night painting still cannot load, the day painting stays up under the old moonlit shade.
- Reduced motion stills the stars, the shooting star and the sway.

## How the night art is made
`assets/academy-night-20260925/source/bake_night.py` bakes every night picture from its day picture, so each lines up pixel for pixel:
- Trees: the sky is cut away (the manga mountains are traced by hand, because they are the same blue as the sky). The tree and valley are graded to moonlight, with a silver rim where leaves meet the sky and a few cottage lights in the valley.
- Houses: moonlit timber, but warm bright blobs (lamps, lit windows, hearths) keep burning, with bloom and a soft halo. The manga houses also take light from the glow anchors in `academy_alive_core.js`.

Rerun it from `public/burbz` if a painting changes. It needs Pillow, numpy and scipy.

## Files
- `academy_daynight.js`: the clock, the grade, the star field and the scene wiring. It sets `--dn-sun`, `--dn-night`, `--dn-warm`, `--dn-lamps`, `--dn-stars` and the sky colours on each scene, adds `.dn-awake` from dusk and swaps in `data-night-src` pictures.
- `academy_daynight.css`: the night sky, stars, moon and shooting star.
- `index.html`: night sky, night tree, lamplight pools and golden-hour layers; night pictures for houses and boughs; `academyNightAsset`.
- `scan_home.js`, `scan_home.css`: the same for Home's living tree.
- `academy_alive_core.js`, `academy_3d_core.js`: night and lamps now follow the game's clock.
- `assets/academy-night-20260925/`: `manga/` and `home/` night art, plus `source/bake_night.py`.
- Pins in `index.html`, all three worker lists in `sw.js`, and `scripts/update-live-burbz.sh`.

## Checks
- `node tests/test_academy_day_night_v483.cjs`: 11 groups.
- Browser: `node tests/run_academy_day_night_v483.cjs`: 7 checks, phone and laptop, day, dusk and night, reduced motion, and a night painting that fails to load.
- Full node and pytest suites match main, apart from the new test.
