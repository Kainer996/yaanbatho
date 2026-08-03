# Empire UI Overhaul — session handoff (2026-08-03)

> **For the next agent.** This file is working state for the in-flight Empire tab
> UI overhaul on branch `claude/burbz-empire-ui-overhaul-qqcf6z`. Delete this
> file in the PR that finishes the work (or before merge). Read
> `public/burbz/AGENTS.md` §9 "Review log" (top entry, *empire clarity*) for the
> full description of what shipped — this file only covers **status, what is
> verified, and what remains**.

## The request (from Yaan)

The empire part of the game was "very difficult to follow, difficult to
understand, and very convoluted — hard to know on the map what [is what]".
Task: make it clear where the player's region and town are, simplify the whole
Empire tab UI, **keep every gameplay mechanic and feature** (dropdown menus
fine). UI-only change.

## Status: IMPLEMENTED, TESTED, PUSHED — verification sweep was mid-flight

Commit `0f53d62` ("Burbz: Empire tab clarity overhaul — locator, map key, tap
cards, ledger drawers") is pushed to `claude/burbz-empire-ui-overhaul-qqcf6z`.
Release tag `empire-clarity-v204-20260803`. **No PR opened yet** (Yaan did not
ask for one).

### What was built (all in `public/burbz/index.html` + pins in `sw.js`)

1. **Map card**: `📍 ME` button (`empireMapMeBtn` → `frameEmpirePlayer`),
   `🗺️ KEY` button + static legend card (`empireMapKey`) explaining every
   marker type + "daylight = your lands"; marker taps open a **tap card**
   (`showEmpireMapCard`, element `empireMapTapCard`) that names the thing and
   offers explicit actions (TRAVEL & GOVERN / OPEN REGION HALL / SHOW ON MAP /
   GO & FREE IT) instead of teleporting; semantic zoom in
   `updateEmpireMarkerDetail` (settlement standards ≥ zoom 4, frontier swords
   ≥ 6.5, focus buttons highlight by zoom band); player beacon expanding-ring
   animation; region/town/city labels get ` · REGION` / ` · TOWN` / ` · CITY`
   CSS suffixes; status bar is one priority-ordered message (frontier target →
   counts) keeping all test-pinned fragments.
2. **Royal Ledger** (`renderEmpirePanel`): `📍 locator strip` (you / your
   town / your region — each chip frames the map); stat chips relabelled
   Provinces→Villages; collect button shows countdown when idle
   (`empireNextTributeCountdownMs`); sections became `<details
   class="empire-drawer">` accordions (`empireDrawerHTML` +
   `empireDrawerOpenState`, session-persisted): YOUR VILLAGES (3-fact rows
   **grouped under their regions** + "Farther afield"), TOWNS & CITIES,
   THE REALM (region rows get `💰 READY` chip via `regionTributeReady`), and a
   closed-by-default HOW YOUR EMPIRE WORKS plain-words explainer; 0-village
   players get a 3-step onboarding card.
3. **Governor's desk / Region Hall**: mechanics untouched; Steward/Warden
   appointment cards folded behind one-line drawers (summary shows the
   incumbent via `rolePostState`); Region Hall copy de-jargoned
   (sanctuaries→villages; pinned `Heart of the `/`District of the ` kept).
4. **Release plumbing** (repo convention — see AGENTS.md §6): `BURBZ_BUILD` →
   `empire-clarity-v204-20260803`; sw.js `BURBZ_CACHE` gained the new lineage
   segment (all historical segments kept); `empire_realm_core.js`,
   `bird_size_core.js`, `bird_roles_core.js` `?v=` pins bumped in BOTH
   `index.html` and `sw.js`; `RELEASE_PIN` updated in 7 test files + `core_pin`
   in `test_location_empire_unlock_20260801.py`.

### What is already verified ✅

- **Full pytest suite green**: from `public/burbz/`:
  `python3 -m pytest tests/ -q --ignore=tests/test_continuous_merlin_listener.py --ignore=tests/test_evil_burbz_battles_20260720.py --ignore=tests/test_regional_bird_completion_20260715.py --ignore=tests/test_uk_bird_expansion_50.py`
  → **722 passed, 18 skipped, 2 failed** — the 2 failures
  (`test_barracks_ui`, `test_buzzard_listener_history`) are **pre-existing on
  main** (Git-LFS bird-art assets, unrelated; same result before any change).
  The 4 ignored files fail collection in this container (missing modules), also
  pre-existing.
- **`node --check`** passes on the whole inline script.
- **Pinned-string self-check**: every test-pinned string/class/data-action/
  comment-anchor verified present; forbidden strings verified absent (the one
  `conquer` hit is pre-existing bird data at ~line 7878, outside the tested
  empire slices).
- **Real-browser smoke test** (Playwright + the preinstalled Chromium,
  390×844): fresh-player onboarding card, rich-empire ledger (7 villages,
  1 town, 2 counties, trade candidate, 💰 READY chip, countdown), map KEY
  legend, village tap card, Region Hall (relabelled chips, warden drawer,
  4 rows), governor's desk — all render and wire correctly. Screenshots
  confirmed visually. Note for reproducing: serve `public/` locally, set
  localStorage `burbz_epoch=new-dawn-evil-burbz-20260720` and
  `burbzIntroSeen:two-part-hf-20260729=1`, use Playwright
  `serviceWorkers:'block'` and route `https://tiles.openfreemap.org/**` to a
  stub style `{version:8,sources:{},layers:[{id:'background',type:'background'}]}`,
  seed villages via `window.__burbzVillageDebug.seedEmpire(seed, rec)`
  (localhost-only), then `switchScreen('village')`.

### What was mid-flight when the session ended ⏳

An adversarial verification workflow (3 reviewers + per-finding skeptics) was
running but had produced **no findings yet**. Its checklist — worth finishing
by hand or re-running as subagents:

1. **Feature-preservation audit**: walk the old UI feature-by-feature and
   confirm each is still reachable. Known deliberate relocations to sanity-check
   rather than "fix": per-village production summary + liberation date left OFF
   the ledger rows (production still in Stores ledger + collect toast; date on
   claim-bar banner); town member names off settlement rows; guild build-speed %
   off rows (still in governor desk `settleLine` + build toasts); region marker
   tap now opens a card first (Region Hall still 1 more tap; also reachable from
   ledger rows — both call the pinned `openEmpireRegion`).
2. **JS review of the new code paths**: tap-card null handling
   (`villageEconomySnapshot` on a claim without economy), `empireDrawerHTML`'s
   `.replace('class="empire-drawer"', …)` trick, drawer toggle listeners on
   re-render, `empireNextTributeCountdownMs` edge cases (future
   `lastTributeAt`), escapeHtml coverage in tap-card facts.
3. **Mobile-Safari `<details>` behaviour** (works in Chromium; untested in
   WebKit here).

### Suggested remaining plan (in order)

1. Re-run the pytest suite once (command above) to confirm the checkout state.
2. Finish the verification checklist above; fix anything real; commit with the
   same release tag (amend or follow-up commit — if gameplay-visible behaviour
   changes, bump to v205 per AGENTS.md release discipline and update the same
   pin set).
3. Optional polish ideas that were consciously deferred (all small):
   - auto-open + gold-flash the TOWNS & CITIES / THE REALM drawer the first
     time a new town/region appears (reward beat);
   - a `💰 COLLECT` button directly on the region tap card;
   - hide `📍 ME` when no position/home fix exists.
4. Delete this handoff file.
5. Ask Yaan whether to open a PR to main; if yes, note the PR must mention the
   release-pin bumps. Suite expectation for CI parity: 722+2 known art failures
   (or `653 passed, 18 skipped` per AGENTS.md §3 with LFS hydrated — those two
   art tests pass with LFS).

### Hard-won context (do not relearn the slow way)

- **Tests grep `index.html` as text**: exact strings, comment anchors
  (`// EMPIRE —`, `// ---- Scene state`, etc.), function order, and Node-eval'd
  code slices are all contracts. Never reformat, rename, or reorder empire
  functions without grepping `tests/` first. The full pin inventory that guided
  this change is reproduced in AGENTS.md §9's new entry and enforced by the
  suite itself.
- The tab's internal name must stay `village` (nav, tutorial, badges, roles).
- `#villageClaimBar`/`#villageManagePanel` hide via `:empty` CSS.
- Do not insert code between `collectRegionTribute` and `renderRegionScreen`
  (a test slices that span and forbids `empireVillages().forEach` inside it).
- The old design/understanding research lives only in the dead session's
  scratchpad — everything needed to continue is in this file + AGENTS.md.
