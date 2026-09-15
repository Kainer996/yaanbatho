# Common prerequisite guidance intake

Status: guidance implementation and focused native acceptance complete; handed to the release owner for full Home, installed/offline and public acceptance. No publication by this task. Read the final commit and evidence section before release; this document does not certify an exhaustive play-through of every game mechanic.

## Source and integration ownership

Isolated branch `codex/prerequisite-common-guidance`, checkout `/home/yaan/Documents/Codex/2026-09-06/burbz-visual-polish/work/prerequisite-common-guidance`.

- Existing source `377be543` and recipe persistence `f1824d5c` are retained.
- `e10bb953`: common typed guidance and lexical/public action guards. Root already took this as `894a1df7`.
- `57320cc3`: native help controls, Home recovery, wider pure tests and portable native runners. Subsequent Home-layout fixes supersede its initial art-overlay positioning.
- Root immutable `618740ae` merged as `646c02cd`; root anchor fix/pins `efbc6fc6` cherry-picked as `478143ad`. These are root work, not another publication.
- `f8c69fdc`: Goal control in the existing action row, available-height track choice, and native shop selectors.
- `119558a9`: destination focus prefers the active game screen over an old Academy room copy; native shop assertions scope to the active screen.
- Root `495860ab` adopted as `d82199b0` for final header checks; this is root code and must not be cherry-picked back.
- `821bff01`: keeps the real Current Quest control usable next to Goal on short phones by reusing the existing compact Equipment header placement.

Changed runtime is `index.html`, `prerequisite_guidance_core.js`, `player_equipment.js`, plus the narrow available-height track choice in `scan_home.js`. Parent owns final build/cache/pins and publication. Do not cherry-pick our merge or duplicate the root anchor commit. Do not change terrain/combat as part of guidance.

## Entry-point inventory

Machine-readable inventory: `public/burbz/tests/prerequisite_entry_points_v417.json`. The registry explicitly rebinds both lexical functions and `window` handlers because event callbacks and equipment/home adapters use the closure directly. A `window` wrapper alone would miss actual native actions.

| Gameplay family | Actual gates and next steps | Original target retained |
| --- | --- | --- |
| Academy construction and room shortcuts | Actual Academy catalogue trainer level, coin/timber price, Birdhouse→Kitchen dependency, Project Manager completion gate, feature quest; Build Help remains clickable | Building or room ID; no automatic placement/build |
| Bird recruitment | Actual discovered/candidate record, built Birdhouse, actual recruitment quote | Original species/candidate card |
| Forge recipes and upgrades | All catalogue recipes, actual Forge level, costs, aggregate material reserve, busy anvils, actual Market/quest sources; partial-buy amounts re-read | Exact recipe, or original equipment item when crafting is its prerequisite |
| Market purchases and village shops | Actual Market building, real stock and current quote/discount; requested stock total and original discovered shop/settlement | Item/category/desired quantity or original shop item |
| Market selling | Shared Market-building guard; no stock/equipped piece can be invented or sold by guidance | Existing Sell controls own item/quantity; an empty/non-sellable selection stays a native validation case |
| Shared player/bird equipment | Canonical bag and current wearer; inspect/unequip existing copy before making a new one, or exact recipe/anvil | Owner, slot and item; keeper `@player` and real Merlin equipment retained |
| Training and errands | Actual training room/Quest Roost, current bird level, post, job, sleep/hunger; current job review or care; actual template picker | Bird/template; special first Merlin supply flight stays with original tutorial |
| Bird moves and role assignment | Built room; existing expedition/training/post; Project Manager Office; original role sleep rule | Bird/room or scope/post/bird; hunger does not invent a role gate, transfers remain allowed |
| Kitchen | Compatible foods from the same source-backed diet scorer, actual pantry/larder, real Market ingredient list and actual errand item pools | Original bird meal; helper never feeds or claims food |
| Head Chef bulk service | Existing Kitchen, actual appointed Head Chef and real time-served career level | Existing service board; no fabricated chef XP or auto-service |
| Villages | All 15 actual building catalogue entries, trainer/town tier, costs, existing construction/crew, supply carts, victory/birdhouse cost for liberation | Village seed/building/target level; native claim/battle authority retained |
| Towns/regions | Actual network target, Hall development/population/happiness/crew/cost, wholesale queue/cost, Hall prerequisite for policies, existing policy term/tribute conditions, trade route cost | Town/region/route/policy; no automatic policy, tribute, merge or claim |
| Home and farm | Actual home tier/room/decor/farm costs, owned placements are free, actual seed inventory, target owned/placed/plot/seed count, planted plot identity | Primary or exact camp home and intended action; no automatic placement or spend |
| Camps | Real saved camp, five-timber campfire requirement; actual real-location visit for house unlock | Exact camp; no new fast travel or synthetic GPS receipt. `placeCamp` itself has no resource price and retains the existing coverage, spacing and capacity validation. |
| General feature/resource gates | Current actual Player Quest/opening route; shared coin/timber/stone/material shortage adapters | Typed goal when its action is known, otherwise bounded resource/amount/label/origin screen |

