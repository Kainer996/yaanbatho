# Pocket quests and saved detours v382

Build: `pocket-detours-v382-20260910`, based on merged v381 `c2de0ed9`.

Walking and side quests save hidden-page time across screen locking and reloads.
A qualifying finish adds up to 50% completion XP, useful crafting materials and
the first Pocket Pathfinder achievement. Completion, reward, history and receipt
share one durable save. Suspended quests accrue neither hidden nor active time.

After at least 40 minutes away from the original route, a new fresh accurate
fix at least 500 metres away starts a detour. Screen-off/reload gaps preserve
the saved start; missing/stale GPS cannot start it, and an observed accurate
return inside 500 metres resets the wait. Returning near the route never ends
an active detour. **Resume Original** works immediately anywhere, preserving the
whole side quest and its unclaimed finds under **Continue Saved Detour**. Neither
switch grants or remotely collects a reward. Four saved themes vary the guide,
objective and first discovery using existing loot, allies and Wayside Tales.

All map discovery types now save rewards and claim flags before showing success.
Failed saves restore their state, and retries cannot double-pay. Side completion
rechecks active identity after awaited claims; in-place quest state transfers
make this guard apply even when Resume Original is tapped during completion.
Failed walking completion resets the restored finish for a fresh GPS retry;
failed detour transfers stop the current fix from updating a detached quest.
Explicit abandonment rolls back on save failure. Legitimate active-route changes
refresh detour distance evidence before suspension.

V381's 185 m yellow collection circle and fresh-GPS guard remain; walking chests
retain independent 45 m reach, other checkpoints/finish stay ordered, and routes,
6 m trail edges, landmark models and command-centre startup remain unchanged.
The changed side-trail core and new pocket core share the v382 URL pin in index
and all three service-worker lists. Unchanged v381 modules retain their own URLs.

Technical details and reproducible checks:
[POCKET_QUESTS_V382.md](POCKET_QUESTS_V382.md) and [DETOURS_V382.md](DETOURS_V382.md).
All 76 combined focused Python checks pass; included Node suites exercise the
actual transaction and suspension seams. Evidence is recorded in
`/root/burbz-v382-release-evidence/integration-focused.txt`.
The coordinating release owns full-app, installed/offline and public checks;
this integration commit does not publish the build.
