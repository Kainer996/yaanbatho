# Home, countryside and footsteps — v387

Local implementation built from v386 (`085e8ae`), stamped `home-countryside-v387-20260910`. Publishing is a separate step.

## Player behavior

The real-life quest map keeps its GPS marker, ordinary camera controls, routes and physical quest authority. Its Walk & fly launcher and virtual-camera override are removed. A separate passive ✦ marks the saved first-person avatar; refreshing it only updates a marker position.

First-person travel starts in the house or a settlement walk. Walking outward at the detailed village boundary transfers to the geographic countryside at the same latitude/longitude and facing direction. The satchel offers both walking and immediate flight; F starts world flight from a settlement, while the world retains its existing touch climb/descend/land controls. A fresh home without an anchor uses the existing explicit location picker, with cancellation returning to the settlement. Return Home opens the house. Scene transfer may briefly load; distances are not shortened to hide that transfer.

Settlement identities and coordinates come from the existing Empire records. Projection, floating origin, metres and the existing flight integrator are unchanged: five miles remains 8,046.72 metres. Actual constructed buildings and residents still come from saved records. Detailed village/town interiors, purchases and quest receipts retain their established adapters.

The outdoor world retains sourced Mapterhorn elevation with exaggeration 1, mapped land cover, water and woodland. Provider city buildings are hidden only in this separate first-person map. Detail remains bounded: at most 16 nearby settlement records, two rendered settlements within 450 m, 240 nearby trees, 24 decoded DEM tiles and the existing map cache bounds. Missing elevation holds movement and shows retry/return controls; it does not invent a flat surface. When decoded elevation is refined, authored ground patches, building heights and tree placement refresh together within the existing bounded update cadence, so an earlier coarse tile cannot leave a home underground. Tile resolution and available offline coverage still limit detail; this is broad geographic countryside rather than a recreation of every real building.

Coin shortages now open a persistent native modal above shop and first-person layers. The three choices open the bird quest board, an unselected Find Coins errand, or the existing marketplace/build gate. No choice dispatches a bird, buys anything or spends coins. Escape, browser Back, outside tap and Maybe later dismiss it. Insufficient BUY 5 cannot quietly buy a smaller quantity. Construction, village shops, tavern drinks, recruitment, market buying, forge upgrading and crafting use coin checks; missing timber/stone/materials retain their appropriate existing handling. Busy, level and progression gates stay enforced.

Home shares the game's charcoal/gold tokens. Only the Discover card's surrounding vertical space shrinks; scanner/camera button dimensions and handlers stay intact. The dynamic Your villages section immediately follows discovery in source and in the phone/desktop layout.

## Footsteps

Six private ElevenLabs Sound Effects outputs: two each for soft ground, wood and stone. Three generation requests yielded four candidates each; observed credit use was 33 total. No purchase or subscription change. `assets/audio/footsteps/manifest.json` records prompts, processing and hashes. The originals and playable user copies are in the originating task's audio output folder.

The existing audio manager owns the bank. Actual horizontal grounded movement drives cadence; idle, collision, teleports, long resume gaps, flight and menu/exit/reset paths do not produce catch-up steps. The first step occurs after 0.18 m, subsequent steps around 1.2 m apart with a 320 ms guard. Variant selection avoids an immediate repeat; at most one footstep voice plays. Existing SFX mute and all unrelated effects remain intact. Wood is selected for rooms and the actual bridge bounds, stone from actual cobble geometry/home paving, ground elsewhere. No extra ambient or action sounds were generated.

## Verification and constraints

- `tests/test_footsteps_20260910.cjs`: seven cadence, collision, mute, material, boundary, variant and playback-failure groups.
- `tests/test_home_countryside_v387.cjs`: actual five-mile scale, passive marker, coordinate-preserving handoff, forge shortage guard, and all three worker lists/updater.
- Existing geographic core, scene, save-replacement, home, scan-home, audio, market, worker and map regression tests.
- `tests/run_home_countryside_v387.cjs`: disposable full-app browser saves; phone/desktop measurements, native modal routes, MP3 decoding and native walking playback, village boundary and touch flight. `--provider` uses actual OpenFreeMap/Mapterhorn responses; other map runs use explicit synthetic vector/DEM fixtures. Runtime/evidence paths can be supplied through environment variables.
- Browser rendering uses software WebGL in the local test environment; its frame times are not a physical-phone performance claim. Native movement checks wait for distance rather than assuming a fixed number of frames per wall-clock second.
- Audio files were decoded and measured, with native playback verified. The model cannot hear audio; user previews are supplied without claiming human audition.

All changed module URL pins and six runtime MP3s are present in BURBZ_ASSETS, BURBZ_CORE, BURBZ_INSTALL_REQUIRED and the legacy updater. Unchanged modules retain their previous release pins. Existing release-test CURRENT_BUILD labels advance together; no save format, GPS, reward, sound-listener or economy authority is changed.