Existing direct native validation is retained for invalid/removed IDs, stale action revisions, incompatible diets/slots, resource overflow, geometry/collision/spacing, absent camera/microphone/location permission, GPS reach/order, real-world quest alignment/network errors, cap/completed operations, cooldowns and no-effect attacks/potions. Those conditions are not fictional currency/material prerequisites. Existing direct real-world quest resume/permission/location UI remains authoritative, separate from Alderwing. The audit is not an assertion that every such validation message was redesigned.

`forgeTransmute` is rendered only when the real source stock already meets its ratio; insufficient/stale stock and invalid targets retain the original no-op guard. Current material gathering is available through actual recipe/material goals. XP-scroll controls only exist for owned scrolls; wrong class and max-level remain actual validation, without invented XP supplies. Completed/empty tribute, full seed box, already-finished construction, already-fed meals and already-collected receipts remain original no-op/cap handling.

## Saved intent and transactions

One bounded version-2 `{owner,goal:{type,args}}` intent is saved under the existing `photoProfileId`. Legacy version-1 recipe records still load. Type/argument allowlists, bounded strings/counts and matching profile reject malformed/foreign goals. No saved action/cost/reward is trusted. All current quantities, costs, readiness and routes are reconstructed.

Selection and Stop use durable save with rollback, preserving other state and the previous goal on failure. The original recipe clears inside its paid Forge transaction. General goals remain visible as satisfied until explicit Stop; stable owned counts/levels/slots are recomputed. No guidance click purchases, constructs, equips, dispatches, claims or feeds. Navigation opens existing controls, and a subsequent deliberate native action uses the existing original transaction and rollback.

Related nested Market/Forge/room/care/errand detours keep the original goal. Choosing an unrelated blocked goal can replace it, with the old goal retained if saving fails. The guide's Return revalidates current target availability; stopped/reset/foreign goals cannot execute a saved action. New Game uses the original identity/reset/movie path.

The Home Goal control shares the existing next-action row; it does not replace tutorial Current Action or add an outer page-scroll region. Short phones use the existing compact Equipment header placement when a goal is present. Available-height track choice also fixes the four-panel small-phone overflow. Guide Stop is available while on Home.

## Validation and limits

Pure tests cover all actual Academy catalogue buildings, all 15 settlement building kinds, recipe catalogue graph/budget/cycle bounds, typed input, general intent reload/reset/failed-save behavior, original transactions, wearer/gear/craft detours, food scorer/stock, role semantics and camp/home identities. Broad graph tests use real catalogue modules plus explicit state adapters; they do not claim every town/world UI was exercised natively.

Native guidance tests use fresh disposable Chromium contexts, controlled synthetic saves, real visible controls and no recognition calls. Timers are not accelerated: the actual opening supply flight is sent, waited for, and claimed; the ordinary five-minute errand is dispatched and retained across reload but not claimed here. Viewport/touch emulation is not a physical-phone or GPU/FPS test. Service workers are blocked in functional runners; root owns installed/offline/public verification.

`run_prerequisite_native_v417.cjs` covers blocked Bow, paid partial buys/reload, exact return/paid commission, real Market construction, actual trainer/resource gates, starter dispatch, Stop/replacement failures, native New Game and layouts.

`run_prerequisite_common_native_v417.cjs` covers native locked Academy Help, Home resume bounds and hit testing, shared player/bird copy transfer, Fieldcraft requirements, hungry bird food acquisition/return, reload and failed Stop.

