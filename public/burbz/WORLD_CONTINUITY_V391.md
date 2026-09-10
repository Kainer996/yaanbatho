# Continuous settlement countryside — v391

Walking past the old village or town radius now extends its existing scene into geographic terrain. The borrowed canvas, camera, player, heading, lights, actors, input and frame loop survive outward and return travel. There is no boundary-triggered renderer replacement, fade or teleport. Landscape v388, Buy/Sell v389 and Merlin 2D v390 remain installed. This release also integrates the finished first-person equipment/combat feature and the canonical Merlin equipment-owner fix. It contains no Blender/3D Merlin work.

## Terrain and appearance

`village_world_core.js` uses real geographic metres, decoded DEM elevations and immutable 32 m terrain chunks. The authored ground joins DEM-relative elevation through a smooth 64 m grade; unknown DEM is never interpreted as zero. The visible mesh and walking collision use the same 2 m triangles. Source bridge clearance remains authoritative.

`village_world.js` borrows the exact source ground, textured road, river, tree geometry and material colours. It replaces the finite ground disk during the visit with a continuous grid. Original roads and rivers continue across the old edge with terrain-following strips and gradual natural narrowing. Original source buildings, villagers, harvest nodes and paid rooms remain in place. Trees use fixed geographic identities and positions; retained chunks are never rebuilt when a boundary is crossed or the camera turns. Nearby settlements/home use the existing canonical models and saved records.

MapLibre decodes real provider tiles in a bounded offscreen host. It never becomes the visible first-person scene. Fixed-density instanced trees, frustum culling, cached shadows and omission only of geometry beyond opaque atmospheric fog bound rendering work. Tree count and visible density do not change with frame rate. Horizontal fog and the matching depth-ink calculation retain visible ground from flight altitude and avoid outlines of fully fogged trees.

The streaming window is 11×11 chunks; the full visible horizon must exist before ordinary movement advances. Prefetch builds nearest missing chunks first and retains decoded DEM/vector data through tile turnover. A missing initial DEM offers a usable Return action. A genuinely unavailable future horizon retains the last valid pose and tells the player what is loading. Loading-stop frames/time are recorded separately from render frame time and movement integration. No GPS fix, physical quest progress or reward is inferred from virtual movement.

## Controls and ownership

Touch/keyboard movement, turn, takeoff, climb, descent and landing share the same scene. F remains contextual at a real doorway; otherwise it changes walking/flight. The native movement/look controls allow Space to climb after touch focus, while actual action buttons retain keyboard activation. Building entry hides outdoor flight controls immediately; leaving restores the same outdoor world.

The completed HUD, equipment and combat feature reuses `inventory.equipment['@player']` and the existing Forge definitions, battle rules and atomic save conventions. Combat is restricted to confirmed wilderness; source/canonical settlements, homes, rooms and unknown coverage are nonhostile. The projectile collision hook uses the same terrain/building/tree collision without repeatedly checking the camera-wide streaming horizon. Unknown point elevation remains blocked. See `FIRST_PERSON_EQUIPMENT_V1.md` and `FIRST_PERSON_COMBAT_V1.md` for bounded simulation, potion/refill, cancellation and persistence rules.

Merlin equipment validation uses `getBattleFlock()`, the same canonical roster as the Forge, without inserting the guide into the saved flock. Merlin, saved companions and the player share actual owned copies; invalid owners and failed durable writes cannot mutate equipment. Market Sell can sell spare copies only.

## Release and recovery

Changed runtime modules, lazy walking loader pins, forest worker import/URL, all three service-worker lists and the guarded updater use `continuous-world-v391-20260910`. Unchanged Merlin 2D pixels/config/renderer remain on v390 and landscape modules on v388. Existing save schemas and unrelated source/art remain intact.

The release goes through the existing reviewed branch, main merge and guarded VPS deployment. Verify exact public bytes, deployment marker and real installed worker cache before reporting publication. The prior managed files and marker are backed up before promotion. Return/exit restores source ground/corridor visibility, fog, light targets, camera, renderer sizing and shader hooks, and disposes streaming, combat and UI resources. Failure does not delete the saved settlement or player inventory.

## Verification evidence

Core tests cover exact DEM/null handling, ground/slope continuity, rendered triangle collision, immutable tree IDs, original building collision, geographic metre conversion and river/road clipping. Shared gear tests cover all 35 Forge definitions, Merlin and companion ownership, last-copy exclusivity, atomic failure/rollback, reload, potion costs and Market protection. The ink renderer is checked against actual THREE projection and its existing disposal/fallback contract.

Native browser evidence uses disposable saves, actual game/THREE/MapLibre rendering and native timers. Deterministic DEM/vector fixtures are explicitly separate from the real-provider run. Checks include held native touch/keyboard outward movement, a 180° turn and forward return, retained scene/camera/chunk identity, zero routine loading stops, flight, roads/rivers, paid interiors, original harvesting and saved geographic pose. Frame-time evidence is software Chromium/touch emulation, not a physical-phone performance claim. Exact results, screenshots, videos and production verification are recorded in the release owner's `continuity-v391` and `release-v391` evidence directories.
