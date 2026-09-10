# Pocket quest rewards — pending v382 integration

Both walking quests and side quests reward time with Burbz hidden (screen off or another app). After 60 seconds, the existing Trail Bonus gives up to 50% extra completion XP, in proportion to the active quest time spent hidden. It also gives an oak twig, a down tuft at 50% hidden time, and iron grit at 90%. The first qualifying finish earns Pocket Pathfinder in Profile → Achievements and records it in the diary. Live quest sheets explain the bonus; completion sheets and saved records retain minutes, multiplier, extra XP and materials.

The browser cannot prove physical pocket use or continuous outdoor movement. GPS can pause with the screen off; the copy asks players to check their route when needed. Existing GPS, distance and checkpoint authority stays in the quest modules. Rewards require completing the quest; abandonment pays no completion bonus. The prior 60-second threshold and side-quest XP cap remain, with the bonus applied above that cap.

`quest_pocket_core.js` accepts numeric walking timestamps and ISO side-quest timestamps. Each quest keeps its legacy `pocketMs` plus a small `pocket` object: hidden/suspended timestamps, total suspended time and last observed clock. Duplicate hide/pagehide events do not reset accrual. Visibility return, pageshow and startup bank a saved hidden interval, so timer throttling and process restart need no background interval loop. A single unseen gap is capped at 24 hours; negative clock deltas add nothing. Old saves without a hidden timestamp receive no invented past hidden time. Failed observation saves retain accurate in-memory visibility for the next save.

`questPocketSuspend(quest, now)` and `questPocketResume(quest, now)` mutate only the supplied quest, without saving. Detour switching must call these within its own durable transfer transaction. Suspended time contributes to neither hidden time nor the bonus denominator; resuming while hidden starts a fresh interval. Lifecycle observation reads only currently active quests.

Completion uses `quest-finish:<kind>:<id>:<startedAt>` receipts in the existing receipt dictionary. XP, materials, first badge, history, active removal and the receipt share one durable save; failure restores the snapshot. Walking's fallback story-scroll XP is deferred into that transaction. Existing chest receipts stay intact. Concurrent side finish taps are serialised, and an awaited claim rechecks quest identity before ending anything. Failed walking completion reopens the finish checkpoint for a valid arrival retry. Completion notifications run after commit using the coordinated claim adapter's optional deferred-effects array.

## Integration

This isolated feature branch does not publish or bump the release. Register `quest_pocket_core.js` and its chosen pin in the index, all service-worker shell lists and guarded updater before release. Integrate the v382 claim-hardening helpers (commit `ae36a67c`) and detour transfer hooks; retain the detour agent's explicit completion flow instead of the old automatic `endOffRoadSideQuest` body. Preserve both changes where the walking completion preamble or side completion sheet overlap.

## Verification

From the repository root:

```sh
python3 -m pytest public/burbz/tests/test_quest_pocket_v382.py public/burbz/tests/test_trail_mode_20260825.py public/burbz/tests/test_side_quest_20260720.py public/burbz/tests/test_offroad_side_quests_20260818.py public/burbz/tests/test_walking_story_quests_20260811.py -q
node public/burbz/tests/run_quest_pocket_v382.cjs
```

The new Node suite has 21 checks, including actual inline adapter execution, reload, old timestamp formats, suspension, malformed inputs, clock rollback, save failure, replay receipts, concurrent finish and delayed-claim identity changes. The five Python suites contain 35 passing checks.

The disposable browser runner starts a local server on port 8982. It accepts `PLAYWRIGHT_MODULE`, `CHROME_PATH`, `ASSET_ROOT` (hydrated `public/` fallback for local LFS pointers) and `EVIDENCE_DIR`. It uses simulated visibility/time and an isolated save: both real completion paths preserve the hidden interval through reload, roll back failed writes, pay only once and retain inventory/history/achievement on reload. `results.json` and the visible earned Profile badge in `achievement.png` are retained in `/root/burbz-pocket-v382-evidence/`. Browser errors: none. This is not a physical-phone or outdoor GPS test; the coordinating release owns installed/offline update and final public verification.
