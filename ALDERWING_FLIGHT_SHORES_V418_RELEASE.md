# Alderwing aircraft, flocks and countryside v418

Build: `alderwing-flight-shores-v418-20260915`.
Runtime checkpoint: `b57023e3adcfcb53d950533f42482182cbd219b9`, based on deployed v417/main `314f0a3dd9b710c89457510cbe82456df1b4bc81`.
Status: merged and published; local and actual public acceptance complete.
Runtime release: [PR355](https://github.com/Kainer996/yaanbatho/pull/355), merge `a005c4ccc1406980e51e28020e522d011224b93c`.

## Result

- One free flapping-wing craft is parked near the saved home. Board, take off, steer, land and step out through the actual world controls. Its real coordinates appear on the map and persist with the player journey in the same guarded save. Interrupted flights resume aboard the same craft; incompatible travel cannot strand it. Failed saves retain the previous state. Wounded players can still steer, land and return to safety.
- Swipe-to-Auto requires actual aircraft occupancy. Partial/cancelled swipes refuse to latch; manual input, landing, exit, death, modal capture and disposal clear it. Right-thumb steering and attack input coexist. Airborne health, equipment and attack warnings remain visible; controls fit five tested screen sizes.
- Chickenz begin the hostile roster. Actual Forge upgrades plus discovered/recruited bird families introduce Ravenz, Peregrinez, Eaglez, Hawkez and Owlez. New camps retain their chosen species alongside existing HP and reward receipts. Flyers take off, spread out and coordinate warned dives with real collision, darkness and combat authority; a fixed dive point allows dodging. Ground Chickenz are gentler than the later flyers. The Forge threshold and combat values are implementation tuning, not user-specified level/order requirements.
- Freshwater and sea landings use real loaded water surfaces. The craft floats gently on freshwater and more strongly at sea, with damped, reduced-motion-aware animation. Safe shore exits and an afloat deck permit reboarding without an invented drowning system.
- Water polygons colour the existing terrain through cached antialiased coverage. Original coordinates, islands, holes, narrow channels, collision and terrain topology remain intact. Full-water chunks share a material; mixed chunks use one 128×128 coverage texture. Shared sample columns match across chunk seams, and retired chunks dispose their textures/materials. Water ripples use the retained renderer.
- Yaan chose mapped grassland and heath. Explicit grass/grassland/meadow and heath/fell polygons thin deterministic trees and subtly change grass colour, with gradual edges. Mapped woodland takes precedence. Missing or unrelated landcover does not become invented open countryside. Tag interpretation follows the [OpenMapTiles landcover schema](https://openmaptiles.org/schema/#landcover).

## Verification

- Fourteen focused source suites pass: craft/save/wounded handling, enemy progression and obstacle/light boundaries, outpost persistence, geography/terrain, initial-home races, prerequisites and opening transactions.
- Native aircraft: eight groups, including boarding-save failure, five viewport layouts, touch Auto with simultaneous look/attack input, native landing/exit and reconstruction. The disposable fixture returns to its original collision-checked berth before landing.
- Native airborne camp: eleven groups, including natural camp discovery, genuine flying defenders, aircraft Fireball attacks, atomic liberation, native landing/exit, responsive camp controls and saved friendly return without repeated XP. Travel/aim use explicitly guarded test placement; enemies and damage are not injected.
- Full opening: six groups through the real shelter, Birdhouse, denied/cancelled discovery, companion play, earned Kitchen supplies and the real meal transaction.
- Live-provider candidate: four groups with successful live elevation/vector responses, native Camps controls, movement on the retained canvas and save-preserving exit/reload.
- Freshwater/sea transitions and mapped-heath rendering pass with synthetic provider inputs. Standalone runtime models and shoreline seam/channel/disposal checks pass.
- The exact final v417→v418 installed update passes six groups: all14 changed modules plus the document/movie match, craft/save data survives, and offline New Game, real movie playback/seek, Skip, Settings cancellation and restart retain the correct state.

### Shoreline comparison

The baseline retains the aircraft integration but uses the pre-shoreline world renderer. Each surface has three 180-frame samples in the same desktop/software-WebGL setup. Median mean frame times:

- Freshwater: 54.16 → 49.26 ms; median p95: 83.4 → 66.8 ms.
- Sea: 44.72 → 45.46 ms; median p95: 83.3 → 66.8 ms.
- Matching scenes retain 106/84 draws and 46,100/20,580 triangles. Visible texture counts increase by three/two, or 192/128 KiB of RGBA coverage. Full-water chunks require no coverage texture.

There is no meaningful slowdown detected in these samples; between-round variance exceeds the sea mean difference. These are desktop measurements, not physical-phone FPS or real GPS fieldwork. Synthetic geography is kept separate from the live-provider check. One real location does not prove worldwide coverage.

## Release integrity

Fourteen changed JS/CSS URLs agree between their consumers, all three worker lists and the guarded updater. The global build/cache is promoted together. Existing Home/tutorial, prerequisite guidance, camps/light, farming, equipment, durable photos, the shared £5 monthly Gemini guard and sound recognition remain intact. No paid recognition requests are used by these tests.

Full evidence is retained at `/root/burbz-remaining-v418-evidence/`; `reports/BURBZ_V418_VERIFICATION.json` records local checks and exact hashes; all16 live file hashes match. Actual public real-provider world passes four groups, and installed/offline public acceptance passes six groups with zero page errors. GitHub Pages workflow34953878564 succeeded; the guarded live marker matches the runtime merge. Rowan's user-authored story remains paused.
