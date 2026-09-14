# Motivated opening integration slice — 14 September 2026

Prepared from verified live `48ea7df10cfc6ea94cef5cb00837b214f28ff0d2` in its own detached worktree. This is not a release: no build/cache bump, push, deployment or real-player reset.

## Behavior

The guided order is now Home arrival → Birdhouse → discovery and the actual bird card → companion interaction → Kitchen need → real construction shortage → earned supply delivery → Kitchen construction → actual meal → next real discovery. The Player Quest selected during this opening follows that same action; existing unclaimed rewards remain available afterwards. All original quest IDs, amounts and completion facts survive. Training, battle and settlement quests follow this opening.

The discovery action opens the existing photo/sound flow. Reviewing an actual saved species card records the lesson; dismissing that card advances it. The immediate **Continue with Merlin** control records an honest deferral. It neither creates a species nor claims discovery/recruitment rewards. A late photo can still enter through the existing verified queue unchanged. Merlin's real care/play interaction makes companion utility usable without a wild discovery or permissions.

Kitchen construction is withheld until that discovery choice and companion interaction, except when already owned or the earlier tutorial was completed. The construction price is unchanged: 130 coins and 25 timber. An actual failed affordability check records the shortage and reveals errands. The screen's Player Quests remain available before errands; ordinary errand drawers and First Flight no longer advertise themselves then. Existing expedition activity remains accessible.

The Birdhouse gift remains exactly 60 coins / 8 timber, once per save, committed transactionally. The old direct Kitchen gift and repeated tutorial ration/hunger mutation are retired. Only a **fresh default** Merlin starts at 60 hunger, ready for the later existing meal; existing care is never overwritten.

First Flight still uses its existing internal template and five-second duration (the existing hungry multiplier may make it ten). Its one-time building delivery guarantees at least 130 coins, 25 timber and one falcon ration **after** ordinary carrying calculation. Ordinary expeditions keep their real carry limits. Existing larger promised rewards are retained. This funds construction even with an empty purse, without requiring Player Quest prizes. A stockpiled player builds immediately and gets no fictitious shortage.

A durable `opening:kitchen-supplies-v1` receipt and `tutorialFlow.openingSupplyReturnClaimed` guard the delivery. An old pending First Flight can receive the supply upgrade at its real claim after a shortage. An old already-claimed tiny First Flight keeps its claim and earnings; if the Kitchen is still missing and genuinely short, it may fly exactly one newly introduced supply delivery, tracked separately. This is an explicit bounded compatibility allowance, not a reset of its old receipt. Repeated sends/claims cannot farm it. Spending that earned delivery elsewhere does not replenish it; ordinary errands remain available for recovery.

The Birdhouse construction/60 XP, starter gift, expedition send, expedition claim, Player Quest rewards and shared single-food Kitchen transaction now commit their relevant state together before success effects. Failed writes roll back. The Kitchen meal uses the existing diet/food/bond rules; an already-fed save is acknowledged without fabricating hunger or consuming food.

## Integration ownership

Changed `index.html` regions: DEFAULT_STATE's Merlin care only; valid bird-card open/close review hooks; Academy Kitchen gate/card visibility and build transactions; expedition send/claim/card eligibility; `chefBulkFeedSameSpecies` deferred quest effects and `burbzFeedFood` save boundary; feature evidence; Player Quest ordering/selection/claims; tutorial step array, availability, flow projection/gifts, resume-preserving handoffs. No Home layout, trailer, world renderer, Settings markup, tutorial speaker/title removal or wholesale terminology pass is included.

`openingObjective()` is a read-only UI contract: `{id, screen, label, target, shortage, complete}`. IDs are `birdhouse`, `discovery`, `companion`, `kitchen`, `errand`, `care`, `done`. `scan` is Home/discovery. `openingProgress()` adds canonical Kitchen/errand introduction facts. `featureGateOpen('kitchen')` requires the actual built room. Previously claimed feature links continue to open their features even when older pending quests precede them after reordering.

Navigation worker owns `updateMerlinFlowPointer`, `merlinFlowPointerTarget` presentation, pause/keyboard/target helpers. Its replacement of my small `merlinFlowPointerTarget` projection is intentional. My `maybeStartMerlinChapterForScreen` includes the optional `merlinNavigationPaused` guard. The navigation worker supplies the corresponding first-launch guard.

The owner's v415 `startMerlinTutorial` intro/Settings guards, `placeMerlinSettingsControl`, `closeBurbzSettings`, `merlinSettingsPause`, focus trap and `endMerlinTutorial` header restoration must be retained while merging these function hunks. The owner's Earthling text/title removal, trailer sequencing and Birdhouse-wide labels must also survive. This slice deliberately leaves the exact original greeting row untouched for that merge.

Changed core scripts are `academy_treehouse_core.js` and `onboarding_gate_core.js`. The sole release owner must pin both consuming URLs and all three worker lists/legacy updater in the integrated release. No pins were advanced here under the coordinator's no-version-bump instruction.

## Validation and limits

- `node tests/test_motivated_opening_20260914.cjs`: 13 extracted-runtime/pure checks pass, covering the complete resource/care sequence, genuine shortage timing, no fake discoveries, deferred goals, exact gift/retry, build XP rollback, dispatch rollback, old pending/claimed First Flight, depleted/overprepared/prebuilt saves, claim idempotence, meal rollback/retry, real Kitchen gates and every surviving stable tutorial ID.
- Selected existing pytest: `test_concise_onboarding_20260906.py`, `test_tutorial_merlin_first_flight_spotlight_20260730.py`, `test_player_built_kitchen_20260906.py`: 15 pass. Obsolete immediate-Kitchen-gift/order expectations were updated to the accepted later construction requirement; the old positional/stable-ID migration and live dispatch-art spotlight checks remain.
- Both modified cores and all inline script content parse; `git diff --check` passes.

No browser was launched because the release owner held the existing media/browser slot. Real integrated trailer → Home → opening → save/reload, actual provider denial/offline UI, native meal controls, Settings at every step, viewport/keyboard routing and installed/offline cache delivery still require the owner’s browser/public proof. The test meal uses the runtime feeding function with an isolated deterministic diet transaction; it is not new recognition or field accuracy evidence. This is automated acceptance, not an unfamiliar-player usability study.
