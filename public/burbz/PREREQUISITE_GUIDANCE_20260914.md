# Forge prerequisite guidance — unpublished handoff

Base: owner integration commit `a54484d7`. Separate worktree: `work/parallel/prerequisite-guidance`. This does not change the completed navigation worktree/commit or delay v416.

## Implemented scope

`prerequisite_guidance_core.js` provides a reusable read-only prerequisite graph resolver with bounded traversal, cycle/unknown-source reporting, shared-dependency/action deduplication, full shortage lists and an audited Forge plan adapter. Facts and actions come from the caller; resolving a graph cannot spend, award, navigate or save.

The first connected UI path is a blocked **Forge recipe → missing materials → built Magpie Market**, or **Market construction → actual trainer level / coins / timber → an available existing action**. Rarer recipes separately resolve the actual Forge-level upgrade and its real costs. Busy anvils route to the actual queue. These are different level/stock requirements, not substitute unlocks.

The adapter reads all 36 current recipes from `loot_crafting_core.js`, Market sellable-material membership and live buy quotes, the real Academy building configuration and progress locks, trainer/Forge levels, inventory, completed/in-flight errand rewards, receipt exclusions, the active Player Quest and actual dispatch bird readiness. Market costs are currently level 4, 135 coins and 28 timber; none are duplicated as runtime constants. Current repeatable starter Find Coins and Branch Run provide the audited coin/timber/XP routes. Existing ready returns/quests take precedence. If birds are busy or need care, the route says that and opens their real progress or care view. An unfinished opening points back to the actual opening objective instead of inventing an unlocked errand.

Multiple missing ingredients remain visible. Purchase budgets reserve the original recipe or upgrade coins; shared/overlapping budgets are explicitly not summed. After every action the player can recompute the next step. Unknown/non-purchasable materials stay explicitly unsupported, never receive an invented source. The unbuilt Market is never offered as the place to fund its own construction.

A dismissible native dialog explains the chain. A non-floating banner on Forge, Academy, Market rooms and Quests retains the selected recipe and offers **Next step**, **Return to recipe**, and **Stop tracking**. Returning highlights/focuses the exact original recipe. Buttons open existing Market rows, build cards, upgrade controls, quest send/return sheets and ready Player Quest claims; they never purchase, build, send or claim. Stale choices are re-resolved before routing. Only the existing successful durable craft commission clears the tracked goal; failed or blocked work retains it.

## Files and integration

- `index.html`: one new pure-module script URL, small guide CSS, Forge adapter/dialog/banner functions before `renderForge`, recipe identity markup, help access for blocked level/full-anvil buttons, narrow blocked Forge/Market-building/purchase/upgrade guards, and bounded banner refresh after navigation and ordinary header updates. Existing economy transactions and confirmed reset/Settings/Home implementations are unchanged.
- `prerequisite_guidance_core.js`: generic resolver and facts-only Forge graph builder.
- `sw.js`: the new exact module URL in all three existing asset lists. No global cache/build version bump.
- Two Node tests in `tests/`.

The sole release owner must include `prerequisite_guidance_core.js?v=prerequisite-guidance-v1-20260914` in the external guarded updater’s managed-file/pin list and assign the eventual release cache/build. That updater is outside this repository checkout. Do not publish this source directly or hold v416 for it.

## Verification performed

- `node tests/test_prerequisite_guidance_20260914.cjs`: passed every actual catalogue recipe, multiple shortages, partial purchases, reserve budgets, built/unbuilt Market, trainer vs Forge levels, queue limits, unavailable routes/sources, bounded cycles, and immutable facts.
- `node tests/test_prerequisite_adapter_20260914.cjs`: passed real blocked-craft no-spend behavior, invalid recipe handling, real commission/goal completion, Market/errand routing without automatic action, stale/gated route re-resolution and all three worker pins.
- `node tests/test_market_tabs_v389.cjs`: all nine real Market regression groups passed, including exact-price trades, invalid/stale quantity handling, all 36 collected craft sales, protected equipment, failed-save rollback/object identity, building gate, and crafted-arrow safeguards.
- Four legacy Forge/Market/trading pytest suites: **42 passed, 7 failed**. Every failure was reproduced against `a54484d7`’s `index.html`: obsolete release/module pins, an old direct-gate source expectation for `magpieMarketSell` whose gate now lives in `storesSellItem`, and an old coin-shortage harness missing `showCoinShortage`. No tests were weakened.
- All inline JavaScript, the new module and `sw.js` parse; `git diff --check` passes.

## Explicit remaining acceptance and coverage

No native browser was launched for this feature: the coordinator reserved the slot for camp retry, published v415 offline verification and full v416 opening/Home acceptance. The owner should test this feature afterwards at phone portrait/landscape/desktop: real blocked recipe → Market build prerequisites → earned resources → real build/purchases → exact original recipe → commission, plus keyboard/touch/dialog dismissal, simultaneous shortages, stale affordability, all-busy/resting birds, native save failure and goal-banner fit beside the new tutorial navigation.

The original recipe now persists in `gameState.prerequisiteGoal` as one versioned `{version, owner, recipeId}` record, scoped to the existing `photoProfileId`. Reload/app closure recovers the same recipe when entering Forge, Academy, Market or Quests, and each Next step recomputes from current authoritative state. No modal or action is automatically opened on startup. Missing/unknown/oversized/wrong-owner records are ignored and load sanitization keeps only a known recipe. New Game/default saves do not inherit the intent. Selection and Stop tracking use the existing durable/stale-tab save guard with rollback. Goal completion belongs inside the paid Forge commission transaction; a failed save retains the original goal, purse, materials and anvil. See `PREREQUISITE_PERSISTENCE_INTAKE_20260914.md` for the intake proof and native plan.

Coverage is **Forge recipes and their audited Market/build/upgrade dependencies**, not all game goals. Other building types, recruitment chains, equipment requirements, arbitrary ingredient supply routes, specialised quests, probabilistic gathering, transmutation, settlement economy and long-term trainer-XP pacing have not been connected/audited by this feature. The source graph can expose those later when their exact prerequisites and available actions are established. A route to earn XP is not a claim that one errand reaches level 4, and reviewing a waiting bird is not an immediate reward.
