# Saved off-route detours

A walking quest opens a side quest only after the player has been at least
500 metres from its original route for 40 minutes. The off-route start is saved
on that quest. Legitimate route changes while it is active refresh the distance
baseline and restart the wait; suspension preserves that final original route. Screen-off time and app restarts retain it; a new accurate GPS
fix must confirm the player is still far away before switching. No timer,
missing fix, replayed timestamp or stale fix can start a detour. A fresh accurate
fix inside 500 metres resets the wait. Fixes need finite coordinates and accuracy
0–80 metres, a timestamp no more than two minutes old, and no future timestamp.

The map HUD and quest log show **Resume Original**. It works immediately from
anywhere, with no GPS requirement and no reward claims. It moves the whole side
quest to `sideQuest.suspendedDetour` and returns `walkingQuests.suspended` to
`walkingQuests.active`. **Continue Saved Detour** reverses this. Original route,
checkpoints, rewards, receipts, encounters, future fields and every unclaimed
side find remain intact. Only one quest progresses at a time. A different new
quest cannot overwrite a suspended original. A saved detour can also be resumed
after its original has completed or been explicitly abandoned.

Proximity never ends a side quest. Only the existing explicit End Side Quest
flow completes it. That flow retains the collection-circle and durable reward
guards; resuming the original does not call it. Legacy saves with both a main
quest and its automatic side quest freeze the main quest until manual resume.

Switches snapshot state, suspend/resume the pocket clock through the agreed
`questPocketSuspend(quest, now)` and `questPocketResume(quest, now)` hooks, and
commit both quest records in one checked durable save. A failed save restores
both records and pocket ownership before changing the map; the GPS handler exits
if rollback replaced its captured quest object. Explicit abandonment is also
checked and rolled back on save failure. Switching pays no XP,
items or completion progress. Walking distance restarts its last-fix baseline
on resume; side trail segments retain their saved points without drawing or
counting a connector across the suspended journey.

Four saved themes vary guide, purpose and initial discovery: the Hedgerow Post,
Inkwing’s Missing Margins, the Quiet Watch and the Gleaner’s Lantern. Existing
provision bundles, gear, local bird companions and twelve Wayside Tales supply
the discoveries. Theme and first find are stable across resumes and reloads.

## Verification and integration

- `python3 -m pytest -q public/burbz/tests/test_detours_v382.py public/burbz/tests/test_offroad_side_quests_20260818.py`
- `node public/burbz/tests/run_detour_controls_v382.cjs`

The Node suite exercises pure timing and reference transfers plus extracted real
index adapters: exact boundaries, hidden/reload gaps with fresh confirmation,
invalid/stale/replayed fixes, original-state preservation, legacy migration,
double taps, save rollback, unclaimed-find retention, no payout and path breaks.
The browser runner uses production switch functions and actual HUD DOM/CSS at
320×640, 390×844 and 844×390; it verifies visible 44px touch controls, save-failure
rollback, resume without GPS/claims, serialized reload and continue. It is a
focused controls fixture, not a full MapLibre/provider or installed-PWA proof.
Evidence: `/root/burbz-detours-v382-evidence/controls-results.json` and screenshots.

The combined build registers both changed cores at
`pocket-detours-v382-20260910` in index, all three worker lists and the guarded
updater. Pocket-clock ownership and claim hardening are integrated. Transfers
update existing state containers in place, so a completion awaiting a discovery
claim observes suspension and exits before completing the saved detour.
The release coordinator owns full-app/offline and post-publication verification.
