# Prerequisite goal persistence — integration intake

Prepared in the isolated `codex/prerequisite-v417-intake` worktree, based on the existing reviewed handoff `377be5432d2e8aacd1be27f9c2e2648c17ac808f`. The original implementation and owner v416 checkout remain untouched. This is a narrow continuation of the Forge/Market prerequisite adapter, not a second implementation.

## Change

One canonical `gameState.prerequisiteGoal` record holds only `{version:1, owner:<existing photoProfileId>, recipeId:<known catalogue ID>}`. The getter always reads current game state, so reloading, switching to a loaded save, or resetting cannot leak an old page variable into the new game. Invalid versions, owners, recipe IDs, oversized IDs and malformed records are rejected. Unknown fields, including saved actions or quotes, are discarded on normalization. Actual ownership/profile rules are unchanged.

Selecting a goal and Stop tracking use `durableSaveState({throwOnFailure:true})` and restore the previous field on write failure, including the existing stale-tab guard. Reopening the same valid goal does not write again. Plan reads never save. Purchases, errand dispatch/rewards and navigation remain under the original controls.

Completing the matching paid Forge commission clears the goal **inside** `forgeCommitChange`, in the same serialized save as spent ingredients/coins and the new job. Failed writes restore the goal and the existing live inventory/quest references. An unrelated craft leaves the goal intact. Reload recovers the goal’s banners in the four already connected screens; it does not pop a modal or navigate automatically from Home.

Read-only review retained the original graph boundaries: all 36 current Forge recipes; separate trainer/Forge gates; real Market construction, coins and timber prerequisites; bounded cycle/unknown-source diagnostics; reserve budgets; partial quantities recomputed after purchases; and explicit unavailable readiness paths. An unbuilt Market is not its own supply source. Academy Market construction is currently immediate after the actual native build/placement, so no invented construction timer or completion claim was added.

## Verified here

Commands run from the repository root:

- `node public/burbz/tests/test_prerequisite_persistence_20260914.cjs` — **8 groups pass**: bounded known records; separate app-session recovery; reset/replacement isolation; stop and failed-write rollback; stale-tab rejection; atomic successful/failed commission; unrelated commission; quantity/budget recovery from current state.
- `node public/burbz/tests/test_prerequisite_adapter_20260914.cjs` — original adapter checks pass, updated for the saved getter; actual blocked craft stays read-only, routes open existing controls, stale/gated choices re-resolve, three worker lists remain present.
- `node public/burbz/tests/test_prerequisite_guidance_20260914.cjs` — original graph/all-catalogue, partial purchase, separate gates, unavailable route, cycle and immutable-facts checks pass.
- `node public/burbz/tests/test_market_tabs_v389.cjs` — **9 groups pass**, including all 36 collected crafted items, player/bird equipped protection, exact trades, invalid input and failed-save rollback.
- New module and all inline scripts parse; `git diff --check` passes.

No browser, global build/cache update, updater edit, merge or deployment was performed by this intake task. The original `v1` script pins are unchanged and must advance together in index/all three worker lists/the guarded updater in the coordinated release, because the core now exports `normaliseTrackedRecipe`. Original unrelated Python baseline exclusions remain documented in `PREREQUISITE_GUIDANCE_20260914.md`; they were not rerun or claimed fixed here.

## Native acceptance plan for the release owner

Use a disposable test save, never the user's current inventory. Serialize these runs with the owner's existing browser queue.

1. **Existing Market / multiple materials:** choose an actual blocked Forge recipe such as the existing Wayfarer Bow. Open its guide, verify the actual missing ingredient quantities, follow a Market row and buy only part through the real Buy control. Next step must show the remaining quantity and reserve recipe coins. Reload, visit Forge/Market/Quests and recover the same goal. Complete the remaining native purchases, Return to recipe must focus that exact card, and explicitly commission it. Saved coins/materials/job and removed goal must agree after reload; no automatic purchase or duplicate job.
2. **Unbuilt Market / low trainer level and stock:** open the same real recipe from a save with no Market. Verify trainer level, Market coins/timber and actual available XP/resource errand controls. Exercise a native send/return through the existing authority, then revisit the guide. It must not route funding back into an unbuilt Market or promise that one errand supplies every level. Build through the actual Academy build/placement once affordable; the goal survives waiting/reloads and offers the built Market afterwards.
3. **High rarity / busy or unready birds:** verify the Forge upgrade uses actual upgrade materials/coins separately from trainer level. With all birds busy/resting, show their actual job/care view; do not dispatch automatically. A full anvil offers its existing queue. Already collected expedition receipts and claimed Player Quests must not be offered again.
4. **Persistence failures:** simulate localStorage quota and a second-tab save on disposable profiles. Failed tracking/Stop must retain the previous goal; failed commission restores goal, purse, ingredients, inventory object identity and queue. Reload after a successful Stop must stay stopped. Confirm New Game follows the existing movie flow without retaining the old goal. Load a different-profile save and ensure old intent is ignored.
5. **Phone/desktop and focused tutorial:** portrait390×844, landscape844×390 and desktop1280×800. Check dialog scrolling, Escape/tap dismissal, visible 44px buttons, banner layout alongside the new tutorial navigation/Settings, keyboard Return-to-recipe focus, no obstructed Market quantity controls and no uncaught console errors. Test offline after the coordinated worker/updater pins are verified.

## Limits

Native browser, production and offline validation are pending at handoff. This feature covers Forge recipes plus audited Market/build/upgrade dependencies; it does not claim that every blocked action elsewhere in the game has guidance. Other building/recruitment/equipment/settlement or unsupported material acquisition chains remain explicitly outside this connected adapter. This change adds no grants, recipes, revised prices, saved routes or new game identity.