Both accept `BURBZ_TEST_ROOT=/path/to/public/burbz` to serve the release candidate without modifying it. Optional `BURBZ_URL=https://yaanbatho.com/burbz/` instruments only the fetched public HTML with the disposable seed and closure hook. Public mode disables local asset fallbacks and serves actual remote runtime/assets. It is not an installed/offline test and does not expect instrumentation to exist in cached production HTML.

The first full opening attempt exposed a genuine root async-anchor race (no DEM requests); root fixed it in `efbc6fc6`. The unchanged full `run_opening_v416.cjs` then passed all six groups through actual shelter/shared-world/desk and all opening milestones. The interim milestone-only fixture is separately labelled and is not substituted for that full proof.

## Final evidence and remaining release checks

Evidence copied into this checkout at `outputs/prerequisite-v417-native/` (not part of the deployable assets):

| Evidence | Result / exact useful scope |
| --- | --- |
| `recipe/results.json` | All 12 native groups complete, zero page errors on runtime `119558a9`: blocked Bow, partial paid buys, reload, remaining quantities, exact return, failed commission rollback, single paid job, unbuilt Market trainer/coin/timber graph, real starter dispatch, native Market Build, three responsive shop layouts, Stop/replacement failures, confirmed New Game identity/reset. |
| `common/results.json` | Eight native groups complete, zero page errors on the `f8c69fdc` runtime: actual locked Academy Help after lexical rebinding, generic-goal reload, failed Stop, real bird-to-keeper copy transfer, Fieldcraft requirements, hungry Robin’s empty feeding sheet, paid food acquisition and exact original Feed return. |
| `home/results.json` | Four groups complete, zero page errors on final `821bff01` with root header bytes: Help/reload and Home with both no next quest and an actual unclaimed Hospital quest; 320×568, 390×844, 844×390, 1280×800. Current/Goal controls retain at least 44×44 bounds; no Goal overlaps; zero Home/main overflow; native Goal hit tests pass. This small runner sets `HOME_GEOMETRY_ONLY=1` and deliberately stops before repeating the separately passed equipment/food flows. |
| `runtime-sha256.json` | SHA-256 of final local index, guidance core, equipment, Home layout and root Home CSS for release-owner comparison. Each native report separately records its served bytes. |

The shared Find Coins source is correctly deduplicated when it supplies both coins and XP; the recipe test asserts its real template rather than demanding duplicate buttons. Responsive Market assertions use the current game screen because the game can retain another Academy panel copy. Runtime destination focus now follows the current screen too.

Full original opening: `/tmp/burbz-opening-v416/results.json`, all six groups complete after root anchor fix. Root archived durable proof at `outputs/v417-local/full-opening`. This traverses the actual shelter/shared-world/desk plus Birdhouse gift, honest cancelled discovery, Play, Kitchen shortage, real send/wait/claim, reload and exact meal transaction. The full opening ran before the subsequent bounded Goal-layout/focus refinements; those do not alter opening progression or transactions.

Final pure/transaction commands (run from checkout root):

```sh
node public/burbz/tests/test_prerequisite_common_20260914.cjs
node public/burbz/tests/test_prerequisite_persistence_20260914.cjs
node public/burbz/tests/test_prerequisite_guidance_20260914.cjs
node public/burbz/tests/test_prerequisite_adapter_20260914.cjs
node public/burbz/tests/test_market_tabs_v389.cjs
node public/burbz/tests/test_progressive_home_20260914.cjs
```

Results: 17 common groups; eight recipe persistence groups; actual-catalogue graph/budget/cycle suite; original-adapter contracts; nine Market groups including all 36 collected recipes; progressive Home projection/preferences checks. All four inline scripts and changed standalone scripts parse. Root owns its current shared-equipment test-only dependency fixture and has separately reported 12 passing equipment groups.

Remaining release-owner checks: original progressive Home 24 groups/complete independent lists; label and header visual review; final build/cache/updater pin parity; installed/offline and public tests against final integrated bytes. The 320px screenshot still shows the last character of Equipment clipped in root’s equal-four-button header, and at 390px the Hospital quest title wraps across lines while meeting bounds. These were explicitly handed to root’s header/Home visual pass; this document does not call those final presentation checks complete.

To integrate, root already took `e10bb953`, `57320cc3`, and `f8c69fdc`; take `119558a9` and `821bff01` plus the documentation commit containing this handoff. Do not reapply our root merge, anchor or header cherry-picks. Browser slot was released after these checks; no browser or server remains running in this task. No independent publication was attempted.
