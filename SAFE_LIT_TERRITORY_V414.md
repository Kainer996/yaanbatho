# Lit-territory safety integration

Base: retained `3b63df91`. Isolated safety patch; no release pins, deployment,
new camp creation, progression AI, terrain, vehicle or uncommitted house changes.

## Shared authority

- `empireTerritoryLight()` derives circles once per changed saved geometry from
  the existing village/town district radii, county radii, enemy liberation
  receipts and `gameState.exploration.camps`. Camp contract: `{id,lat,lon,
  lightRadiusM}`; legacy missing radius defaults to 80 m. The camp worker owns
  placement and save normalization. Do not store a second territory map.
- `updateEmpireFogMask()` renders those same circles, including player camps.
  Soft edges belong to each full protected geographic radius. The separate
  moving scout half-light remains visual scouting, with no protection.
- `enemyOutpostDark(point)` now reads that same authority. Existing local
  unknown-terrain/home/settlement safety remains an additional fail-closed guard.
- `invalidateEmpireTerritoryLight()` marks the derived snapshot dirty.
  `durableSaveState()` and `restoreGameStateSnapshot()` invoke it; replacement
  game-state identity also rebuilds. Unrelated saves reuse the same index when
  the source-circle signature has not changed. If a future transaction exposes
  light before saving, invalidate immediately after mutation and after rollback.
- `walkingCombatAdapter().territoryLight.contains({lat,lon})` and
  `.firstHit(from,to)` are the geographic hooks. `firstHit` returns a fraction
  from 0 to 1 or `null` for an entirely dark segment. Invalid paths fail closed.
  The runtime uses the live `s.origin` for geographic scenes and retained
  `continuousWorld.record` for settlement walking; altitude never bypasses land
  protection. It no longer depends on rendered friendly-camp props.

## Enemy-worker hooks

`BurbzWildernessCombatCore` instances expose `hostileAt(point)`,
`darknessPath(from,to)`, `canHostileAttack(from,to=lastPlayerPose)` and the
transactional ground-hit helper `hostileAttack(actor,skill)`.

New aerial/ranged AI must use the geographic darkness path at launch, every
swept movement/projectile step, and actual impact/splash resolution. Check both
source and target when either enters newly lit land. Use the shared existing
combat transaction for damage. Do not treat actor suppression, retreat, stale
visibility or unloading as an HP-zero record. The retained baseline has no
hostile projectile engine; its existing ground melee is wired through the
transactional helper, and current player projectile/splash/pursuit boundaries
are guarded. New hostile aerial/projectile behavior still requires integrated
acceptance once the enemy worker supplies it.

## Verification

Passed locally:

- `node public/burbz/tests/test_lit_territory_safety_v414.cjs`: 10 focused groups,
  covering circles/overlaps, geographic seams, tiny tangencies, 10,001 indexed
  circles, canonical source and scout separation, save/rollback/reload/rebase,
  current projectiles, immediate light, splash, chase, melee, elevated guards,
  defender/XP preservation and damage rollback.
- Existing Node suites: 12 combat groups, 6 outpost groups, 5 outpost-save groups,
  and 4 settlement-boundary groups.
- Relevant Python map/region/combat invocation: 32 passed, 1 failed solely
  because retained WIP has no `scripts/update-live-burbz.sh`; the unchanged
  offline dependency test tries to read that missing release fixture.
- Modified JS and all four executable inline HTML scripts parsed; diff check
  clean. Uses existing modules already in offline asset lists; release owner
  must update the integrated build/cache pins normally.

Node-only query microbenchmark with 10,001 circles: initial index 23.95 ms;
combined point-plus-segment query mean 0.0020 ms, p95 0.0036 ms, p99 0.0061 ms
(after warmup). Unrelated saves do not rebuild the index. This measures pure
queries, not renderer frame time, phone performance or browser integration.

Remaining release-owner checks: resolve overlapping index/combat edits with the
camp and enemy workers; supply release fixture and combined cache pins; run real
boundary flight/combat/map visibility and installed/offline save retention on
merged bytes. No live player save was accessed or modified by these tests.
