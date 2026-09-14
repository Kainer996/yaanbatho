# Camp reliability slice

This is an unpublished patch on retained `38e99189` (itself based on unfinished
camp WIP `3b63df91`). It requires the existing enemy-outpost modules/index save
adapters and the complete shared-light patch described in
`SAFE_LIT_TERRITORY_V414.md`. It is not a cherry-pick for the live v415 baseline
by itself. No deployment, global build/cache pins, player camps, house placement,
Home, tutorial, story or new enemy AI are included. The one extra walking
startup hunk is an essential prerequisite described below.

## Behavior

- New camps require three distinct valid defender positions connected to one
  actual walking approach with clear camera-to-body shots. Preferred slots may
  fall back to bounded nearby positions around real trees, rocks and camp cover.
  Placement never removes scenery or relaxes projectile/walking collision.
- The layout probe yields between candidate checks into the existing 2 ms scan
  budget. It has no timer, RAF, renderer or unbounded pathfinder of its own.
- Saved camp coordinates/member IDs/HP remain authoritative. Saved layouts are
  checked again against loaded ground; missing or blocked ground leaves guards
  pending and retries. Newly streamed obstructions can suppress a blocked live
  actor, but its saved HP remains available for the next valid placement.
- A saved friendly flag can reload on known ground inside its own saved light.
  The former unconditional hostile loading gate hid these flags. A saved hostile
  camp that becomes lit remains suppressed and undefeated.
- Existing atomic damage/XP/liberation, saved friendly ownership, 180 m light,
  5 coins/hour income with a 60-coin cap, trusted clock, one-time collection and
  durable-save rollback retain their canonical authorities. There is no second
  territory map and no synthetic defeat endpoint.

## Essential walking prerequisite

The retained `village_walk.js` called `BurbzVillageWalkCore.autoFlight()` before
its own `load()` loaded that module. First opening could stop with `open:true`,
`ready:false`, `frames:0` before any walking CSS or dependencies loaded. The
first browser attempt reproduced that exact state and timed out after 90 seconds.

The coordinator authorized this minimal dependency repair: create Auto only
after `load()` resolves, tolerate reset/keys while it is pending, and ignore
movement pointer starts until it exists. The existing gesture state machine is
unchanged. Three new initialization groups verify genuinely absent core loading,
close-before-load cancellation and the actual Auto latch/reset behavior. The
native proof does not preload or stub the walking core.

## Proof correction

The older `/tmp/burbz-outpost-proof/results.json` showed all three real guards
alive in guard phase for about 228 seconds. Its 45 attacks came from a single
position behind cover, with impacts before the targets. That failure was not
proof that defenders had failed to spawn.

`tests/run_enemy_outposts_v414.cjs` now requires a real clear landing connected
to the checked approach, follows the collision-tested route with native walking,
and checks actual camera-to-body line of sight before native attacks. It asserts
three defenders, the 120 XP delta, zero saved HP, friendly status, exit/reload,
and return visibility inside the outpost's light with no resurrected defenders.
Debug access is limited to the existing localhost travel/aim and read hooks;
no enemies or damage are injected. It uses a disposable save and deterministic
DEM/vector fixtures, not a player's save or live geographic coverage.

## Validation

Passed locally: six new controller/combat reliability groups, six existing
outpost groups, five save/rollback groups, eleven shared-light groups, twelve
walking-combat groups, thirteen archery groups and four settlement-boundary
groups. The existing articulated bird geometry/lifecycle test also passed using
the already-present local Three.js runtime fixture.

The focused Python invocation returned 3 passed, 1 failed. The sole failure is
the retained WIP's missing `scripts/update-live-burbz.sh`, already documented by
the shared-light patch. That release fixture and exact module pins belong to the
release owner; this patch does not invent them or claim that check passed.

The first native attempt failed before scene initialization because of the
walking dependency fault above, with no page errors or camp checks reached.
It is preserved under `bootstrap-failure/`. A corrected actual-runtime retry is
queued; native camp acceptance is not yet claimed.

Evidence directory:
`/home/yaan/Documents/Codex/2026-09-10/realtime-voice-chat-2/work/evidence/camp-reliability-v414/`

## Integration and remaining limits

The sole release owner is task `01a0777f-3e39-7982-bf6e-15ebca86308e` (Burbz visual
polish implementation). Integrate the retained camp scaffolding and shared-light
prerequisites first, then this bounded slice. Preserve the three new callbacks
passed from `wilderness_combat.js` to outpost attachment (`allowed`, `clear`,
`walkClear`) and the narrow camp-obstruction removal hook in the combat core.
Also keep the deferred Auto initialization/cancellation fix in `village_walk.js`;
the native proof must start with its module genuinely absent, as on first open.
Future enemy AI must retain `hostileAt`, `darknessPath`, `canHostileAttack` and
`hostileAttack`; no future aerial behavior is supplied or validated here.

Before publication, resolve overlapping owner edits, update all consuming module
URLs/three worker lists/updater pins and global release markers, and verify the
combined installed/offline build with real save retention. The approach probe is
local; it cannot guarantee worldwide terrain connectivity or clear every camp
on every real terrain tile. Where no valid layout exists, the roster stays
pending with its saved HP rather than claiming victory. Native desktop fixture
proof is not phone-hardware or real-world terrain acceptance.
