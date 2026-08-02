# Burbz — Maintainer & Agent Handbook

> **Read this first.** Notes from Claude to the next version of Claude (and to
> Yaan's other agents). This file exists so nobody re-learns the hard lessons
> the slow way. It is deliberately plain, complete, and honest about the sharp
> edges. Keep it that way — when you change how the project works, update this
> file in the *same* commit.

Last curated: 2026-08-02 (empire opens on the player + sound session shelf — see "Review log" at the bottom).

---

## 1. What Burbz is

Burbz is a **birdwatching adventure PWA** — a static, offline-first web app
served from GitHub Pages at `https://burbz.app` (see `CNAME`). You walk in the
real world, Merlin's wand (the microphone) listens for birdsong, and confirmed
species unlock birds you can recruit, feed, level up, and battle. The fiction
lives in [`STORY.md`](STORY.md); licensing of every third-party dataset and
asset lives in [`LICENSING.md`](LICENSING.md).

**The whole app is static.** There is no application server in this repo. It is
HTML + vanilla JS + JSON data + a service worker. That is a feature: it can
never break because a backend went down, because there is no backend.

---

## 2. The shape of the code

Burbz grew as a monolith with satellite modules. Here is the honest map.

| Thing | What it is |
| --- | --- |
| `index.html` (~1.7 MB) | The entire game. UI, state, screens, the sound listener, scan economy, tutorial — all inline in one big `<script>`. This is the heart. When a test says `assert "..." in HTML`, it is pinning a contract against a string in here. |
| `*_core.js` | Extracted, individually-testable modules (`scan_economy_core.js`, `bird_diet_hunger_core.js`, `diet_hunger_core.js`, `merlin_companion_core.js`, `quest_core.js`, `academy_*_core.js`, `battle_core.js`, `empire_map_core.js`, `empire_realm_core.js`, …). Each is loaded by `index.html` **and** `require()`d by a test. They export via the `(function(root){ … })(globalThis)` UMD-ish pattern so they run in both the browser and Node. `empire_realm_core.js` is the Crusader-Kings endgame maths: village→region clustering, feudal tiers (plus `nextRegionTier` ladder progress), crown titles, region map-coverage radius (`regionCoverageRadiusKm`), and trade-route income/cost/arcs; `index.html` surfaces none of it until the first region actually exists — from then on each region is run from its own Region Hall screen (`screen-region`). |
| `*_bird_expansion*.js`, `national_bird_completion_20260715.js` | Generated species catalogues (UK, AU, national). Large. Loaded by both `index.html` and `sw.js` via `importScripts`. |
| `data/` | JSON the game reads at runtime. **`data/bird-diet-records.json` / `.js` are generated — do not hand-edit** (see §4). |
| `data/national-bird-completion/source-cache/` | Committed copies of the external source datasets (EltonTraits, AVONET, geoboundaries, …) so the build/verify pipeline is reproducible offline. Large files live here on purpose. |
| `bird-art-cache/` and `bird-art-cache/cutouts/` | Bird card art (`*.png`) and transparent cutouts. **Stored in Git LFS** (see §5). |
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
  the oracle.
- **Outputs (generated — do not hand-edit):**
  `data/bird-diet-records.json`, `data/bird-diet-records.js`,
  `data/bird-diet-provenance-summary.json`.

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
- Expansion **art** for the big catalogues is fetched from GitHub `raw` (LFS-
  backed) rather than bloating the Pages bundle — that is intentional.

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
