# First-person casting groundwork — not connected gameplay

The user's target-location decision remains pending. The actual village/town/Academy/geographic walkers contain friendly actors and world interactions but no hostile fighters. Existing zombie squads live in the turn-based battle screen. There is also no current keeper combat-stat/health authority. Adding a keeper turn to a companion squad, or spawning roaming hostiles, would change meaningful combat and reward rules; neither has been silently invented.

The originating thread was asked to choose an existing-opponent first-person battle view or walking-world zombie encounters. **Do not enable this groundwork just by adding script tags. The requested full spell/equipment-effects feature remains blocked on this decision and subsequent integration.** HUD and ownership changes have a separate, preceding commit.

Implemented and tested here:

- `first_person_cast_controls.js/css`: separate right look stick and casting stick above it; hold/aim/release, independent move contact, Q/arrow-compatible keyboard input and right-mouse drag/release. Pointer identity, explicit/implicit capture loss, touch cancellation, blur, Escape, resize and teardown cancel safely. Listeners have their own abort lifecycle. No game-world hooks are installed yet.
- `first_person_spell_core.js`: normalized yaw/pitch launch vectors, swept sphere collision, obstacle occlusion, explicit opponent/HP/fainted target guards, fixed projectile/effect caps and lifetimes. Target resolution is injected by the host.
- `first_person_spells.js`: a THREE group on the host renderer with visible travelling spell meshes and expanding impact meshes; no new GL context, timer or independent animation loop. Host calls update/dispose. Geometry/materials are bounded and disposed. Solids should be a bounded collision set; do not pass an entire unbounded world into raycasting.
- A battle adapter reserves the existing actor/skill/turn, revalidates it, and invokes the actual `battle_core.resolveAction` on impact. Ember Wisp uses the genuine 35% adjacent-slot splash, Tempest 55%, Frost the genuine speed debuff, healing/cleanse the existing effects. Existing spell scrolls are reusable; there is no defined mana or ammo cost. Cooldowns remain own-turn based and are not reinterpreted as seconds.

Still required after the decision:

1. A real game route and actor authority: how the keeper joins/starts combat, authoritative base stats/health, and which actual saved/generated opponent squad is represented. Apply the existing Forge bonuses and potion effects to that keeper there; do not copy owned items into a second inventory.
2. World/battle host integration for target meshes/positions, direction, collision solids, the current borrowed frame, rendering, close/reset, navigation, save replacement and context loss. Target conventions must preserve friendly safety; battle splash adjacency must be represented spatially if the route stays turn based.
3. Final action/miss rule and costs: the groundwork resolves and spends the battle turn on a valid hit. Miss/terrain impact or lifetime expiry currently cancels the reservation without spending a turn. This behavior is not approved gameplay and must be decided with the real route. Lock/rollback or otherwise serialize state transitions while a projectile is in flight; the existing battle UI cannot remain independently active.
4. Existing reward/loss/potion/save integration, cooldown progression, reload policy, and application-level combat verification. No target spawning, virtual-walk quest rewards, world liberation or player health saves have been invented here.
5. Loader/three-list worker/updater registration, final release/cache promotion, world-owner coordination and production/offline verification. These files are deliberately unregistered.

Validation:

- `node tests/test_first_person_spells_v1.cjs`: 7 groups pass against real loot/battle cores. Tests cover normalized aim, swept hit/miss, travel before damage, actual primary and adjacent splash, real cooldowns, Frost/healing/cleanse, scenery/friendly/fallen target guards, stale/cancelled turns, no double resolution, and bounded expiry/disposal.
- `tests/run_first_person_cast_v1.cjs`: 6 native Chromium groups pass. Separate move/cast contacts, ordinary-look-only input, cancelled/lost captures/blur, Q/Escape, right mouse, and native Q release into rendered THREE travel/impact and real battle damage are verified. Screenshots/report: dedicated task `evidence/casting`.
- The browser combat test uses an isolated harness with synthetic combat actors created by the real battle core. It is **not** evidence of an existing production walking target or completed game route. Software WebGL only; no physical-device frame-time claim.
