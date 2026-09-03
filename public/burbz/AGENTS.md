# Burbz — Maintainer & Agent Handbook

> **Read this first.** Notes from Claude to the next version of Claude (and to
> Yaan's other agents). This file exists so nobody re-learns the hard lessons
> the slow way. It is deliberately plain, complete, and honest about the sharp
> edges. Keep it that way — when you change how the project works, update this
> file in the *same* commit.

Current release: 2026-09-02 (`generated-building-interiors-v344-20260902`) — **every building now opens onto a real painted place.** The fifteen governor buildings and the unbuilt plot each have an original 1448×1086 woodland-fantasy painting under `assets/building-interiors-manga/`, generated for Burbz from the game's own visual language and stored as same-origin WebP files. `building_interior_core.js` is no longer an SVG illustrator: it is a small deterministic art/state adapter that selects the correct painting and keeps level, crew, stores and construction truth in the DOM. The room art has a restrained slow camera breath, material-specific glints and construction dust; `prefers-reduced-motion` turns all movement off. All sixteen files are precached as best-effort generated art, the core moved in every service-worker list, and the head build/cache lineage moved together. Contracts: `tests/test_step_inside_buildings_20260901.py` now proves the complete unique 16-image roster, full-size valid WebP files, honest state attributes, no SVG fallback and complete release plumbing.

Previous release: 2026-09-01 (`empire-three-pages-v343-20260901`) — **the Empire tab is three pages.** Yaan's ask, from a screenshot: people cannot work out how to do things on the Empire tab. Make it three very clear screens they can swipe through — the whole empire, the towns, the villages — with no writing that does not need to be there, and take no feature away. **(1) Three pages.** `#screen-village` now holds a tab strip (`#empirePagesNav`: 🗺️ EMPIRE · 🏘️ TOWNS · 🏡 VILLAGES) and a page track (`#empirePages`). The EMPIRE page carries the royal map and, under it, the counties with the crown above them and the trade routes (`#empireRealmPanel`); TOWNS carries the town squares (`#empireTownsPanel`); VILLAGES carries the village squares (`#empirePanel`, unchanged id) with the village hub inside the same page. `renderEmpirePanel` writes all three; the tax chest is written into the panel and lifted into `#empireCollectBar` above the tabs, so it is on screen whichever page is open. Only the open page takes up height — the other two stand beside it `visibility:hidden` until a drag pulls one in (`showEmpirePage`, `bindEmpirePager`). A new save opens on the map; a save with villages opens on the villages. **(2) Three sideways gestures nest.** The village carousel sits inside the page track, which sits inside the dock road. One flag, `sideSwipeClaimed`, keeps them honest: the innermost surface that can still move in the drag's direction claims the touch on its first sideways move, and an edge hands it outward — at the first village a right-drag turns the page to TOWNS; on the EMPIRE page a right-drag walks the dock to Quests. The road resets the flag on every new touch (a stale claim ate flicks on other screens in the first cut). **(3) The writing goes behind the eye.** Every tier caption, the colour key, the merge-star rules, the trade and ladder nudges, the merge-banner sentence, the desk's door hint, the town-works line, the village subtitle and the town link's sentence now wait behind `infoDotHTML` eyes; the village pager is dots. A rung the player has not reached is one faded square with a star count (`.empire-ghost`, e.g. "⭐ 0 / 3"); an empty empire is one gold FREE YOUR FIRST VILLAGE button that turns to the map. Merge banners sit on the page holding the things they merge (villages → VILLAGES, towns → TOWNS), so the first county is never out of reach. **(4) Merlin teaches the pages.** The Realm chapter walks the tab strip, the map and the chest (steps carry a `pane`), and two new chapters fire the first time a page has something to teach: `empire_villages` (the squares and the desk) and `empire_towns` (the merge, and what stands above towns). **Nothing was removed** — ledger, chest, map tools and key, squares, merges, pyramid, trade, the desk, the carousel, the halls all stand. Suite 2001 passed (the two pre-existing `settlement_scene` failures only); 97 head-build pins rolled; `tests/test_empire_three_pages_20260901.py` (11 tests); browser evidence `tests/run_empire_three_pages_evidence.js` 21/21 with real touch drags, plus `run_village_swipe` 7/7, `run_empire_grid` 31/31 (selectors moved to the new nodes) and `run_step_inside` 17/17. Lesson: a test that slices `renderEmpirePanel` between `const tiersHtml` and `panel.innerHTML` pins the ORDER of the tier calls, not their home — keep villages → towns → counties in the source even when they render to three nodes.

Previous release: 2026-08-26 (`quiet-arena-v331-20260826`) — **the fight fits on one screen, and the errand sheet opens to the coins.** Four asks from two screenshots. **(1) The writing goes.** Every fight opened with eight lines of narration — the tier name, how Skyclash works, what the Speed meter does, how to aim — which pushed the game itself below the fold. `startPerchBattle` no longer calls `addBattleLog` at all. What the player actually needs is on the cards and the buttons; the log fills as blows land. **(2) Focus is gone, mechanic and all.** Yaan: "I don't even know what that is as a mechanic so I won't miss it." Out went `FOCUS_MAX`, `SURGE_COST`, `battle.focus`, `addFocus`, `focusGain`, the surge multipliers in `computeDamage`/`previewDamage`, the AI's surge bid, the rail and the SURGE button. The eight signature moves that stole Focus — magpie, drongo, frigatebird, gull — now knock their mark down the Speed meter with `crShred`, which is closer to what those birds actually do. **(3) One screenful, by construction.** Not by counting pixels: the arena is a flex column exactly as tall as the screen's content box, every block keeps its natural height, and the log alone gives ground. Measured in real Chromium at 360x780: **927px of content into a 711px screen before, 711 into 711 after.** The measuring caught what counting would have missed — at 360x667 the ATTACK bar still ran 13px past the nav bar, so short screens get a tightening block, and the arena scrolls internally rather than ever clipping a button. **24 checks across three phone sizes.** **(4) The errand sheet opens to just under the coins**, pinned with a *measured* header height rather than the old `82vh`, with SEND at the bottom under the thumb. Suite 1775 passed.

Previous release: 2026-08-26 (`field-any-bird-v330-20260826`) — **any bird, any turn, on cards that are all the same size.** Two complaints from one screenshot of a live fight. **(1) The Great Spotted Woodpecker's card was nearly twice as wide as its squadmates'.** `.arena-squad` was `repeat(4, 1fr)`, and plain `1fr` is `minmax(auto, 1fr)` — a track can never shrink below its item's own content. The name is `white-space:nowrap`, so the longest bird name in the UK list simply pushed its track open and took the width off the other three; because `.au-art` is `aspect-ratio:1`, the wider card also drew a far bigger picture. Measured in real Chromium at 390 px: **67.0 / 68.5 / 125.9 / 82.0 px before, 85 / 85 / 85 / 85 after.** Every name was doing it, not just the woodpecker's. Fix is `minmax(0, 1fr)` plus `min-width:0` on the card, and the name became a fixed-height two-line clamp so long names read in full and the HP bars still line up. **(2) The turn meter decided which bird you were allowed to use.** Now the meter decides WHEN the flock acts and the player decides WHO swings: tap any living bird in your row and it takes the turn, as often as you like. The balance hinges on one line — `battle.turnHolder` is the bird whose meter bought the turn, and `resolveAction` empties **its** meter, not the one you fielded. Fielding a favourite therefore costs the flock exactly one turn, the same as before; a test runs 60 turns both ways and pins the identical player/opponent split. Cooldowns tick once per turn via a `cdTurn` stamp (swapping back and forth five times used to be five ticks), and buff durations run down on both birds so a rally cannot be parked on a bird that never holds the meter. Suite 1755 passed; browser evidence drives the real Battle screen end to end.

Previous release: 2026-08-25 (`trail-mode-v329-20260825`) — **Burbz notices you have gone out, and the interface stops beeping.** Two asks from Yaan. **(1) Trail Mode.** When the live map sees a real walk, the game opens questing by itself, pulls the camera back to z15.2, and says the one thing that matters out there: eyes on the trail, be careful. Everything from that moment is charted and saved, and time with the phone in a pocket pays a Trail Bonus of up to +50% XP. New pure core `trail_mode_core.js`. **The judgement is the whole feature**, and it is deliberately hard to convince, because a missed walk costs nothing while a false positive takes over the screen of someone sitting still. Three things make it hold: ground covered is the NET displacement of each 30-second slice and never a sum of consecutive hops (summing hops turned a phone jittering on a table into 755 m of "walking" in the very first test); every slice is discounted by half the accuracy the device itself reports; and the distance bar rises with that accuracy (80 m at a 10 m fix, 150 m at 25 m). Anything above 6 m/s is a vehicle, not a wander. Measured over 300 synthetic traces per case: **0/300 stationary phones judged walking at every accepted accuracy, 300/300 real walks caught from a 0.9 m/s dawdle to a 3.2 m/s jog, 0/300 vehicles.** **(2) Delicate UI sound.** Every candidate was decoded with `decodeAudioData` and measured rather than picked by filename: `sfx-ui-tap.mp3` put 90% of its energy in 111 ms but **rang for a full second**, and with a 90 ms cooldown up to six of them overlapped — that was the mush. `ui-wood.mp3` (body 47 ms, gone by 200 ms) takes the tap; `ui-lock` takes unlock, `ui-coins` coins, `ui-spell` magic, `reward-level-up` the level sting. The bespoke one-second Burbz sounds keep the big moments, where a tail belongs. New per-role `DEFAULT_VOLUMES` (a tap at 0.30, measured RMS ran -21 to -33 dB so without this the interface shouted) and `DEFAULT_PITCH_DRIFT` (±6% on a tap, none on the fanfares — a wobbling fanfare sounds broken). The oscillator fallback's bare 600 Hz sine is now a two-partial mallet through a lowpass: rendered offline it measures body 16 ms, tail 59 ms. **Two bugs fell out.** `.wq-detail-start` is used by nine quest sheets and **had no CSS rule at all** — every Side Quest button in the game rendered as bare inline text. And `scripts/update-live-burbz.sh` needed the new core adding to its hardcoded list, exactly as its own header warns; without that the VPS would have served an index.html whose `trail_mode_core.js` 404s. Its completeness test caught it.

Previous release: 2026-08-25 (`wand-button-leads-v328-20260825`) — **the wand's button stands where its caption was.** Yaan, on the Sound screen: take away "Ready to listen / Tap once and Merlin will keep listening while you explore Burbz" and put the big START MERLIN'S WAND button there instead. The caption was saying what the button already says — the button's own label is the state (`START MERLIN'S WAND` → `OPENING MICROPHONE…` → `STOP LISTENING`), so the line was reading it out twice. `#scanBtn` now follows the painting directly; the shelf, the waveform and the data note keep their order below it. **What the caption was still carrying:** the listener's failure messages. Four of the six error paths raise a toast, but two do not (`Listening paused by this device`, `Microphone unavailable. Tap Merlin's wand to try again`), and a toast is gone in three seconds anyway. So `.merlin-listener-line` stays in the DOM as an `aria-live` region, clipped off-screen, and `updateMerlinListeningUI` gives it `.is-error` when `soundListenerState === 'error'` — at which point it appears under the button with the reason. Verified both ways in Chromium: hidden at rest, and tapping the wand with no microphone shows "Listening paused / Microphone unavailable. Check this device and try again." `test_empire_player_start_sound_shelf` owned the old order (`shelf < grid < button < note`) and now pins the new one (`stage < button < shelf < grid < note`) — the note is still well below the button, which was that release's actual point.

Previous release: 2026-08-24 (`one-tap-appointments-v320-20260824`) — every post in the game is one symbol and one sheet. Yaan's ask, from a screenshot of the Kitchen: cut the "Head Chef / The Kitchen wants a thinker" headline and the vacant paragraph, replace the APPOINT grid with **a box in the top-left of the room's own picture carrying a symbol** (an SVG chef's hat, by name), and make tapping it open **a little menu that explains what the chef does and lists the birds, their percentage and how useful they are** — "this goes across the rest of the game too". Plus two rules: **posted birds are offered at the BOTTOM** of the list, marked, and **the player can appoint whichever bird they want from whatever screen they are on**. **New shape.** `ROLE_SYMBOLS` is a 14-glyph map keyed by ROLE ID (not room) — stroked 24×24 paths in `currentColor`, so one glyph works on dark art, on a desk row and in the sheet; `roleSymbolSVG` falls back to the role's emoji, so adding a post can never blank a screen. **Watch the ids:** the region post is `region_warden`, not `warden` — keying the map off the room or the title silently yields the emoji fallback and nobody notices. `rolePostBadgeHTML` is the corner box (vacant = dashed + a slow glow, honoured `prefers-reduced-motion`; staffed = the holder's face); `rolePostRowHTML` is the desk equivalent for a village, Town Hall or County Hall. **One sheet, and it lives on `document.body`, not inside a screen** — that is precisely what makes "from whatever screen they're on" true, and it survives every re-render. `refreshRoleSurfaces` redraws it, or appointing from inside it leaves the player staring at the list they just acted on. **`rolePostCardHTML` is now only the sheet's body** — no title, no prose, no vacant explainer — and the sheet's head is the single place in the game a post is explained (`role.effect.copy`). The Training Hall's bespoke `trainingMasterPickerOverlayHTML` retired into it; its ↻ actor now carries `roleOpenAttrs`. **The mechanic that actually changed:** `assignBirdRole` no longer refuses a bird who holds another post. `birdCanMoveToVillagePost` (v315's narrow village-to-village exception) is replaced by `birdMovesFromPost`, and `roleCandidateBirds` stopped filtering posted birds out at all — `core.assignRole` was already vacating the old post, so the refusal was pure UI policy. Two traps that came with it: **capture `birdPostLabel` BEFORE `core.assignRole`** or the toast names the post the bird just arrived in (v315 wrote this down; it bites again), and **a Head Chef leaving the Kitchen must be passed to `pauseHeadChefCareer`** — `assignRole` vacates the post silently and the career would otherwise keep running with nobody at the stove. **Layout trap:** the ON DUTY chip cannot live inside `.role-candidate-name`, which ellipsises — a long bird name would clip away the very marker Yaan asked for. It is a sibling inside `.role-candidate-nameline`, which also keeps the desk suite's `candidate_names()` helper parsing cleanly. The sheet scrolls, so `.role-picker .role-candidate-list` drops its own `max-height` or the posted birds hide behind a nested scroller. Two caps, not one: `ROLE_CANDIDATE_LIMIT` 8 free + `ROLE_POSTED_CANDIDATE_LIMIT` 6 posted, so a large empire full of posted birds can never crowd the free flock out. **The test cost:** the v315 suite's subject was inverted by Yaan's own follow-up — its slab markers, its ordering test and its two "still has to stand down" tests were inverted rather than deleted, each naming this release, and its Node harness gained a `document` stub because the slab now defines the sheet's plumbing. Four other suites were retargeted from the inline card to the badge, the row and the sheet. Contracts: `tests/test_one_tap_appointments_20260824.py` (21 tests). No core changed, so no `?v=` moved. Suite 1693 passed, 17 skipped — plus 6 already red on `origin/main` from PR #248 (towns 3D), untouched. Browser runs at 360px and 320px drove the real chef's hat, the sheet, a Librarian moving into the Kitchen, and the same sheet opened from a village desk moving that bird on again. **Merged with `free-birds-v318-20260824`, which landed on main mid-flight and touched the same card.** Both releases reordered `rolePostCardHTML`; the resolution composes them rather than picking a side — birds with no post come first (Yaan: posted birds at the bottom), and *within* that group a genuinely free bird leads one merely stationed in a room (free-birds' rule, and `birdIsFree` is stricter than "has no post", which is why both filters are needed). free-birds' own "serving managers first" test was inverted, because Yaan reversed that ordering the same day; the half of it that still holds is kept. free-birds also retired the Head Gardener, so its glyph came out of `ROLE_SYMBOLS` (13 now, not 14) and out of the release test's id list. **Renumbered v318/v319 → v319/v320** because free-birds took v318 on main first. **Pin trap, hit again:** seven suites carry a head-build constant next to a `bird_roles_core.js` pin, and free-birds edited that core — so those hunks take *theirs* for the core pin and *mine* for the head build. Taking either whole side gets one of the two wrong. Suite 1708 passed, 17 skipped after the merge; the browser runs were repeated on the merged build, plus one that proves the composed order (a free INT-60 bird leads a stationed INT-150 one, and a posted INT-200 one still rides at the bottom).

Previous release: 2026-08-24 (`villages-first-county-merge-v319-20260824`) — two follow-ups to v317, one of them a progression dead-end. **Villages lead the tabs.** Yaan's words were "on that screen have villages at the top". v317 hid the empty COUNTIES and TOWNS tabs, which reads correctly on a one-village empire — but the moment a Town rises, VILLAGES drops back to the bottom, and villages stay the screen the player opens every day. Order is villages → towns → counties now, reversing the top-down ladder `empire-nav-tabs-v275` shipped. **The county merge was unreachable, and this is the one to remember:** `countiesBody = regionMergeBanners || …` — the gold 🛡️ MERGE INTO ONE COUNTY banner is rendered *into* the Counties tab. v317 gated that tab on `regions.length`, so a player with three starred towns and no county had nowhere to press it: the first county could never be founded and the ladder dead-ended at Town for good. `showCounties = regions.length > 0 || regionCandidates.length > 0`. Reproduced on main in a headless browser before the fix (three starred towns → tabs `[TOWNS, VILLAGES]`, no merge button) and after (`[VILLAGES, TOWNS, COUNTIES(0)]` carrying it). **The village→town merge never had this problem** — `townMergeBanners` rides in `villagesBody`, and the Villages tab always stands. That asymmetry is exactly what made the bug easy to miss, so both halves are pinned. **General rule: before you hide a container, look at what it renders.** Progressive disclosure must never hide the control that advances the thing being disclosed. Contracts: `tests/test_villages_first_county_merge_20260824.py` (7 tests). No core changed, so no `?v=` moved. Suite 1664 passed, 17 skipped — plus 6 failures that are already red on `origin/main` from PR #248 (towns 3D upgrade), untouched here: `test_midgame_progression`, `test_settlement_scene_sharp`, `test_settlement_scene_upgrade`, `test_steward_project_manager`, `test_timed_crafting_stores_quest_categories`, `test_village_basics_town_industry`. **Two sessions built v317 in parallel from the same two screenshots.** PR #249 merged first; this branch was restarted on top of it rather than competing with it. Check the open PRs, not just `main`, before starting a screenshot ask.

Previous release: 2026-08-24 (`free-birds-v318-20260824`) — a bird with no job is FREE, and the game finally says so. Yaan's ask: "the Aviary Gardens shouldn't even be a room, the bird should just be free... make them top of the list for doing any sort of quests or being assigned to anything... and have the red notification on the birds tab show there are birds not assigned to anything." **The insight is that `outdoors` was never a room.** It has always been the fallback the whole codebase writes when a bird is not anywhere else — 44 references, every one of them a default. So this release changes what it is *called*, not what it *is*: the id stays `outdoors` (behind the new `FREE_BIRD_ROOM` constant) and every save keeps its birds. **One definition, used everywhere:** `birdIsFree(bird)` — no post, not stationed in a room, not away on a quest, not mid-drill — plus `freeBirds()`, `freeBirdsCount()` and the stable comparator `freeBirdsFirst(list)`. Stable matters: the role picker ranks by aptitude underneath, and a non-stable sort would have shredded that ordering. `freeBirdsFirst` also copies before sorting, so a caller's array is never mutated. **What stopped being a room:** the label is FREE BIRDS with no passive perk and no perches; `openAcademyRoom(FREE_BIRD_ROOM)` bounces to the Academy screen rather than opening an interior; the Head Gardener post is retired (11 academy roles now); and "Send to the Aviary Gardens" reads "🕊️ Set free" on both the bird-card chips and the panel's move buttons. **What deliberately did NOT change:** free birds still mend and cheer up on the care tick. "Not doing anything" means no job, not no rest — taking recovery away would have been a regression Yaan did not ask for, and the tree has been home since roost-retired-v302. **Free birds lead four pickers**: quest dispatch, the Training Hall drill board, the Academy's add-a-bird roster, and role posts. The role list is now three tiers — serving village managers (v315), then free birds, then birds already stationed — under one shared cap. **The Hospital is the one picker deliberately left alone**: its ward sorts by who is hurt, and idleness is not the question there. Battle picking was left alone too — a squad wants the strongest birds, not the idlest, so free-first would actively mislead. **The birds tab (`data-screen="birdex"`) carries the count.** `birdex` was already in the badge core's SCREENS list, so this is one wrapped count in `normalizeActionBadgeState` plus one ACTION_BADGE_WORDS entry ("3 birds with nothing to do"). It is the only badge in the game that means "you have spare hands" rather than "something finished" — and it clears the moment every bird has a job, verified both ways in a browser. **Sharp edges hit this time.** (1) The Project Manager suite extracts `rolePostCardHTML` and runs it in a bare Node context, so adding a `birdIsFree` call broke it with a ReferenceError — the fix is to add the real function to the harness's source list, not to weaken the code. (2) `saveState` and `freeBirdsCount` are NOT on `window`, so a browser probe that nudges a refresh with `window.saveState && window.saveState()` silently does nothing and reads a stale badge — that cost a false "the badge never clears" bug report. Switch screens and wait instead. (3) The Gardens name survived in five player-facing places beyond the room entry: a fallback label in the completion-notice locator, the battle-result rest note, a tutorial line, and comments. **Grep the copy, not just the code.** (4) The pin sweep moved `bird_roles_core.js` (the Head Gardener left it), which broke eight suites pinning its old tag — five of them through a `MAGPIE_CORE_PIN` that only ever meant "the roles core", now honestly renamed `ROLES_CORE_PIN`; the Stores suite needed a genuine split because one constant pinned two cores and only one moved. Contracts: `tests/test_free_birds_20260824.py` (16 tests, including a Node harness proving exactly which birds count as free and that the sort is stable and non-mutating). Suite 1586 passed, 25 skipped. index.html + bird_roles_core.js, so one `?v=` moved.

Previous release: 2026-08-25 (`empire-grid-v322-20260825`) — the Empire screen is a **box of boxes**. Yaan's ask, from a screenshot: "instead of the villages tab the way it is there, where you press the 5 and it does a dropdown menu... each village will have a little square. In that square I want the icon of the bird that is assigned as the project manager, and the player can click on either one of those squares to open the village straight away below it." **The drop-down tabs are gone.** Each of the three tiers — 🛡️ COUNTIES, 🏘️ TOWNS, 🏡 VILLAGES, same ladder order as before — is a heading over a grid of square buttons, one per holding, all on screen at once. Inside each square is the bird holding that holding's civic post, drawn with the same `birdOnlyImgHTML` cutout helper every other bird picture in the game uses; an empty desk shows the holding's own banner, greyed. **The square's border and wash say what that holding wants most**, off a pure ladder in the new `empire_grid_core.js`: red (nobody lives here / folk are unhappy) → gold (⭐ ready to merge) → violet (nobody in charge) → blue (a crew is free) → green (building / all is well), with a 💰 pip riding alongside for a whole cycle banked. Five colours, one legend line under the grids. **COLLECT TAXES & PRODUCE moved above the boxes** — you empty the chest, then you go somewhere. **Towns and Counties get exactly the same view**, reading their own desks: a town's is now the **LORD MAYOR's** (the chain `bird_roles_core.js` had promised "comes later"), a county's is the Warden's. That rename is a title override in `index.html` only: one role id (`steward`), one save slot, keyed by seed — `empirePostTitleFor` decides the name from whether the seed is a merged settlement's heart, so every toast and bird card agrees. Suite 1711 passed, 17 skipped; 31 browser checks in `tests/run_empire_grid_evidence.js`. ⚠️ Six suites are red on main from PR #248 (towns 3D) — not mine, unchanged.

Previous release: 2026-08-24 (`empire-village-declutter-v317-20260824`) — nine cuts across the Empire screen and the village desk, from two of Yaan's screenshots. The rule running through all of them: **a line that only describes is a line the player scrolls past.** Not one mechanic changed — merge stars are still earned, trades still hide until walked, supply carts still work, crews still gate builds. Only the narration went. **(1) The tax chest holds a number, not a countdown.** It read "NOTHING BANKED YET — FULL CYCLE IN 7h 56m"; it now always reads `COLLECT TAXES & PRODUCE: <takings>` through the new one-line `empireTakingsSoFar(due)`, which falls back to `+0` rather than an empty string. `hasTribute` still decides `disabled`, so a fresh chest is honest AND unclickable, but a **part-cycle is now collectable**: verified in the browser at 4 minutes (`+0`, disabled), 3 hours (`+3 coins`, live) and past a full cycle (`+9 coins +2 timber` plus produce). This is what continuous accrual (v311) always implied — the UI had simply never caught up. **The whole countdown apparatus is retired**: `empireCycleCountdownMs`, `empireNextTributeCountdownMs`, `empireTributeCountdownTimer` and both ticker functions. Do not reintroduce a live ticker here: `empireTributeReady()` calls `simulateAllVillageEconomies()`, so a 1s interval would re-simulate every holding every second. The panel re-renders on entry and after actions, and the amounts move at ~1 coin/hour/village, so a stale reading is never meaningfully stale. **(2) Counties and Towns wait until you have one.** Both nav tabs are behind their own count (`regions.length`, the new `townCount`); Villages is unconditional. The gate and the tab's badge read the same expression, so they cannot disagree. **(3) The Empire screen ends at the chest.** `FIND YOURSELF` and `HOW YOUR EMPIRE WORKS` are gone, `footerHtml` is now the empty string, and with them went `locatorChipsHtml`, `helpHtml`, four locator click handlers and **sixteen CSS rules** (`.empire-locator*`, `.empire-help-row`, `.ehr-icon`, `.empire-footer`, `.empire-drawer.is-footer`). Deleting the markup but leaving the string-building is the trap here — both were rebuilt on every Empire render for nobody. **(4-8) The village desk.** The `MANAGE VILLAGE / NAME` headline is gone (the player knows which village they opened); the head is now just pop/cap, happiness and crewed/worked — numbers with no trailing words. The merge-star progress line, the trades line, the `SEND A SUPPLY CART` button and the `Construction Yard / CREWS n/m / purse ...` heading all went, along with `mergeReady`/`mergeLine`, `allTrades`/`foundTrades`/`tradesLine`, `cartUseful`/`cartHtml` and five more CSS rules. One knock-on worth copying: the income line still ended "...or send a supply cart", pointing at a button that no longer exists — **when you delete a control, grep the copy that names it.** **(9) Building cards lost `tier.desc`.** Name, pips, crew line, cost button, shortage line. The `desc` field stays in `EMPIRE_BUILDINGS` untouched; only the card stopped printing it. Storm Wreckage cards keep theirs deliberately — Yaan named the construction cards, and his screenshots had no ruins in them. **The test cost is the real story: 14 suites went red, none of them wrong.** Every one pinned copy this release removed. The discipline that matters: *never weaken an assertion to make it pass.* Each was either retargeted to the surviving mechanic ("builders busy here..." to `busyElsewhere`; "yards crewed" to the bare crew numbers; the cart button to `function empireSendSupplyCart(`), inverted into a no-dead-CSS check, or deleted outright when its subject no longer exists (the locator-chip wrap rule had no successor — `.empire-village-name` ellipsises, so inventing a replacement claim would have been a lie). Five suites pinned single lines of the deleted help guide; those assertions went with a comment naming the release, because the *rules* they described are all still live and still tested elsewhere. Two sharp edges from the pin sweep, both already written down and both hit again: a suite's `OWN_RELEASE_PIN` may be a **core** pin (the Magpie Market's five cores stay on v316 for ever — that suite now carries a separate `CURRENT_BUILD`), and v315's suite asserted `bird_roles_core.js` sat on the head build, which was only true while v316 *was* the head. It has a `ROLES_CORE_PIN` now. Contracts: `tests/test_empire_village_declutter_20260824.py` (16 tests, including a Node run of the takings helper and a check that every removed mechanic is still alive elsewhere). Suite 1571 passed, 25 skipped. index.html only — no core changed, so no `?v=` moved.

Previous release: 2026-08-24 (`magpie-market-v316-20260824`) — the Academy gets a trading post. Yaan's ask: "add a building that can be built to the Academy, not much later on in the levels, that is a trade building so that the player can buy and sell materials — make it the fifth building that the player can build". **The ⚖️ Magpie Market is the fifth gate on the ladder** — Barracks 1, Training Hall 2, Quest Roost 3, Kitchen 4, Market 5 — which meant the Bird Hospital and The Crowbar each slipped one level, to 6 and 7. That was the cheapest way to honour "the fifth": the alternative was pricing the Market above the Hospital, and the catalogue's own rule is that costs climb with the gates. Nothing got dearer — the Market costs 135 coins / 28 timber, between the Kitchen's 130/25 and the Hospital's untouched 140/30, so the coin ladder still rises strictly with every gate. The early ladder now reads 1,2,3,4,5,6,7 with no hole (level 7 used to be empty). Delaying the Hospital by one level is safe because the tree itself mends HP since roost-retired-v302: the ward is *fast* healing, not the only healing. **Do not reuse the id `market`.** It is taken twice over — `ensureAcademyBuildings` still deletes `gameState.academyBuildings.market` to refund the retired Recruitment Roost, and `market` is the town-tier Market Hall in `EMPIRE_BUILDINGS` (🏪, unlock 10). The room id is `magpie_market` and the icon is ⚖️, both previously unused. **The art was already in the repo.** `assets/academy-buildings-manga/market.png` is a painted market stall — striped awning, jars of stock, produce baskets — that the Recruitment Roost left behind and the service worker has been precaching ever since. No new binary shipped. There is no *interior* painting, so the room draws its own scene through `ACADEMY_ROOM_SVG_FALLBACKS`, the same path the Library uses: shelf planks of stock jars, bunting, a counter with balance scales and a magpie's coin hoard, crates, sacks and a barrel. **Buying is the only genuinely new mechanic.** Selling reuses the Royal Stores' shelf prices verbatim; `loot_crafting_core.js` gains `BUY_MARKUP` (common/uncommon ×2.5, rare ×3, epic ×4, legendary ×5), `buyValue` and `buyQuote`. The markup widens with rarity on purpose: a Phoenix Ember sells for 100 and costs 500, so the market is a shortcut you pay for and quests stay the cheap road to anything precious. The spread also means a round trip always loses coins — there is no arbitrage at any rarity. `buyQuote` clamps the quantity to what the purse covers and **rounds the per-unit price before multiplying**; doing it the other way round lets a Market Trader's discount leak a free unit. The discount itself is floored at ×0.5 and at 1 coin. **The trap worth remembering: shared code must not reach into the Academy.** The first cut put `if (currentScreen === 'academy-room')` inside `storesSellItem` so a counter sale would redraw the room. The Stores suite extracts that function and runs it in a bare Node context, where a free identifier is a `ReferenceError`, and it went red immediately — the right signal for the wrong-looking reason. The fix is not a `typeof` guard but the separation the failure was pointing at: `magpieMarketSell` wraps the shared sale, then does the two things only a deal at *this* counter means (count the trade, redraw the stall). It detects a real sale by comparing the stack before and after, so a refused click counts for nothing. `test_the_stores_sell_path_stays_free_of_the_academy` now pins that. **The Market is a counter, not a dormitory**, exactly like the Kitchen: `academyMoveBird` refuses it with a toast, `academyRoomButtonsHTML` filters it out, and the generalised `counterRoom` flag suppresses the "add a bird to this room" roster for both. The old kitchen-only assertion was updated rather than duplicated. A `market_trader` post (⚖️, CHA 0.7 / INT 0.3) joins the eleven other Academy roles — every room has one, and `rolePostCardHTML` renders nothing without it. Its discount uses the Barracks' recruiting-discount shape, `1 / (1 + (m - 1) * 0.5)`, so a discount means the same thing wherever the player meets one: about a quarter off at best. The chain gains `pq_build_market` + `pq_market_trade`, slotted after the Kitchen's links and before the Hospital's; `academyBuildBuilding` fires `build_<id>`, so the quest type had to be `build_magpie_market`. Chain length 32 → 34. **Five cores changed, so five `?v=` busters moved** (treehouse, alive, 3d, roles, loot) — in index.html and all three sw.js lists. That sweep is the real cost of this release: ~20 older suites name those pins, and a stale one would serve an installed PWA the old core against the new page, with the Market missing from the catalogue and `buyQuote` undefined. Where a suite's pin constant doubled as its own release name it was split into a `MAGPIE_CORE_PIN` rather than retargeted, which keeps the older release's meaning intact. Three suites also asserted an *old release name* was still present in index.html; it only ever was as a core's `?v=` pin, so those now assert the append-only `BURBZ_CACHE` lineage in sw.js, which is what actually refreshes a PWA. `test_every_core_this_release_edited_ships_under_its_new_tag` guards the whole class of bug from now on. **Numbered v316, not v314.** The branch was cut at v313 and built as v314, but `claude/burbz-notification-icons-e0q01h` had already claimed that number for an unmerged `battle-pick-your-bird-v314`, and v315 landed on main while this was open — which is why main's own lineage skips 314. Renumbering on the merge is the same courtesy v315 paid v314 and v311 paid v310; the cache lineage is append-only, so it reads v313 → v315 → v316 and the gap is harmless (no test asserts the sequence is contiguous). The merge itself conflicted in 74 files, 71 of them the same one-line head-build pin. **Resolve those hunk-by-hunk, never with `git checkout --ours -- <file>`**: that takes the whole file and silently drops the other release's real edits to it — here it reverted v315's Project Manager copy changes and only a content assertion in an unrelated suite caught it. v315's own suite also aliased `CURRENT_BUILD = RELEASE`, which a later release always breaks; it has its own head-build pin now. Contracts: `tests/test_magpie_market_20260824.py` (21 tests, including a Node harness that buys and sells through the real functions). Suite 1547 passed, 25 skipped. Browser runs verified the level-4 lock and the level-5 build, a BUY 5 moving 25 coins into 5 twigs, SELL ALL paying 18 for 9, the trade counter reaching 2, the Hospital accepting a bird the Market refuses, and no page errors.

Previous release: 2026-08-24 (`project-manager-desk-v315-20260824`) — the Project Manager desk is a picker, not a pamphlet, and a manager can walk between villages. Two asks from Yaan, one screenshot: "remove all of that writing from where the player appoints a project manager, and also give the player the option to appoint any birds that are project managers in other villages — at the top of the list". **(1) The desk went quiet.** `rolePostCardHTML` sets `const bare = scope === 'village'`, and a bare card drops the flavour paragraph (`.role-post-copy`), the whole `.role-vacant` explainer, and the sentence trailing the holder's effect — the number (`Project management +29%`) stays, the prose after it goes. The card is now title → holder (if any) → APPOINT → list. Only `scope === 'village'` is bare, so the Academy rooms and the region Warden read exactly as before; the post's own words are untouched in `bird_roles_core.js`, which two older suites still pin. The Town Hall's desk is a village post at the settlement's heart, so it went bare too and its `copy`/`effectCopy` overrides were deleted rather than left to render nowhere. The one-line drawer summary above the desk ("Vacant — appoint a bird: builds go faster and cheaper, taxes rise") is deliberately kept: it is what the player taps, and it carries what the post does. **(2) Managers move.** New `birdCanMoveToVillagePost(scope, key, post)` names the single exception to one-bird-one-job: a bird whose post is a village desk in a DIFFERENT village. `roleCandidateBirds` lets exactly those birds through the `birdAssignedPost` filter, and `assignBirdRole` lets exactly those past the "stand them down first" toast — `core.assignRole` already vacated the old key, so the old village genuinely falls empty and the toast says so ("— Foxholt needs a new one"). A Librarian still cannot take a village, and a manager still cannot take a room. **Order is the feature.** Serving managers are ranked, capped at `ROLE_SERVING_CANDIDATE_LIMIT` (5), and concatenated ahead of the free flock before the list is cut to `ROLE_CANDIDATE_LIMIT` (8) — so they lead even when a free bird scores higher, which is the whole point, and three seats always remain for birds with no job. Their row carries `.role-candidate.is-serving` (gold edge) and a `.role-candidate-post` line naming the village they would leave, `white-space:nowrap` + ellipsis so a long name truncates instead of growing the row. Watch out: `birdPostLabel` reads LIVE state, so `assignBirdRole` captures `movesFrom` BEFORE `core.assignRole` runs or the toast names the destination. Contracts: `tests/test_project_manager_desk_20260824.py` (14 tests, running the real card renderer and the real `assignBirdRole` in node). No core file changed, so no `?v=` pin moved — index.html, sw.js and the test pins only. **Numbering:** another session had already pushed `battle-pick-your-bird-v314-20260824` to `claude/burbz-notification-icons-e0q01h`, so this release took v315 rather than collide — the same courtesy `village-basics-town-industry-v299` paid `generated-ui-art-v298`. The cache lineage is append-only, so whichever lands second keeps BOTH markers in landing order and points `BURBZ_BUILD` at the last one. Suite 1639 passed, 17 skipped; headless boots at 360px and 320px moved a real manager between two real villages through the real click handler, with a 25-character village name ellipsised and nothing clipped.

Previous release: 2026-08-24 (`bird-card-carry-charm-v313-20260824`) — the front of a bird card shows five stats, not three. Yaan's ask: "on the birds card please can you include the birds' carrying capacity and also charisma". The row is **ATK · DEF · SPD · CHA · CARRY** now. Charm was only on the card back and carrying capacity only in the field guide's Size & carrying panel, so the two numbers that decide who you send on a quest were the two you could not see while choosing. `createBirdCardHTML` (companion) and `createKnownSpeciesCardHTML` (Birdex preview) share the row markup **verbatim**, so both gained it in one edit; the capture-celebration card matches, and `createSilhouetteCard` shows `?` in all five so an undiscovered slot keeps the same shape. CARRY is the same number `birdSizeSummary().capacity` already feeds the field-guide panel and the quest-picker chip. CHA is NOT added to the `card-info-hint` line — it kept MAG/INT/STAM, which have no tile. No CSS change was needed: `.card-stat` is `flex:1` with default `min-width:auto`, so CARRY takes its natural 32px and the other four share the rest; measured at 320px and 360px viewports, nothing clips. **The trap, and it is a nasty one.** A Birdex preview bird comes from `createBirdFromDiscovery` → `createBirdEntry`, and `createBirdEntry` stamps `id: Date.now() + '_' + hashStr(name)` — a **fresh id on every render**. The obvious `birdSizeSummary(bird)` call reaches `birdGearBonuses` → `birdLoadout(id)`, which does `if (!eq[birdId]) eq[birdId] = {}` — so every draw of the codex would have written a brand-new slot into `gameState.inventory.equipment`, unbounded, into the save. `birdCardCarryCapacity` therefore reads gear ONLY for a bird found in `gameState.flock` by id, and falls back to the bare `birdCarryCapacity` otherwise; `birdLoadout` also refuses a falsy id outright now. Verified in a headless boot: 15 codex redraws left the equipment ledger at 0 keys. Rule for next time: any helper that reads a bird's kit must first establish that the bird is a real companion — preview and encounter cards carry throwaway ids. **Yaan then asked for CARRY on the card back too**, so the back's stat block carries it as well. The eight combat stats pair off two to a row in a 2-column grid; carrying is a different kind of number on a different scale, so `.card-back-stat.is-carry` spans `grid-column:1/-1` and sits alone at the foot of the block. Its bar is scaled by `birdCardCarryPct`, which reads `MAX_CARRY_UNITS` off the size core rather than hard-coding 20 — raise the ceiling there and every bar moves with it. Colour is `--hp-yellow`, the one bar tone no combat stat on that card already uses (the suite asserts all nine are distinct). Same release, no version bump: v313 had not merged, so this rode the existing pin the way `4a26c94` extended v310. Contracts: `tests/test_bird_card_carry_charm_20260824.py` (15 tests, including a parse of all four front stat rows and all nine back rows, and a node run proving only the in-flock bird's gear is read). No core file changed, so no `?v=` pin moved — index.html and sw.js only. Sharp edge that bit during the pin sweep: the v312 suite's `OWN_RELEASE_PIN` is a CORE pin and must not follow `CURRENT_BUILD`; the sweep regex matches any `CONST = "<old build>"` line, so check what each renamed constant is actually used for.

Previous release: 2026-08-24 (`nav-action-badges-v312-20260824`) — the red dot now covers the whole loop, not just quests. Yaan's ask: badge the Kitchen when a bird needs feeding, the Forge when there are materials to make something, the Empire when a building is complete, "plus any other notifications that keep the gameplay going". **The plumbing first.** Kitchen, Hospital and Training open a pop-up rather than a screen, so they carry `data-quick-destination` and the shared walker — which only ever queried `[data-game-route][data-screen]` — could not see them. `applyActionBadges` now walks `[data-game-route][data-screen],[data-quick-destination]` and keys off `data-quick-destination || data-screen`, which retires the hand-rolled `updateTrainingDockBadge` (its `.training-ready-badge` class is gone; nothing styled it). `SCREENS` gains `kitchen`, `hospital`, `training`. **Aggregation stays in the core**, like `quests` and `academy` before it: `forge = forge + forgeCraftable`, `village = village + buildingsComplete`, so the two existing suites that assert `computeActionBadgeCounts({forge:2}).forge === 2` still hold. **Six counts, one rule: a badge is a promise that something is waiting, and it clears the moment the player acts.** `kitchenBirdsNeedingFood` counts birds past `warnsWork` (hunger ≥ 70) *and Merlin* — he is not in `gameState.flock`, he lives on `gameState.merlinCare`, exactly as the Kitchen roster treats him — but returns 0 when pantry and larder are both empty, because a dot you cannot act on is noise. It reads hunger through the pure `hungerStatusForCare`, so the elapsed-time projection matches the gauges and nothing rewrites the save while counting (`careNeedsCount` still uses raw `care.hunger`; left alone deliberately — it is a broader needs-care signal, and the Academy suite pins it). `forgeCraftableNow` counts gear the player does *not* own, has *not* equipped and has *not* queued, gated on `canForgeAtLevel` and `!forgeQueueIsFull()` — "something new is within reach", not "you still own materials", which is what stops a mature save lighting it forever. `empireBuildingsComplete` sums constructions past `endMs`, town-hall builds past theirs, *and* queued `empire-building` completion notices: `tickEmpireConstruction` folds a finished build in within 60 s and the corner card it leaves carries the news until the player looks, so the two halves cover the whole done→seen gap and cannot double-count (the notice is queued in the same commit that removes the construction). `hospitalPatientsWaiting` counts birds under half HP who are not already in a bed, skipping posted, questing and drilling birds — a save with no HP written reads as hale, the way the rest of the game reads it. `storesGearWaitingToEquip` counts spare pieces against empty slots per slot, `min(spare, empty)` — one spare talon is one dot however large the flock grows. Every new count sits in its own `try/catch` inside `normalizeActionBadgeState`: one broken save must never blank the whole dock. **Screen readers get words, not a number**: `ACTION_BADGE_WORDS` + `actionBadgeText` feed `formatActionText`, so the Kitchen reads "Kitchen & Pantry, 2 birds to feed". Sharp edge for next time: `function_source()` in the suites slices to the next `\nfunction ` and stops mid-comment, so joining two extracted helpers needs an explicit `\n` or the second one is swallowed by the first's trailing comment. Contracts: `tests/test_nav_action_badges_20260824.py` (17 tests, including a stub-DOM run of `applyActionBadges` proving a pop-up button badges and clears exactly like a routed tab), plus the updated training-dock and merge suites — the latter's `settlement_merge_core.js` pin now has its own `MERGE_CORE_PIN` constant instead of tracking `CURRENT_BUILD`, which is what a core pin always meant.

Previous release: 2026-08-24 (`village-work-huts-v311-20260824`) — a village works its own timber and stone, and the strongbox opens whenever you ask. Five asks from Yaan. **(1) Two work huts.** New village-tier `lumberhut` (🪚 Lumberjack Hut, +5 🪵/cycle/level, oak_twig) and `minehut` (🪨 Miners' Hut, +6 stone/cycle/level, iron_grit), each `workers: 3` — the first multi-hand yards in the game. Staffing stopped being binary: `villageWorkforce` now returns `assigned: {id: count}` alongside `staffed`, and new `villageCrewShare(building, crew)` returns `got / workers`, folded in BEFORE rounding at all six consumers (`villageNeedCapacity`, `villageProvisionRates`, `villageProductionSnapshot`, the flat-income loop in `villageEconomySnapshot`, and the textually separate copy in `villageBuildingOutputForLedger` — miss that one and the Stores row advertises more than the strongbox pays). `staffed` still means "somebody is here", so every existing `workers: 1` yard is bit-identical. Towns keep the Quarry and Lumber Camp as the efficient industry (10 stone per hand vs 2), so merging still pays. `buildMinutes` 35/40 placed between farm and cottages — the ladder test demands ramp[0]==15, ramp[1]==30, strictly ascending, unique, 240 last. `workPriority` 6 and 7 put the huts LAST on purpose: they are the crude version of the Lumber Camp and Quarry, and since a short-handed yard now takes what it can instead of standing aside, a 3-hand hut sharing their priority would have starved the better town yard it is meant to lose to. **(2) Collect whenever you like.** `empireVillageTributePeriods` returns a FRACTION now (no `Math.floor`), still capped at `EMPIRE_TRIBUTE_MAX_PERIODS`. **The clock always clears to `now`, and the HOLDING keeps the change**: `villageTributeTake(rec, periods, snap, commit)` pays whole units and banks the leftover fraction per resource in `eco.tributeCarry`, so six collections across a day earn exactly what one earns and a 1-per-cycle material is never rounded away. That indirection is load-bearing — ONE clock cannot serve resources with different rates: advance it by what the fastest earned and the slow ones are destroyed; advance it by the slowest and the fast ones pay twice. (An adversarial review caught both halves after the first cut shipped a goods-only second clock with the same flaw.) `commit` is false on every display path and true only inside the three collectors, which reckon once without banking, then pay. `empireAdvanceTributeClock` must set `lastTributeAt = now` and never `now - cap`: that is exactly the point at which a fresh full cap re-banks, so a holding idle two days paid its cap twice — the same bug was fixed on the caravan clock. Three further traps were real: `mergeResourceTotals` floored periods to a MINIMUM of 1 (a full cycle of goods on every tap — now `Math.floor(qty * n)`); `tributeHasAnything` returned true on `payingHoldings` alone (free `rollLoot('tribute')` per tap — now real amounts only, and forge chests ride WHOLE banked cycles in all three collectors); and `townHasAccruedTribute` gates the Council policy lock in four places, so it floors to whole cycles, as does the Empire nav badge, or both jam on for ever. Payouts floor to whole coins/timber/stone; one `now` threads through ready and collect. The provisions sim keeps its own separate `eco.lastSimAt` clock — untouched. **(3) Timber Well.** `well` is 🪣 Timber Well; the 3D collar is staved wood in both scenes. Id, save key and every `EMPIRE_BUILDING_INDEX.well` lookup unchanged; the need-gauge sublabels follow `source.name` automatically. **(4) Happiness must be earned.** It was pinned at exactly 0.75 for ever: relief supplies gave food and water a free 1, the first cabin gave shelter 1, joy was a flat 0, and (1+1+1+0)/4 is also the merge bar — so the star's happiness half passed with no Alehouse anywhere. `EMPIRE_NEEDS` entries carry a `weight` now (joy 1.25, the rest 1) and the mean is weighted, putting a tavernless village at 71%: under the star, over the 0.65 band where villages stop growing, and free to reach 100% once the ale flows. **(5) 16 folk, not 40.** `TOWN_MERGE_MIN_POPULATION` 40 → 16 in `settlement_merge_core.js`; `REGION_MERGE_MIN_POPULATION` stays 120 deliberately. That core edit moved its `?v=` buster to this release in index.html and all three sw.js lists. Also retired `townFromLevel` and `settlementAllowsStep` from v309: a village digs its own stone now, so the Stone Cottage is bought, not waited for. Crew lines count real hands through new `villagerCount()` ("3 villagers at work", "1 of 3 posted"). Head counts are no longer yard counts: the desk's "n/m yards crewed" and "n yards stand idle" lines count yards, and `villagerCount()` pluralises every crew line. `townBuildingOutputText(building, level, share)` scales the Town sheet's coins, timber, stone, taxBoost AND produced goods. Contracts: `tests/test_village_work_huts_20260824.py` (17 tests, including both exploit regressions). Suite 1573 passed, 22 skipped; browser runs verified partial crews ("1 of 3 posted"), 71% tavernless happiness, and a 2-hour strongbox paying +2 coins / +1 timber / +1 stone then correctly refusing the next two taps.

Previous release: 2026-08-23 (`walking-villagers-cottage-variety-v310-20260823`, Ava) — walking legs for villagers and livestock, cart horses that trot, and per-house cottage variety. Landed on main while the v309/v311 branch was open, which is why this branch renumbered itself from v310 to v311 on the merge: the cache lineage is append-only, so both v310 markers stay and the sequence reads v309 → walking-villagers v310 → village-work-huts v311. Ava's commit bumped BURBZ_CACHE without moving BURBZ_BUILD, so main sat with a failing `test_build_tag_matches_the_newest_cache_marker` until this merge set both to v311.

Earlier release: 2026-08-23 (`timber-village-builds-v309-20260823`) — a village builds in timber, all the way up. Yaan's screenshot report: every build card read "SHORT n · Quarry Stone arrives every 8h", so a village with no quarry looked walled off. Two things were wrong. **(1) One real stone gate.** The Timber Cabin's level-2 rebuild asked for 10 quarried stone in a settlement that has no quarry, so the shelter chain dead-ended at 6 villagers. The home now climbs three steps — 🛖 Timber Cabin (6) → 🏡 Timber Longhouse (12) → 🏠 Stone Cottage (18) — and the village pays for the first two in coins and timber alone (`costLevels` 25/14, 45/20, 70/18+12 stone; the longhouse spends in timber exactly what the old rebuild spent in stone). The stone rung carries `townFromLevel: 3` and waits for a Town. **(2) A lying hint.** That shortfall line named the Quarry under EVERY shortage, including the timber ones it was actually showing; it now says "🕊️ tap to send birds after it" for coins and timber and "⛏️ stone is cut by a Town quarry" for stone. New `settlementAllowsStep(rec, building, toLevel)` gates one STEP rather than a whole card — every building without `townFromLevel` is waved straight through, which is what keeps a grandfathered town yard upgradeable in a lone village (`settlementAllowsBuilding` is untouched; the two are deliberately separate). It guards `empireBuildStructure`, `wholesaleUpgradePlan` and the desk, where the stone rung draws as a disabled "🏘️ STONE REBUILD · TOWN WORK" button with no bill and no shortfall line. The 3D village reads all three steps (logs, logs stretched long, then stone). Copy swept: the empire guide says villages never spend stone, and the first quarry's opening cut now bankrolls the first Grain Farm and Lumber Camp instead of a Cottage Row that stopped costing stone in v299. Old saves migrate for free: a cabin already at level 2 reads as a Timber Longhouse at the same 12 shelter, and gains the stone rung above it. Contracts: `tests/test_timber_village_builds_20260823.py` (10 tests, including a walk of every level of every village card asserting `stone == 0`); six settlement harnesses lift `settlementAllowsStep` alongside `settlementAllowsBuilding`.

Earlier release: 2026-08-20 (`village-basics-town-industry-v299-20260820`) — Yaan's settlement law. A lone village keeps only the basics — Timber Cabin, the NEW 🏹 Hunter-Gatherer Hut (feeds 8/level, berries + mast per cycle, 1 worker, 15m build), Stone Well, Cottage Row, Alehouse, Storehouse — all bought with coins and timber alone, because the stone economy itself is town work. The industry (Grain Farm, Lumber Camp, Quarry, Chapel, Market Hall) carries `tier: 'town'` in `EMPIRE_BUILDINGS` and opens when three starred villages merge into a Town: `settlementAllowsBuilding(rec, building)` gates NEW builds in `empireBuildStructure` and `wholesaleUpgradePlan`, the village desk hides those cards behind one "Town works" teaser line, and grandfathered yards from old saves keep working and upgrading. Copy points villagers at the hut, the 3D village grew a hunters' camp, and the stone-shortage toast names the Town. Contracts: `tests/test_village_basics_town_industry_20260820.py`; the loose-village economy harnesses (quarry, concurrent-builds) became Town-ward fixtures.

Earlier release: 2026-08-20 (`generated-ui-art-v298-20260820`) — the player HUD and crafted inventory now share one coherent woodland-fantasy art language. The former SVG navigation and separate image dock are one horizontally scrollable, snap-aligned Adventure Dock with 44px+ targets; its route set preserves the v286 Forge destination while Map, Empire, Birdex, Scan, Battle, Forge, Academy and Ranks use generated transparent WebPs, and the existing Academy Hospital is a first-class generated quick destination with the same built/unbuilt guidance as Kitchen. Every one of the 35 gear, satchel, spell and potion definitions has a unique 256px transparent generated WebP under `assets/gear/`; `gearIconHTML` uses it across Stores, Forge, bird loadouts, battle controls and visual reward/result sheets while preserving the old emoji as a resilient text/load fallback. The Academy's Crowbar and Kitchen use bright 1448×1086 animated-storybook interiors, kept versioned and sprite-safe through the central mobile crop. All new art is in the service worker and live updater; nav art is core-preloaded and all generated gear/interior art is install-warmed. Contracts: `tests/test_generated_ui_art_v298_20260820.py` plus the updated dock, kitchen, tutorial, Hospital and generated-art suites.

Previous release: 2026-08-20 (`equip-card-swipe-v297-20260820`) — Yaan's ask: on the Equipment screen (the back of a bird's card) a horizontal swipe flips to the next or previous companion, card sliding out one side and in the other. The deck is `gameState.flock` in collection order, wrapping at both ends. The gesture follows the finger with an axis lock (`bindBirdEquipSwipe` on `.bird-equip-scroll`, bound once; vertical drags still scroll; horizontal drags call `preventDefault` from a non-passive listener), commits past 70px, springs back otherwise — including the one-bird flock. `birdEquipSwipeTo` swaps `birdEquipState`, closes any open gear picker, resets the scroll to the top and runs the slide animation; a pager line ("‹ 3 of 12 companions — swipe for the next ›") teaches the gesture and hides for a single bird. Contracts: `tests/test_equip_card_swipe_20260820.py`.

Earlier release: 2026-08-20 (`honest-need-gauges-v296-20260820`) — Yaan's screenshot report: a village with no farm and no well showed Food 3/3 and Water 3/3, full and green, because the liberation relief stores were filling the bars. Now every need bar is a gauge of what is actually BUILT: `villageEconomySnapshot` carries two truths per need — `sat` (harvest + stores; unchanged, still drives happiness, growth and starvation, so relief supplies keep doing their job) and `supplySat`/`supplyServed` (only what built, staffed farms and wells deliver; shelter and joy carry the same fields). The village desk and the Town Hall draw the gauge; the sublabel tells the stores story ("no stone well yet · villagers live off the cistern (30 stored — 10 more cycles)", amber while it lasts) and the shortage warning still runs on `sat`. `townEconomySnapshot` rolls `supplyServed` up from its wards. Contracts: `tests/test_honest_need_gauges_20260820.py`.

Earlier release: 2026-08-20 (`stores-market-project-manager-v295-20260820`) — Yaan's two follow-ups. First, the village post's nameplate: it is the **Project Manager** now, not the Steward — role title, icon (📋), province drawer, Town section and income line all say so; the role id stays `steward` so old saves keep their appointee, and grander civic titles (Lord Mayors for towns, Councillors for counties) are planned for later. Second, the **Stores market**: every stockroom card in the Royal Stores carries SELL buttons. Prices live in `loot_crafting_core.js` (`SELL_PRICES`/`sellValue`/`sellQuote`): gear by rarity (15→450 🪙, a legendary beats its own forge bill), materials by rarity (2→100 🪙), larder food 2 🪙, keepsakes 5 🪙. `storesSellItem(kind, id, qty|'all')` in `index.html` owns the trade — exposed on `window` for onclick and on `__burbzStoresDebug` for tests; equipped gear is safe because worn pieces leave `inventory.gear`. Contracts: `tests/test_stores_market_20260820.py`.

Previous release: 2026-08-20 (`steward-project-manager-v294-20260820`) — Yaan's building pace and project managers. The village build clocks now climb a ladder: the Timber Cabin and Stone Well rise in 4 minutes, the Grain Farm takes half an hour, and every later building takes longer, up to 4 hours for the Storehouse at the bottom of the list (`buildMinutes` in `EMPIRE_BUILDINGS`; upgrades still multiply by level). And the Steward is now the project manager: the post's INT+CHA civic aptitude (small birds boosted, heavyweights penalised — the raven law) cuts up to 30% off every build clock and 15% off every bill via `stewardProjectFactors` in `bird_roles_core.js`. One shared clock helper `villageBuildDurationMs(seed, building, level)` composes guilds × Steward with the 30s floor, and `villageBuildingCost(building, level, seed)` takes an optional seed for the discount — call sites without a seed keep base prices. Old economy-harness tests gained a vacant `villageStewardProject` stub. Contracts: `tests/test_steward_project_manager_20260820.py`.

Earlier release: 2026-08-20 (`burbz-zombie-canon-v291-20260820`) — the first law of the canon: **Burbz names the enemy, and the Z is for zombie.** Yaan's ask, written into the game's law. `STORY.md` gains "The first law — the name of the enemy" at the top: the Burbz are zombie birds raised by the usurper's shadow magic, they have taken over the kingdom, the game bears their name because saving the world from the Burbz is the task, and the player's birds are never Burbz — living birds and companions only. The evil-Burbz section, the dispel rule (raised forms are laid back to rest — still non-gory, nothing living harmed) and the Canon terminology list all restate it; the Kingdom of Burbz carries its captors' name while they hold it. Copy sweep is deliberately small because the game already says "evil Burbz" everywhere it should: the battle tutorial's "Know your enemy" card now teaches the law ("The Burbz are zombie birds — the Z is for zombie." — trimmed to the tutorial suite's 150-character glance cap), and the one line that called the player's birds "your Burbz collection" (the bird-card summary fallback) now says "flies with your free flock". All pinned canon markers ("squads of evil Burbz", "never against free, ordinary birds", "No town is destroyed", "dark magic unravels") kept. Contracts: `tests/test_burbz_zombie_canon_20260820.py`.

Previous release: 2026-08-20 (`empire-badge-quest-prompts-v289-20260820`) — two asks from Yaan. **(1) The Empire tab says when taxes wait.** New `empireCollectiblesWaiting(now)` counts every strongbox holding a full 8-hour cycle — merged settlements via `townHasAccruedTribute`, lone villages via `empireVillageTributePeriods`, caravan routes via `empireTradeRoutePeriods` — and `normalizeActionBadgeState` feeds it to the shared action-badge heartbeat as the `village` count, so the bottom nav's Empire button carries the red badge exactly while the Royal Ledger's COLLECT button would pay, and drops it on the collect (every collect saves, and `durableSaveState` re-runs the badges). No change to `action_badge_core.js` — `'village'` was already in its SCREENS. **(2) A build you can't pay for offers the fix.** The eleven coin/timber build gates (both academy builders, `empireBuildStructure`, `empireOpenTradeRoute`, `empireSendSupplyCart`, `claimCurrentVillage`) stopped toasting and call `showResourceQuestPrompt(kind, need, goal)` instead: a small centred card (`#resourceQuestOverlay`) that names the shortfall and offers "🕊️ SEND BIRDS OUT ON A QUEST". Taking it runs `openQuestBoardCategory` — switches to the quests screen, opens the right drawer (`RESOURCE_QUEST_ROUTES`: coins → `treasure`, branches → `timber`, both drawers hold starter errands so a roost-less player is never stranded), scrolls to it and pulses it (`.quest-category.spotlit`, reduced-motion safe). Stone keeps its Quarry toast — no errand earns stone by design. So the prompt can actually appear, unaffordable build buttons stay tappable: the province yard and Town networks now dim with `.short` instead of `disabled` when the only blocker is the purse (busy builders, locks and maxed levels still disable). `goalWithThe` guards labels that carry their own article ("The Roost"). Contracts: `tests/test_empire_badge_quest_prompts_20260820.py`.

Previous release: 2026-08-20 (`merge-when-ready-v290-20260820`) — merging is the player's own act now, all the way up the ladder. Yaan's ask: no more automatic three-villages-make-a-town; a village must first reach **40 folk and 75% happiness** to earn its **⭐ merge star**, then the player presses Merge on three starred neighbours; the same again for towns (**120 folk, 75%**) merging into a County/region. **The rules** live in new pure `settlement_merge_core.js` (readiness, charter healing, `mergeCandidates`/`validateMerge` over 5 km / 150 km union-find clusters). **Formation** replays SIGNED CHARTERS: `empire.townCharters` / `cityCharters` / `regionCharters` (append-only `{seeds, mergedAt}` rows) flow through `empireMergeCharters()` into `deriveSettlements`/`deriveRegions`/`deriveRealm`, whose new `replayCharters` forms exactly the signed groups — pass no charter options and the old automatic rules still hold for legacy callers and fixtures. Both derivation caches key on the charter signature. **Migration**: `ensureEmpireState` grandfathers pre-v290 saves once (`mergeChartersVersion` 1) — every auto-formed town, city and county is re-signed as a charter, so nothing the player built dissolves; new-progression merges only ever create town and region charters (cities are a grandfathered tier). **Actions**: `empireMergeVillages`/`empireMergeTowns` validate, push the charter, save durably with snapshot rollback, and open the new Hall; gold `merge-banner`s with the three names appear on the Empire tabs, the Town Hall's county section, star badges (rows, hero, governor's desk `merge-progress` line, '⭐ ' atlas prefix in `refreshEmpireMap`), and `maybeAwardMergeStar` queues a one-time corner card when a village crosses the bar (flag `eco.mergeStarSeen`). Liberation now NEVER merges or founds anything — `claimCurrentVillage` lost its whole announcement block, `previewClaimFounding` (kept, charter-aware) returns null for fresh claims, and the claim bar's union note is gone. **The Upgrade tab**: `beginWholesaleUpgrade`/`wholesaleUpgradePlan`/`completeWholesaleWorks` give the Town Hall and County Hall one gold UPGRADE order that raises every home and yard across all wards — summed cost, ONE clock (the longest single build, crews work in parallel), stored in `empire.wholesaleWorks[id]`, completed atomically alongside the other constructions in `tickEmpireConstruction`. **Visiting**: `visitEmpireWard` + `visit-chip` rows on the Town Hall open a merged ward's 3D village read-only (never touches `gameState.lastVillage`); the claim bar shows a "just visiting" banner with BACK TO THE HALL; County Hall holdings rows remain the door into each town. empire_realm_core.js moved so its `?v=` pin rolled to v290 (settlement_merge_core.js ships at v290 in the loader and all three sw lists); `townCountyClusterSize` was removed (its county-rung UI is star-based now). Contracts: `tests/test_merge_when_ready_20260820.py`; the v286 merge-announcement contracts in `test_battle_progression_fixes_20260819.py` were rewritten to the signed-merge behaviour, and `test_training_your_way_20260819.py`'s plumbing gained a CURRENT_BUILD.

Previous release: 2026-08-19 (`training-your-way-v288-20260819`) — the Training Hall works like the quests now. Yaan's ask: the notice board carried too much fluff, and every drill ran one fixed timer; he wants the classic mobile ladder — 15 minutes to 24 hours — where long runs pay less per minute than repeated short ones. **The economy** lives in academy_treehouse_core.js beside the quest-duration maths it mirrors: `TRAINING_DURATION_MINUTES` [15,30,60,120,240,480,1440], `trainingXpMultiplier` ((m/15)^0.8), `trainingStatMultiplier` ((m/15)^0.6 — a day of drills makes a bird stronger, never a different bird), a ^0.5 hunger curve, `trainingRewardsForDuration` and `getTrainingDurationOptions`. Everything is ANCHORED to each template's classic `minutes`, so a run at the classic duration pays byte-identical rewards — old saves, legacy callers and the night-school multipliers (3× XP, 2× stat, applied after duration scaling) all hold. `createTrainingSession` takes `options.durationMinutes`, validates it against the ladder (junk falls back to the classic timer), and stamps `session.durationMinutes`. Wing Sprints reads: 15m ≈ 7 XP (28/h) … 24h ≈ 277 XP (11.5/h) — totals always grow, per-minute pay always falls. Discipline move-tier progress stays 1 session per claimed run at any length, so short runs win that race too, deliberately. **The board** (renderTrainingHallPanel) sheds its fluff: no essay paragraphs, no per-card fixed duration, no 'Send X · fed' labels. One shared dial (`trainingDurationChoice`, default 15; `selectTrainingDuration` re-renders) sits above the drill grid; each card is icon + name + stat/school chip + move line + a live preview ('1h → +1 SPD · +22 XP · 1 move session') + bird-name buttons (hunger still disclosed via data-hunger-state and 'Feed X first'; Night Hunters wear 🌙3×). The dispatch toast names the run length. academy_treehouse_core.js moved, so its `?v=` pin rolled to v288 across index.html, sw.js and every pinning test (that pin is referenced in ~10 suites — the sweep list lives in this file's v287 note). Contracts: `tests/test_training_your_way_20260819.py`; the hunger-disclosure and night-hunter copy pins were updated to the new labels.

Previous release: 2026-08-19 (`mercy-streak-attack-preview-v287-20260819`) — battles turn kind and honest, three asks from Yaan in one release. **(1) The mercy rule replaces the level-12 gate.** Yaan at level 12 with three raptors was destroyed — the v262 early game had just ended for him. Difficulty is no longer gated on the player's level at all: it is gated on the WIN STREAK (`gameState.league.streak`, in `ensureLeagueState`, +1 per win, reset to 0 on any loss). Until the flock takes `MERCY_WIN_STREAK` (4) wins in a row, every squad — league and liberation alike — is a ragged scouting party: `MERCY_OPPONENT_EASE` (0.3 of every stat), at most three birds, never more than the flock, one level below it, no tier boost. From the fourth straight win `MERCY_RAMP_EASE` climbs 0.5 → 0.7 → 0.85, and the seventh brings full strength. One loss and the game is kind again immediately — a losing player can never be stuck in hard fights. The functions are `battleWinStreak` / `isMercyBattles` / `mercyOpponentEase` / `easeMercyOpponents` (the `EARLY_GAME_*` family is gone); the rival cache key carries `_mercy_ws<streak>`; the battle-select screen says where the streak stands (`rival-streak-line`). The first-liberation token garrison is untouched. **(2) Aim, read the damage, then strike.** Attacks resolve in three taps now: tap a move (it stays `pending`), every living rival shows that move's projected damage on its card (`au-dmg-preview`, super-effective green ▲ / resisted grey ▽), tap the rival to lock the target (`target-locked`, 🎯 TARGET flag), and a full-width ATTACK button (`attack-confirm-btn`) names the target and the damage range before anything lands. New pure `previewDamage(attacker, defender, skill, {surge, aoeSplit})` in battle_core.js is computeDamage with the dice removed — variance range 0.9–1.1, no crit, barrier absorption modelled, zero mutation. AoE moves skip aiming and confirm as ATTACK ALL with the squad total; a lone rival aims itself; tapping the chosen move again puts it back; Surge re-prices the preview while armed. Support moves (heal/barrier/rally) still cast on one tap. `battleConfirmAttack` joined the window exposure list. The old double-tap quick-cast is gone. **(3) Parley is retired.** Yaan: it confused him and rarely worked. The move is out of `buildFighter`'s loadout, its resolve branch and AI branch are gone, and `PARLEY`/`PARLEY_WINOVER_HP_PCT`/`charmResolve` left the core's exports. Charm (CHA) keeps its whole out-of-battle life — the Crowbar, diplomacy quests, the envoy — and every copy surface (stat blurb, Crowbar desc, tutorial, STORY.md, the ws18 folio scroll) now tells that truth. The `swayed`/`charmCoins` reward plumbing stays as harmless legacy (always 0). battle_core.js, academy_treehouse_core.js and walking_story_core.js all moved, so their `?v=` pins rolled to v287 across index.html, sw.js and every pinning test. Contracts: `tests/test_mercy_streak_attack_preview_20260819.py`; the old early-game and charm-diplomacy suites were rewritten to pin the new behaviour.

Previous release: 2026-08-19 (`battle-progression-fixes-v286-20260819`) — Yaan's battle-and-progression bug sweep, four fixes in one release. **(1) A bird lost in battle truly reaches the ward now.** `endPerchBattle` marks each fallen fighter `lost` and grants its battle XP with `levelUpBird(bird, xp, { noHeal: true })` — the level-up full-heal is optional now (`options.noHeal`), because it used to heal a fainted bird to full BEFORE `admitFaintedBirdToHospital` ran, whose full-HP guard then refused the admission and left the "lost" bird standing in its old room looking fine (Yaan's peregrine: Training Hall, full health). With no Hospital built, new `restLostBirdOutsideWard` moves the fallen to the Aviary Gardens instead of leaving them at a post; the result screen names both the admitted and the resting. **(2) The liberation victory screen stops lying about tier.** Every battle frees a VILLAGE — "VILLAGE LIBERATED!", "Free the village!" — towns only ever form later, at the birdhouse build, when three claims chain within 5 km (`deriveSettlements`, untouched). The merge is announced by name everywhere it can surprise: new `settlementWardNames` + `previewClaimFounding` (a `deriveSettlements` over claims ∪ candidate — pure, no cache touched) power a `village-claim-note` under the BUILD LIBERATION BIRDHOUSE button ("Raising it unites A, B and C into one town"), the same forewarning on the victory screen, and ward names in both merge toasts — so a neighbouring village can never again silently vanish into a town. **(3) The village → town → county ladder is visible from town management.** `renderTownScreen` gains `townCountySection`: OPEN COUNTY HALL (via `openEmpireRegion`) once `empireRegionOfSeed(settle.heartSeed)` holds, otherwise a "Toward a County" progress line from new `townCountyClusterSize` (core `clusterVillages` at `REGION_RADIUS_KM`). County formation itself (3 towns / 150 km, `deriveRegions`) is untouched; a new sampled world-density contract proves every tested neighbourhood on Earth (~13 km window, 12 latitude bands) holds ≥3 disjoint 5-km-chain village trios — so a town, and in turn a county, is always reachable. **(4) The bottom nav gains an 8th item: FORGE** (`data-screen="forge"`, monoline hammer SVG, between Battle and Academy) — the Fletcher's Forge in one tap; `action_badge_core.js` adds `'forge'` to SCREENS and `normalizeActionBadgeState` feeds `forgeJobsReady().length`, so ready commissions badge the tab. The badge core changed, so its `?v=` moved to v286 in the loader and both sw lists (`test_live_reconcile_v245` repointed per convention). Contracts: `tests/test_battle_progression_fixes_20260819.py`; `test_battle_faint_auto_hospital_20260810.py` and `test_town_liberation_story.py` repinned to the fixed behaviour. STORY.md canonises "The cost of the field, and the honest merge".

Previous release: 2026-08-19 (`settlement-scene-sharp-v285-20260819`) — the 3D villages and towns are sharp and smooth again. The v281 quality profile bucketed every phone into its "low" tier by screen width alone (any short side under 430 CSS px), which rendered the scenes at 1.25x pixel ratio on ~3x phone screens (visible blur), shrank shadow maps from 2048 to 512 (blocky), and skipped animation frames down to ~30fps (judder). v285 reverts all three: `qualityProfile` in `settlement_scene_core.js` now tiers by the chip (cores, `deviceMemory`) and never by screen size — phones get `maxDpr` 2, 2048 shadows and `frameInterval` 0 (native rate), matching the pre-v281 look. In place of guesswork there is measurement: new pure `adaptDetail(state, sample)` judges a rolling ~48-frame stretch of real frame times and steps the render resolution down 0.25 at a time (floor 1.25) only on a device that proves slow — and back up once it recovers; `settlementSceneSampleFrame`/`settlementSceneApplyDpr` in `index.html` wire it into both renderers. The frame path also lost its dead weight: `settlementSceneStageInViewport` caches its `getBoundingClientRect` for 250ms instead of forcing a page reflow every animation frame; the selected-object label caches its anchor and raycaster at selection time (`settlementSceneSetContext`) so `settlementSceneUpdateContext` no longer runs `Box3.setFromObject` over a mesh tree per frame, allocates nothing, and occlusion-casts only against the tappable buildings, not the whole scene. The viewport meta takes back `user-scalable=no` — pinch is a camera/map gesture in this game and the page must not zoom underneath it (this reverses a v281 contract; the old test now asserts the opposite). Everything v281 added that players like — the inspector, physical signs, Town Hall, ambient life, offscreen suspension, reduced-motion support — is untouched, and reduced motion still caps at 33ms frames with zero ambient actors. Contracts: `tests/test_settlement_scene_sharp_20260819.py`; `tests/test_settlement_scene_upgrade_20260817.py` re-pinned to the new quality table.

Previous release: 2026-08-19 (`building-discovery-v284-20260819`) — the trades hide until you walk to them: a settlement's generic shops (the five `VILLAGE_SHOPS` trades — general store, potion shop, smithy, tavern, guild) no longer stand open from the first visit anywhere. New pure core `building_discovery_core.js` keeps the ledger in `gameState.empire.shopDiscoveries` (seed → trade keys found, healed once per session by `sanitizeShopDiscoveries` via `shopDiscoveryState()`). Discovery is real-world: every ordered checkpoint reached on a walking quest (`questOnPositionFix`, event types npc/flag/chest/finish) calls `maybeDiscoverSettlementShop(lat, lon)`, which binds to `nearestVillageTo` within `SHOP_DISCOVERY_RANGE_M` (1200 m, matching `VILLAGE_VISIT_RANGE_M`) and reveals `nextShopDiscovery` — first undiscovered key in `villageShopKeysFor(seed)` order, so the guaranteed general store always leads — paying +15 XP, a toast, and an immediate `saveState()`. Rendering gates: `buildVillageScene` still rolls all trades but only adds discovered ones to the scene (`openShopKeys`; undiscovered trades BURN every rng draw and keep their `claimSpot` plot, so a find pops in without moving anything else — same principle as the cleared-wrecks rule); the town square's per-ward shopfront burns its `tradeRoll` die then deals from `townShopfrontKey(discoveredVillageShopKeys(seed), tradeRoll)` (none found → no shopfront); the 2D fallback lists found trades or an honest hint. Scene caches rebuild on a find via `villageBuiltShopsKey` and a `#s` segment in `townSceneKey`. `villageOpenShop` refuses undiscovered doors through `villageShopIsOpenTo` — with one exception: the player-built Alehouse (`EMPIRE_BUILDINGS` id `tavern`, which shares the shop key) always opens, because player builds are never gated; every other `EMPIRE_BUILDINGS` yard is untouched by this release. The governor's desk gains a `province-trades-line` (found trades · how many still wait). Old saves start with nothing discovered by design — Yaan wants the shops earned on real walks. Contracts: `tests/test_building_discovery_20260819.py`; the town-shopfront pin in `test_village_variation_20260811.py` repointed at the discovery gate.

Previous release: 2026-08-18 (`offroad-side-quests-v283-20260818`) — the roads grow verges: walk 300 m away from your active walking quest's golden route and an off-road side quest opens by itself (v282 is the quest zoom lock below, merged into the same PR — never reuse a number another branch holds). `side_trail_core.js` is the pure brain: `distanceFromRouteM` measures the player against the persisted `quest.route`, and `sideTrailStep` is a tiny hysteresis machine — two consecutive fixes ≥300 m off-route (GPS accuracy ≤80 m) start the wander, one fix back within 150 m banks it, so a single GPS jump can never open or close one. The auto wander reuses the whole existing Side Quest machinery (charting, pocket mode, discoveries) with `active.auto = true`, a `parentQuestId`, and a random name from `sideTrailQuestName` ("The Crooked Byway" and friends); the main quest keeps every marker and its own HUD line, which now appends "🎒 <name> live" while both run. `questOnPositionFix` calls `maybeToggleOffRoadSideQuest` after event handling; `completeWalkingQuest`/`abandonWalkingQuest` bank a still-running auto wander via `endOffRoadSideQuest` (quiet: claims everything, pays capped XP, writes history with `auto: true`, no completion sheet, no walk-goal tick — the main quest counts that). Discoveries gain a fourth kind everywhere: `sideTrailDiscoveryKind` rolls chest/weapon/questgiver/**lore**, and a lore find is one of twelve Wayside Tales — off-road hedge-canon (the usurper's blind spot, the gleaner's right, Merlin's lost feather) persisted on the discovery at spawn, paid +10 XP on claim, deduped into `gameState.sideQuest.waysideTales`, and shelved in the Feathered Folio under its new "🎒 Wayside Tales" section. The manual mutual-exclusion stays: `startSideQuest` still refuses during a walking quest and vice versa — only the auto path may run both, by constructing `sq.active` directly. Contracts: `tests/test_offroad_side_quests_20260818.py`.

Previous release: 2026-08-18 (`quest-zoom-lock-v282-20260818`) — a live walking quest now holds the camera where the trail still fits on screen. Zoomed right in, GPS wobble threw the player marker clear of the drawn footpath and the golden line ran off the edge, so an accurate walk looked wrong. While a quest is active the map keeps a zoom ceiling fitted to the marker ahead: `questWalkZoomCeiling(targetDistM, lat, viewportPx)` inverts the Web Mercator metres-per-pixel (78271.517 × cos(lat) / 2^zoom, MapLibre's 512 px tiles) to frame the player and the next waymarker together, clamped into `QUEST_WALK_ZOOM_FLOOR` 16.8 … `QUEST_WALK_ZOOM_CEILING` 18.2 — well under the free map's `BURBZ_MAX_ZOOM` 19.1, and always above the resting `BURBZ_START_ZOOM` 16.35 so there is room to lean in. `applyQuestZoomLock()` runs on every quest redraw and every position fix (so the ceiling relaxes as you close on a marker and pulls back when the next one is far); it eases out of a too-tight view before closing the ceiling, on `moveend` or a 520 ms fallback timer, because `setMaxZoom` snaps. `clearWalkingQuestFromMap` releases the lock and hands `BURBZ_MAX_ZOOM` back. The + button and pinch stop at `liveMapZoomCeiling()`, with one toast per quest saying why. Read it live via `__burbzMapDebug.questZoomLock` / `questZoomCeiling()`. Contracts: `tests/test_quest_zoom_lock_20260818.py`.

Previous release: 2026-08-17 (`living-settlements-v281-20260817`) — Villages and Towns are now living city-builder spaces rather than debug-like dioramas. Depth-tested timber shop signs replace the always-on-top floating plaques; selection uses one collision- and occlusion-culled screen label plus an accessible inspector. The cohesive v277 Town remains one fixed-view settlement with tappable yards and its ledger, now anchored by a levelled Town/City Hall model. Real economy state drives residents, working carts, horses, cattle, goats, pigs, sheep and overhead birds; build timers drive rising shells, builders, hammering, materials and dust. Both stages gain authored fallback art, camera/HUD controls, keyboard access, responsive layouts, device-aware DPR/shadows/frame caps, reduced-motion behaviour and hidden/offscreen suspension. Keep `settlement_scene_core.js`, its v281 loader/SW/updater pins and `assets/settlements/settlement-loading-v281.webp` aligned. Contracts: `tests/test_settlement_scene_upgrade_20260817.py`, the Town fixed-view/city-builder suites, village variation, daylight, hold-to-steer and service-worker suites.

Previous release: 2026-08-17 (`original-bird-card-art-v280-20260817`) — the cards get their paintings back. `BUILT_IN_BIRD_CARD_ART` snapshots the original complete ImageGen artwork before `applyBurbzMangaWarriorArt20260803` redirects the icon route, so companion cards, Birdex cards, capture reveals and field-guide heroes now use each species' own scenic habitat composition. `birdOnlyImgHTML` still uses the transparent warrior cutouts for Academy actors, map markers, walking companions and other compact/moving UI. `birdCardImgAttrs` no longer asks for a cutout; complete paintings crop edge-to-edge inside their frames, with the transparent warrior plus habitat library retained only as a load-failure fallback. Contracts: `tests/test_original_bird_card_art_20260817.py`.

Previous release: 2026-08-17 (`true-diet-primaries-v279-20260817`) — Bird diet primaries now describe what each species mainly eats while preserving the v278 one-time First Catch quest and the v277 cohesive Town screen. Its diet data and runtime pins remain unchanged by v280.

Previous release: 2026-08-17 (`first-catch-once-v278-20260817`) — teaching quests retire: Yaan's daily board kept re-offering "First Catch — Capture any bird" at level 10 because it lived in `DAILY_QUESTS` and the midnight reset re-opened everything. A daily def can now carry `once: true` plus a `done()` read from real game state (First Catch checks `gameState.player.totalCaptures >= 1`); `initQuests`'s new-day reset marks such a quest spent (`{ progress: target, claimed: true }`) instead of fresh, so it never renders, never progresses and never pops a claim card again — new players still meet it exactly once, and veteran saves retire it on their first new day. Any future one-time teaching daily follows the same shape. Contracts: `tests/test_first_catch_once_20260816.py`. Same day, village-provisions v272 — the villages live off what they grow: Yaan's screenshot showed Kestrelby claiming food and water with no farm or well built, because `VILLAGE_BASE_NEED_CAPACITY` fed the bars from thin air. That constant is now all zeros, and food/water are real stocks-and-flows: `eco.stores` (granary + cistern, sanitised in `ensureVillageEconomy`, seeded with `VILLAGE_RELIEF_SUPPLIES` 30/30 for fresh liberations AND older saves meeting the code for the first time), `villageProvisionRates` (staffed farms +14 food/level/cycle, wells +16 water/level — `workers` yards gate on the crew, and `villageNeedCapacity` now takes an optional crew arg and gates worked need-buildings the same way, so an unstaffed farm feeds nobody), and `villageStoreCapacity` (base 40 + 20 per farm/well level + 40 per level of the new passive 🧺 `storehouse` building, unlock 4). Each `simulateVillageEconomy` cycle the harvest is eaten fresh before the remainder must fit the cellar, then growth requires FULL provisioning (`provisioned`) on top of the old happiness gates, starvation (<50% fed or watered) empties a village at −2/cycle, and a hungry catch-up queues one `village-hunger` completion notice (navigates via `completionNoticeGo` → `openEmpireVillage`). `villageEconomySnapshot` returns `provisions` {rate, store, cap, eats} per flow and honest per-need `served`/`sat`; the governor's desk draws `province-need-sub` granary/cistern lines, warning states, and the 🛒 `empireSendSupplyCart` button (20 🪙 → +12/+12, capped, window-exposed). The old sim/happiness/taxes tail, unity/merged/governance multipliers and the stubborn-few floor are untouched, so the feudal/trade/settlement/empty-town harnesses still pin them; `test_settlement_tiers` extracts the two new functions and `test_citizen_workers` stubs the zeroed base capacity. Contracts: `tests/test_village_provisions_20260816.py`. STORY.md canonises "The folk live off what they grow". Previously completion-notices v265 — the corner learns to speak: classic city-builder / Crusader Kings completion buttons. `gameState.completionNotices` holds up to four saved cards (`COMPLETION_NOTICE_LIMIT`); `queueCompletionNotice` keeps one card per subject (newest wins) and never saves itself — every caller queues inside its own commit, so the empire path queues BEFORE `durableSaveState` and a failed save rolls the card back with the building. `renderCompletionNotices` paints the top-right `#completionNoticeStack` (under the money HUD, hidden on the battle screen via `body[data-active-screen="battle"]`, reduced-motion aware) and prunes quest cards whose quest is already claimed; it rides the action-badge heartbeat (`updateActionBadges`), so claimed quests clear their card on any save/screen switch/30 s tick. Tapping travels then removes: `completionNoticeGo` → `openEmpireVillage(seed)` for empire builds, `focusAcademyBuilding(room)` (golden quest ring + scroll to the tree node) for Academy builds, `focusQuestFromNotice` (Quests screen + `data-quest-card` glow, `.quest-target-card`) for quests; ✕ dismisses. Raised by `empireCompleteConstructions`, `academyBuildBuilding`, `updateQuestProgress` (dailies/weeklies/achievements — including the two absolute-count paths — and the player chain, each the moment it crosses its target) and `completeWalkingQuest`. Side fix: the treehouse quest-guide callout now names the guided room instead of always saying Kitchen & Pantry. Also in v265: the Bird Hospital's "add a bird" list shows each candidate's HP bar (`room-bird-option-hp`, green/yellow/red at ≤35%) with hurt birds sorted first. Contracts: `tests/test_completion_notices_20260813.py`. Previously real-place-names v264 — the world gets real names: every settlement name now comes from `PLACE_NAMES` in `empire_realm_core.js`, 200 hand-written invented names (Wrenfold, Thistlemere, County of Vixenholt) shared by every player — the old injective 14-letter syllable stems read as noise on the map. The SEED stays the only identity: names may repeat far apart like Earth's many Newtons, so save data must never key on a name. `placeName(kind, seed)` maps `(seed % 200) × 73 + rank offset` into the pool: the ×73 stride (coprime with 200) gives any 200 consecutive seeds — neighbouring map cells — 200 different names, and the six rank offsets (0/33/71/107/139/171, all distinct mod 200) stop a capital village, its town and its county sharing a name. The pool's order is API — replace in place or append, never re-sort, insert or delete a shipped entry. Saves rename themselves on boot through the existing `migratePlaceNames` path; `PLACE_NAME_VERSION` stays 2. Contracts: `tests/test_unique_place_names_20260804.py`, rewritten from the old global-uniqueness invariant. Previously feedback-menu-keyless v263: the inbox unlocks from a magic link. `adoptInboxKeyFromLink()` in `index.html` reads `?inboxkey=…` into the shared `burbz_admin_token` slot and scrubs the param from the URL and history, so Yaan taps a link once (Ava mints it on the VPS, where the key lives) and Settings → Feedback Inbox just opens. The server-side `X-Burbz-Admin` check is untouched — keyless for Yaan, locked for everyone else. Previously early-game-until-level-12 v262: the early game keeps its promise: Yaan reported a level-8 player destroyed by a level-5 garrison, because the v240 easy-battles gate ended at the FIRST COUNTY regardless of level. `isEarlyGameBattles()` in `index.html` now reads the player's level (`battlePlayerLevel()` ← `gameState.player.level`) and holds until `EARLY_GAME_ENDS_AT_PLAYER_LEVEL` (12). Through `EARLY_GAME_CRUISE_LEVEL` (8) squads fight at `EARLY_GAME_OPPONENT_EASE` (0.35) with at most three birds and never more than the flock — near-free wins even for one bird of prey plus one large bird. From level 9 `earlyGameOpponentEase()` ramps linearly toward `EARLY_GAME_RAMP_TOP_EASE` (0.95 at the level-12 boundary): ~0.5 at 9, 0.65 at 10, 0.8 at 11, squad cap easing to four; engine-driven sims put the level-11 split at wrong-birds 3% wins vs right-birds 100% (67% HP left; 89% geared) — wrong birds lose, right birds win easily, gear whitewashes. Level 12 restores full difficulty and makes the forge matter. Eased squads still sit at avgLevel−1; the rival cache key carries `_early_game_pl<level>` so a level-up re-rolls the squad; first-liberation garrison and all conquest maths untouched. Tests: `tests/test_early_game_until_level_12_20260813.py`; the v240 suite repointed at the level gate. No core moved — every `?v=` stays put. Previously feedback-menu v259 — the feedback release, renamed and renumbered while merging the week's sessions (born v254, then v258): the settings menu reads the private inbox. Settings gains a 📥 Feedback Inbox row under Send Feedback; `openFeedbackInbox()` in `index.html` unlocks with the admin key — the same `burbz_admin_token` localStorage slot and `X-Burbz-Admin` header `inbox.html` uses, so one unlock covers both — lists every `type:'feedback'` report newest-first with done/reopen/delete actions against `api/admin/reports/:id`, and points at `inbox.html` when new-bird reports wait. The backend lives on the VPS only, so the reader works at yaanbatho.com/burbz; the send path was proven live end-to-end. `inbox.html` joined the live updater's FILES. Previously village-variation v260 (built 2026-08-11 as v250, merged 2026-08-13): no two villages alike — `village_variation_core.js` rolls every settlement seed a DNA card (wall build: timber/stone/brick/painted · roof craft: thatch/slate/tile/shingle · colour washes, trim + door paints, window glow, banner cloth) and re-keys the base `VILLAGE_PALETTES` entry through pure HSL/golden-angle maths, No-Man's-Sky style; `buildVillageScene`'s pinned palette roll survives and is varied per seed, the building/cottage makers read `pal.dna` for their styling, and two new landmarks (wayside shrine, stone watchtower) join the pool. The Town Square's districts now replay each member village's own opening dice (`villagePlan` — bit-identical mulberry32) plus its DNA, so every district wears its real village's palette, tier, plan and one of its true trades — and the landmark ledger (`landmarkPlan`, its own seed-keyed stream ^0x5FCA9B3D) names WHICH landmarks a village raises, so the village scene places exactly those and each district builds its village's signature (picks[0]) from the shared `VILLAGE_LANDMARK_MAKERS` pool. Districts mirror their village's RECOVERY too (`villageDistrictState`: same ruin-stage thresholds, wreck list and rising construction as the village screen; `townSceneKey` carries per-member stage so development rebuilds the square) — the town you see IS the villages you visit. `__burbzTownDebug` joins the localhost-only debug hooks. Previously chef-mastery-feed-all v261 (Ava, built 2026-08-07 as v237, merged 2026-08-13): the Head Chef earns on-duty mastery to Chef Level 10 over nine days, better meal rewards along the way, and a one-tap Feed All that spreads scarce pantry food across every hungry bird by maximum matching; the roles core ships under the chef pin. Previously night-hunter-ascendant v258: the Night Hunter advantage is now truly massive and reaches every capacity. `bird_sleep_core.js`'s `NOCTURNAL_NIGHT_BONUS` rises to coins ×3 / timber ×2 / XP ×3 / two guaranteed extra finds and gains `statBonus: 2` (training stat gains double — `academy_treehouse_core.js` multiplies `template.bonus` by it); the new `NOCTURNAL_NIGHT_BATTLE` pack + `nocturnalNightBattleBoost()` is the battle half — `battle_core.js`'s `buildFighter` accepts `opts.nightBoost` (ATK/SPD/MAG ×1.5, DEF/HP ×1.25, +0.15 crit, stamps `f.nightHunter`; no pack = byte-identical classic stats, and rival squads never get one). `index.html` wires `nocturnalNightBattleBoostFor` into `startPerchBattle`, glows every nocturnal surface after dark (`.night-hunter-aura` pulse, `.pk-night-chip`, `.battle-night-hint`, `.au-night-moon` arena badge — all reduced-motion aware), and teaches the numbers in the send sheet, Training Hall night-school banner, Roost status and toasts. Timers never move — only payouts and stats. Tests: `tests/test_night_hunter_ascendant_20260813.py` plus the rewritten nocturnal suite; the three moved cores' `?v=` pins split out of their old release loops (living-canopy, turn-potions, conquest, diet-integration suites). STORY.md canonises "The hour of the owl". Previously bird-bond-love v256: every bird can now be loved for itself. Players attach to different birds, so each companion carries a personal bond in `bird.bond` — a favourite flag, a bond level 1–5 with warm titles (New Friend → Soulbound, 100 XP each), and a 4-hour preen ritual — all owned by the new `bird_bond_core.js` (sanitize/grant/preen/cooldown, pure and Node-tested). The equipment screen grew a heart toggle on the hero and a Bond panel (hearts, meter, PREEN button with floating-hearts animation); flock cards wear a ❤️ badge and a small hearts row, favourites sort ahead of raw power in Companions, and the card back gains a Favourite button. Every successful companion feed now grants the same `reward.bondXp` Merlin already earned (the Academy tray path uses `FEED_BOND_XP`), so the four feed-path Node harnesses in tests stub `grantBirdBondXp`. Bond is affection only — it never touches battle stats. Tests: `tests/test_bird_bond_love_20260812.py`; the new core joined both sw.js precache lists and the live updater's FILES list. Previously night-owl-dark-mode v257: night mode lands — the game follows the player's real sky (PR #197; shipped without a handbook summary — its contracts live in `tests/test_night_owl_dark_mode_20260813.py`). Previously raven-weight-and-wit v255: a real raven flew over Yaan and the game now honours true bird weight. `bird_size_core.js` gains `FIELD_GUIDE_MASS_G` — real field-guide masses for the hand-curated UK/AU roster, keyed by profile id with a name-slug fallback (measured AVONET provenance still wins, source `'field'` sits between `'mass'` and `'stats'`) — and carrying is now mass-linear: `carryCapacity` = one load per 100 g (`GRAMS_PER_LOAD_UNIT`), max 20 units, so a 1.2 kg Raven hauls 12 to the 510 g Carrion Crow's 5 and a Buzzard 8 to a Robin's 1. `bird_roles_core.js` gains the civic size rule: `steward`/`region_warden` are flagged `civic:true`, rebalanced to INT 0.5/CHA 0.5, and `roleAptitude` multiplies civic aptitude by `governanceWitFactor(sizeScore)` (≤20 → ×1.15, ≤40 → neutral, 100 → ×0.55) — so a robin out-governs a raven while the Library still belongs to the raven. `BIRD_BIOLOGY_STATS_VERSION` bumped to v4 so saves re-derive sizes; the bird card's size panel shows a 🏛️ governing chip and honest "field guide weight" sourcing. STORY.md canonises "The Raven, and the law of weight and wit". Tests: `tests/test_raven_weight_and_wit_20260812.py`; the size/roles suite's generated-stats class ladder moved to tiny/small/LARGE/giant (the stub Buzzard now weighs its true 780 g). Previously citizen-workers-timber-homes v253: the villages become a real city-builder loop. Every producing yard — Grain Farm, Lumber Camp, Quarry, Market Hall, Chapel — now carries `workers: 1` and stands idle until a villager runs it; `villageWorkforce()` deals scarce hands out by `workPriority` (food → timber → stone → trade → chapel) and production, flat coins/timber and the market tax boost all gate on the crew. The stone-free 🛖 Timber Cabin (new `cabin` building, first in `EMPIRE_BUILDINGS`) is the intended first build — coins and timber only — and rebuilds at level 2 into the 🏠 Stone Cottage via the new `tiers`/`costLevels` fields (`villageBuildingTier`, stepped `villageBuildingCost`). The quarry's founding crew is gone (an empty town's quarry cuts nothing; the first-cut 10-stone grant survives), superseding the v221 empty-town pin in `test_quarry_stone_economy_20260804.py`. STORY.md canonises the **village folk**: a separate human-like species, simpler than the birds — residents and workers, never protagonists; birds keep every named part. Previously academy-training-dock v252: the Kitchen/Quests/Stores quick icons moved again, to the bottom dock flanking the Scan orb. Previously hold-to-steer v251: every 3D stage — Academy tree, villages, town squares — now lets the page scroll over it; only a finger held still for ~300 ms grabs the camera (`touch_steer_core.js`, a pure Node-testable gate wired into all three engines), a mouse or pen steers at once and a pinch always steers. The same release moves the Kitchen/Quests/Stores quick icons from mid-right (they covered claim buttons) to the top left under the header, and flips the tutorial's side pointer to match. Previously academy-2d-default v250: the Academy opens in the painted 2D tree — the tutorial's tap-the-tree building step misfired on the 3D canvas on some phones, so `academyViewMode()` now defaults to `'2d'` and only a saved `'3d'` choice opens the 3D tree, which stays one tap away on the same toggle. Previously walking-story-quests v249: The Twenty Roads land — `walking_story_core.js` carries a fixed campaign of 20 real-world walking quests, identical for every player on Earth: tiered to walk size (stroll/ramble/trek), each told by a named NPC with intro/milestone/outro dialogue riding the ordered waymarkers, each hiding a Feathered Folio lore scroll tying the roads to the Academy and Empire canon, and each paying real catalogue gear/materials/xp-scrolls on first completion. `index.html` attaches the next untold tale at quest activation and keeps completion/scroll state in `gameState.walkingStories`. Previously conquest-world-levels v248: conquest difficulty lands — `world_level_core.js` turns the realm pyramid into a WORLD LEVEL, liberation garrisons fight at their land's stamped level (world level + distance band from the cradle village), the atlas stamps dark villages with AC-style recommended levels and danger colours, the Fletcher's Forge gains five upgradeable hearths that gate rarities and temper all equipped gear (`gameState.forgeLevel`), and `battleRewards` scales with the beaten squad's level. Early-game easy battles are untouched. Previously battle-faint auto-hospital v247: a bird knocked out in battle is carried straight to the Bird Hospital by `admitFaintedBirdToHospital` in `endPerchBattle` — no player taps — and the v239 discharge sweep sends it home at full HP. This release also moves the newest-release test pins on from v245, which find-your-bird-v246 had left behind. Over live reconcile v245: the production server had advanced through five releases that never reached GitHub — birdex-direct-recruit-v240 … distributed-game-hud-v244 — while main advanced through four others, and the auto-deploy's drift guard correctly froze all updates. The live deltas were recovered byte-exact over HTTPS and three-way merged; both lineages survive in `BURBZ_CACHE`. **Lesson repeated from v217: work deployed straight to the VPS without a PR WILL collide — always promote through GitHub.**

Previous release: 2026-08-16 (`mobile-fresh-update-v274-20260816`) — Phone updates now land reliably without touching the save. Service-worker registration starts immediately with `updateViaCache: 'imports'`, rechecks on page restore, focus, foreground and reconnection, and retries once in-session. Installation blocks only on the current document and changed Town runtimes; large shell files are best-effort and bounded. Activation validates prior caches and retains the newest demonstrably complete shell as an offline fallback, consulted only after the current cache. Hidden/frozen phone clients refresh after activation without holding the lifecycle open, while the existing one-shot controller takeover handles visible clients. Contracts: `tests/test_sw_self_update_20260728.py` and `tests/test_service_worker_cache_ownership_20260715.py`.

Previous release: 2026-08-16 (`town-strategy-v273-20260816`) — Towns are now the durable strategy layer. Three nearby villages are consumed into one permanent Town, those member records remain canonical for save/economy compatibility, and every player-facing route redirects to the Town Hall instead of reopening a ward. The Town screen retains its 3D square while adding a shared strongbox, Hall levels, limited builder slots, aggregate building networks, restoration work, policies with real output trade-offs, staffing/provisions visibility and supply carts. Stone is part of Hall costs and Industry output; Growth only adds residents when food and water are fully provisioned. Three nearby Towns (nine villages) now found a County, so County governance no longer competes with the first Town. Town/City formation replays claim chronology in exact trios, so later bridge claims cannot rename or merge established Towns. The old village economies, ruins, construction timers, tribute clocks and civic posts are conserved underneath the Town projection. `town_strategy_core.js` is a critical offline asset; keep its loader, service-worker and live-updater pins together with `empire_realm_core.js`. Contracts: `tests/test_town_strategy_20260816.py` plus the settlement, Town/County, feudal, stone, workforce, provisions and completion-notice suites.

Last curated: 2026-08-16 (village-provisions v272 — the villages live off what they grow: Yaan's screenshot showed Kestrelby claiming food and water with no farm or well built, because `VILLAGE_BASE_NEED_CAPACITY` fed the bars from thin air. That constant is now all zeros, and food/water are real stocks-and-flows: `eco.stores` (granary + cistern, sanitised in `ensureVillageEconomy`, seeded with `VILLAGE_RELIEF_SUPPLIES` 30/30 for fresh liberations AND older saves meeting the code for the first time), `villageProvisionRates` (staffed farms +14 food/level/cycle, wells +16 water/level — `workers` yards gate on the crew, and `villageNeedCapacity` now takes an optional crew arg and gates worked need-buildings the same way, so an unstaffed farm feeds nobody), and `villageStoreCapacity` (base 40 + 20 per farm/well level + 40 per level of the new passive 🧺 `storehouse` building, unlock 4). Each `simulateVillageEconomy` cycle the harvest is eaten fresh before the remainder must fit the cellar, then growth requires FULL provisioning (`provisioned`) on top of the old happiness gates, starvation (<50% fed or watered) empties a village at −2/cycle, and a hungry catch-up queues one `village-hunger` completion notice (navigates via `completionNoticeGo` → `openEmpireVillage`). `villageEconomySnapshot` returns `provisions` {rate, store, cap, eats} per flow and honest per-need `served`/`sat`; the governor's desk draws `province-need-sub` granary/cistern lines, warning states, and the 🛒 `empireSendSupplyCart` button (20 🪙 → +12/+12, capped, window-exposed). The old sim/happiness/taxes tail, unity/merged/governance multipliers and the stubborn-few floor are untouched, so the feudal/trade/settlement/empty-town harnesses still pin them; `test_settlement_tiers` extracts the two new functions and `test_citizen_workers` stubs the zeroed base capacity. Contracts: `tests/test_village_provisions_20260816.py`. STORY.md canonises "The folk live off what they grow". Previously completion-notices v265 — the corner learns to speak: classic city-builder / Crusader Kings completion buttons. `gameState.completionNotices` holds up to four saved cards (`COMPLETION_NOTICE_LIMIT`); `queueCompletionNotice` keeps one card per subject (newest wins) and never saves itself — every caller queues inside its own commit, so the empire path queues BEFORE `durableSaveState` and a failed save rolls the card back with the building. `renderCompletionNotices` paints the top-right `#completionNoticeStack` (under the money HUD, hidden on the battle screen via `body[data-active-screen="battle"]`, reduced-motion aware) and prunes quest cards whose quest is already claimed; it rides the action-badge heartbeat (`updateActionBadges`), so claimed quests clear their card on any save/screen switch/30 s tick. Tapping travels then removes: `completionNoticeGo` → `openEmpireVillage(seed)` for empire builds, `focusAcademyBuilding(room)` (golden quest ring + scroll to the tree node) for Academy builds, `focusQuestFromNotice` (Quests screen + `data-quest-card` glow, `.quest-target-card`) for quests; ✕ dismisses. Raised by `empireCompleteConstructions`, `academyBuildBuilding`, `updateQuestProgress` (dailies/weeklies/achievements — including the two absolute-count paths — and the player chain, each the moment it crosses its target) and `completeWalkingQuest`. Side fix: the treehouse quest-guide callout now names the guided room instead of always saying Kitchen & Pantry. Also in v265: the Bird Hospital's "add a bird" list shows each candidate's HP bar (`room-bird-option-hp`, green/yellow/red at ≤35%) with hurt birds sorted first. Contracts: `tests/test_completion_notices_20260813.py`. Previously real-place-names v264 — the world gets real names: every settlement name now comes from `PLACE_NAMES` in `empire_realm_core.js`, 200 hand-written invented names (Wrenfold, Thistlemere, County of Vixenholt) shared by every player — the old injective 14-letter syllable stems read as noise on the map. The SEED stays the only identity: names may repeat far apart like Earth's many Newtons, so save data must never key on a name. `placeName(kind, seed)` maps `(seed % 200) × 73 + rank offset` into the pool: the ×73 stride (coprime with 200) gives any 200 consecutive seeds — neighbouring map cells — 200 different names, and the six rank offsets (0/33/71/107/139/171, all distinct mod 200) stop a capital village, its town and its county sharing a name. The pool's order is API — replace in place or append, never re-sort, insert or delete a shipped entry. Saves rename themselves on boot through the existing `migratePlaceNames` path; `PLACE_NAME_VERSION` stays 2. Contracts: `tests/test_unique_place_names_20260804.py`, rewritten from the old global-uniqueness invariant. Previously feedback-menu-keyless v263: the inbox unlocks from a magic link. `adoptInboxKeyFromLink()` in `index.html` reads `?inboxkey=…` into the shared `burbz_admin_token` slot and scrubs the param from the URL and history, so Yaan taps a link once (Ava mints it on the VPS, where the key lives) and Settings → Feedback Inbox just opens. The server-side `X-Burbz-Admin` check is untouched — keyless for Yaan, locked for everyone else. Previously early-game-until-level-12 v262: the early game keeps its promise: Yaan reported a level-8 player destroyed by a level-5 garrison, because the v240 easy-battles gate ended at the FIRST COUNTY regardless of level. `isEarlyGameBattles()` in `index.html` now reads the player's level (`battlePlayerLevel()` ← `gameState.player.level`) and holds until `EARLY_GAME_ENDS_AT_PLAYER_LEVEL` (12). Through `EARLY_GAME_CRUISE_LEVEL` (8) squads fight at `EARLY_GAME_OPPONENT_EASE` (0.35) with at most three birds and never more than the flock — near-free wins even for one bird of prey plus one large bird. From level 9 `earlyGameOpponentEase()` ramps linearly toward `EARLY_GAME_RAMP_TOP_EASE` (0.95 at the level-12 boundary): ~0.5 at 9, 0.65 at 10, 0.8 at 11, squad cap easing to four; engine-driven sims put the level-11 split at wrong-birds 3% wins vs right-birds 100% (67% HP left; 89% geared) — wrong birds lose, right birds win easily, gear whitewashes. Level 12 restores full difficulty and makes the forge matter. Eased squads still sit at avgLevel−1; the rival cache key carries `_early_game_pl<level>` so a level-up re-rolls the squad; first-liberation garrison and all conquest maths untouched. Tests: `tests/test_early_game_until_level_12_20260813.py`; the v240 suite repointed at the level gate. No core moved — every `?v=` stays put. Previously feedback-menu v259 — the feedback release, renamed and renumbered while merging the week's sessions (born v254, then v258): the settings menu reads the private inbox. Settings gains a 📥 Feedback Inbox row under Send Feedback; `openFeedbackInbox()` in `index.html` unlocks with the admin key — the same `burbz_admin_token` localStorage slot and `X-Burbz-Admin` header `inbox.html` uses, so one unlock covers both — lists every `type:'feedback'` report newest-first with done/reopen/delete actions against `api/admin/reports/:id`, and points at `inbox.html` when new-bird reports wait. The backend lives on the VPS only, so the reader works at yaanbatho.com/burbz; the send path was proven live end-to-end. `inbox.html` joined the live updater's FILES. Previously village-variation v260 (built 2026-08-11 as v250, merged 2026-08-13): no two villages alike — `village_variation_core.js` rolls every settlement seed a DNA card (wall build: timber/stone/brick/painted · roof craft: thatch/slate/tile/shingle · colour washes, trim + door paints, window glow, banner cloth) and re-keys the base `VILLAGE_PALETTES` entry through pure HSL/golden-angle maths, No-Man's-Sky style; `buildVillageScene`'s pinned palette roll survives and is varied per seed, the building/cottage makers read `pal.dna` for their styling, and two new landmarks (wayside shrine, stone watchtower) join the pool. The Town Square's districts now replay each member village's own opening dice (`villagePlan` — bit-identical mulberry32) plus its DNA, so every district wears its real village's palette, tier, plan and one of its true trades — and the landmark ledger (`landmarkPlan`, its own seed-keyed stream ^0x5FCA9B3D) names WHICH landmarks a village raises, so the village scene places exactly those and each district builds its village's signature (picks[0]) from the shared `VILLAGE_LANDMARK_MAKERS` pool. Districts mirror their village's RECOVERY too (`villageDistrictState`: same ruin-stage thresholds, wreck list and rising construction as the village screen; `townSceneKey` carries per-member stage so development rebuilds the square) — the town you see IS the villages you visit. `__burbzTownDebug` joins the localhost-only debug hooks. Previously chef-mastery-feed-all v261 (Ava, built 2026-08-07 as v237, merged 2026-08-13): the Head Chef earns on-duty mastery to Chef Level 10 over nine days, better meal rewards along the way, and a one-tap Feed All that spreads scarce pantry food across every hungry bird by maximum matching; the roles core ships under the chef pin. Previously night-hunter-ascendant v258: the Night Hunter advantage is now truly massive and reaches every capacity. `bird_sleep_core.js`'s `NOCTURNAL_NIGHT_BONUS` rises to coins ×3 / timber ×2 / XP ×3 / two guaranteed extra finds and gains `statBonus: 2` (training stat gains double — `academy_treehouse_core.js` multiplies `template.bonus` by it); the new `NOCTURNAL_NIGHT_BATTLE` pack + `nocturnalNightBattleBoost()` is the battle half — `battle_core.js`'s `buildFighter` accepts `opts.nightBoost` (ATK/SPD/MAG ×1.5, DEF/HP ×1.25, +0.15 crit, stamps `f.nightHunter`; no pack = byte-identical classic stats, and rival squads never get one). `index.html` wires `nocturnalNightBattleBoostFor` into `startPerchBattle`, glows every nocturnal surface after dark (`.night-hunter-aura` pulse, `.pk-night-chip`, `.battle-night-hint`, `.au-night-moon` arena badge — all reduced-motion aware), and teaches the numbers in the send sheet, Training Hall night-school banner, Roost status and toasts. Timers never move — only payouts and stats. Tests: `tests/test_night_hunter_ascendant_20260813.py` plus the rewritten nocturnal suite; the three moved cores' `?v=` pins split out of their old release loops (living-canopy, turn-potions, conquest, diet-integration suites). STORY.md canonises "The hour of the owl". Previously bird-bond-love v256: every bird can now be loved for itself. Players attach to different birds, so each companion carries a personal bond in `bird.bond` — a favourite flag, a bond level 1–5 with warm titles (New Friend → Soulbound, 100 XP each), and a 4-hour preen ritual — all owned by the new `bird_bond_core.js` (sanitize/grant/preen/cooldown, pure and Node-tested). The equipment screen grew a heart toggle on the hero and a Bond panel (hearts, meter, PREEN button with floating-hearts animation); flock cards wear a ❤️ badge and a small hearts row, favourites sort ahead of raw power in Companions, and the card back gains a Favourite button. Every successful companion feed now grants the same `reward.bondXp` Merlin already earned (the Academy tray path uses `FEED_BOND_XP`), so the four feed-path Node harnesses in tests stub `grantBirdBondXp`. Bond is affection only — it never touches battle stats. Tests: `tests/test_bird_bond_love_20260812.py`; the new core joined both sw.js precache lists and the live updater's FILES list. Previously night-owl-dark-mode v257: night mode lands — the game follows the player's real sky (PR #197; shipped without a handbook summary — its contracts live in `tests/test_night_owl_dark_mode_20260813.py`). Previously raven-weight-and-wit v255: a real raven flew over Yaan and the game now honours true bird weight. `bird_size_core.js` gains `FIELD_GUIDE_MASS_G` — real field-guide masses for the hand-curated UK/AU roster, keyed by profile id with a name-slug fallback (measured AVONET provenance still wins, source `'field'` sits between `'mass'` and `'stats'`) — and carrying is now mass-linear: `carryCapacity` = one load per 100 g (`GRAMS_PER_LOAD_UNIT`), max 20 units, so a 1.2 kg Raven hauls 12 to the 510 g Carrion Crow's 5 and a Buzzard 8 to a Robin's 1. `bird_roles_core.js` gains the civic size rule: `steward`/`region_warden` are flagged `civic:true`, rebalanced to INT 0.5/CHA 0.5, and `roleAptitude` multiplies civic aptitude by `governanceWitFactor(sizeScore)` (≤20 → ×1.15, ≤40 → neutral, 100 → ×0.55) — so a robin out-governs a raven while the Library still belongs to the raven. `BIRD_BIOLOGY_STATS_VERSION` bumped to v4 so saves re-derive sizes; the bird card's size panel shows a 🏛️ governing chip and honest "field guide weight" sourcing. STORY.md canonises "The Raven, and the law of weight and wit". Tests: `tests/test_raven_weight_and_wit_20260812.py`; the size/roles suite's generated-stats class ladder moved to tiny/small/LARGE/giant (the stub Buzzard now weighs its true 780 g). Previously citizen-workers-timber-homes v253: the villages become a real city-builder loop. Every producing yard — Grain Farm, Lumber Camp, Quarry, Market Hall, Chapel — now carries `workers: 1` and stands idle until a villager runs it; `villageWorkforce()` deals scarce hands out by `workPriority` (food → timber → stone → trade → chapel) and production, flat coins/timber and the market tax boost all gate on the crew. The stone-free 🛖 Timber Cabin (new `cabin` building, first in `EMPIRE_BUILDINGS`) is the intended first build — coins and timber only — and rebuilds at level 2 into the 🏠 Stone Cottage via the new `tiers`/`costLevels` fields (`villageBuildingTier`, stepped `villageBuildingCost`). The quarry's founding crew is gone (an empty town's quarry cuts nothing; the first-cut 10-stone grant survives), superseding the v221 empty-town pin in `test_quarry_stone_economy_20260804.py`. STORY.md canonises the **village folk**: a separate human-like species, simpler than the birds — residents and workers, never protagonists; birds keep every named part. Previously academy-training-dock v252: the Kitchen/Quests/Stores quick icons moved again, to the bottom dock flanking the Scan orb. Previously hold-to-steer v251: every 3D stage — Academy tree, villages, town squares — now lets the page scroll over it; only a finger held still for ~300 ms grabs the camera (`touch_steer_core.js`, a pure Node-testable gate wired into all three engines), a mouse or pen steers at once and a pinch always steers. The same release moves the Kitchen/Quests/Stores quick icons from mid-right (they covered claim buttons) to the top left under the header, and flips the tutorial's side pointer to match. Previously academy-2d-default v250: the Academy opens in the painted 2D tree — the tutorial's tap-the-tree building step misfired on the 3D canvas on some phones, so `academyViewMode()` now defaults to `'2d'` and only a saved `'3d'` choice opens the 3D tree, which stays one tap away on the same toggle. Previously walking-story-quests v249: The Twenty Roads land — `walking_story_core.js` carries a fixed campaign of 20 real-world walking quests, identical for every player on Earth: tiered to walk size (stroll/ramble/trek), each told by a named NPC with intro/milestone/outro dialogue riding the ordered waymarkers, each hiding a Feathered Folio lore scroll tying the roads to the Academy and Empire canon, and each paying real catalogue gear/materials/xp-scrolls on first completion. `index.html` attaches the next untold tale at quest activation and keeps completion/scroll state in `gameState.walkingStories`. Previously conquest-world-levels v248: conquest difficulty lands — `world_level_core.js` turns the realm pyramid into a WORLD LEVEL, liberation garrisons fight at their land's stamped level (world level + distance band from the cradle village), the atlas stamps dark villages with AC-style recommended levels and danger colours, the Fletcher's Forge gains five upgradeable hearths that gate rarities and temper all equipped gear (`gameState.forgeLevel`), and `battleRewards` scales with the beaten squad's level. Early-game easy battles are untouched. Previously battle-faint auto-hospital v247: a bird knocked out in battle is carried straight to the Bird Hospital by `admitFaintedBirdToHospital` in `endPerchBattle` — no player taps — and the v239 discharge sweep sends it home at full HP. This release also moves the newest-release test pins on from v245, which find-your-bird-v246 had left behind. Over live reconcile v245: the production server had advanced through five releases that never reached GitHub — birdex-direct-recruit-v240 … distributed-game-hud-v244 — while main advanced through four others, and the auto-deploy's drift guard correctly froze all updates. The live deltas were recovered byte-exact over HTTPS and three-way merged; both lineages survive in `BURBZ_CACHE`. **Lesson repeated from v217: work deployed straight to the VPS without a PR WILL collide — always promote through GitHub.**)

---

## 1. What Burbz is

Burbz is a **birdwatching adventure PWA** — a static, offline-first web app
served from GitHub Pages at `https://burbz.app` (see `CNAME`). You walk in the
real world, Merlin's wand (the microphone) listens for birdsong, and confirmed
species unlock birds you can recruit, feed, level up, and battle. The fiction
lives in [`STORY.md`](STORY.md); licensing of every third-party dataset and
asset lives in [`LICENSING.md`](LICENSING.md).

**The name law (first law of the canon):** Burbz names the ENEMY — the
usurper's zombie flock, and the Z is for zombie. The game is named after the
threat the player must save the world from. Player-facing copy must never call
the player's own birds "Burbz"; they are birds and companions. The Kingdom of
Burbz carries its captors' name while they hold it. Full canon: `STORY.md`,
"The first law".

**The whole app is static.** There is no application server in this repo. It is
HTML + vanilla JS + JSON data + a service worker. That is a feature: it can
never break because a backend went down, because there is no backend.

---

## 2. The shape of the code

Burbz grew as a monolith with satellite modules. Here is the honest map.

| Thing | What it is |
| --- | --- |
| `index.html` (~1.7 MB) | The entire game. UI, state, screens, the sound listener, scan economy, tutorial — all inline in one big `<script>`. This is the heart. When a test says `assert "..." in HTML`, it is pinning a contract against a string in here. |
| `*_core.js` | Extracted, individually-testable modules (`scan_economy_core.js`, `bird_diet_hunger_core.js`, `diet_hunger_core.js`, `merlin_companion_core.js`, `quest_core.js`, `academy_*_core.js`, `battle_core.js`, `empire_map_core.js`, `empire_realm_core.js`, …). Each is loaded by `index.html` **and** `require()`d by a test. They export via the `(function(root){ … })(globalThis)` UMD-ish pattern so they run in both the browser and Node. `empire_realm_core.js` is the Crusader-Kings endgame maths: Town→County clustering plus the NESTED feudal pyramid (`deriveRealm`: 3 Towns/9 villages → County, 2 counties/600 km → Duchy, 2 duchies/2000 km → Kingdom, 2 kingdoms → Empire — every tier made of the tier below, never of raw village headcounts), liege-aware crown titles and unity taxes (`crownTitle`, `regionUnityBonus`), county map-coverage radius (`regionCoverageRadiusKm`), and trade-route income/cost/arcs; `index.html` surfaces none of it until the first county actually exists — from then on each county is run from its own County Hall screen (code ids keep the historical `region` name: `screen-region`). |
| `*_bird_expansion*.js`, `national_bird_completion_20260715.js` | Generated species catalogues (UK, AU, national). Large. Loaded by both `index.html` and `sw.js` via `importScripts`. |
| `data/` | JSON the game reads at runtime. **`data/bird-diet-records.json` / `.js` are generated — do not hand-edit** (see §4). |
| `data/national-bird-completion/source-cache/` | Committed copies of the external source datasets (EltonTraits, AVONET, geoboundaries, …) so the build/verify pipeline is reproducible offline. Large files live here on purpose. |
| `bird-art-cache/` and `bird-art-cache/cutouts/` | Bird card art (`*.png`) and transparent cutouts. **Stored in Git LFS** (see §5). |
| `empire_grid_core.js` | The Empire screen's colour ladder (`empire-grid-v322-20260825`). Pure: given one holding's plain facts it names the single thing that holding wants most, as an id + tone + icon + line of words. Reads no game globals, so the whole ladder is unit-tested in bare Node. |
| `sw.js` | Service worker: precache list + versioned cache name. Governs offline behaviour and self-update (see §6). |
| `sound_id/` | Pluggable birdsong-ID providers (BirdNET v3, perch, …) + a tiny local server integration used only in dev. |
| `tests/` + `test_continuous_scan_economy.py` | The safety net: ~650 pytest tests plus a couple of Node tests. See §3. |
| `scripts/` | Build/verify tools. The important one is `check_bird_diets.py` (§4). |

### Mental model
- **`index.html` is the truth for behaviour.** Most tests read it as text and
  assert that specific functions, ids, and constants exist. That means renaming
  a function or changing a string literal can break a test even though the code
  still "works". Before you rename something, grep the tests for it.
- **`*_core.js` modules are the truth for logic you can unit-test.** Prefer
  putting new testable logic in a core module and calling it from `index.html`.

---

## 3. Running the tests

From `public/burbz/`:

```bash
python3 -m pytest tests/ test_continuous_scan_economy.py -q
```

### First-run setup (fresh container)
The suite needs a few things that are not in the repo:

```bash
pip3 install pytest pillow requests numpy flask
# flask may collide with the OS 'blinker' package; if so:
pip3 install flask --ignore-installed blinker
```

- **Git LFS must be hydrated** or ~5 image tests fail with
  `PIL.UnidentifiedImageError` / tiny 132-byte files. See §5.
- **The diet oracle** (`BirdFuncDat.txt`) must be resolvable. It now falls back
  to the committed cache automatically, so no manual download is needed. See §4.

### Expected result
`653 passed, 18 skipped` with only LFS hydrated and pillow installed. With
`numpy`+`flask` too, most skips light up and pass. The remaining legitimate
skips are for a **production server module that is intentionally not in this
repo** (`test_national_bird_integration`, `test_scan_anti_cheat…`) — those are
not failures, do not try to "fix" them by inventing a server here.

### Node tests
```bash
node tests/test_audio_core_20260726.js
```
The `run_*_evidence.js` files are Playwright evidence generators, not unit
tests; they need a browser and are not part of the green-bar contract.

---

## 4. The diet data pipeline (read before touching diet data)

Bird diets are **derived from a real scientific dataset**, not made up:
EltonTraits 1.0 `BirdFuncDat` (Wilman et al. 2014, `doi:10.1890/13-1917.1`,
CC BY 4.0). The pipeline is deterministic and drift-guarded.

- **Generator/verifier:** `scripts/check_bird_diets.py`
  - `python3 scripts/check_bird_diets.py` — regenerate the artifacts.
  - `python3 scripts/check_bird_diets.py --check` — fail if anything drifted.
- **Inputs:** `data/national-bird-completion/profiles.json` (951 species) +
  `data/catalogue-species.json` (every OTHER playable bird — see below) +
  the oracle.
- **Outputs (generated — do not hand-edit):**
  `data/bird-diet-records.json` (has both `records` = the 951 profiles + Merlin,
  and `catalogueRecords` = every catalogue bird), `data/bird-diet-records.js`,
  `data/bird-diet-provenance-summary.json`.

### Full-catalogue coverage (why the gull now eats fish)
The 951 profiles are NOT every bird the game can show. The UK/AU expansion
catalogues (`*_bird_expansion*.js`) and the BOU alias overlay add hundreds more,
and those used to have NO diet record — so at runtime they fell to the generic
"unmatched" fallback that refuses fish and claims invertebrates/seeds/fruit.
That is why a Yellow-legged Gull (`Larus michahellis`, a 40%-fish larid that IS
in BirdFuncDat) refused fish.

- `scripts/build_catalogue_species.js` loads those catalogue modules and writes
  every playable non-profile bird's `(name, scientific)` to
  `data/catalogue-species.json` (generated — re-run `node
  scripts/build_catalogue_species.js` after changing a catalogue file; `--check`
  fails on drift).
- `check_bird_diets.py` then mints a `catalogueRecords` entry for each one using
  the same matcher plus a **genus fallback** (exact scientific → scientific
  alias → common name → **genus** → family → unmatched). `CATALOGUE_SCIENTIFIC_ALIASES`
  maps modern splits/renames (Coloeus, Astur, Curruca, Spatula, Mareca, …) to the
  BirdFuncDat name that carries the same bird's diet. Target: **zero** unmatched
  catalogue birds (the report prints `Catalogue unresolved count: 0`).
- The runtime core (`bird_diet_hunger_core.js`) indexes `catalogueRecords`
  alongside `records`. The shipped browser records are trimmed
  (`CATALOGUE_RUNTIME_FIELDS`) so full coverage costs ~1 MB; the disclosure card
  regenerates a diet sentence when `education` is absent (curated refinements
  keep theirs).
- **Omnivores:** `OMNIVORE_PRIMARY_FRACTION` (0.7) promotes every family within
  reach of the top one to PRIMARY, so a generalist has several full-meal foods
  and a specialist keeps one. Don't lower it past ~0.65 or the Great Spotted
  Woodpecker's seed (a curated *secondary*) becomes a co-primary.
- **Vertebrate prey is split (v237):** `small_mammals` means warm-blooded prey
  only (Diet-Vend / Diet-Vunk); cold-blooded prey (Diet-Vect: frogs, lizards)
  is its own `reptiles_amphibians` family, where the Common Frog and Common
  Lizard ingredients now live. The split is asymmetric on purpose: every
  mammal-hunter also scores `reptiles_amphibians` at its Diet-Vend level
  (a Kestrel's lizards, an owl's frogs — EltonTraits often records no
  Diet-Vect for them), but Diet-Vect alone never grants mammals. That is the
  fix for the reported "Mallards eat voles" bug (Mallard: Vend 0, Vect 10) —
  see `tests/test_mallard_vertebrate_prey_split_20260809.py`.
- **Head Chef service board:** with a chef appointed, the kitchen renders
  `kitchenHeadChefBoardHTML()` — foods listed with the birds that eat each — and
  `chefServeFoodToEveryEater()` plates one food to every hungry eater across
  species. Both are in `index.html`; tests in
  `tests/test_full_catalogue_diets_and_chef_board_20260805.py`.

### The oracle resolution order (why it no longer breaks)
The script and the diet tests resolve `BirdFuncDat.txt` as:
1. `--source PATH` if you pass one,
2. `/tmp/BirdFuncDat.txt` (legacy fast-iteration download spot),
3. **`data/national-bird-completion/source-cache/BirdFuncDat.txt`** — committed,
   so a fresh clone verifies offline with zero setup.

The oracle bytes are pinned by `EXPECTED_SHA256` in the script and
`BIRDFUNCDAT_SHA256` in the tests. The generated artifact records a **stable,
repo-relative** source path (not an absolute `/tmp/...` path) so the output is
byte-identical no matter where the oracle was read from. If you ever refresh the
dataset: update both SHA constants, re-run with no `--check` to regenerate, then
`--check` to confirm, and commit the regenerated artifacts together.

---

## 5. Git LFS — the one that bites hardest

`bird-art-cache/**/*.png` and `*.mp4` are tracked in **Git LFS** (see
`.gitattributes`). On a machine without git-lfs, these are 132-byte pointer
files, and any code/test that reads them as images fails.

```bash
git lfs install --local
git lfs pull            # hydrate real bytes
```

### Deploy must hydrate LFS
`.github/workflows/pages.yml` checks out with **`lfs: true`**. This is
load-bearing: without it, GitHub Pages ships pointer files and every bird image
on the live site is broken. **Do not remove that flag.** (This was a real,
silent production bug fixed on 2026-07-31.)

### The quota is the real constraint (read before adding any art route)
GitHub's free LFS allowance is **1 GB of storage and 1 GB of download a month**,
and this repo holds ~1.6 GB of art. When the download allowance is spent GitHub
**blocks** further LFS downloads — which takes the Pages deploy down with it, as
it did daily from 2026-08-20. There is no billing on the account, so the only
lever is spending less.

**The rule, from `art-same-origin-v325-20260825`: nothing the game ships and
nothing the deploy runs may fetch art from GitHub.** Every art path stays a
same-origin `/burbz/…` URL. `test_art_same_origin_20260825.py` pins this, and
`tests/run_art_same_origin_evidence.js` proves it in a real browser.

- **Never** re-introduce a rewrite onto `github.com/…/raw/…`. One rewrite costs
  one LFS download per file **per player**, and the service worker precache
  multiplies that by ~292 on every install.
- **Never** make the deploy script download art. `scripts/update-live-burbz.sh`
  sources every art file from the repo checkout or the live directory, and keeps
  the LFS-pointer guard so an unhydrated checkout fails loudly rather than
  shipping 132 bytes of text where a painting belongs.
- Backups live at `/var/backups/burbz-art/burbz-art-<date>/`, outside the web
  root and outside every checkout, with a sha256 manifest. That backup plus the
  untouched copy in Git LFS is what makes the local source safe.
- Before changing anything about art, run `scripts/check-burbz-art-on-vps.sh`.
  It enumerates every art URL the game can request and checks each against the
  live site, failing anything that answers with fewer than 300 bytes.

---

## 6. The service worker (`sw.js`)

- `BURBZ_CACHE` is a long, ever-growing version string. **Bumping it is how a
  new release reaches users** — an old cache is only replaced when the name
  changes. When you ship a user-visible change, append a new `-vNNN-YYYYMMDD-...`
  segment. `test_service_worker_cache_ownership_*` and `test_sw_self_update_*`
  guard the mechanics.
- `BURBZ_ASSETS` is the precache list. Every local `./…` entry must exist on
  disk (there is a test, and a quick check in §8). Cache-busting `?v=` suffixes
  are fine and expected.
- Expansion **art** for the big catalogues is precached like everything else,
  **same-origin** (`UK50_LOCAL_ART` / `UK50_LOCAL_CUTOUTS`). It used to be
  fetched from GitHub `raw`; that cost one LFS download per file per install,
  for every player, and it is exactly what exhausted the quota. See §5.

---

## 7. Invariants that must never break

If you remember nothing else, remember these:

1. **Deploy checks out with `lfs: true`.** (§5)
2. **Diet artifacts are generated and drift-checked** — regenerate with the
   script, never hand-edit; keep the two SHA constants in sync. (§4)
3. **Bump `BURBZ_CACHE`** on any user-visible change or users get stale code. (§6)
4. **Sound-listener generation guards.** The continuous listener uses
   `soundListenerGeneration` counters so stale permission/recorder callbacks
   can't resurrect a stopped session. Several tests pin this — keep the
   `generation === soundListenerGeneration` checks when editing that code.
5. **Tests assert against string literals in `index.html`.** Grep tests before
   renaming functions/ids/constants.
6. **The app is static and offline-first.** Don't introduce a required backend.
7. **No art comes from GitHub** — not in the game, not in the deploy. The LFS
   download allowance is 1 GB/month against ~1.6 GB of art, and exceeding it
   blocks the Pages deploy for everyone. (§5)

---

## 8. Quick health checks (copy/paste)

```bash
cd public/burbz

# Every JS file parses:
find . -name '*.js' -not -path './node_modules/*' -exec node --check {} \;

# Every data JSON parses:
find data -name '*.json' -exec node -e 'JSON.parse(require("fs").readFileSync(process.argv[1]))' {} \;

# SW precache entries all exist + full test suite:
python3 -m pytest tests/ test_continuous_scan_economy.py -q
```

---

## 9. Review log

- **2026-08-26 — the quiet arena, and an errand sheet that opens to the coins (Claude).**
  Release `quiet-arena-v331-20260826`. Four asks from two screenshots of the
  live game.
  - **The narration.** Every fight opened with eight `addBattleLog('system-msg')`
    lines: the league tier, how Skyclash works, what the Speed meter does, how
    to aim, plus a line per squad bonus. Yaan named them one by one.
    `startPerchBattle` now calls `addBattleLog` zero times. Two of those lines
    carried real information and moved rather than died: the first Liberation
    Battle's "only a weary token garrison" reassurance is on the select
    screen's banner, read *before* the fight; the Liberation Battle's own story
    line is a persistent one-line arena banner that names the village instead
    of a paragraph that scrolls away. Night Wings was already a moon badge and
    an aura on the card, so the shout was redundant.
  - **Focus, removed entirely.** `FOCUS_MAX`, `SURGE_COST`, `battle.focus`,
    `addFocus`, `focusGain`, the `canSurge` flag, the ×1.4 surge multipliers in
    `computeDamage` and `previewDamage`, the crit bonus, the AI's surge bid,
    the rail, the SURGE button, `surgeArmed`, `battleToggleSurge`. **The one
    thing that needed a real decision was the `steal` rider** — eight signature
    moves (magpie's Shiny Snatch, the frigatebird's Pirate Chase, the gull's
    Chip Raid) existed to steal Focus. Deleting the rider would have left them
    as plain attacks with a thief's name. They now carry `crShred` and knock
    the mark down the Speed meter, which is nearer what those birds do anyway.
    A stale `{surge:true}` from any caller is now inert rather than a hidden
    multiplier, and there is a test pinning that.
  - **One screenful, by construction — not by counting pixels.** `.battle-arena.live`
    is a flex column at `height:100%` of the screen's content box; every block
    is `flex:0 0 auto` and the log alone is `flex:0 1 auto; min-height:0`, so it
    grows with the fight and then gives its space back rather than pushing the
    moves under the nav bar. Measured at 360x780: **927px into a 711px screen
    before, 711 into 711 after.**
  - **The measuring is the point.** The flex layout passed on Yaan's phone
    first try. On 360x667 the ATTACK bar still finished **13px past the nav
    bar**, and on 320x568 by **92px** — and because the first draft used
    `overflow:hidden` the box reported "no scroll" while quietly clipping the
    buttons, which is worse than scrolling. Hence a `max-height:740px` block
    that stands the meter-forecast strip down and brings the pictures and
    buttons in, a `640px` block that goes further, and `overflow-y:auto` so the
    worst case is ever a scroll and never a hidden button.
    `tests/run_battle_fits_one_screen_evidence.js` plays four real turns
    through the real buttons on three phone sizes: 24 checks.
  - **The errand sheet.** `.quest-overlay-panel` was capped at `82vh`, so the
    dispatch sheet opened into a box you scrolled twice. The cap is now
    `calc(100dvh - var(--burbz-header-h) - 6px)` against a header height that
    is **measured**, because `.header` wraps its chips and takes a safe-area
    inset — a magic number drifts by phone. The dispatch sheet alone is pinned
    to that full height (`.is-send`) with SEND at the bottom under the thumb;
    every other sheet still sizes to its content. The prose note explaining
    that quick quests pay best per hour is gone: each tile already prints the
    numbers, and it cost 38px of a sheet that has to hold the whole errand.
    **755px of content into a 704px sheet before; 704 into 704 after**, with
    all seven durations and the whole flock in one look.
  - Suite: 1775 passed, 25 skipped; the two `settlement_scene` failures are
    pre-existing on main (verified on a clean tree) and untouched. Three
    browser evidence scripts, 48 checks, all through the handlers a thumb hits.

- **2026-08-26 — any bird, any turn, on cards that are all the same size (Claude).**
  Release `field-any-bird-v330-20260826`. Both asks came from one screenshot of
  a live Liberation Battle.
  - **The card that would not stay in its lane.** `.arena-squad` was
    `grid-template-columns:repeat(4, 1fr)`. Plain `1fr` is `minmax(auto, 1fr)`,
    so a track can never shrink below its item's min-content — and `.au-name`
    was `white-space:nowrap`. "Great Spotted Woodpecker" pushed its own track
    open and took the width off its three squadmates; `.au-art` is
    `aspect-ratio:1`, so the wide card drew a far bigger picture too. Measured
    in real Chromium at 390 px, the player row went **67.0 / 68.5 / 125.9 /
    82.0 px** — every name was stretching its own card, the woodpecker just
    stretched it furthest. `minmax(0, 1fr)` plus `min-width:0` on `.arena-unit`
    holds the four tracks level (**85 / 85 / 85 / 85** after), and the name is
    now a fixed-height two-line clamp: a long name reads in full instead of
    being cut to "Great Sp…", and every card's HP bar still sits on one line.
  - **The meter decides when, the player decides who.** New
    `core.chooseActingFighter(battle, index)`; tapping your own bird routes
    through `battleTargetPick` → `battleFieldBird`. Your row is a bench now, so
    the birds you can send in wear a dashed gold edge and the banner says so.
  - **The one line that keeps it balanced.** `battle.turnHolder` records the
    bird whose meter bought the turn, separately from `battle.acting` (who
    swings). `resolveAction` empties the *holder's* meter and leaves the
    fielded bird's readiness alone, so fielding a favourite costs the flock
    exactly one turn — the cadence is identical to before. Emptying both would
    have quietly nerfed the very feature Yaan asked for; a test runs 60 turns
    with and without swapping and pins the same player/opponent split.
  - **Two things that only bite once you can swap.** Cooldowns ticked at the
    top of a bird's turn, so swapping back and forth five times would have
    ticked five times — a `cdTurn` stamp holds it to once. And buff durations
    tick on both the swinger and the holder, or a team rally could be parked on
    a bird that never holds the meter and never expire.
  - Suite: 1755 passed, 25 skipped; the two `settlement_scene` failures are
    pre-existing on main (verified on a clean tree) and untouched. Browser
    evidence (`tests/run_field_any_bird_evidence.js`) plants a flock, walks the
    real Battle screen, measures both rows and takes four turns in a row with
    one bird — all through the same handlers a thumb hits.

- **2026-08-25 — Trail Mode, and an interface that sounds like wood (Claude).**
  Release `trail-mode-v329-20260825`.
  - **`trail_mode_core.js`** (new, pure, Node-testable): `createWalkDetector`
    plus `pocketBonus`. The first draft summed step-to-step hops and a
    stationary phone read as 755 m of walking; the second measured net
    displacement per 30-second slice and a genuinely slow walk vanished because
    each 5 m step fell under a per-step floor. The shipped version drops per-step
    gates entirely, discounts each slice by half the reported accuracy, and
    scales the distance bar with it. Sweeps live in the test file, 300 seeds a
    case — that is the evidence, not the prose.
  - `index.html`: `handleLivePosition` feeds the detector; `trailModeBlockedReason`
    is a hard-no list (setting off, muted, already offered, already questing,
    mid-battle, mid-tutorial, cutscene); `enterTrailMode` opens a quiet Side
    Quest (`{ auto:true, quiet:true }` — the wander is what makes it saved),
    switches to the map, flies to z15.2 and opens the card. Pocket time accrues
    only while `document.hidden` and only while a wander runs, and is paid on
    top of the distance XP cap.
  - **Sound.** `audio_core.js` gained `DEFAULT_VOLUMES` and `DEFAULT_PITCH_DRIFT`
    and a re-pointed manifest. The measurement that decided it is written into
    the file's comments so the next person does not have to re-derive it. Tap
    cooldown came DOWN (90 → 65 ms): the old one existed to stop a one-second
    sample stacking, and the new tap is gone in 200 ms.
  - **`.wq-detail-start` had no CSS rule.** Nine sheets use it. Found by
    screenshotting the Trail Mode card and seeing its buttons render as inline
    text — the same bug had been sitting under every Side Quest sheet.
  - **The live updater needs every new core adding by hand.** Its own header
    warns about this and `test_live_updater_completeness` enforces it; the VPS
    would otherwise have served an index.html whose new core 404s.
  - Suite: 1749 passed, 25 skipped; the two `settlement_scene` failures are
    pre-existing on main and untouched. Browser evidence: a simulated 1.4 m/s
    walk in real Chromium opened Trail Mode after ~60 s with the card, the
    camera move and a saved `Trail` wander.

- **2026-08-25 — the wand's button stands where its caption was (Claude).**
  Release `wand-button-leads-v328-20260825`. Yaan asked for one thing on the
  Sound screen: drop "Ready to listen / Tap once and Merlin will keep listening
  while you explore Burbz" and put START MERLIN'S WAND in that spot. He was
  right that it was redundant — `updateMerlinListeningUI` already writes the
  state onto the button itself.
  - `#scanBtn` moved up to follow `#merlinListenerStage` directly (`.scan-btn-lead`
    adds the 14px it needs there). Waveform, session shelf and the BirdNET data
    note keep their order below it.
  - **The caption was load-bearing for one thing:** listener errors. Two of the
    six `setMerlinListenerState('error', …)` paths raise no toast at all. So
    `.merlin-listener-line` was not deleted — it is clipped off-screen
    (`clip-path:inset(50%)`), still an `aria-live` region, and
    `updateMerlinListeningUI` toggles `.is-error` on it so a failure appears
    under the button with its reason. Checked in Chromium both ways.
  - Suite: 1726 passed, 25 skipped; the two `settlement_scene` failures are
    pre-existing on main and untouched. `test_first_village_liberation`'s own
    release check now reads the head build out of `BURBZ_BUILD` instead of
    assuming its own pin leads the lineage — that assumption breaks on every
    following release.

- **2026-08-25 — free your first village (Claude).** Release
  `free-your-first-village-v327-20260825`. The player quest chain now opens on
  the game's biggest promise: `pq_open_empire` → `pq_liberate` → `pq_first_bird`,
  ahead of Merlin's errands and the Barracks. Getting there needed four changes,
  three of them load-bearing:
  - **The cradle village.** `empireCradleSite()` / `ensureEmpireCradleSite()`
    plant one settlement ~144 m from the player the first time the atlas knows
    where they are, and only while they own nothing. It takes its own cell's
    `villageCellSeed`, and `villageInCell()` returns it INSTEAD of whatever that
    cell rolled — that override is what keeps one seed to one place. The lookup
    is guarded with `typeof ensureEmpireState !== 'function'`, so the seeded
    village pipeline still runs pure in the bare-Node map tests.
  - **Merlin on the squad sheet.** `merlinBattleBird()` builds him from
    `generateBirdStats('Merlin', …)` at the player's own level; `getBattleFlock()`
    puts him first. `birdBattleAvailable()` / `birdBattleReady()` are the single
    rule both pickers read, and Merlin is their only exemption. `endPerchBattle`
    already skipped anything not in `gameState.flock`, so he takes no damage,
    no hunger and no XP home — deliberate, and the reason "always available"
    is safe.
  - **An unloseable first liberation.** `battle_core.createBattle` accepts
    `unloseable`, and `handleFaint` holds a PLAYER fighter at 1 HP under it.
    `startPerchBattle` sets it only for `liberation && isFirstLiberationBattle()`.
    A 200-seed engine run with a deliberately feeble level-1 bird wins 200/200;
    an ordinary battle against the same harness still loses 20/20.
  - **`currentVillage()` carries coordinates.** Its `nearestVillageTo` fallback
    returned `{seed, name}`, and `BurbzEmpireMapCore.validClaim` needs lat/lon.
    Any player who opened Empire and pressed the claim bar's own button — rather
    than walking in from a map banner — was told to "open a real village from the
    Map tab". Fixed at the source.
  - **Scan opens on Sound.** Markup, `scanMode`, and a `landOnSoundScanScreen()`
    call in `init()` that lands the game there without touching the microphone
    (a walk already underway still keeps the map). `.merlin-listener-copy` is
    deleted; `#merlinListenStatus` / `#merlinListenActivity` live below the
    stage. `test_tutorial_overhaul` correctly caught that this dropped the
    "Microphone active only while…" disclosure — it now leads `#merlinDataNote`.
  - **Release bookkeeping.** `battle_core.js` changed, so its `?v=` moved in
    `index.html` and both `sw.js` lists, and `test_mercy_streak_attack_preview`
    (which owns the old pin) notes the move — the same pattern the suite already
    uses for the academy cores. Suite: 1725 passed, 25 skipped; the two
    `settlement_scene` failures are pre-existing on main and untouched.
    Browser evidence in real Chromium: the chain runs
    Empire → CLAIM → Liberate → CLAIM → Find your first bird, and Merlin alone
    takes Misthollow ("VILLAGE LIBERATED!").

- **2026-08-25 — the artwork stops coming from GitHub (Claude).** Release
  `art-same-origin-v325-20260825`. The Pages deploy had failed every day since
  2026-08-20 because the repo's ~1.6 GB of LFS art was being pulled against a
  1 GB/month download allowance from two directions at once: the game rewrote
  most art paths onto GitHub's raw endpoint at boot (and precached ~292 of them
  per service-worker install, per player), and the deploy script re-downloaded
  every art file on every run. Both are gone; every art path is same-origin.
  Order of work mattered — verify, then back up, then change: the referenced set
  was checked against the live site first (1543/1543 required files and 435/435
  derived cutouts present, no gaps), then the whole art set was backed up to
  `/var/backups/burbz-art/burbz-art-20260825/` (4146 files, 3.59 GB, sha256
  manifest, no pointers), and only then was code touched. Nothing was removed
  from the repo, from LFS or from history — the 1.6 GB is still the second copy.
  New: `scripts/check-burbz-art-on-vps.sh`, `tests/test_art_same_origin_20260825.py`,
  `tests/run_art_same_origin_evidence.js`.

- **2026-08-25 — the Project Manager builds the village (Claude).** Release
  `manager-builds-the-village-v324-20260825`, from Yaan's ask: appoint a bird to
  a village and it raises every building on its own; six hours for a clever,
  charming songbird, three real days for a dull heavyweight; four hours if the
  player does it themselves; and no bird means no building.
  - **Two numbers is one number too many, so derive one from the other.** The
    six-hour promise only holds while the ladder really is four hours, so
    `managerBuildFactor` takes the measured budget rather than a constant, and a
    test adds up the real `buildMinutes` and asserts 240. Re-tuning the ladder
    can now change the pacing but can never quietly break the promise.
  - **Count what stands, not what is scaffolded.** `villageManagerRows` first
    reported a rising site's `toLevel` as its level. The programme worked, but
    the desk said "1 of 8 up" over an empty field and left the site's remaining
    time out of the estimate. The true level plus a `rising` flag answers both
    questions; one field cannot.
  - **Back-date the crew, or offline time is silently lost.** A build must start
    when the last one *finished*, not when the player next opens the app.
    `eco.managerFreeAt` is written from `con.endMs` on every completion, and the
    catch-up loop alternates finish/take-site until it reaches now — which is
    what makes two days away land exactly where the clock says.
  - **The appointment sheet is shared code; guard with `typeof`, not a call.**
    Four suites lift `rolePostCardHTML` and `assignBirdRole` into a bare Node
    context with no empire around them. `!villageManagerCore()` throws there;
    `typeof villageManagerVillageMs !== 'function'` returns the honest empty
    string. Same lesson as the Stores' harness in v316.
  - **One crew is the manager's, one stays the player's.** Taking both slots
    would have made appointing a bird *remove* a control the player had. The
    manager checks for a site of its own (`con.by === 'manager'`) before it
    checks free slots, so the second crew can never be swallowed.
  - **"Finished" has to mean finished.** With cottages, alehouse and storehouse
    behind trainer gates, the manager legitimately runs out of work — and the
    first draft of the line called that village complete. It now names the gate.
  - **Round the value, not the rounded value.** `formatManagerSpan` computed
    days from already-rounded hours, so 61.44h printed as 2.5 days instead of
    2.6. Two roundings in a row is one too many.
  - **A blanket pin sweep is still the tax on every release.** 77 test files pin
    the head build and nine pin `bird_roles_core.js`. Sweep the assignment
    lines, then run the previous release's own file — v323's suite asserts it is
    the head, and that assertion has to become "keeps its place in the lineage".

- **2026-08-25 — the Forge opens on its anvil (Claude).** Release
  `forge-opens-on-the-anvil-v323-20260825`.
  - **A default landing tab belongs on the route every entry shares.** The dock
    routes generically, so `switchScreen` is the only such place. In
    `renderForge` it would fight the player's own tap; on the buttons it would
    miss the dock entirely.
  - **`switchScreen` returns early when the screen is already open.** Any helper
    that means "go there AND do something" has to handle the already-there case
    itself, or it is a no-op exactly when the player is closest to the thing.
  - **An inline `onclick` needs the function on `window`.** The game is an IIFE;
    a new handler that is not added to the export list throws on tap and
    nothing in the test suite notices. The browser run caught it first.
  - **A blanket version-pin sweep will eat a `PREVIOUS_RELEASE_PIN`.** Replacing
    every occurrence of the old build string also rewrites the constant that
    deliberately names the previous release, leaving a test asserting a build is
    both the head and its own predecessor. Sweep the assignment line, not the
    string — or check the new release's own file afterwards.

- **2026-08-24 — one symbol, one sheet, for every post in the game (Claude).**
  Release `one-tap-appointments-v320-20260824`, from Yaan's Kitchen screenshot.
  - **An overlay that must open "from whatever screen they're on" belongs on
    `document.body`.** Rendering it into a screen's root ties it to that
    screen's lifecycle; `#rolePicker` is created once, lazily, and every
    surface only carries a `data-action="role-open"` button.
  - **Key the glyph map off the role ID, and check it against the roles core.**
    The region post is `region_warden`, not `warden`. A wrong key falls back to
    the emoji and looks *almost* right, which is how it survives a review — the
    release test walks the core's own ids rather than the map's.
  - **The refusal was UI policy, not a rule.** `core.assignRole` has always
    vacated whatever post a bird held. Dropping "stand them down first" needed
    no state change at all — only the label capture before the move, and
    `pauseHeadChefCareer` for a chef who walks out of the Kitchen (the post is
    vacated silently, so the career would keep paying with nobody at the stove).
  - **A marker inside an ellipsising element is a marker that disappears.** The
    ON DUTY chip started inside `.role-candidate-name`; a long bird name would
    have clipped away the one thing Yaan asked to see. It is a flex sibling now
    — which also keeps the desk suite's name-parsing helper honest.
  - **Two caps beat one.** Free birds and posted birds each get their own slice
    (8 and 6). A single list cap lets a big empire's posted birds crowd out the
    free flock entirely.
  - When a follow-up ask inverts an older release's rule, invert its tests and
    say which release did it. v315's suite now documents both rules and why the
    second replaced the first; deleting it would have lost the reasoning.

- **2026-08-24 — villages first, and the county merge that a hidden tab ate
  (Claude).** Release `villages-first-county-merge-v319-20260824`, two
  follow-ups to v317.
  - **Before you hide a container, look at what it renders.** `countiesBody`
    is built as `regionMergeBanners || …`, so the MERGE INTO ONE COUNTY button
    lives inside the Counties tab. Gating that tab on `regions.length` alone
    made the first county impossible to found — a permanent dead-end at Town,
    invisible until a player is three starred towns deep. `showCounties` reads
    `regions.length > 0 || regionCandidates.length > 0`. The village→town
    merge was safe only by accident of layout: its banner is in `villagesBody`,
    and the Villages tab never hides.
  - **"Hide it when empty" and "put it first" are different asks.** v317 did
    the first and read as if it had done the second, because a new empire has
    only villages. The order only shows its hand once a Town exists.
  - **Two sessions built v317 in parallel** from the same pair of Yaan's
    screenshots, minutes apart. Both were correct; PR #249 merged first, and
    this branch was restarted on top of it rather than competing. Before
    starting a screenshot ask, check the OPEN PRs and the other live
    `claude/*` branches, not just `main` — the vault's project-state file is
    the fastest place to see what another session is holding.
  - Six suites are red on `origin/main` from PR #248 (towns 3D upgrade) and
    were left alone: this release touched none of them. Say which failures
    you inherited; a green-bar claim that quietly includes someone else's red
    is worse than no claim.

- **2026-08-25 — the box of boxes (Claude).** Release
  `empire-grid-v322-20260825`, from Yaan's screenshot of the Empire screen.
  - **Deleting a control is half the job.** The drop-down went, and with it
    `empireNavTabHTML`, `.empire-nav-tabs`, `.empire-drawer.is-nav-tab`, the
    whole `.settlement-row` family, `.empire-group-title`, `.evr-badge`,
    `.region-ready-chip` and `.realm-lead` — every one of them was still live
    CSS for markup nobody built any more. The `empire-drawer` bones stay:
    the village, town and county desks still fold their appointment cards
    behind `.empire-drawer.is-sub`.
  - **The reading lives in a core, the drawing lives in the page.**
    `empire_grid_core.js` takes plain facts about one holding (pop, happiness,
    posted, freeCrews, building, mergeReady, tributeReady) and names the one
    thing it wants. It reads no globals, so the whole ladder is unit-tested in
    bare Node. `index.html` only turns that answer into a square.
  - **`posted === false`, not `!posted`.** A county has no crews and no merge
    star; a tier that cannot report a signal passes nothing, and an absent
    signal must never trip its rung. Only an exact `false` reads as "the desk
    is empty".
  - **Two meanings must never share a colour.** The vacant desk started amber
    and was indistinguishable from the merge star's gold on a phone. It is
    violet now — the game's own `--epic` purple. Look at the screenshot before
    believing a palette.
  - **A whole cycle, not "something has accrued".** Tribute is continuous
    since v311, so `tributeHasAnything` is true every second of every day. The
    💰 pip uses `Math.floor(empireVillageTributePeriods(...)) > 0`, the same
    test the nav badge uses, or it would be pinned on for ever.
  - **Shared code must not force a harness to grow a dependency.** Several
    suites lift `birdPostLabel`, `assignBirdRole` and `clearBirdRole` out of
    `index.html` one function at a time. All three call `empirePostTitleFor`
    behind a `typeof … === 'function'` guard — the same pattern
    `villageRoleMultiplier` already uses for `empireSettlementOfSeed`.
  - **The Counties tier reads two gates, on purpose.** The MERGE INTO ONE
    COUNTY banner renders inside it, so `showCounties` is
    `regions.length || regionCandidates.length`. Gate it on `regions.length`
    alone and the first county can never be founded — the exact bug v317 shipped.
  - **A test that pins a superseded design is not weakened, it is repointed.**
    Nine suites asserted on the drop-down markup. Each now pins the boxes and
    says in a comment what replaced what; nothing was deleted to go green.
  - **Rolling release pins is not a blanket find-and-replace.** `CURRENT_BUILD`,
    `RELEASE_PIN`, `RELEASE` and `BUILD` name the head build and roll every
    release. `ROLES_CORE_PIN` names `bird_roles_core.js`'s own `?v=` tag and
    only moves when that core is edited. `OWN_RELEASE_PIN` never moves at all —
    two suites were using it for both jobs and have been split.

- **2026-08-24 — the Project Manager desk (Claude).** Release
  `project-manager-desk-v315-20260824`, from Yaan's screenshot of a vacant
  village desk.
  - **Bare is a scope rule, not a caller flag.** `bare = scope === 'village'`
    inside `rolePostCardHTML` means the village desk and the Town Hall desk
    can never drift apart, and no caller can forget to pass it. If a future
    ask wants a bare Academy card, make it an option then — not now.
  - **The words stayed in the core.** `role.copy` and `role.effect.copy` are
    still the canonical description of the post and are still rendered by the
    Academy and region cards; two older suites pin those strings in
    `bird_roles_core.js`, and they still pass untouched.
  - **One exception to one-bird-one-job, named once.**
    `birdCanMoveToVillagePost` is the only place that decides a manager may
    move, and both the filter (`roleCandidateBirds`) and the guard
    (`assignBirdRole`) call it. Keep it that way: a list that offers a bird
    the guard then refuses is the bug this shape prevents.
  - Sharp edge: `birdPostLabel` reads live role state, so the village being
    left must be captured BEFORE `core.assignRole` moves the bird, or the
    toast names the village the bird just arrived in.
  - Ordering is deliberate: serving managers lead even when a free bird
    scores higher. `ROLE_SERVING_CANDIDATE_LIMIT` (5) stops a large empire
    burying the free flock — three of the eight seats always stay open.
  - Pin sweep: twelve suites track the head build under names other than
    `CURRENT_BUILD` (`RELEASE_PIN`, `OWN_RELEASE_PIN`, `BUILD`). Check what
    each constant asserts — `BURBZ_BUILD`/cache tail means roll it, a `?v=`
    means leave it. `bird_roles_core.js` did not change this release, so its
    `roost-retired-v302` pin stayed put.
  - Numbering: v314 was already taken by another session's unmerged
    `battle-pick-your-bird-v314-20260824`, so this took v315. Look at the
    other live `claude/*` branches before you claim a number — a duplicate
    costs a renumber at merge, which is how v310 went twice. No test asserts
    the sequence is contiguous, so a gap on your branch is harmless.
  - Contracts: `tests/test_project_manager_desk_20260824.py`; the v294
    steward suite's "the cards tell the player about the building sites"
    assertion was rewritten to pin the new, quieter truth.

- **2026-08-20 — village basics, town industry (Claude).** Release
  `village-basics-town-industry-v299-20260820`, Yaan's settlement design.
  - **The law in data:** `tier: 'town'` on farm/lumber/quarry/chapel/market;
    everything else is village-tier and costs zero stone (the cabin's stepped
    stone rebuild is the deliberate exception). Rationale: quarries are the
    only renewable stone source, so town-gating them forced the village
    basics onto a coins-and-timber economy or fresh players would deadlock.
  - **The gate mirrors the trainer gate:** NEW builds only
    (`level === 0 && !settlementAllowsBuilding(...)`), so old saves keep and
    upgrade whatever they built. Wholesale orders skip gated level-0 steps.
  - The hut slots between the starters and the farm on the build ladder
    (15m), so the ladder tests' "strictly climbing" pin still holds.
  - Sharp edge: several economy harnesses were "one loose village" fixtures
    that built farms and quarries — those are Town ward fixtures now
    (settlement stub + `{townMode:true}`), and any harness that extracts
    `empireBuildStructure` or `wholesaleUpgradePlan` needs
    `settlementAllowsBuilding` extracted or stubbed.
  - Numbering: another session shipped `generated-ui-art-v298` first; this
    release took v299 and gave the v298 release test the standard
    predecessor surgery (RELEASE stays, CURRENT_BUILD rolls).
  - Contracts: `tests/test_village_basics_town_industry_20260820.py`.

- **2026-08-20 — swipe through the flock on the Equipment card (Claude).**
  Release `equip-card-swipe-v297-20260820`, Yaan's ask.
  - The overlay's scroll container owns the gesture; the card body
    (`#birdEquipBody`) is what slides. Axis lock after 14px of drift keeps
    vertical scrolling untouched; the horizontal branch needs the
    `{ passive: false }` touchmove listener or `preventDefault` is ignored
    and the page scrolls under the drag.
  - Swap order matters: set `birdEquipState` BEFORE the out-animation so a
    mid-animation re-render (tick timers call `renderBirdEquip`) already
    shows the new bird. `birdEquipSwipeAnimating` gates re-entry.
  - `overflow-x:hidden` on `.bird-equip-scroll` — without it the translated
    card widens the scroll area and the page jiggles sideways.
  - Contracts: `tests/test_equip_card_swipe_20260820.py`.

- **2026-08-20 — honest need gauges (Claude).** Release
  `honest-need-gauges-v296-20260820`, from Yaan's screenshot report.
  - **Two truths per need, kept apart on purpose.** `sat` = harvest + stores
    (the meal truth — happiness, growth, starvation, the shortage warning,
    all unchanged). `supplySat`/`supplyServed` = built, staffed supply only
    (the gauge truth — the bars and their N/N numbers). Do NOT "fix" one
    into the other: making the sim capacity-based would starve fresh
    villages before their first 30-minute farm finishes; making the gauge
    stores-based recreates Yaan's bug.
  - The stores story lives in the sublabel: "villagers live off the granary
    (30 stored — 10 more cycles)", amber (`warn`) while a source is missing.
  - Pin churn was tiny by design: only `test_village_provisions`'s
    "Math.min(snap.pop, n.served)" pin moved. This release moves no core, so
    the roles/loot `?v=` pins stay at v295 — when rolling CURRENT_BUILD
    across the suite, skip the pin constants (ROLE_CORE_PIN, ROLES_PIN,
    ROLES_CORE_PIN, chef-bulk's RELEASE_PIN, loot_version, and the two
    release tests' RELEASE) or the ?v asserts break.
  - Contracts: `tests/test_honest_need_gauges_20260820.py`.

- **2026-08-20 — the Stores market + the Project Manager nameplate (Claude).**
  Release `stores-market-project-manager-v295-20260820`, Yaan's follow-ups.
  - **Rename, not a new post.** The village role reads Project Manager
    everywhere (title, 📋 icon, drawer, Town section, income line) but keeps
    `id:'steward'` — assignments live under that id in saves, and four suites
    call `roleById('steward')`. Lord Mayors (towns) and Councillors
    (counties) are future titles, noted in the role copy and STORY.md.
  - **Selling.** Prices are pure data in the loot core (`SELL_PRICES`,
    `sellValue`, `sellQuote` — quotes clamp to owned stock so a stale button
    can never oversell). `storesSellItem` mutates the right bag
    (items/larder/gear), pays via `addCoins`, and deletes emptied stacks.
    Remember the IIFE rule: it is exposed in the big `Object.assign(window,…)`
    or every onclick dies silently.
  - Equipped gear needs no guard: `equipItemOnBird` already decrements
    `inventory.gear`, so the Armoury tab only ever shows spare stock.
  - Sharp edge: the loot core's `?v=` pin had sat at v248 since Conquest —
    rolling it touches `test_conquest_world_levels` (decouple the loot pin
    from OWN_RELEASE_PIN), `test_bird_equipment_screen`, and
    `test_simple_quest_dispatch`.
  - Contracts: `tests/test_stores_market_20260820.py`.

- **2026-08-20 — build ladder + Steward project managers (Claude).** Release
  `steward-project-manager-v294-20260820`, two asks from Yaan.
  - **The build ladder.** Starters stay instant fun (Cabin and Well at 4
    minutes); the rest climb the list — farm 30m, cottages 45m, alehouse 1h,
    chapel 1h30, lumber camp 2h, quarry 2h30, market 3h, storehouse 4h.
    `test_settlement_tiers` pinned the farm's old 10-minute upgrade clock —
    rolled to the 60-minute truth.
  - **The Steward project-manages.** New pure `stewardProjectFactors(aptitude)`
    in `bird_roles_core.js` (caps: 30% faster, 15% cheaper), read through
    `villageStewardProject(seed)` which resolves the post at a merged
    settlement's heart seed. Cost flows through `villageBuildingCost`'s new
    optional `seed` arg; clocks through the new `villageBuildDurationMs`
    (guilds × Steward, 30s floor) used by the real build flow AND every
    displayed duration — the province card used to show the undiscounted
    base time even for merged wards; now every surface shows the true clock.
  - Sharp edge: economy harnesses in older tests stub collaborators, so
    each one that extracts `empireBuildStructure`/`wholesaleUpgradePlan`
    needed a vacant `villageStewardProject` stub (and the settlement-tiers
    stub block is an f-string — double the braces). Float note:
    `1 - 0.925 = 0.074999…`, so aptitude 50 labels as 7% cheaper, not 8%.
  - Contracts: `tests/test_steward_project_manager_20260820.py`.

- **2026-08-20 — the first law: Burbz means zombie (Claude).** Release
  `burbz-zombie-canon-v291-20260820`, Yaan's canon ask.
  - **The law:** Burbz names the ENEMY — the usurper's zombie flock, Z for
    zombie. The game is named after the threat; the player's birds are never
    Burbz. It leads `STORY.md` as "The first law" and §1 of this handbook.
  - Reconciliation, not rewrite: the evil Burbz keep every visual and moral
    rule (smoke-and-ember look, dispelled non-gorily — now "laid back to
    rest"); the Kingdom of Burbz keeps its name, canonised as carrying its
    captors' name while they hold it.
  - Copy sweep was tiny by design — the game already says "evil Burbz"
    everywhere it matters. Only two lines changed: the battle tutorial's
    "Know your enemy" card now teaches the law, and the bird-card fallback
    stopped calling the player's birds "your Burbz collection". Note the
    tutorial strings store em dashes as \u2014 escapes — pin phrases, not
    dashes.
  - All older canon pins kept (`test_evil_burbz_battles_20260720.py` passes
    untouched). Contracts: `tests/test_burbz_zombie_canon_20260820.py`.

- **2026-08-20 — empire badge + shortfall quest prompts (Claude).** Release
  `empire-badge-quest-prompts-v289-20260820`, two asks from Yaan.
  - **The Empire tab badges waiting taxes.** The badge mirrors the COLLECT
    button exactly — it keys on banked 8-hour cycles (`payingHoldings`
    semantics), not on the payout amount, because a starved village with a
    due cycle still enables COLLECT. Counting periods is cheap; the badge
    heartbeat never runs the economy simulation.
  - **Failed builds open a quest prompt, not a toast.** Coins route to the
    Coin & Treasure drawer, timber to Timber & Building; both hold `starter`
    errands so the offer works before the Quest Roost exists. To let the
    prompt fire, unaffordable build buttons in the province yard and Town
    networks are tappable again (`.short`, dimmed) — the cost gates inside
    `empireBuildStructure` were already the single source of truth, so no
    build can slip through. Watch for labels with their own article: room
    labels like "The Roost" go through `goalWithThe`, or the card reads
    "The The Roost" (caught in the headless boot, not by the unit tests).
  - Verified in a headless phone boot: seeded a 9h-old province → badge "1"
    on the Empire tab → collect → badge gone; 3-coin purse + Roost build →
    prompt → quest board with the treasure drawer open and spotlit; same for
    timber. Suite: 1442 passed, 0 failed (on main merged up to v288).

- **2026-08-19 — battle-progression fixes (Claude).** Release
  `battle-progression-fixes-v286-20260819`, from Yaan's play report.
  - **Lost birds reach the Hospital.** The root cause was ordering: battle XP
    ran `levelUpBird` (which full-heals on any level gained) before
    `admitFaintedBirdToHospital`, whose full-HP guard then bounced the
    casualty — so a fainted peregrine stood in the Training Hall at full
    health. Battle now passes `{ noHeal: true }` for lost birds; the guard
    itself stays for every other caller. No ward built → new
    `restLostBirdOutsideWard` rests the fallen in the Aviary Gardens.
  - **A battle frees a village, and merges announce themselves.** "TOWN
    LIBERATED!" was hard-coded copy on every liberation; there was never a
    single-village promotion path. The victory screen now says VILLAGE, and
    the three-village merge is named before it happens (claim bar + victory
    note via `previewClaimFounding`) and as it happens (ward names in both
    toasts). Nothing changed in `deriveSettlements`/`deriveRegions` — exact
    trios, 5 km / 15 km / 150 km, all as before.
  - **Town Hall shows the county rung.** Open the County Hall from the town
    once it exists; see "N of 3 towns" toward it while it doesn't. A sampled
    density contract (12 latitude bands, ~13 km windows) proves ≥3 disjoint
    village trios everywhere tested, so the ladder never dead-ends.
  - **FORGE joined the bottom nav** (8 items now, Scan orb still centred
    enough on 360 px — labels fit at 8 px). Ready forge commissions badge it
    through the action-badge heartbeat. `action_badge_core.js` changed → its
    `?v=` pin moved to v286 everywhere, and `test_live_reconcile_v245`'s
    core-pin assert moved with it, per the moved-core convention.

- **2026-08-13 — the world gets real names (Claude).** Yaan saw the map full
  of 19-letter gibberish (Bahadofubibidustead, Cocogadubafugushire) and asked
  for 200 hand-made names that read like real villages and towns — invented
  words, the same for every player. Release `real-place-names-v264-20260813` (born v263; renumbered mid-merge — feedback-menu-keyless claimed v263 first, and the vault protocol caught the collision).
  - **Core** (`empire_realm_core.js`): the syllable encoder is gone.
    `PLACE_NAMES` holds 200 hand-written names, alphabetical for auditing —
    bird names for a bird game (Wrenfold, Kestrelby, Starlingden, Rooksby),
    trees, water and stone (Alderbrook, Thistlemere, Silverbeck, Shalefell),
    all 6–13 letters, none a famous real place. `placeName(kind, seed)` maps
    `(seed % 200) × 73 + rank offset` into the pool. **The old uniqueness
    invariant is replaced**: the seed is the only identity; names may repeat
    far apart, and nothing may ever key save data on a name. Three kept
    properties: deterministic (same seed, same name, on every phone,
    forever); spread (stride 73 is coprime with 200, so 200 consecutive
    seeds — neighbouring map cells — wear 200 different names, pushing
    namesakes kilometres apart); rank-distinct (offsets 0/33/71/107/139/171
    are distinct mod 200, so one seed never repeats a name across
    village/town/city/county/duchy/kingdom). `PLACE_NAMES` order is API —
    never re-sort, insert or delete a shipped entry; replace in place or
    append only.
  - **Migration**: free — `migratePlaceNames` already rewrites every stored
    village name from its seed on each boot, so old saves wake up with the
    new names and lose nothing. `PLACE_NAME_VERSION` stays 2 (the identity
    scheme is untouched).
  - Tests: `tests/test_unique_place_names_20260804.py` rewritten — the
    6000-unique-names contract became four: pool shape (200 distinct,
    hand-written look, map-chip length), pool membership + determinism,
    namesake spread, per-seed rank distinctness. The migration, hierarchy
    and UI contracts survive unchanged. Head pins swept to v264 (the keyless
    v263 and early-game v262 suites keep their OWN_RELEASE_PINs per
    convention); the realm core's `?v=`
    moved from town-county-screens-v242 in both loaders and the four suites
    pinning it. SW cache + `BURBZ_BUILD` bumped. Local run: 1196 passed,
    15 skipped, only the 7 documented container art failures.
    Browser-checked in Chromium (390×844): zero page errors, 2400 rank/seed
    draws all land in the pool, real map cells read Greywold / Pengarth /
    Robinsworth / Reedholme, and the crown label says "County of Vixenholt".

- **2026-08-13 — the inbox key becomes a link (Claude).** Yaan doesn't want
  to type an admin key. The key check must stay (feedback holds testers'
  messages and emails, and the server enforces it), so the key now travels
  in a one-time magic link: `burbz/?inboxkey=…` stores it silently in the
  shared `burbz_admin_token` slot, scrubs the URL, and the Feedback Inbox
  opens from then on. Gate copy teaches the link first. Ava mints the link
  on the VPS (the token lives in the feedback server's config there) and
  sends it to Yaan on WhatsApp — the request sits in the vault's
  project-state. Release `feedback-menu-keyless-v263-20260813`;
  `tests/test_inbox_magic_link_20260813.py` pins adopt/scrub/order, the
  untouched server check and the release pins; head pins swept v259→v262.

- **2026-08-13 — the early game keeps its promise to level 12 (Claude).**
  Yaan's report: a level-8 player was destroyed by a level-5 garrison —
  early battles were still far too hard, and the right birds and right gear
  should only start to matter later in the game. Root cause: the v240
  early-game gate ended at the FIRST COUNTY, so a low-level player who
  founded a county was thrown to full-strength squads mid-story. Release
  `early-game-until-level-12-v262-20260813`.
  - **Gate** (`index.html`): `isEarlyGameBattles()` now reads the player's
    level (`battlePlayerLevel()`, from `gameState.player.level`) and holds
    until `EARLY_GAME_ENDS_AT_PLAYER_LEVEL` (12). The county check is gone.
  - **Ramp**: through `EARLY_GAME_CRUISE_LEVEL` (8) squads fight at
    `EARLY_GAME_OPPONENT_EASE` (0.35 of every stat) with at most three
    birds and never more than the flock — near-free wins even for a flock
    of one bird of prey plus one large bird, whatever the matchup. From
    level 9 `earlyGameOpponentEase()` climbs linearly toward
    `EARLY_GAME_RAMP_TOP_EASE` (0.95, the value the line would reach at the
    level-12 boundary): ~0.5 at 9, 0.65 at 10, 0.8 at 11, with the squad
    cap easing to four. Full difficulty — and the real need for counters
    and forged gear — arrives at player level 12. Eased squads still sit
    one level below the flock (avgLevel − 1, unchanged).
  - **Tuning evidence** (real engine, its own AI on both sides, 150 runs
    per scenario): at ease 0.8 four hard-countered tiny songbirds win 3%
    while four counter picks win 100% with 67% HP left, and the same squad
    with forged gear keeps 89% — exactly the ask: wrong birds lose, right
    birds win easily, gear whitewashes. At 0.35 even four wrong birds
    against their counters win 100% untouched.
  - The rival cache key carries `_early_game_pl<level>` so levelling up
    re-rolls the squad at the new ease. The first-liberation token garrison
    and all conquest maths (world level, stamped garrisons, tier boosts)
    are untouched for level 12 and beyond.
  - Tests: `tests/test_early_game_until_level_12_20260813.py` (gate, ramp
    constants, cruise sims, the level-11 separation sim, release pins); the
    v240 suite repointed at the level gate (county pin superseded, sim ease
    0.45 → 0.35). Head pins swept v259 → v262 (the v259 test kept its
    OWN_RELEASE_PIN). SW cache + `BURBZ_BUILD` bumped; no core module
    changed, so every `?v=` stays put.

- **2026-08-13 — five sessions come home (Claude).** Yaan asked for every
  outstanding session to be merged and live. Merged in order: bird bond
  v256 (PR #199), night hunter v258 (PR #200), feedback menu v259 (PR #198,
  renamed from feedback-inbox at Yaan's ask — the head build testers see),
  village variation v260 (PR #188, built as v250), chef mastery v261
  (PR #175, Ava's, built as v237 — this entry documents it, her branch
  carried no handbook edit). The three later releases ride UNDER the
  feedback-menu head: their cache segments sit before it in BURBZ_CACHE and
  their suites pin OWN segments while asserting the head, so the version in
  Settings stays feedback-menu-v259. Core pins after the sweep:
  bird_roles_core → chef v261 (raven's suite grew ROLES_CORE_PIN),
  village_variation_core → v260, bird_size_core stays raven v255. Full
  suite after every step: only the 7 documented container art failures.

- **2026-08-11 — no two villages alike: village DNA + true town districts
  (Claude).** Yaan's two-part ask: villages need "much much more variation"
  the way No Man's Sky varies through maths — more colours, more details,
  more kinds of buildings — and the Town Square's three districts must BE
  the three real villages you zoom into, not generic stand-ins. Release
  `village-variation-v260-20260813`.
  - **Core** (`village_variation_core.js`, new, pure, Node-testable):
    `villageRng` is the game's mulberry32 bit for bit (a test pins the
    constants in `villageRngFrom` against it). `villageDNA(seed)` rolls the
    identity card: wall build (timber 38% / stone 22% / brick 16% /
    painted 24%), roof craft (thatch/slate/tile/shingle), a plaster wash
    (painted villages commit to real colour — pink, sage, cornflower),
    a six-colour roof run walked by GOLDEN_ANGLE steps inside the craft's
    hue band (`ROOF_BANDS`, `roofColorRun`), trim + door accents a golden
    angle apart, a window-glow colour (14% cool lamps), two banner-cloth
    dyes, and crookedness/prosperity dials. `varyPalette(pal, dna)` re-keys
    sky/ground/leaf/plaster/timber/stone/hemi and replaces `roofs` while
    keeping `weather`/`speck` (the snowman still rolls) — and never mutates
    the base palette. `villagePlan(seed, count)` replays buildVillageScene's
    exact opening dice (palette index, tier, layout — thresholds pinned).
  - **Village scene** (`index.html`): the pinned
    `VILLAGE_PALETTES[Math.floor(r() * VILLAGE_PALETTES.length)]` roll
    survives, wrapped by `villageVariedPalette(…, v.seed)`; a missing core
    returns the palette untouched (classic look, no DNA). Builders read
    `pal.dna`: `villageMakeBuilding` grows real wall styles (quoined stone,
    mortar-coursed brick, painted timbers), craft-shaped roofs (thatch =
    deep gable + straw ridge-roll + brushed eaves, no dormers), trim-painted
    shutters, village-coloured doors and window glow, prosperity-scaled
    window boxes; `villageMakeCottage` follows suit and can grow a lean-to
    wood store. New landmarks `villageMakeShrine` and `villageMakeWatchtower`
    join the pool (10 skylines now). Maypole ribbons and garland bunting dye
    themselves in `dna.banners`/trim/door.
  - **Town Square** (`buildTownScene`): each district now derives from ITS
    village — `villagePlan(seed, VILLAGE_PALETTES.length)` +
    `villageVariedPalette` give the district the village's true palette
    (daylight-graded), its tier sizes the yard and cottage count, its layout
    shapes the arrangement (lane = a cottage row, hamlet = scatter, else the
    ring), and one of the village's REAL trades (`villageShopKeysFor`) keeps
    a 0.82-scale shopfront on the yard.
  - **Landmark ledger** (follow-up, same release): which landmarks a village
    raises used to ride the scene builder's long shared dice stream, so no
    other screen could know them. `landmarkPlan(seed, tier, poolSize)` rolls
    count + up-to-3 distinct picks on its OWN stream (`seed ^ 0x5FCA9B3D` —
    the ruins/governor-build precedent), tier gates only the count, and both
    scenes index the hoisted `VILLAGE_LANDMARK_MAKERS` pool (order is API —
    append only). The village scene places exactly `picks[0..count-1]`; a
    district builds `signature` (= picks[0]), and a village too small to
    keep a landmark shows an honest bare green (tree + cart), never a fake.
    No core = both scenes fall back to the classic in-stream rolls.
  - **Ruin mirror** (follow-up, same release): a district also shows its
    village's recovery, with the village scene's own gates.
    `villageDistrictState(seed)` reads the empire record once — ruin stage
    (identical `<=0 / <5` thresholds), uncleared wreck count + first wreck
    kind, rising construction. In the district: stage 0 = real wreckage
    (`villageMakeWreckedBuilding` of the village's first uncleared kind, two
    rubble piles), no shopfront, no torch; stage 1 = trades reopen, one
    rubble pile while wrecks remain; stage 2 = cottages + landmark return.
    A rising build shows its `villageMakeConstructionSite` at live progress.
    `townSceneKey` now keys on `seed@stage.ruinsLeft(+b)` per member, so
    clearing a wreck, starting a build or flourishing rebuilds the square on
    the next visit (renderTownScreen already simulates economies first). The shared-builder adoption grew `smokeMark`/
    `signMark` splices (this also fixes a quiet leak: town cottage smokes
    used to strand in `villageSmokes`, unanimated). Pinned contracts kept:
    settlement standard call, `townDistrictLayout`, `districtSeed` tagging,
    `villageMakeSign(v.name…)`. `__burbzTownDebug` (localhost-only) mirrors
    the village hook so the town generator runs headless.
  - Tests: `tests/test_village_variation_20260811.py` (DNA determinism/
    distinctness/coverage, golden-angle band maths, palette contract incl.
    no-mutation, rng parity + threshold pins, HTML wiring for village +
    town, release pins). Release pins repointed per convention (20
    head-tracking files sed'd v249→v250; the v249 walking-story test grew
    the OWN_RELEASE_PIN/CURRENT_BUILD split — its `walking_story_core.js`
    `?v=` stays on v249). SW cache + `BURBZ_BUILD` bumped;
    `village_variation_core.js` precached in both SW lists and added to the
    live updater's FILES. Local run: 1133 passed, 10 skipped, only the 7
    documented git-lfs pointer-file art failures. Browser-checked in
    headless Chromium (390×844, SwiftShader): six seeds build six villages
    with six distinct colour fingerprints (56–74 unique material colours
    each); a mock three-village town builds three districts with their own
    palettes and shopfronts, 30 animation frames clean; zero page errors.

- **2026-08-12 — the settings menu reads the feedback inbox (Claude).**
  Yaan is starting early testing with friends and asked for two things: make
  sure the settings-menu feedback box works, and let him read all feedback
  from inside the game via the settings menu. Release
  `feedback-menu-v259-20260813` (renumbered from v254 in the merge with main: raven v255 and night mode v257 landed first).
  - **Send path verified live**: a real multipart POST to
    `yaanbatho.com/burbz/api/feedback` answered `{"ok":true}` (test message
    id `abeb6a71b7cfc1fe` — safe to delete from the inbox). The backend is
    VPS-only, so feedback only sends when the game is played at
    yaanbatho.com/burbz — burbz.app (GitHub Pages) has no `api/`.
  - **Reader** (`index.html`): new Settings row `#feedbackInboxBtn`
    (📥 Feedback Inbox, gold-tinted `settings-inbox` variant of the feedback
    row) under Send Feedback. `openFeedbackInbox()` renders a recruit-sheet
    overlay: an admin-key gate on first use (stored in the SAME
    `burbz_admin_token` localStorage slot `inbox.html` reads, so one unlock
    covers both; a 401 forgets the key and re-gates), then all
    `type:'feedback'` reports newest-first — message escaped before
    innerHTML, category chip, sender, time — with ✓ Done / Reopen / Delete
    actions posting `{action}` to `api/admin/reports/:id`, a Show-done
    toggle, Refresh, and Lock (forget key). Open new-bird reports surface as
    a count linking to `inbox.html`.
  - **Ops**: `inbox.html` added to `update-live-burbz.sh` FILES (it was
    live-only-by-history before; live and git copies were verified
    byte-identical first, so the add is safe).
  - Tests: `tests/test_feedback_inbox_20260812.py` (row placement + wiring,
    shared token slot/header/endpoints with inbox.html, gate/list/act
    behaviour, escaping, send path still wired, updater ships inbox.html,
    release pins). Release pins repointed per convention (the v253 test grew
    the OWN_RELEASE_PIN/CURRENT_BUILD split). SW cache + `BURBZ_BUILD`
    bumped; no core module moved, so every `?v=` stays put. Local run:
    1150 passed, 10 skipped, only the 7 documented git-lfs pointer-file art
    failures. Browser-checked in Chromium (390×844): the row opens the
    overlay with the key gate, zero page errors.

- **2026-08-13 — the hour of the owl: Night Hunter Ascendant (Claude).**
  Yaan's ask: an absolutely massive advantage for using a nocturnal bird late
  at night compared to other birds, implemented deeply — training, UI,
  graphics, everything. The Night Hunter bonus (v229, kept as pure reward
  when sleep retired in v238) grows from a 2×-coins perk into the game's
  biggest situational advantage. Release `night-hunter-ascendant-v258-20260813`.
  - **Reward pack** (`bird_sleep_core.js`): `NOCTURNAL_NIGHT_BONUS` is now
    coins 3 / branches 2 / xp 3 / itemRolls 2, plus new `statBonus: 2`.
    Nothing is ever blocked at night (the bedtime-quest contract survives
    untouched); timers never move — only payouts swell.
  - **Training** (`academy_treehouse_core.js`): `createTrainingSession`
    multiplies the permanent stat gain by the pack's `statBonus` — a +1
    drill teaches +2 at night, the Focus Roost's +2 teaches +4 — on top of
    the tripled XP. Packs without `statBonus` fall back to the plain gain.
  - **Night Wings** (`bird_sleep_core.js` + `battle_core.js`): new
    `NOCTURNAL_NIGHT_BATTLE` pack (atk/spd/mag ×1.5, def/maxHp ×1.25,
    +0.15 critBonus) via `nocturnalNightBattleBoost(bird, hour)`.
    `buildFighter` gains `opts.nightBoost`: gear adds first, the pack then
    multiplies, `f.nightHunter` is stamped for the UI, and RES rises
    naturally since it derives from boosted DEF/INT/MAG. **Default calls
    stay byte-identical** (nb() is 1 without a pack — every existing rewards
    and fighter pin still passes). Only player fighters in `startPerchBattle`
    ever receive the pack; `buildOpponentFighter` takes none, so the
    advantage belongs to the player who kept an owl.
  - **UI + graphics** (`index.html`): `nocturnalNightBattleBoostFor` helper;
    battle-select cards glow `.night-hunter-aura` with a `.pk-night-chip`
    and the roster shows a `.battle-night-hint` after dark; the arena unit
    wears an animated `.au-night-moon` badge and the log opens with
    "🌙 NIGHT WINGS!"; the Training Hall banners night school (triple XP,
    double gains) and marks nocturnal birds' send buttons; the quest send
    sheet, Roost status line (`data-night-hunter` state) and all toasts
    teach the true multipliers. The aura/moon animations respect
    `prefers-reduced-motion`.
  - Tests: `tests/test_night_hunter_ascendant_20260813.py` (packs, fighter
    maths + default-identity contract, arena/hall/CSS wiring, release pins);
    `test_nocturnal_night_bonus_20260805.py` rewritten for the ascendant
    numbers (including the statBonus doubling). Three cores moved, so their
    `?v=` pins split out of old release loops with comments: living-canopy
    (treehouse core), turn-potions + conquest (battle core), diet-integration
    (treehouse core), bird-sleep grids (sleep core); head-tracking
    RELEASE_PIN/CURRENT_BUILD swept v255→v256 and the v255 suite grew the
    conventional OWN/CURRENT split. SW cache + `BURBZ_BUILD` bumped; all
    three cores' `?v=` moved in both loaders. Local run: 1157 passed,
    10 skipped, only the 7 documented git-lfs pointer-file art failures (no
    `git lfs` in the container). Browser-checked in headless Chromium
    (390×844, clock frozen at 23:00): boots with zero page errors, cores
    live, aura CSS shipped, a Tawny Owl's ATK 60→90 with `nightHunter` set.

- **2026-08-12 — every bird loved: the bond (Claude).** Yaan wished players
  could give every single bird a little more love — people attach to
  different birds. Release `bird-bond-love-v256-20260812`.
  - **The core** (`bird_bond_core.js`, new): each companion's `bird.bond`
    holds `{level, xp, favourite, lastPreenAt, preens}`. Five levels, 100 XP
    each, titles New Friend / Companion / Close Friend / Beloved / Soulbound.
    `preen()` grants 20 bond XP on a 4-hour cooldown (`canPreen`,
    `describeWait` for the button copy) and +12 happiness is applied app-side.
    Bond is affection only — no stat, power or battle hooks, on purpose.
  - **Equipment screen**: heart toggle on the hero
    (`birdEquipToggleFavourite`), Bond panel with hearts + meter + PREEN
    button (`birdEquipPreen`, floating hearts via `spawnBondHearts` — spawn
    AFTER the re-render or the fresh innerHTML eats them).
  - **Flock cards**: ❤️ badge (top-right, under the power chip — the top-left
    corner belongs to LV/diet), a small hearts row under the nickname, a
    Favourite button on the card back (`data-action="toggle-favourite"`), and
    favourites sort ahead of power in Companions.
  - **Feeding bonds**: all five companion feed-success points grant bond XP —
    the three kitchen paths reuse `reward.bondXp` (Merlin's numbers), the two
    Academy tray paths use `FEED_BOND_XP`. The four feed-path Node harnesses
    (`test_one_tap_feeding`, `test_kitchen_feeding_roster`,
    `test_chef_bulk_feeding`, `test_full_catalogue_diets_and_chef_board`)
    stub `grantBirdBondXp`/`birdBondCore` — any new call site inside an
    extracted feed function needs the same stub.
  - Saves migrate on load (`gameState.flock.forEach(ensureBirdBond)`), pins
    swept v255→v256 (the v255 core `?v=` pins stay put), new core precached
    in both sw.js lists and shipped by `scripts/update-live-burbz.sh`.
    Browser-verified with Playwright: preen, cooldown refusal, favourite
    ordering, zero page errors.

- **2026-08-12 — the raven's law: weight and wit (Claude).** A real raven flew
  over Yaan's head — the first after months of looking — and he asked for it to
  be reflected in the game: bird size must be real (a raven is twice a carrion
  crow and must carry twice as much; a buzzard dwarfs a robin; gulls are great
  carriers), size must decide battle strength, and size must count AGAINST
  running villages, towns and counties — robins charm a town hall, ravens
  empty it. Release `raven-weight-and-wit-v255-20260812` (v254 was taken by
  the unmerged feedback-inbox branch).
  - **True weight** (`bird_size_core.js`): `FIELD_GUIDE_MASS_G` — curated
    BTO/RSPB-style adult masses for the hand-curated roster (whole UK corvid
    family, the named yardsticks, gulls, raptors, waterfowl, AU regulars),
    keyed by profile id with a name-slug fallback. Resolution order:
    measured AVONET provenance → field guide (`source:'field'`) → stats.
    `massGramsFromScore` inverts the log scale for birds that only stored a
    score; `birdMassGrams` prefers the bird's stored true grams.
  - **True carrying**: capacity is mass-linear — `round(massG / 100)` own
    units (min 1, max 20), stamina/level trims, satchels always additive on
    top (the pinned 1→4 stormweave contract survives). Raven 12 / crow 5 /
    buzzard 8 / robin 1 / herring gull 12.
  - **Weight loses ledgers** (`bird_roles_core.js`): `civic:true` on
    Steward/Warden, stats rebalanced INT 0.5 / CHA 0.5, and
    `governanceWitFactor(sizeScore)` multiplies civic aptitude: ×1.15 in the
    robin's bracket (≤20), neutral to jackdaw weight (≤40), sliding to ×0.55
    at score 100. Unknown size is neutral. Non-civic posts ignore size, so
    the raven (INT 10) keeps the Library.
  - **Wiring** (`index.html`): `BIRD_BIOLOGY_STATS_VERSION` →
    `bird-biology-runtime-v4-weight-and-wit-20260812` (saves re-derive
    size/mass/carry); size panel gains a 🏛️ governing chip and says
    "field guide weight" for curated masses (AVONET label reserved for
    measured ones). STORY.md: "The Raven, and the law of weight and wit".
  - Tests: `tests/test_raven_weight_and_wit_20260812.py`; size/roles suite
    repointed (both core `?v=` pins move to v255, generated-stats ladder is
    now tiny/small/large/giant since the stub Buzzard weighs its true 780 g);
    biology-version pins updated; release pins swept v253→v255 with the v253
    suite growing the conventional OWN_RELEASE_PIN/CURRENT_BUILD split.
    SW cache + `BURBZ_BUILD` bumped; both cores' `?v=` moved in both loaders.
    Local run: 1131 passed, 15 skipped, only the 7 documented container art
    failures (also failing on main).

- **2026-08-12 — citizens work the yards, homes start in timber (Claude).**
  Yaan's ask: every yard (quarry, lumber camp and the like) needs one citizen
  working it, and a basic wooden house — upgradeable to stone — so the Quarry
  no longer has to be a village's first building. Release
  `citizen-workers-timber-homes-v253-20260812`.
  - **Workers** (`index.html`): producing buildings carry `workers: 1`
    (Farm, Lumber Camp, Quarry, Market Hall, Chapel). New `villageWorkforce()`
    deals villagers out by `workPriority` — food, timber, stone, trade,
    chapel — so a short-handed town staffs its farm before its chapel.
    `villageProductionSnapshot`, `villageEconomySnapshot` (flat coins/timber,
    tax boost) and the Stores ledger all skip unstaffed yards. The quarry's
    v221 "founding crew" is gone — an empty town's quarry cuts nothing — but
    the first-quarry 10-stone opening cut and the stone-free first-quarry
    build both survive.
  - **Homes** (`index.html`): new `cabin` building, first in
    `EMPIRE_BUILDINGS`, ungated, `need: shelter`. Level 1 is the 🛖 Timber
    Cabin (25 🪙 + 14 🪵, no stone — so homes precede the Quarry); level 2
    rebuilds it as the 🏠 Stone Cottage (stone cost) and doubles its housing.
    Two new catalogue fields: `tiers` (per-level name/icon/desc, read via
    `villageBuildingTier`) and `costLevels` (stepped prices replacing the
    flat ×(level+1) — `villageBuildingCost` checks it first). The governor's
    desk shows 👷 crew lines per yard and a "👷 x/y yards crewed" headline;
    the 3D village raises `villageMakeSettlerHome` (logs at level 1, stone at
    level 2). Empty-village copy now points at the Timber Cabin everywhere.
  - **Lore** (`STORY.md`): the **village folk** are canon — a human-like
    species of the Kingdom of Burbz, a separate people and much simpler than
    the birds. They work and endure; birds get every named speaking part.
    Keep it that way in future quest text.
  - Tests: `tests/test_citizen_workers_timber_homes_20260812.py` pins the
    cabin costs/tiers, the crew gating, the priority order and the copy.
    Superseded pins moved on with comments (`test_quarry_stone_economy`'s
    empty-town stone, `test_empty_liberated_towns`' Cottage Row hint);
    harnesses that extract `villageEconomySnapshot`/`empireBuildStructure`
    grew `villageWorkforce`/`villageBuildingTier`. Release pins repointed;
    SW cache + `BURBZ_BUILD` bumped.

- **2026-08-11 — Hold to steer, scroll to pass; quick icons go top-left
  (Claude).** Yaan asked for two things: the Kitchen/Quests/Stores icons out
  of the middle-right (they covered claim buttons), and 3D views that stop
  hijacking the page scroll — tap-and-hold should be the way in. Release
  `hold-to-steer-v251-20260811`.
  - **Core** (`touch_steer_core.js`, new, pure, Node-testable): a hold gate.
    A touch never steers on contact; moving past 10 px marks the gesture as
    the page's scroll for good; holding still 300 ms engages steering. Mouse
    and pen engage at once; a second finger (pinch) always engages. Timers
    are injectable for tests.
  - **Wiring**: the village and town engines in `index.html` and
    `academy_3d_core.js` all consult the gate before moving the camera,
    switch their stages from `touch-action: none` to `pan-y`, preventDefault
    touchmove only while engaged, re-anchor the drag on engage (no camera
    jump), mark a grab as never-a-tap, and show a golden `.steering` outline.
    Player copy now says "Hold, then drag to look around".
  - **Quick icons**: `.game-side-actions` moved from right-center to
    top-left under the header; the tutorial nav pointer flips to sit right
    of the dock (`rect.right + 5`, row-reverse, arrow pointing left).
  - Test pins moved on from v250; `academy_3d_core.js` gets a new `?v=` pin
    tracked by `test_academy_3d_glow_detail_20260806.py`.

- **2026-08-11 — Academy opens in 2D (Claude).** Yaan reported the tutorial
  landing players on the 3D Academy, where tapping the tree to place a
  building misfired. Release `academy-2d-default-v250-20260811`.
  - `academyViewMode()` in `index.html` now defaults to `'2d'`; only a saved
    `'3d'` choice (or the toggle) opens the 3D tree. The static toggle label
    `🌳 3D` already matched a 2D default, so no markup changed.
  - `tests/test_academy_2d_default_20260811.py` pins the default and the
    toggle; the newest-release test pins moved on from v249, with
    `test_walking_story_quests_20260811.py` gaining a `CURRENT_BUILD`
    alongside its own asset pin (same split as the v248 test).

- **2026-08-11 — The Twenty Roads: twenty shared walking tales (Claude).**
  Yaan asked for 20 real-life walking quests that are the same for every
  player anywhere in the world — proper RPG quests with NPCs, sized to the
  walk, with really good rewards and lore scrolls tying back to the empire
  and Academy the way Bethesda games hide books. Release
  `walking-story-quests-v249-20260811`.
  - **Core** (`walking_story_core.js`, new, pure, Node-testable): the
    campaign catalogue `WALKING_STORIES` — 20 tales in fixed order, tiered by
    the quest's full walking distance (`storyTierForLength`: stroll <1500 m,
    ramble <3200 m, trek beyond; 8/7/5 tales per tier). Each tale has a named
    NPC (a recurring cast of nine), intro/milestone/outro dialogue, one
    Feathered Folio lore scroll (canon-checked: charters, the Academy's
    founding, sky-caravan waybills, the usurper's Ember Script, Merlin's
    letter), and a reward of real catalogue ids only — gear + materials from
    `loot_crafting_core`, bird-study scrolls from the bag
    (`validateWalkingStories` resolves every id; a test runs it).
    `nextWalkingStory(lengthM, completedIds)` is deterministic: first untold
    tale of the walk's tier, falling through to any untold tale once a tier
    is exhausted so the campaign always completes. `attachWalkingStory`
    stamps the full text onto the quest itself (saves stay self-contained)
    and plans story beats onto EXISTING plain-flag waymarkers
    (`walkingStoryCheckpointPlan`: milestone mid-list, scroll at the last
    plain flag) — no new checkpoint kinds, so ordered-marker progression
    (v224) is untouched.
  - **Wiring** (`index.html`): `attachStoryToNewWalkingQuest` runs right
    after `buildQuestFromOffer` (indexes survive route repair — checkpoint
    identity is preserved). Story intro replaces the generic trailhead/NPC
    dialogue; `handleWalkingStoryWaymarker` fires the milestone beat and
    `collectWalkingStoryScroll` (+25 XP, scroll dialog, stored in
    `gameState.walkingStories.scrolls`). `applyWalkingStoryCompletion` in
    `completeWalkingQuest` marks the tale told, grants the missed scroll
    quietly, pays the reward ONCE (first telling only — replays after a
    catalogue reset can't farm epics), and returns the summary block that
    rides `wq.history`. UI: outro NPC dialog at the banner, tale line on the
    active-quest sheet, tale chip on the map focus card (previews which tale
    a walk of that length would tell), a 📖 Twenty Roads progress card and
    tap-to-read 📜 Feathered Folio sheet on the quests screen.
  - Tests: `tests/test_walking_story_quests_20260811.py` (catalogue
    validation incl. every-reward-id-resolves, tier maths, deterministic
    selection + fallback, attach/checkpoint-plan behaviour on a real built
    quest, one-time reward rule, HTML wiring, release pins). Release pins
    repointed per convention (21 head-tracking files v248→v249; the v248
    test grew the OWN_RELEASE_PIN/CURRENT_BUILD split — its
    `world_level_core.js` `?v=` pins stay on v248 since that core is
    untouched, as do the battle/loot core pins). SW cache + `BURBZ_BUILD`
    bumped; `walking_story_core.js` precached in both SW lists and added to
    the live updater's FILES. STORY.md gains "The Twenty Roads" and "The
    Feathered Folio". The alignment-authority harness gained the conventional
    one-line stub (`attachStoryToNewWalkingQuest → null`). Local run:
    1117 passed, 10 skipped, only the 7 documented git-lfs pointer-file art
    failures (no `git lfs` in the container). Browser-checked in headless
    Chromium (390×844): the game boots with the story core live, a 2 km walk
    resolves the correct ramble tale with beats on plain flags, zero page
    errors.

- **2026-08-11 — conquest raises the world level, and the world fights back
  (Claude).** Yaan asked for a fully fleshed-out classic-RPG XP system where
  the more the player conquers, the harder the game gets — higher-level
  battle opponents, crafting that keeps pace through an upgradeable forge,
  and Assassin's-Creed-style recommended levels on the empire map. Release
  `conquest-world-levels-v248-20260811`.
  - **Core** (`world_level_core.js`, new, pure, Node-testable): `worldLevel`
    weighs the whole realm pyramid (village 1 · county 2 · duchy 4 ·
    kingdom 6 · empire 8, capped at 50 — the bird level cap);
    `siteRecommendedLevel` adds a distance band from the CRADLE (the first
    village ever freed): heartland +0 through far frontier +8, so riding out
    always means harder garrisons. `dangerRating` calls the odds in plain
    words (stroll/fair/hard/deadly with icon + colour) against
    `flockBattleLevel` (average of the four strongest birds — a Skyclash
    squad).
  - **Battles** (`index.html` `leagueRivalOpponents`): a Liberation garrison
    now fights at `empireSiteRecommendedLevel(liberationSite)`; a roaming
    league squad at `max(flock average, world level)` plus the tier boost.
    The rival cache key carries `_wl<level>` and the liberation seed so a
    changed world re-rolls the squad. The battle-select header shows the
    honest odds line (`rival-danger-line`: garrison level, world level,
    flock level, danger call). **Early game is untouched** — no county means
    the same ragged eased squads, pinned by
    `test_early_game_easy_battles_20260810.py`, and the first-liberation
    token garrison still can't lose.
  - **Rewards** (`battle_core.js` `battleRewards`): additive
    `opts.opponentLevel` scales coins/branches/birdXp/playerXp by +4% per
    level above 1. No option (or level 1) pays the exact classic numbers, so
    every pre-existing rewards pin stays true; defeat stays a flat
    consolation. `endPerchBattle` passes the beaten squad's average level.
  - **Forge** (`loot_crafting_core.js` + `index.html`): the Fletcher's Forge
    has five hearths (Field Anvil → Stone Hearth → Guild Forge → Royal
    Forge → Sunfire Forge). Rarity gates: rare needs Lv 2, epic Lv 3,
    legendary Lv 4 (`minForgeLevelForRarity`; locked recipes show
    `🔒 FORGE LV n`, and `craftGear` re-checks). Upgrades cost coins,
    branches and real materials (`FORGE_UPGRADE_COSTS`, up to a phoenix
    ember for the summit) via the craft tab's upgrade desk
    (`renderForgeUpgradePanel` / `upgradeForge`; `gameState.forgeLevel`,
    clamped by `normalizeForgeLevel`). Tempering: every equipped piece is
    honed to the forge's level — `equipmentBonuses(loadout, {gearLevel})`
    applies `temperedStats` (+12% combat stats and +1% crit per level above
    1; carry bonuses never scale — a bag is a bag). `birdGearBonuses` and
    `forgeGearStatLine` feed the forge level through, so stat lines show
    what gear really does today. Default calls stay byte-identical.
  - **Atlas** (`refreshEmpireMap`): every dark frontier banner is stamped
    `<danger icon> LV n · name` with a `danger-<id>` tint class, its tap
    card leads with `Recommended Lv n — <danger> (flock Lv m)`, the map key
    teaches the colours, and the owned-lands status line opens with
    `🌍 World Lv n`.
  - Tests: `tests/test_conquest_world_levels_20260811.py` (Node-driven core
    maths incl. the default-identity contracts, forge gating/tempering,
    reward scaling, HTML wiring, release pins). Release pins repointed per
    convention (19 head-tracking files sed'd v247→v248; the v247 test grew
    the OWN_RELEASE_PIN/CURRENT_BUILD split; the three
    `turn-potions-v232` core `?v=` pins moved since both cores changed).
    SW cache + `BURBZ_BUILD` bumped; `world_level_core.js` precached in
    both SW lists and added to the live updater's FILES. STORY.md gains
    "The usurper fights back — the world level". Local run: 1111 passed,
    10 skipped, only the 7 documented git-lfs pointer-file art failures.

- **2026-08-10 — live reconcile: the drifted v240-v244 line comes home
  (Claude).** Yaan reported that none of the day's updates were reaching the
  game. Root cause: the production VPS (yaanbatho.com/burbz) had been
  advanced DIRECTLY through five releases that never reached GitHub —
  `birdex-direct-recruit-v240` (Birdex cards recruit directly once the
  Barracks stands), `companion-unlock-copy-v241` ("NEW COMPANION
  UNLOCKED!"), `remove-merlin-first-clue-v242` (retires `pq_merlin_clue`,
  27-link chain), `training-master-room-actor-v243` (the Drill Master
  stands in the Training Hall scene; its role card lives in a picker
  sheet), `distributed-game-hud-v244` (header Diary button, right-side
  quick-action rail with Kitchen/Quests/Stores, `data-game-route` routing
  through `activateGameHudDestination`) — while GitHub main advanced through
  four OTHERS (`early-game-easy-battles-v240` … `real-sky-daylight-v243`).
  The burbz-sync drift guard then did exactly its job: live managed files no
  longer matched its last-deploy manifest, so every sync aborted fail-closed
  and NOTHING deployed. Release `live-reconcile-v245-20260810`.
  - **Recovery**: `.burbz-deployed-sha` on the server still read the v239
    base commit (7ba86f6). Exactly three managed files had drifted
    (`index.html`, `sw.js`, `action_badge_core.js`); all three were
    recovered byte-exact over HTTPS from the live web root and committed on
    a branch cut from that base, then three-way merged with main — only the
    `BURBZ_BUILD`/`BURBZ_CACHE` lines conflicted. Both lineages' markers
    survive in the cache history, per the v217 precedent.
  - **Tests**: the live line's test updates never reached GitHub and the
    server does not serve `tests/`, so eleven pinned contracts were
    repointed here at the recovered behaviour (nav-label pins → header
    diary button / side-rail label, `roomBirdGridHTML(stageBirds, room)`,
    the training-room rolePanel conditional, `recruitAction` fallback,
    tutorial tab hook now `'tab:' + destination` fired from
    `activateGameHudDestination` — with switchScreen still clean — and the
    27-quest chain). New `tests/test_live_reconcile_v245_20260810.py` pins
    the five recovered releases so they can never silently vanish again.
  - **Ops**: the server's stale `.burbz-managed-hashes.sha256` must be
    cleared once (then `systemctl start burbz-sync.service`) so the guard
    re-baselines on this promoted build — after that the 5-minute timer
    deploys main normally again.
  - Local run: 1095 passed, 10 skipped, only the 7 documented git-lfs
    pointer-file art failures. Browser-checked in Chromium: the merged game
    boots with the distributed HUD and the town/county/daylight features
    together, zero page errors.

- **2026-08-10 — the real sky: village and town lighting follows the
  player's clock (Claude).** Yaan's follow-up to the town square: "I want the
  lighting to reflect the time of day in the player's real-life world."
  Release `real-sky-daylight-v243-20260810`.
  - **Core** (`daylight_core.js`, new, pure, Node-testable): fixed local-hour
    windows (dawn 5-7, day 7-17, dusk 17-19, night otherwise — no location
    permission needed just to light a scene). `sunFactorForHour` (smooth
    ramps), `warmFactorForHour` (golden-hour blush, `4·s·(1−s)`),
    `phaseForHour`, integer-RGB `mixHex`, and `daylightGradeForHour` — the
    whole lighting balance sheet (sun/warm/stars/moon flag/torch/hemi/
    keyIntensity/keyColor/exposure). **The night row reproduces the game's
    original moonlit values exactly** (hemi 2.0, key 1.95 × 0xbfd2ff,
    exposure 1.25, torches full) — a player at midnight sees the village the
    game has always drawn, pinned by test. `gradePalette` blends a village
    palette's sky/ground/hemisphere toward daytime targets; materials keep
    their authored colours — brightness comes from the lights.
  - **Wiring** (`index.html`): `burbzDaylightGradeNow()` reads the local
    clock once per scene build (typeof-guarded — a missing core falls back
    to the original night). In `buildVillageScene` and `buildTownScene`: the
    pinned `VILLAGE_PALETTES[...]` roll survives as `basePal` and is graded;
    stars keep their rng draws (layout stability) but fade via opacity +
    `visible`; the moon/halo yields to a sun-halo/disc pair when
    `daylight.moon` is false; fireflies and the shooting star sleep through
    the day; doorway torches and lamp glows scale by `daylight.torch`; the
    hemisphere and the shadow-casting key light take grade colour/intensity;
    `toneMappingExposure` follows the grade. Scenes rebuild on phase change
    two ways: the `render*` entry compares `*BuiltPhase` against
    `burbzDaylightPhaseNow()`, and the animate loops check every ~600 frames
    so dawn breaks over an open screen too.
  - Tests: `tests/test_real_sky_daylight_20260810.py` (core curves, the
    night-equals-original contract, palette grading, HTML wiring, release
    pins). Release pins repointed per convention; SW cache + `BURBZ_BUILD`
    bumped; `daylight_core.js` precached with its own `?v=`. Browser-checked
    in Chromium with a frozen clock at 13:00 / 18:00 / 23:00: bright green
    midday, warm half-lit dusk, and the untouched moonlit night; zero page
    errors.

- **2026-08-10 — the town square, the county map and the painted realm
  (Claude).** Yaan's three-layer ask: capture three villages and the town they
  make gets its own 3D screen "in sort of the same way that you've done the
  village", with the villages visible within it; a county gets a separate
  zoomed-out screen "more like Crusader Kings"; and once the player holds
  several counties, the main map itself is coloured like a Crusader Kings
  map. Release `town-county-screens-v242-20260810`.
  - **Town Square** (`screen-town`, `index.html`): `renderTownScreen` /
    `buildTownScene` run their OWN three.js renderer and animation registries
    (`town*` globals) but reuse the whole `villageMake*` catalogue, textures
    and gesture code. `townDistrictLayout` projects each member village's real
    lat/lon offset from the settlement centroid onto the meadow (normalised,
    then relaxed apart) — the town on screen is the town on the map. Each
    district gets a cobbled yard, cottages, a seeded landmark
    (church/windmill/manor/dovecote), hearth smoke and a floating name sign;
    lanes run back to the shared market square, where the charter stone
    (`villageMakeSettlementStandard`) flies one pennant per district. Tap a
    district (raycast on `userData.districtSeed`) → `openEmpireVillage`.
    Builders that push into the village animation registries
    (walkers/roof-birds/cloths/hens/windmill sails) are length-marked before
    the build and `splice`d into the town's own lists after — the two scenes
    never fight over one list. Scene rebuild keys on `townSceneKey`
    (settlement id + sorted member seeds), so a town that gains a district
    rebuilds on the next visit. Reached from the Royal Ledger settlement rows
    (`openEmpireTown`), the atlas settlement tap card (WALK ITS SQUARE — the
    pinned `frameEmpireSettlement(settlement.id)` action survives), the
    county-map hotspots, and a `#villageTownLink` banner on any district
    village's screen. No-WebGL fallback: a district button list.
  - **County Map** (`screen-county`): `drawCountyMap` paints a parchment
    chart onto a 2D canvas, fully offline and seeded off the capital —
    the county border as a smoothed convex hull in its realm's colour,
    neighbouring counties dash-bordered at the map's edge, lanes running
    capital-outward, village crests (district villages drop their labels —
    the settlement banner names the group), town/city standards, cartouche,
    compass and scale bar. DOM hotspot buttons over the canvas travel to
    villages (`openEmpireVillage`) and squares (`openEmpireTown`). Opened
    from the County Hall's 📜 COUNTY MAP button and the atlas county card.
  - **Painted realm** (`empire_realm_core.js` + atlas): new pure helpers
    `realmSeatTint` (golden-angle HSL per liege seat), `territoryHullRing`
    (convex hull over padded village points, dateline-safe) and
    `realmTerritoryFeatureCollection` (one polygon per county sworn to a
    duchy or better, coloured by its TOP liege — kingdom over duchy; lone
    counties stay unpainted on purpose: colour is the reward for uniting the
    realm). The atlas adds an `empire-realm` geojson source with
    data-driven `['get','color']` fill + border line layers, inserted BEFORE
    `empire-territory` so village green stays on top; `refreshEmpireMap`
    feeds it from the cached `empireRegionsInfo()` pyramid. Tapping painted
    land opens an explain-first card (`showEmpirePaintedCountyCard`) via the
    single map click handler (per the no-second-listener comment), and the
    map key teaches the colours.
  - Tests: `tests/test_town_county_screens_20260810.py` (Node-driven tint/
    hull/painting maths — including the kingdom-overrides-duchy colour rule
    and a dateline county — plus HTML wiring and release pins). Release pins
    repointed per convention (11 `CURRENT_BUILD`s, 5 head-tracking
    `RELEASE_PIN`s, and the realm-core `?v=` pins in the feudal/settlement/
    location suites). SW cache + `BURBZ_BUILD` bumped;
    `empire_realm_core.js` `?v=` moved in both loaders. Local run:
    1077 passed, 10 skipped, only the 7 documented git-lfs pointer-file art
    failures (no `git lfs` in the container). Browser-checked in Chromium
    (390×844, SwiftShader): the Town Square renders both seeded towns with
    3 district rows and travels into a district on tap; the County Map
    paints hull, hotspots, cartouche and the duchy colour; zero page errors.
  - NB: `screen-town` and `screen-county`, like `screen-region`, have no
    bottom-nav item — they are reached programmatically only, so
    `switchScreen`'s trail/back handling covers them automatically.

- **2026-08-09 — the Bird Hospital discharges healed patients (Claude).**
  Yaan's follow-up to the sleep retirement: birds parked in the Bird Hospital
  stayed there until manually moved. Release
  `hospital-auto-discharge-v239-20260809` makes the ward a ward, not a home.
  - **Rules** (`index.html`): `academyMoveBird` writes an admission slip —
    `academy.hospitalReturnRoom` records the room a patient was admitted
    from, and moving anywhere else clears it. `dischargeBirdFromHospital`
    releases a full-HP patient to the slip's room (falling back to the
    Aviary Gardens when the room is unbuilt, or is the Kitchen/Barracks,
    which take no lodgers) with a toast; it never touches the Head Healer
    (the post is the point of being there), birds away on expeditions, or
    birds mid-training. `tickAcademy`'s hospital branch heals then sweeps —
    so patients healed to full by a meal or a level-up between rounds are
    also released, and an open room interior re-renders when a bed empties.
  - **Why the sweep is safe for the story chain**: `pq_hospital_rest`
    ("Prescribe some rest") completes via the `station_hospital` event the
    moment the player stations a bird, before any discharge can undo it.
  - Tests: `tests/test_hospital_auto_discharge_20260809.py` (stub-driven
    discharge matrix — healed/hurt/no-slip/demolished-room/Kitchen-slip/
    Head-Healer/away cases — plus HTML wiring and release pins). Release
    pins repointed per convention; SW cache + `BURBZ_BUILD` bumped. No core
    module moved, so every `?v=` stays put.

- **2026-08-09 — sleep retired: birds never sleep, never blocked (Claude).**
  Yaan opened The Roost to find all 8 of his companions asleep at 21:00 and
  nothing available for battle — the roost-sleep-v208 loop could idle the
  entire flock at once. His call: "the gameplay mechanics aren't right there —
  just remove the sleep part of it, for now." Release
  `sleep-retired-v238-20260809` (renumbered from v237: the same-day
  mallard-true-diet release took the v237 number on main first) removes the
  mechanic while keeping every API shape and pinned call site, so a future
  revert is one release, not a rebuild.
  - **Core** (`bird_sleep_core.js`): `sanitizeSleepCare` now heals any care
    record to awake-and-rested (tiredness 0, sleeping false; only
    `sleepReturnRoom` survives, for migration); `advanceTiredness` never
    accrues; `isScheduledSleepTime` is always false (owls have no bedtime
    either); `sleepPlan` never sleeps and flags `shouldWake` for stale
    sleepers; `sleepReadiness` is always `ok`. The nocturnal detection,
    night window and **Night Hunter bonus all stay** — they are rewards,
    not blockers (their v229 test suite still passes minus the retired
    scheduled-sleep pins).
  - **App** (`index.html`): `reconcileBirdSleep` is now a one-way save
    migration — a bird an old save left asleep in The Roost wakes on first
    look and walks back to the room in `sleepReturnRoom`. Manual Roost
    assignment is an ordinary move (no more sleep-on-assign), the TIREDNESS
    metre and the room grid's tiredness bar / Sleeping states are gone, the
    add-a-bird sheet no longer disables sleepers, and the Roost copy sells
    "Rest: restores HP · birds stay battle-ready". The pinned availability
    filters (battle/quests/training/posts) still call
    `sleepReadinessForBird` — it just always answers awake — so the
    reservation-guard and size/roles string contracts are untouched, and the
    whole sleep gate can be re-enabled from the core alone.
  - Tests: `tests/test_bird_sleep_and_room_grids_20260803.py` rewritten to
    pin the retirement (never tires / never sleeps / stale sleepers wake /
    no dead sleep UI); `test_hospital_bird_ui` and
    `test_bird_card_locations` repointed off the removed Sleeping states;
    release pins repointed per convention (the two canopy suites split a
    `CURRENT_BUILD` off their unchanged core pins, same pattern as the
    nocturnal suite's v235 split). SW cache + `BURBZ_BUILD` bumped;
    `bird_sleep_core.js` `?v=` moved in both loaders. Local run:
    1047 passed, 10 skipped, only the 7 documented git-lfs pointer-file art
    failures (no `git lfs` in the container).

- **2026-08-06 — the living canopy: layered painted branches (Claude).** Yaan's
  verdict on v234's tree sway was exact: "it's the same picture of the tree …
  it's just warping." Tilting one flat painting can never read as branches
  moving. He generated a new master tree and six branch paintings on request
  (prompts supplied by Claude), and this release rebuilds the scene in layers.
  Release `living-canopy-v236-20260806` (renumbered from v235: the same-day 3D tree-glow release took v235 on main first — same convention as the v202/v203, v221/v222 and v228/v229 pairs).
  - **Art pipeline** (offline, in-container): the branch generations came with
    painted backdrops, so backgrounds were removed with `rembg` (u2net),
    cropped to content, resized to 680px and shipped as WebP-with-alpha in
    `assets/academy-branches/branch-{a..d}.webp` (~460 KB total). The tree is
    `assets/academy-tree-manga-20260806.webp` (327 KB; the old
    `academy-tree-manga-20260629.png` stays on disk for rollback but left the
    SW precache and the live updater's file list, both of which now carry the
    five new assets).
  - **Layered scene** (`index.html`): `.academy-branches-back` (z2) holds four
    bough instances sprouting from the trunk BEHIND the treehouses;
    `.academy-branches-front` (z8) holds two near-camera boughs (darker,
    1px blur) over them. Each `.ab-N` instance pivots about the point where
    its bark meets the trunk (`transform-origin` on the bark end; flipped
    instances put the origin on the right and mirror via an inner `img`
    scaleX so the pivot maths stays sane) on one of three sway characters
    (`abSwayA/B/C`, ±~1.5° with vertical spring) at its own duration and
    phase. A CSS grade (`saturate/brightness`) pulls the vivid sprites down
    to the muted tree; `.alive-night` rules dim the canopy after dark.
    `treeSway` itself is now a hair of drift (±.15°) — the warp is gone, the
    movement lives in the boughs. Layers are `pointer-events:none`; reduced
    motion stills `.academy-branch`.
  - **Engine** (`academy_alive_core.js`): the procedural corner tufts'
    `defs` list is now empty — two art styles of foliage clashed — but
    `buildFoliage`/`drawFoliage` stay (they're pinned by the academy-alive
    suite, and one defs entry brings the tufts back if ever needed).
  - **Rooms** (`academy_treehouse_core.js`): default x/y retuned so fresh
    buildings land on the new painting's shelves (dorm 22,68 · tavern 80,71 ·
    training 75,58 · hospital 25,52 · crowbar 75,41 · kitchen 50,55 ·
    workshop 29,30 · library 74,26 · nursery 35,16 · observatory 66,12 ·
    quest_roost 49,71). Player placements override defaults, so existing
    saves keep their layouts (and can re-place via build/move).
  - Tests: `tests/test_living_canopy_20260806.py` (including a ≤0.2° cap on
    treeSway rotation so the warp can't creep back). Release pins repointed
    per convention — note `test_nocturnal_night_bonus` now splits its core
    pins: `academy_treehouse_core.js` moved to v235 (`ACADEMY_CORE_PIN`)
    while `bird_sleep_core.js` stays on v229, since only the former changed.
    SW cache + `BURBZ_BUILD` bumped; both academy cores' `?v=` moved.
    Browser-checked in Chromium: ~40% of the treehouse frame's pixels change
    across a 3.2s interval (the canopy genuinely moves), buildings sit on
    their painted shelves day and night, and the crow still walks his deck.

- **2026-08-06 — the living Academy tree (Claude).** Yaan asked for the 2D
  Academy to read as a genuinely living, breathing place: the tree moving
  slowly "the same way you've done Merlin's Perch", the buildings smaller and
  truly integrated into the tree (moving WITH it), different life per building
  (lights going on and off, more smoke), and The Crowbar's little crow moving
  backwards and forwards. Release `academy-living-tree-v234-20260806`.
  - **The whole tree sways together** (`index.html`): a new
    `.academy-tree-sway` wrapper (`#academyTreeSway`) now carries the branch,
    room and bird layers, and runs the IDENTICAL `treeSway 13s ease-in-out
    infinite alternate` shorthand as `.academy-tree-swaybg` — both elements
    exist from first parse, so the two animations share a document-timeline
    start and the treehouses stay glued to their boughs. `treeSway` gained a
    touch of vertical give (Merlin's-bough weight). The wrapper is
    `pointer-events:none` (placement taps fall through to the tree, pinned by
    test) and `.treehouse-room-node` re-enables `pointer-events:auto`.
    NB: the wrapper's transform makes it the containing block for the room
    nodes' `left/top` percentages — it must stay `inset:0`.
  - **Smaller, nestled buildings**: node + sprite shrank 112→92px, with a
    tighter double drop-shadow and a stronger elliptical contact shadow so
    each treehouse sits INTO the bark. Every placeable room carries its own
    `--th-tilt` (resting lean) and `--th-rock-dur/-delay`, feeding a shared
    `thBranchRock` keyframe (rock about `50% 88%` with a weight-down /
    spring-up beat) — eleven boughs, not one sheet of buildings.
    `academy_alive_core.js` scales glow radii by `box / SPRITE_BOX` so the
    window glows shrank with the paintings (anchor FRACTIONS were already
    scale-invariant).
  - **Different life per building** (`academy_alive_core.js`): GLOW_STYLES
    `offChance` roughly trebled (window .026, lantern .016, hearth .009,
    cool .020, coollantern .016) so somebody visibly moves between rooms
    every ~15-30s; the Kitchen chimney works harder (power 1.25); the
    Crowbar's crooked stovepipe (0.44, 0.075) and the Hospital ward stove
    (0.47, 0.09) now smoke too; smoke cadence quickened and MAX_PARTICLES
    rose 150→170 to cover the two new chimneys.
  - **The Crowbar crow** (`index.html`): `crowbarCrowHTML()` renders a small
    hand-drawn SVG puppet (body/head/tail groups — the Library-art precedent)
    into the Crowbar node only. `crowbarCrowPatrol` (17s) hops him along the
    pub deck, turns him (`scaleX` flip — he never moonwalks), lingers him by
    the stools and hops him home; `crowbarCrowBob`/`Peck`/`TailFlick` keep
    him alive between trips. **The no-birds rule
    (test_no_birds_anywhere_on_the_academy_tree) still binds the ambience
    ENGINE** — the crow is deliberate, player-requested markup with his own
    class names; `class="treehouse-bird"` stays absent and the engine stays
    birdless. Don't "fix" him away.
  - Reduced motion switches off the wrapper sway, the branch rock and every
    crow animation (the pinned `.academy-tree-swaybg { animation:none; }`
    fragment survives inside the same media block).
  - Tests: `tests/test_academy_living_tree_20260806.py`. Release pins
    repointed per convention; SW cache + `BURBZ_BUILD` bumped and
    `academy_alive_core.js` `?v=` moved to the new tag in both loaders.
    Browser-checked in Chromium (390×844): wrapper and painting both compute
    `treeSway/13s`, sprites 92px on `thBranchRock`, exactly one crow who
    visibly patrols and turns on the deck, 20 glows anchored, chimney smoke
    and night fireflies on screen.

- **2026-08-06 — 3D Academy tree glow (Ava).** Expanded the existing Three.js
  Academy rather than replacing it. Its eleven rooms now carry distinct body,
  roof, facade and signature-prop treatments. At local night the 3D view exposes
  an accessible **Light the tree** toggle that powers bounded shadow-free interior
  PointLights, merged additive branch veins, leaf-top halos and every room window;
  daytime forcibly disables and hides it. Device-aware quality caps DPR, lights,
  halos, shadow size and frame cadence on phones in portrait and landscape while
  retaining merged static detail. Reduced-motion still frames visibly respond to
  the toggle, and room-unlock rebuilds release their shared GPU textures exactly
  once. Release/core pin: `academy-3d-tree-glow-v235-20260806`.

- **2026-08-06 — player-turn potion hotfix (Ava).** Release
  `turn-potions-hotfix-v233-20260806` fixes the inline battle button by exporting
  `battleUsePotion` from the app IIFE, makes consumption transactional across
  both persistent inventory and transient fighter effects when localStorage is
  full, and replaces two stale Forge descriptions that still promised automatic
  battle-open use. Tests now pin the window export, rollback plumbing and exact
  player-turn copy; global build/cache advanced while unchanged battle/loot core
  asset pins remain on v232.

- **2026-08-06 — player-turn battle potions (Ava).** Release
  `turn-potions-v232-20260806` changes the five existing equipped potion items
  from automatic battle-open effects into explicit once-per-battle **bonus
  actions** shown only while their bird has the player turn. Drinking does not
  replace the bird's move: Tonic of Vigour heals, Nettle War-Brew boosts ATK and
  MAG, Barrier Draught shields, Stormwing Philtre boosts speed and preserves 35%
  readiness after the move, and Phoenix Elixir combines healing, shielding and
  power. Consumption still removes the equipped bottle and quietly restocks the
  same loadout from a matching spare in the Stores for the next battle. All five
  recipes remain in the Fletcher's Forge, and The Gilded Beak now sells each
  battle potion directly into the Stores gear bag. Pure effect/readiness logic is
  in `battle_core.js`; inventory and UI wiring remain in `index.html`. Tests:
  `tests/test_turn_potions_20260806.py` plus the equipment and Skyclash suites;
  SW cache + `BURBZ_BUILD`, `battle_core.js`, and `loot_crafting_core.js` pins
  bumped.

- **2026-08-06 — Side Quests on the live map (Ava).** Release
  `side-quests-walk-goal-v231-20260806` restores the existing free-exploration
  system to the real-life Questing page as its own compact **Side Quests**
  button directly beneath **Show Quests**. The button opens the intro directly,
  changes to **View Side Quest** while a wander is active, and reopens its live
  trail log. The Player Quest is now named **Go for a walk** and counts either a
  completed mapped walking adventure or a completed free-roaming Side Quest;
  historical Side Quests count through the measure function, and new endings
  emit `walk_completed` immediately. Tests:
  `tests/test_side_quest_20260720.py`; SW cache + `BURBZ_BUILD` bumped.

- **2026-08-05 — the Night Hunter bonus (Claude).** Yaan's original idea —
  only nocturnal birds playable in the evening — broke the bedtime loop: a
  player with no owl could not send anything out on the long overnight
  expedition. Release `nocturnal-night-bonus-v229-20260805` (renumbered over
  the same-day eight-hour-quests release, which took v228 on main first —
  same convention as the v202/v203 and v221/v222 pairs) flips the rule:
  ANY bird can be worked at night (diurnal birds were already never
  scheduled-asleep after dark — a test now pins that on purpose), and a
  nocturnal bird (owl, nightjar, frogmouth, kiwi…) used at night in any
  capacity earns the **Night Hunter bonus**.
  - **Rules** (`bird_sleep_core.js`, which already owns `isNocturnalBird`):
    night is 18:00–06:00 local (`NIGHT_START_HOUR`/`NIGHT_END_HOUR`,
    `isNightHour` — `isScheduledSleepTime` now derives from the same window).
    `nocturnalNightBonus(bird, localHour)` returns the
    `NOCTURNAL_NIGHT_BONUS` pack (coins ×2, branches ×1.5, xp ×2, +1
    guaranteed item roll) or null.
  - **Maths** (`academy_treehouse_core.js`): `createBirdExpedition` and
    `createTrainingSession` accept `options.nightBonus` and apply whatever
    pack they are handed — the caller decides IF it applies, the core stays
    pure and Node-testable. The bonus multiplies the payout, never the timer,
    and the quest/session records `nightBonus` so the UI can explain the
    swollen haul.
  - **Wiring** (`index.html`): `nocturnalNightBonusFor(bird)` +
    `isNightRightNow()` next to the sleep helpers; passed at dispatch in
    `startBirdExpedition` and `startBirdTrainingSession` (both toast the
    bonus, dispatch hoots via `SFX.owl`). The send sheet shows a night hint
    and a `🌙 Night Hunter 2×` chip note on nocturnal birds, the adventure
    log gets a night-hunter beat, the claim celebration badges
    `🌙 NIGHT HUNTER RETURNS!`, and the Roost card copy advertises the perk.
  - Tests: `tests/test_nocturnal_night_bonus_20260805.py` (core window/pack
    maths, day-vs-night reward doubling on the same seed, the
    diurnal-birds-never-forced-asleep-at-night contract, HTML wiring,
    release pins). `test_roost_barracks_first_quest` harness gained the
    conventional one-line stub (`nocturnalNightBonusFor → null`). Release
    pins repointed per convention; SW cache + `BURBZ_BUILD` bumped and both
    touched cores' `?v=` cache-busters moved to
    `nocturnal-night-bonus-v229-20260805`.

- **2026-08-05 — mid-game progression: buildings unlock across the levels
  (Claude).** Yaan reported that progression collapsed early: every Academy
  building was open by trainer level 8 (three at level 1, the rest packed into
  2–8), and nothing else in the game ever gated on player level, so levels
  stopped meaning anything. Release `midgame-progression-v227-20260805`
  stretches the curve and makes each level a concrete gate.
  - **Academy curve** (`academy_treehouse_core.js` `TREEHOUSE_ROOMS`): the
    tutorial trio (Gardens/Roost/Barracks) stays at level 1; the teaching rooms
    arrive one per level (Training 2, Quest Roost 3, Kitchen 4, Hospital 5,
    Crowbar 6); the four specialist rooms are true mid-game milestones
    (Workshop 8, Library 9, Nursery 11, Observatory 12). Late-room costs rose
    with their gates (Workshop 240/55 up to Observatory 450/100) so each unlock
    is also a savings goal. The story chain's `pq_build_*` links stay in
    ascending gate order — a test now pins that, because re-ordering either
    side can stall the strictly-ordered chain.
  - **Village halls** (`index.html` `EMPIRE_BUILDINGS`): growth/prestige
    structures now carry `unlockLevel` (Cottage Row 5, Alehouse 6, Chapel 8,
    Market Hall 10). Survival + resource basics (Timber Cabin since v253,
    Farm, Well, Lumber Camp, Quarry) are deliberately ungated — Stone only
    comes from the Quarry, so gating it would deadlock a fresh province. `empireBuildStructure` blocks
    only NEW structures (`level === 0`), so old saves keep upgrade rights; the
    province desk shows 🔒 UNLOCKS AT TRAINER LV n instead of a dead buy button.
  - **Levels feel like rewards** (`index.html` PLAYER LEVEL section): each
    level pays a construction grant (`playerLevelUpGrant`: 20+5·lv 🪙,
    4+2·lv 🪵) inside `applyPlayerXpState`, so batch XP paths award it too. A
    shared `announcePlayerLevelUps()` (used by `addPlayerXp` AND the expedition
    claim) shows the grant, names newly unlocked buildings, or points at the
    next locked one. New badges: Rank 15, Rank 20, Master Builder (full
    Academy). Stale Barracks fallback `unlockLevel: 2` copy fixed to 1.
  - Tests: `tests/test_midgame_progression_20260805.py` pins the full curve,
    grant maths, chain ordering and the empire gate; release pins repointed per
    convention (the feudal-hierarchy test grew a separate `REALM_CORE_PIN`
    since `empire_realm_core.js` is untouched); the concurrent-town-builds
    harness now plays a level-6 trainer. SW cache + `BURBZ_BUILD` bumped
    (`midgame-progression-v227-20260805`).

- **2026-08-05 — accurate diets for every bird + the Head Chef service board
  (Claude).** Yaan reported that feeding a Yellow-legged Gull fish was refused
  even though the gull eats fish, and asked for a real overhaul: accurate,
  easy-to-read diets, omnivores that eat all sorts, and a Head Chef who makes
  feeding easy. Release `accurate-diets-full-catalogue-v226-20260805`.
  - **Root cause.** The gull (`Larus michahellis`) was not one of the 951
    national profiles, so the diet generator never made a record for it, and at
    runtime it fell to the conservative *unmatched* fallback — which refuses fish
    and claims a generic invertebrates/seeds/fruit menu. This hit **every**
    playable bird outside the 951 profiles: 323 of 683 expansion/alias birds had
    no real diet.
  - **Fix — full catalogue coverage.** New `scripts/build_catalogue_species.js`
    enumerates every playable non-profile bird into `data/catalogue-species.json`;
    `check_bird_diets.py` mints a source-backed `catalogueRecords` entry for each
    (398 of them) using a new **genus fallback** and a small
    `CATALOGUE_SCIENTIFIC_ALIASES` map for modern renames. Zero unmatched. The
    gull now resolves *exact* to its real 40%-fish diet. `bird_diet_hunger_core.js`
    indexes `catalogueRecords`; shipped records are trimmed to stay ~1 MB.
  - **Fix — omnivores.** `OMNIVORE_PRIMARY_FRACTION` (0.7) makes every food
    within reach of a bird's top family a PRIMARY (full meal), so a gull's fish,
    invertebrates and molluscs are all main meals while a kingfisher keeps its
    single fish primary. Merlin stays `[small_birds]`, the woodpecker stays
    `[invertebrates]`.
  - **Feature — Head Chef service board.** With a chef appointed, the kitchen is
    laid out by FOOD (`kitchenHeadChefBoardHTML`), each course listing the birds
    that eat it with the hungry ones lit up, and one tap
    (`chefServeFoodToEveryEater`) serves a food to every hungry bird that eats it
    across species, one ingredient each, until the stores run dry.
  - Tests: `tests/test_full_catalogue_diets_and_chef_board_20260805.py`. Existing
    diet/kitchen tests updated for the new (more accurate) verdicts — three
    harnesses that fed a bird a food that is now correctly a *secondary* were
    repointed to species where the food is a genuine primary (Waxwing/berries)
    or secondary (Blackbird/seeds). Release pins repointed per convention: the
    diet files and the two current-build-tracked cores (`empire_realm_core.js`,
    `diary_core.js`) moved to the new tag; `BURBZ_CACHE`/`BURBZ_BUILD` bumped.
    The only remaining local failures are the documented git-lfs pointer-file
    art tests (no `git lfs` in the container).

- **2026-08-04 — walking quests enforce ordered waymarkers (Ava).** A live
  Footpath Ring could mark a later checkpoint merely because a loop or nearby
  route leg passed within the shared GPS radius. That exposed a different icon
  underneath and made guidance appear to reverse toward an earlier missed stop.
  Release `ordered-quest-markers-v224-20260804` fixes the shared quest engine,
  so every walking quest can advance only its first unfinished checkpoint.
  Completed non-finish markers now disappear, the current marker always renders
  above muted future markers, and the finish stays hidden until the ordered route
  is genuinely done. Regression coverage includes overlapping markers, nearby
  loop legs, marker rendering, and PWA cache/version propagation. Verification:
  `880 passed, 18 skipped`, Node syntax checks, and a 375×812 Chromium smoke test.

- **2026-08-04 — the Royal Ledger opens as one realm dropdown (Claude).** Yaan
  reported two things at once: the feudal-ladder deploy "still hasn't updated"
  after several refreshes, and the ledger reads upside down — villages spilling
  from the top of the screen, with the realm buried underneath. Release
  `realm-dropdown-v223-20260804` fixes both.
  - **Layout** (`index.html`, `renderEmpirePanel`): the ledger body is now a
    single **closed** drawer — 👑 *YOUR REALM*, "Click to open your realm —
    counties, then towns, then villages". Everything unfolds inside it in
    ladder order: the crown banner, liege pyramid, counties, ladder nudge and
    trade routes first (`realm-sub-title` + new `.realm-lead` line, no drawer of
    its own any more), then a nested 🏘️ *TOWNS & CITIES* drawer, then a nested
    🏡 *YOUR VILLAGES* drawer — both folded by default. New helper
    `empireSubDrawerHTML()` wraps `empireDrawerHTML()` with the existing
    `.empire-drawer.is-sub` class. A one-village player still gets a realm hint
    at the top of the dropdown so it never opens on nothing. Locator strip,
    stats, the taxes button and the 📜 help drawer are unchanged.
  - **Staleness** (`sw.js`): `cache.add()` reuses the browser's HTTP cache, so
    a Pages `index.html` still inside its `max-age` was being reinstalled into
    the brand-new worker cache — the worker updated, the screen didn't. Install
    now goes through `cacheFreshCopy()`, which fetches each shell entry with
    `cache: 'reload'`. `BURBZ_CACHE` + `BURBZ_BUILD` bumped (Settings shows
    `Build realm-dropdown-v223-20260804` once the new build is running).
    `empire_realm_core.js` is untouched, so its cache-buster stays on v222.
  - Tests: `tests/test_realm_dropdown_20260804.py`; release pins repointed per
    convention; the v222 test's `BURBZ_BUILD` equality relaxed to the standard
    lineage check.

- **2026-08-04 — the feudal ladder nests like Crusader Kings' (Claude).** Yaan
  spotted the structural inconsistency in the empire layer: "three villages
  form a county" — and that same county then relabelled itself a Duchy at 5
  villages and a Kingdom at 8, while 3 villages *also* made a town in the
  settlement layer. Titles were size badges, not a hierarchy. Fixed as a
  simplified Crusader Kings 3, release `feudal-hierarchy-v222-20260804`
  (renumbered over the same-day quarry stone release, which took v221 on
  main first — same convention as the v202/v203 chef/settlement pair):
  - **Maths** (`empire_realm_core.js`): a 150 km cluster of 3+ villages is
    now ALWAYS a County (`COUNTY_TIER`; `regionTier()` is constant, the
    size-based `REGION_TIERS`/`nextRegionTier` are gone). New
    `realmFromRegions`/`deriveRealm` build the nested pyramid with the same
    union-find chaining, one level up each time: county capitals within
    `DUCHY_RADIUS_KM` (600) unite 2+ counties into a Duchy; duchy seats
    within `KINGDOM_RADIUS_KM` (2000) unite 2+ duchies into a Kingdom;
    `EMPIRE_MIN_KINGDOMS` (2) kingdoms proclaim the Empire of the Liberated
    Skies. Every title keeps its earliest-founded member's seat name, and
    counties are annotated in place (`duchyId`/`kingdomId`/`liegeTier`).
    `crownTitle` is now the highest title actually held (Count → Duke →
    Monarch → Emperor), and `regionUnityBonus` scales unity taxes with the
    liege chain (`LIEGE_TAX_BONUS` 15/20/25/30%) — the growth reward the old
    relabelling used to provide. Settlements (village→town→city) are
    untouched: they are the holdings layer, a different axis.
  - **Gameplay** (`index.html`): `empireRegionsInfo()` caches `deriveRealm`;
    `villageEconomySnapshot` unity reads `regionUnityBonus` (falling back to
    `REGION_TAX_BONUS`, keeping the pinned strings); `claimCurrentVillage`
    announces duchy/kingdom/empire proclamations alongside county foundings
    (`is proclaimed!` × 3, staggered); `EMPIRE_RANKS` (the loose-village
    honorific ladder) now tops out at Baron — the CK rung *below* Count —
    since everything from Count up is structural.
  - **UI**: the Region Hall is the **County Hall**; its headcount tier ladder
    became a liege-chain display (`region-hall-liege`) with a next-rung hint.
    THE REALM drawer lists the pyramid above the county rows (kingdom/duchy
    `realm-liege-row`s frame their whole lands via `frameEmpireLiege`, plus a
    `realm-empire-banner`), the atlas county banner (` · COUNTY` suffix, 🛡️)
    names the county's liege on its tap card, and the help drawer / map key /
    locator / status line teach the nested ladder. User-visible "region"
    copy became "county"; code identifiers deliberately keep `region`
    (`empireRegionsInfo`, `screen-region`, …) — grep before renaming.
  - **Canon** (`STORY.md`): "Counties, crowns and the trade of free realms"
    rewrites the ladder as County → Duchy → Kingdom → Empire with the
    unity-tax escalation; crown line (Count/Duke/Monarch/Emperor) unchanged.
  - Tests: `tests/test_feudal_hierarchy_20260804.py` (Node-driven pyramid
    maths — including the old bug as a regression: a 9-village blob is still
    one County — plus HTML/story contracts). The two suites that pinned the
    size ladder (`test_empire_realms_trade_20260731.py`,
    `test_location_empire_unlock_20260801.py`) were repointed at the nested
    behaviour. Release pins moved per convention (this release also caught up
    the stale v217/v220 `CURRENT_BUILD`/`RELEASE_PIN` constants that v218-220
    never repointed, including relaxing the satchel test's `BURBZ_BUILD`
    equality to the standard lineage check). SW cache + `BURBZ_BUILD` bumped;
    `empire_realm_core.js` cache-busters repointed in both loaders. The only
    remaining local failures are the 7 documented git-lfs pointer-file art
    tests (no `git lfs` in the container).

- **2026-08-03 — live v216 recovery + Empire reconciliation v217 (Codex).**
  The production VPS had advanced directly from deployed Git commit `198893f`
  through battle fullness, two-side snacks, role reservations, the proper-meal
  quest, Roost sleep, duration-tier errands, nearby real-walk navigation, diet
  corrections, card locations and the 636-species BOU alias overlay. None of
  those v204-v216 runtime blobs existed in GitHub. The seven exact live runtime
  deltas were recovered from `/home/ubuntu/yaanbatho/burbz`, committed on
  `codex/recover-live-v216`, then three-way merged with manga habitats and the
  Empire clarity v205 line. `BURBZ_BUILD` and the service-worker cache now end
  in `empire-live-reconcile-v217-20260803`, while every divergent release marker
  remains in the cache lineage. Recovered generators and tests were normalized
  for repo paths and explicit UTF-8 subprocess decoding. v217 also closes
  double-booking holes: posted birds cannot be moved (or spend resources on a
  build-and-move), and questing/training birds cannot enter battle through a
  stale selection. Deployment is fail-closed on unmanaged live drift, hydrates
  LFS at an immutable commit, records managed hashes atomically, and the manual
  updater now includes every current PWA dependency plus warrior/cutout/habitat
  art. Tests: `test_activity_reservation_guards_20260803.py`,
  `test_live_updater_completeness_20260803.py`, and the recovered v204-v216 set.

- **2026-08-03 — empire clarity: the Empire tab UI overhaul (Claude).** Yaan
  found the empire layer "very difficult to follow … hard to know on the map
  what [is what]" and asked for a UI-only simplification: keep every mechanic,
  make it obvious where the player, their town and their region are. Release
  `empire-clarity-v205-20260803`. **No gameplay maths changed** — every edit is
  in the render/HTML/CSS layer of `index.html` (plus pins).
  - **Map card**: a `📍 ME` button (frames the player via `frameEmpirePlayer`)
    and a `🗺️ KEY` button (static legend card explaining every marker type +
    "daylight = your lands") join MY REALM/WORLD; the focus buttons highlight
    by zoom band so they double as a "which layer am I looking at" indicator.
    Marker taps now open a **tap card** (`showEmpireMapCard`) naming the thing
    (Your village / Town / Region / Still in darkness) with 2-3 fact chips and
    explicit action buttons — travel/govern, Region Hall, frame, liberate — so
    a mis-tap teaches instead of teleporting. Semantic zoom in
    `updateEmpireMarkerDetail`: settlement standards appear from zoom 4,
    frontier swords from 6.5, so world zoom is regions + the player beacon
    (which gained an expanding ring). Region/town/city labels carry a
    ` · REGION`/` · TOWN`/` · CITY` suffix via CSS so gold never means two
    things. The status line is now ONE message by priority (empty world →
    nearest ⚔️ target → counts), keeping all its pinned fragments.
  - **Royal Ledger** (`renderEmpirePanel`): a `📍 locator strip` on top always
    answers "you / your town / your region", each chip framing the map. Stats
    chips relabelled Provinces→Villages (the Stores screen keeps the pinned
    `'Provinces'` literal). The collect button shows a real countdown when
    idle. The three flat sections became `<details class="empire-drawer">`
    accordions (same pattern as the quest board, session-persisted open
    state): YOUR VILLAGES (rows cut to three facts, **grouped under their
    region** with a "Farther afield" group), TOWNS & CITIES, THE REALM (region
    rows gain a `💰 READY` chip via `regionTributeReady`), plus a new
    closed-by-default **HOW YOUR EMPIRE WORKS** drawer that explains the whole
    village→town→city→region→trade ladder in plain words. A 0-village player
    gets a single 3-step onboarding card instead of empty chrome. All gating
    stays code-identical (`if (regions.length && rc) {` /
    `} else if (count >= 2 && rc) {`).
  - **Governor's desk / Region Hall**: unchanged mechanics; the huge
    Steward/Warden appointment cards folded behind one-line drawers
    (summary shows the incumbent), Region Hall copy de-jargoned
    (sanctuaries→villages; `Heart of the`/`District of the` stay — pinned).
  - **Terminology**: one noun per level — village, town/city, region
    (County/Duchy/Kingdom as badges). "Province"/"sanctuary" survive only in
    pinned strings and flavour copy.
  - **Final verification polish**: the idle tax clock now ticks live and
    includes caravan clocks; future device timestamps cannot wrap the timer.
    Town/city locator chips frame the whole settlement, far zoom hides detail
    banners (including them from the keyboard tab order), green territory taps
    use the same explain-first card as banner taps, and map reframing dismisses
    stale cards. Tap-card text is escaped at the shared rendering boundary.
  - Tests: all Empire suites green, including focused v205 clarity contracts.
    The existing release pins (`RELEASE_PIN` in 7 prior files + `core_pin`)
    moved per convention; the focused clarity test pins v205 too; sw.js got
    the new lineage segment; `empire_realm_core.js`/`bird_size_core.js`/
    `bird_roles_core.js` cache-busters repointed in both loaders.

- **2026-08-03 — villages merge into towns, towns into cities (Claude).** Yaan
  asked for the street-level merge layer: liberate **3 neighbouring villages
  and they make 1 town; 3 neighbouring towns make 1 city**, with gameplay and
  graphics adjusted to match.
  - **Maths** (`empire_realm_core.js`): `deriveSettlements(villages)` — the
    same union-find chaining as regions, but at street scale: villages chained
    within `SETTLEMENT_TOWN_RADIUS_KM` (5 km) merge into a town at 3+; town
    centroids chained within `SETTLEMENT_CITY_RADIUS_KM` (15 km) merge into a
    city at 3+ towns. A town keeps the name of its HEART (earliest-liberated
    village) and a city the name of its earliest-founded town, so ids survive
    growth exactly like region capitals. `SETTLEMENT_TIERS` carries the whole
    balance sheet per tier: taxBonus (0 / +10% / +25%), buildTimeFactor
    (1 / 0.85 / 0.70) and territoryRadiusM (2200 / 3200 / 4200). Everything is
    DERIVED from the liberation claims — no settlement state is stored, so
    nothing can drift; `empireSettlementsInfo()` caches per claim-set like
    `empireRegionsInfo()` does.
  - **Gameplay**: the merged multiplier composes into
    `villageEconomySnapshot` as `* merged * unity * governance` (region unity
    still stacks on top — different layers, different bonuses); construction
    in `empireBuildStructure` multiplies its clock by
    `settlementBuildFactorForSeed` (the per-town `eco.construction` lock is
    untouched — the concurrent-builds harness gained the conventional
    one-line stub `settlementBuildFactorForSeed → 1`). `claimCurrentVillage`
    announces a founding only when it actually happens, same pattern as
    regions. The Royal Ledger grows a green **TOWNS & CITIES** section
    (rows frame the settlement on the atlas via `frameEmpireSettlement`),
    with "two of three" nudges before the first merge; the governor's desk,
    claim bar and village title all name the settlement a district belongs to.
  - **Graphics**: on the royal atlas each district's daylight window and green
    territory circle grow with tier (`empireVillageTerritoryRadiusM`), so the
    three circles literally FUSE into one glow — that is the merge, visually.
    Town standards fly green banners at the settlement centroid, city
    standards gold with an `empire-city-glow` pulse. Walking-map markers swap
    🏰 for 🏘️/🏙️ with a settlement-name chip. In the 3D village,
    `villageMakeSettlementStandard` raises a charter stone by the square —
    one pennant per district, green for towns, gold + glowing crown for
    cities.
  - Tests: `tests/test_settlement_tiers_20260802.py` (Node-driven core, an
    end-to-end harness running the REAL snapshot/build functions to verify
    +10%/+25% taxes and 15%/30% faster builds, and the HTML/CSS contracts).
    Release pins repointed per convention;
    `test_location_empire_unlock_20260801.py`'s realm-core `?v=` pin moved
    with the core (its v193 cache lineage is still asserted). STORY.md gained
    the "Villages grow into towns, towns into cities" canon. SW cache +
    `BURBZ_BUILD` bumped (`settlement-tiers-v203-20260803` — renumbered over the
    same-day chef release, which took v202 on main first).

- **2026-08-02 — the Head Chef feeds the whole species (Claude).** Three player
  asks in one release:
  - **Bulk feeding.** With a Head Chef appointed to the Kitchen & Pantry,
    serving one companion feeds every flock-mate of the same species in the
    same sitting. The planning maths (`chefServicePlan` — who eats, who was
    already full, how many went short when the stores ran dry) is pure and
    lives in `bird_roles_core.js`; `chefBulkFeedSameSpecies` in `index.html`
    spends it, running each bulk meal through the SAME
    `applyFeedingTransaction` pipeline with full per-bird rewards, one
    ingredient per bird. No chef → nothing changes. The call from
    `burbzFeedFood` is `typeof`-guarded (same idiom as `logDiary`) so the four
    existing Node feed harnesses run unmodified.
  - **Tutorial tip.** `assignBirdRole` fires `showChefBulkFeedTip` the moment
    the Kitchen post is filled; it rides the shared `showFeedNotePopup`
    component, which now takes a third `noteId` param (default `side-snack`,
    the tip is `chef-bulk-feed`). The feed sheet also grows a
    `data-chef-bulk-notice` line naming the chef and the species-wide serving,
    and the Head Chef's role-card effect copy advertises the perk.
  - **The chef is visibly in the room.** `kitchenChefSpriteHTML` draws the
    appointed bird's transparent cutout (`birdOnlyImgHTML` — never the framed
    painting) on the Kitchen room stage with a nameplate. It's appended after
    the pinned `birds.map(...roomBirdSpriteHTML...)` expression, so the old
    stage contract strings survive.
  - Tests: `tests/test_chef_bulk_feeding_20260802.py` (Node-driven plan maths
    plus a real end-to-end bulk-feed harness in the one-tap style). Release
    pins repointed per convention; SW cache + `BURBZ_BUILD` bumped
    (`chef-bulk-feeding-v202-20260802`), and both role/size core `?v=` tags
    moved to the same tag.

- **2026-08-02 — weight tells, and every bird gets a job (Claude).** Two rules
  Yaan asked for, both new cores plus wiring:
  - **Size** (`bird_size_core.js`): one 0-100 size score per species, from
    AVONET's *measured* body mass where the catalogue carries it
    (`profile.statProvenance.derivedInputs.mass` — the ~951 national-completion
    profiles) and from the profile's own HP/STRENGTH where it does not (the
    hand-curated UK/AU roster has no mass; `speciesSize().source` says which
    was used, and the bird card's copy is honest about it). Five classes:
    tiny / small / medium / large / giant. The score drives **carrying**
    (capacity in load units, 1 for a goldcrest to 8+ for a swan, plus a haul
    multiplier of 0.55×–1.70×; expedition payouts are scaled then capped, and
    the overflow is left behind with a toast that says why) and **battle**
    (a 0.75×–1.30× multiplier on HP/ATK/DEF/MAG). **The battle multiplier is
    applied exactly once, in `generateBirdStats`** — `battle_core.js`
    deliberately does not re-apply it, it only carries `sizeClass` for display.
    SPD/INT/CHA are size-free on purpose: a swift still outflies a swan.
    - *This changes an old design claim.* Skyclash's header used to say a
      goldcrest could duel an eagle and win, because MAG was purely inverse to
      bulk. MAG is now scaled by size as well, so magic is the little bird's
      *edge*, not an equaliser — bigger is strictly stronger. The comment in
      `battle_core.js` was updated to match; don't "fix" it back.
    - `BIRD_BIOLOGY_STATS_VERSION` bumped to `…v3-size-20260802`, so every
      existing companion is re-derived on load. Size is re-read from the
      profile on migration, never preserved from the save: a well-fed robin is
      still a robin.
  - **Roles** (`bird_roles_core.js`): 14 posts — one per Academy room, plus a
    village Steward and a region Warden. `roleAptitude` scores a bird on the
    stats that job names (the Librarian is pure INT, by request), 0-100 against
    a mastery bar of 250, and `roleEffectiveness` turns that into a multiplier
    of 1.0–1.75. **A vacant post multiplies by exactly 1**, so every posting is
    upside only and nothing regressed for players who ignore the feature. One
    bird holds one job (`assignRole` vacates the old post), and
    `pruneRoleState` drops posts held by birds that have left the flock.
    Wired into: room stat-gain rate, Hospital healing, Roost resting, Crowbar
    and Nursery/Gardens morale, `feedRewardsForVerdict` (Head Chef),
    `recruitCostForBird` (Recruiting Officer), expedition payouts
    (Quartermaster), `villageEconomySnapshot` taxes/timber/production
    (Steward) and `empireTradeRouteIncome` (Warden). State lives in
    `gameState.birdRoles`; the appointment card (`rolePostCardHTML`) is the
    same component in an Academy room, a village hall and a region hall, driven
    by one delegated `data-action="role-assign"` listener.
  - **The game script is an IIFE.** Harnesses (and inline `onclick`s) only see
    window-exported names — this cost an hour of confusion, so there is now a
    `__burbzSizeRolesDebug` export alongside `__academyAliveDebug` and
    `__burbzQuestDebug`. Browser-checked in Chromium: goldcrest carries 1 and
    generates ATK 10/HP 50, mute swan carries 8 at ATK 115/HP 179; an empty
    Library multiplies ×1.00, a dim bird ×1.12, a 240-INT raven ×1.72; posting
    that raven to the Kitchen vacated the Library and took meal XP from 6 to 9.
  - Tests: `tests/test_bird_size_and_roles_20260802.py`. Four existing Node
    harnesses gained one-line stubs (`academyRoleMultiplier → 1`, i.e. the
    unstaffed baseline) and `test_biological_runtime_stats_20260715.py` now
    loads the real size core, since size is part of the biology now. Release
    pins repointed per convention; SW cache + `BURBZ_BUILD` bumped
    (`bird-size-roles-v201-20260802`).

- **2026-08-02 — the Garden Perch card, and four features that never landed
  (Claude).** Yaan reported the Perch League tier card reappearing over the
  town liberation battle after he had removed it. Nothing reverted it:
  `renderBattleSelect()` has set `leagueHeader.hidden = !!liberation` since
  PR #143 (31 July), but `.league-header` carries an author `display:flex`,
  which beats the UA sheet's `[hidden]{display:none}`, so the attribute never
  had a visible effect. The guarding test asserted the JS line was present —
  which it always was — so the suite stayed green over a broken screen. Fixed
  with `.league-header[hidden] { display:none; }` and a test that checks the
  CSS rule, not the source string.

  Auditing the rest of his "changes keep vanishing" hunch: every branch was
  compared against main **by content**, since squash-merges make commit
  subjects useless for this. Four features were genuinely missing, each for
  the same reason — the work was pushed to a branch *after* that branch's PR
  had already merged, or no PR was opened at all, so nothing was watching it.
  All four are restored here:

  - **Nightwing** (`d72ea7c`, pushed 27 min after PR #72 merged) — the secret
    bat easter egg and mythic card. On restore the sound path claims the
    window before any bird handling, since a bat is never a Birdex entry.
  - **Adventurer's Diary** (`a018ade`, no PR ever opened) — `diary_core.js`,
    the Chronicle screen and 15 `logDiary` hooks. Six hooks needed regrafting
    onto code main has since rewritten: the craft entry now fires when a piece
    leaves the anvil (timed crafting landed after the diary was written), the
    meal entry hangs off `badgeEarned` in the current Kitchen, and the diary
    chapter was re-registered in MERLIN_TUTORIAL_CHAPTERS and its copy cut to
    the v7 tutorial's 150-character limit.
  - **Player photo journal** (`f0b13d4`, pushed 33 min after PR #121 merged) —
    the player's own camera shot on the back of the Birdex card. Its hook moved
    to `surfaced[0]`: main's `handleBirdCandidates` now surfaces several sound
    birds per window and `top` is only the raw winner.
  - **Per-town construction copy** (`3162be2`, pushed 25 min after PR #154
    merged) — see the entry below.

  Cleared as already-landed-under-another-name: PR #83's catalogue unlock (in
  main as `inGameCatalogue`), PR #89's Kitchen fix, "The Crow's Perch" (now
  The Crowbar), and the Show Quests framing work (redone by PR #146). Still
  outstanding and deliberately NOT restored: the seasonal spawn gating + root
  diet fix on `claude/burbz-location-season-diets-r4w11u` (~20k lines, and it
  deletes `bird-education.json`, which main has since gained) — that one needs
  a hand-reconciliation, not a cherry-pick.

  Shipped as `restored-lost-features-v200-20260802`. 733 tests pass; the 5
  failures are the pre-existing git-lfs pointer cases, which fail on a clean
  main too. Browser-checked in Chromium: the league header computes
  `display:none` when hidden (and `flex` again the moment that one rule is
  deleted), the Nightwing card opens from the egg, and the Diary screen renders
  real entries.

- **2026-08-02 — the Academy Library (Claude).** A new buildable room that
  makes birds cleverer, requested by Yaan:
  - **Room**: `library` in `academy_treehouse_core.js` TREEHOUSE_ROOMS
    (floor 5, right branch, 210 coins / 55 branches, unlock level 6,
    `trainStat:'int'`). Two INT rooms exist on purpose — the Observatory
    charts the sky, the Library reads about it. Stationed birds gain
    +1 INT / 30 min via `ACADEMY_ROOM_STAT_EFFECTS.library`.
  - **Drill**: `quiet_study` (150 min, +1 INT, +50 XP, happiness +2), room
    `library`, school `mind` — so its sessions advance the same
    Sharp Eyes → Outsmart → Master Plan move line as the Focus Roost. The
    Training Hall notice-board copy now says "Seven timed drills".
  - **Art without Higgsfield**: the user's image-gen subscription lapsed, so
    the Library is the first room with hand-drawn SVG art: the tree sprite is
    `assets/academy-buildings/library.svg` (precached in `sw.js`), and the
    interior is an inline `library()` scene in ACADEMY_ROOM_SVG_FALLBACKS —
    `ACADEMY_ROOM_SCENES` now falls back to the inline scene for any room with
    no painted-PNG interior entry. `academy_alive_core.js` glow anchors are
    read off the SVG's own geometry; `academy_3d_core.js` gained a
    `library` ANCHOR (272°, y 8.2) + STYLE. If the room ever gets manga
    paintings, add the PNGs to the two asset maps and the fallback retires
    itself.
  - Tests: `tests/test_academy_library_20260802.py`; release pins repointed
    per convention. SW cache + BURBZ_BUILD bumped
    (`academy-library-v198-20260802`), and the three academy core files'
    `?v=` cache-busters moved to the same tag.

- **2026-08-02 — Merlin bond meter (Claude).** The bond the player has with
  Merlin (tracked since the tamagotchi release: feed +5 / play +8 / rest +3
  bond XP, 100 XP per level) is now visible: a fourth amethyst bar in the
  care menu (`#merlinBondFill` / `#merlinBondXpValue`) fills toward the next
  level, successful care actions pop a "+X bond" chip (`showMerlinBondGain`),
  and level-ups sparkle + announce themselves. Tests:
  `tests/test_merlin_bond_meter_20260802.py`. SW cache + BURBZ_BUILD bumped
  (`merlin-bond-meter-v197-20260802`).

- **2026-08-02 — per-town builders, verified + explained (Claude).** Player
  asked for concurrent builds across different towns. Verified (Node harness
  driving the real `empireBuildStructure` + a headless-browser run) that this
  ALREADY works: the lock is `eco.construction` on each village's own economy
  record, so only a second project in the SAME town is refused. The confusion
  was the copy — the refusal toast said "one project at a time" with no scope.
  It now names the town and says other towns can build meanwhile, and the
  Construction Yard header says "builders busy here — other towns can still
  build". Contract pinned in `tests/test_concurrent_town_builds_20260802.py`
  so the per-town lock never silently becomes global. SW cache + BURBZ_BUILD
  bumped (`per-town-builders-copy-v197-20260802`). RESTORED on
  2026-08-02 — the original commit was pushed to
  `claude/burbz-map-sound-ui-uwuj9a` 25 minutes AFTER PR #154 merged that
  branch, so it never reached main; it ships under the restore pin instead.

- **2026-08-02 — empire opens on the player + sound session shelf (Claude).**
  Three player reports in one release:
  - **Empire atlas starts where the player is standing.** New
    `frameEmpirePlayer()` (zoom `EMPIRE_PLAYER_ZOOM` = 11.1) is the session's
    FIRST framing — `refreshEmpireMap` only calls `frameEmpireTerritory()` on
    an explicit `frame:true` (village liberation), and the map constructor +
    late-first-GPS-fix glide both use the player position too. 👑 MY REALM
    still frames the whole territory.
  - **Sound screen session shelf.** `#soundSessionShelf` (rendered by
    `renderSoundSessionShelf` from the same `soundDiscoveryHistory`) shows a
    grid of every bird discovered this listening session — art/emoji tile,
    ×N repeat badge, tap → Birdex — sitting where the BirdNET data note used
    to be; the note moved below the START button.
  - **Encounter banner pops once per species per session.** In
    `handleBirdCandidates` the sound-session branch gates
    `showScanEncounterCard` on the history's repeat count
    (`recorded.count > 1` → silent), so the same wren calling every window no
    longer re-covers the screen. Photo scans are unchanged.
  - Tests: `tests/test_empire_player_start_sound_shelf_20260802.py`; the
    release-pin test in `test_back_stays_in_game_20260801.py` repointed per
    convention. SW cache + BURBZ_BUILD bumped
    (`empire-player-start-sound-shelf-v196-20260802`).

- **2026-08-02 — back guard vs Chrome's intervention (Claude).** v194's back
  trap failed on real Android: Chrome's back-button intervention SKIPS history
  entries pushed without a user gesture (the boot-time guard and popstate
  re-pushes both are), so hardware back still closed the app. Fix: the guard
  is re-armed from inside genuine taps (`pointerdown`, capture+passive — one
  live gesture-armed entry at a time, tracked by `burbzGuardGestureArmed`),
  and on modern engines the Navigation API cancels the traversal outright
  (`navigate` event, `traverse` + `cancelable` → `preventDefault`), with the
  popstate path kept as the fallback. Lesson for next time: **a pushState
  back-trap that is not armed from a user gesture does not work in Chrome.**
  SW cache + BURBZ_BUILD bumped (`back-guard-gesture-v195-20260802`).

- **2026-08-01 — back never quits (Claude).** The Android/browser back button
  is trapped behind a history guard entry (`armBurbzBackGuard`, re-armed
  inside `popstate` before anything else, so mashing back can't exhaust it).
  Each press closes the topmost open layer (`closeTopBurbzLayer`: bird
  equipment, village shop, walk-quest sheet, any `.modal-overlay.show`), else
  pops the visited-screen trail (`recordScreenTrail` fed by `switchScreen`,
  back-navigation itself not recorded), else falls back to the map and stays
  put with a throttled hint. Leaving is deliberate: ⚙️ Settings → 🚪 Exit
  Burbz (`exitBurbzGame`) confirms, saves, sets `burbzExitArmed`, unwinds the
  guard and `window.close()`s where the platform allows. Tests:
  `tests/test_back_stays_in_game_20260801.py`. SW cache + BURBZ_BUILD bumped
  (`back-stays-in-game-v194-20260801`).

- **2026-08-01 — location-anchored empire + Region Hall (Claude).** The empire
  now follows the player wherever they physically go (the "I'm in Snowdonia
  but the empire view doesn't show it" report):
  - **Waysteads** (`index.html` village grid): `villagesNearLatLng` split into
    `villageInCell` + `waysteadInBlock`. Any 3×3 cell block (~6.6 km square)
    whose nine cells all roll empty deterministically hosts one waystead from
    the block's own hash (`burbz-waystead:bi:bj`), so there is ALWAYS a
    settlement to liberate near the player — worst case ~5 km anywhere on
    Earth. `villageInCell` reproduces the legacy per-cell formula exactly
    (pinned by test) so existing claims keep their seeds and coordinates.
  - **The atlas knows where you are**: `empirePlayerPosition()` (live GPS fix,
    else `lastKnownHome`) drives a pulsing sovereign's banner (`is-player`),
    a scout's-lantern half-light window in the darkness veil, and up to three
    dark frontier banners (`is-frontier`) on the nearest unclaimed villages —
    tapping one travels into the village and its Liberation Battle claim bar.
    `rememberHomeFix` debounce-refreshes the atlas on real moves only.
  - **Regions unlock their whole map area**: `updateEmpireFogMask` punches one
    gold-rimmed daylight window per founded region (centroid +
    `regionCoverageRadiusKm`, new in `empire_realm_core.js` along with
    `nextRegionTier`), not just per-village pinpricks.
  - **Region Hall** (`screen-region`, `renderRegionScreen`): once a region
    exists the player runs it as one realm — tier-ladder progress bar,
    region-scoped tax strongbox (`collectRegionTribute` resets only that
    region's clocks), sanctuary list, unity bonus, caravan roads. Ledger
    region rows and atlas region banners open the hall (`openEmpireRegion`);
    the old map framing lives on as its "VIEW ON ROYAL ATLAS" button.
  - Tests: `tests/test_location_empire_unlock_20260801.py` (Node-driven core +
    extracted village-grid determinism + HTML contracts). SW cache bumped
    (`empire-here-regions-v193-20260801`).

- **2026-07-31 — endgame realms & trade (Claude).** Added the Crusader-Kings
  endgame layer on top of village liberation, keeping the pre-region game
  untouched-simple:
  - New `empire_realm_core.js` (pure, Node-testable): proximity clustering of
    liberated villages into regions (150 km chains, 3 villages to found),
    County→Duchy→Kingdom tiers, crown-title ladder, trade-route candidates /
    costs / income (distance pays), seeded export goods, great-circle arcs.
  - `index.html`: regions grant +15% unity taxes to member villages; founded
    regions discount new birdhouses (10% each, max 30%); the Royal Ledger grows
    a "THE REALM" section (region rows, trade-route open/establish UI) that
    only renders once a region exists; trade income folds into the same 8-hour
    tribute strongbox (`empire.tradeRoutes` state, healed in
    `ensureEmpireState`).
  - Map: gold dashed great-circle trade roads (`empire-trade` source), region
    banner markers at cluster centroids, and the same arcs re-struck onto the
    darkness canvas so routes glow across unliberated land.
  - Tests: `tests/test_empire_realms_trade_20260731.py` covers the core maths
    via Node and pins the HTML/UI contracts. SW cache bumped
    (`empire-realms-trade-v189-20260731`, on top of main's
    `begin-quest-loop-authority-v188-20260731`).

- **2026-07-31 — full codebase review (Claude).** Brought the suite to green on
  a fresh clone and closed the fragilities that would have bitten later:
  - Fixed `test_continuous_scan_economy.py`: it pinned an old inline-loop string;
    the loop was refactored into an explicit hop clock (`runSoundHop`). Repointed
    the assertions at the real, current control flow.
  - Made the **diet pipeline reproducible offline**: committed the EltonTraits
    oracle to `source-cache/`, added a resolution fallback in
    `check_bird_diets.py` and the diet tests, and made the generated artifact
    record a **stable repo-relative source path** so it stops drifting by machine.
  - Fixed the **LFS deploy bug**: `pages.yml` now checks out with `lfs: true`
    so real bird art (not pointer files) reaches production.
  - Verified: all JS parses, all data JSON parses, every SW precache/`index.html`
    reference resolves, and the full suite passes (**653 passed, 18 skipped**;
    the skips are the intentional production-server-only tests).
