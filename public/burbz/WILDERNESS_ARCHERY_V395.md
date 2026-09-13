# Walking combat: shadow crows, Fireball and fletching

Based on published `77e8a36aebdc08e8b88922ec5b6ab1e2113ac07c` (landscape atlas v394b). The existing release owner integrates and publishes this patch; the terrain, arrival scenes, realm atlas/minimap and paused 3D Merlin are outside this change.

## Encounters

The previous spawn radius reached 65 m but awareness ended at 32 m. A Node reproduction at x=12, z=20 filled all four slots with birds 38–40 m away; none moved or damaged the player over 30 simulated seconds. The revised encounter spawns at most a pair at once within 48 m, pursues within 60 m at 3.1 m/s (scaled by the existing effective SPD, including Frost), and keeps the four-actor hard budget. This avoids an instant four-bird pile-on for a new player.

A bird visibly winds up for 0.55 s, lunges for 0.22 s, then recovers for 0.35 s. Damage uses the existing physical Peck resolver, armour and barriers; readiness remains SPD/second with 100 units per beat. The hit rechecks distance, ground clearance to the player’s torso and wilderness eligibility, so the player can step away during the wind-up. Bird pursuit and body hits use the player’s existing walking footprints, so overhead foliage cannot make a walker immune. Trunks, buildings, water and unknown terrain still block walking; projectiles and splash keep the separate three-dimensional foliage checks. Safe settlements, homes, rooms, flight, hidden windows and unknown terrain retain their existing protection and cancellation rules. No loot, coins or GPS/quest rewards are added.

`wilderness_birds.js` builds an articulated crow from shared geometry: slate/ink plumage, layered ragged wing and tail feathers, ivory beak/claws, pale skull markings and purple eyes. Head, wings, body and legs animate independently; reduced motion removes the idle/walking oscillation but retains the attack tell. Each bird uses ten mesh draws and approximately 2,455 triangles. Nine geometries and four materials are shared across every bird and disposed once with the existing session. No textures, extra renderers, RAFs or asset requests are introduced.

## Fireball and ownership

The existing `ember_wisp` ID is unchanged, now labelled **Fireball (Ember Wisp)**. Its power 56, cooldown two beats, 35% splash, recipes and rarity are preserved. Fresh defaults move the existing one-copy starter scroll from the bag into `inventory.equipment['@player'].spell`; they do not grant a second item. New walkers with only a spell equipped select Spell automatically. Existing local/cloud inventories and loadouts remain authoritative and receive no migration, replacement or repeat gift. A player can equip an existing spare through the Satchel or commission the same inexpensive scroll there.

## Bow, arrows and the anvil

- **Wayfarer Bow** (`reed_bow`): common weapon, +8 ATK before existing Forge tempering; 20 coins, two Oak Twigs and two River Reeds. The normal common-gear timer applies (49.5 s). It occupies the same weapon ledger as companion equipment and cannot be equipped twice or sold while worn.
- **Six Reed Arrows** (`reed_arrow`): 6 coins, two Oak Twigs and one River Reed, 15 seconds. Arrows live in the existing `inventory.items` Stores bag and are a craft-only ammunition entry. They are excluded from raw material loot and Market buying. Spare arrows can be sold at the existing common-material price (2 coins each); their material resale value plus crafting cost equals the bundle sale price, so this introduces no buy/craft/sell profit loop.
- Satchel **Fieldcraft** and the Forge use the same recipes, three-job queue, real wall-clock timers and collect/cancel actions. Collection remains deliberate. Bow/scroll collections advance existing gear-crafting progress; arrows do not impersonate crafted gear or bird equipment. Arrow countdowns update text without replacing an active button.
- Commission, collection and cancellation now use durable save with in-place rollback, including the queue, purse, diary and exact material/output quantities. Failed writes leave no partial craft or duplicate collection. Existing gear commissions retain their IDs and recipes.

Walking bow release consumes one arrow and the attack's readiness in one durable transaction before launch. Missing/invalid ammo, equipment changes, stale save adapters and save failures prevent launch. Holding/cancelling costs nothing. Misses spend the released arrow. A normal projectile travels at 26 m/s with 2.4 m/s² drop, a swept collision radius of 0.06 m and the existing three-second/eight-projectile bound. Its actual shaft, tip and fletching follow its velocity; impacts use shared physical damage and real scenery/target collision. There are no recoverable arrow pickups. Companion turn-based combat retains the bow's equipment ATK and its existing move rules; arrow consumption belongs to the player's walking bow attack.

All changed dependency URLs use `wilderness-birds-v395-20260913` in index and all three service-worker lists, and the new visual module is in the guarded updater. The release owner promotes the global build/cache at v396 or later, preserving the now-published `living-desk-v395-20260913` Home release (`b15f2bf5361ecfb6f14d4a064349539a9c5ccb87`). The unique v395 dependency URLs identify these module bytes, not a replacement global release. Current first-person HUD/map modules keep their v394 pins.

## Verification

See the dedicated task's final handoff and `evidence/v395/` for Node transaction/AI/projectile/model tests, the native retained-scene browser run, screenshots and video. Browser terrain fixtures and software Chromium are identified separately from production and physical-phone performance. Three historical exact-markup/pin assertions were reproduced failing on the unchanged v394b base; their evidence is retained rather than weakening them.
