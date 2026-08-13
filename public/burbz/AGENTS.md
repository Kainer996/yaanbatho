# Burbz — Maintainer & Agent Handbook

> **Read this first.** Notes from Claude to the next version of Claude (and to
> Yaan's other agents). This file exists so nobody re-learns the hard lessons
> the slow way. It is deliberately plain, complete, and honest about the sharp
> edges. Keep it that way — when you change how the project works, update this
> file in the *same* commit.

Last curated: 2026-08-13 (feedback-menu-keyless v262: the inbox unlocks from a magic link. `adoptInboxKeyFromLink()` in `index.html` reads `?inboxkey=…` into the shared `burbz_admin_token` slot and scrubs the param from the URL and history, so Yaan taps a link once (Ava mints it on the VPS, where the key lives) and Settings → Feedback Inbox just opens. The server-side `X-Burbz-Admin` check is untouched — keyless for Yaan, locked for everyone else. Previously early-game-until-level-12 v262: the early game keeps its promise: Yaan reported a level-8 player destroyed by a level-5 garrison, because the v240 easy-battles gate ended at the FIRST COUNTY regardless of level. `isEarlyGameBattles()` in `index.html` now reads the player's level (`battlePlayerLevel()` ← `gameState.player.level`) and holds until `EARLY_GAME_ENDS_AT_PLAYER_LEVEL` (12). Through `EARLY_GAME_CRUISE_LEVEL` (8) squads fight at `EARLY_GAME_OPPONENT_EASE` (0.35) with at most three birds and never more than the flock — near-free wins even for one bird of prey plus one large bird. From level 9 `earlyGameOpponentEase()` ramps linearly toward `EARLY_GAME_RAMP_TOP_EASE` (0.95 at the level-12 boundary): ~0.5 at 9, 0.65 at 10, 0.8 at 11, squad cap easing to four; engine-driven sims put the level-11 split at wrong-birds 3% wins vs right-birds 100% (67% HP left; 89% geared) — wrong birds lose, right birds win easily, gear whitewashes. Level 12 restores full difficulty and makes the forge matter. Eased squads still sit at avgLevel−1; the rival cache key carries `_early_game_pl<level>` so a level-up re-rolls the squad; first-liberation garrison and all conquest maths untouched. Tests: `tests/test_early_game_until_level_12_20260813.py`; the v240 suite repointed at the level gate. No core moved — every `?v=` stays put. Previously feedback-menu v259 — the feedback release, renamed and renumbered while merging the week's sessions (born v254, then v258): the settings menu reads the private inbox. Settings gains a 📥 Feedback Inbox row under Send Feedback; `openFeedbackInbox()` in `index.html` unlocks with the admin key — the same `burbz_admin_token` localStorage slot and `X-Burbz-Admin` header `inbox.html` uses, so one unlock covers both — lists every `type:'feedback'` report newest-first with done/reopen/delete actions against `api/admin/reports/:id`, and points at `inbox.html` when new-bird reports wait. The backend lives on the VPS only, so the reader works at yaanbatho.com/burbz; the send path was proven live end-to-end. `inbox.html` joined the live updater's FILES. Previously village-variation v260 (built 2026-08-11 as v250, merged 2026-08-13): no two villages alike — `village_variation_core.js` rolls every settlement seed a DNA card (wall build: timber/stone/brick/painted · roof craft: thatch/slate/tile/shingle · colour washes, trim + door paints, window glow, banner cloth) and re-keys the base `VILLAGE_PALETTES` entry through pure HSL/golden-angle maths, No-Man's-Sky style; `buildVillageScene`'s pinned palette roll survives and is varied per seed, the building/cottage makers read `pal.dna` for their styling, and two new landmarks (wayside shrine, stone watchtower) join the pool. The Town Square's districts now replay each member village's own opening dice (`villagePlan` — bit-identical mulberry32) plus its DNA, so every district wears its real village's palette, tier, plan and one of its true trades — and the landmark ledger (`landmarkPlan`, its own seed-keyed stream ^0x5FCA9B3D) names WHICH landmarks a village raises, so the village scene places exactly those and each district builds its village's signature (picks[0]) from the shared `VILLAGE_LANDMARK_MAKERS` pool. Districts mirror their village's RECOVERY too (`villageDistrictState`: same ruin-stage thresholds, wreck list and rising construction as the village screen; `townSceneKey` carries per-member stage so development rebuilds the square) — the town you see IS the villages you visit. `__burbzTownDebug` joins the localhost-only debug hooks. Previously chef-mastery-feed-all v261 (Ava, built 2026-08-07 as v237, merged 2026-08-13): the Head Chef earns on-duty mastery to Chef Level 10 over nine days, better meal rewards along the way, and a one-tap Feed All that spreads scarce pantry food across every hungry bird by maximum matching; the roles core ships under the chef pin. Previously night-hunter-ascendant v258: the Night Hunter advantage is now truly massive and reaches every capacity. `bird_sleep_core.js`'s `NOCTURNAL_NIGHT_BONUS` rises to coins ×3 / timber ×2 / XP ×3 / two guaranteed extra finds and gains `statBonus: 2` (training stat gains double — `academy_treehouse_core.js` multiplies `template.bonus` by it); the new `NOCTURNAL_NIGHT_BATTLE` pack + `nocturnalNightBattleBoost()` is the battle half — `battle_core.js`'s `buildFighter` accepts `opts.nightBoost` (ATK/SPD/MAG ×1.5, DEF/HP ×1.25, +0.15 crit, stamps `f.nightHunter`; no pack = byte-identical classic stats, and rival squads never get one). `index.html` wires `nocturnalNightBattleBoostFor` into `startPerchBattle`, glows every nocturnal surface after dark (`.night-hunter-aura` pulse, `.pk-night-chip`, `.battle-night-hint`, `.au-night-moon` arena badge — all reduced-motion aware), and teaches the numbers in the send sheet, Training Hall night-school banner, Roost status and toasts. Timers never move — only payouts and stats. Tests: `tests/test_night_hunter_ascendant_20260813.py` plus the rewritten nocturnal suite; the three moved cores' `?v=` pins split out of their old release loops (living-canopy, turn-potions, conquest, diet-integration suites). STORY.md canonises "The hour of the owl". Previously bird-bond-love v256: every bird can now be loved for itself. Players attach to different birds, so each companion carries a personal bond in `bird.bond` — a favourite flag, a bond level 1–5 with warm titles (New Friend → Soulbound, 100 XP each), and a 4-hour preen ritual — all owned by the new `bird_bond_core.js` (sanitize/grant/preen/cooldown, pure and Node-tested). The equipment screen grew a heart toggle on the hero and a Bond panel (hearts, meter, PREEN button with floating-hearts animation); flock cards wear a ❤️ badge and a small hearts row, favourites sort ahead of raw power in Companions, and the card back gains a Favourite button. Every successful companion feed now grants the same `reward.bondXp` Merlin already earned (the Academy tray path uses `FEED_BOND_XP`), so the four feed-path Node harnesses in tests stub `grantBirdBondXp`. Bond is affection only — it never touches battle stats. Tests: `tests/test_bird_bond_love_20260812.py`; the new core joined both sw.js precache lists and the live updater's FILES list. Previously night-owl-dark-mode v257: night mode lands — the game follows the player's real sky (PR #197; shipped without a handbook summary — its contracts live in `tests/test_night_owl_dark_mode_20260813.py`). Previously raven-weight-and-wit v255: a real raven flew over Yaan and the game now honours true bird weight. `bird_size_core.js` gains `FIELD_GUIDE_MASS_G` — real field-guide masses for the hand-curated UK/AU roster, keyed by profile id with a name-slug fallback (measured AVONET provenance still wins, source `'field'` sits between `'mass'` and `'stats'`) — and carrying is now mass-linear: `carryCapacity` = one load per 100 g (`GRAMS_PER_LOAD_UNIT`), max 20 units, so a 1.2 kg Raven hauls 12 to the 510 g Carrion Crow's 5 and a Buzzard 8 to a Robin's 1. `bird_roles_core.js` gains the civic size rule: `steward`/`region_warden` are flagged `civic:true`, rebalanced to INT 0.5/CHA 0.5, and `roleAptitude` multiplies civic aptitude by `governanceWitFactor(sizeScore)` (≤20 → ×1.15, ≤40 → neutral, 100 → ×0.55) — so a robin out-governs a raven while the Library still belongs to the raven. `BIRD_BIOLOGY_STATS_VERSION` bumped to v4 so saves re-derive sizes; the bird card's size panel shows a 🏛️ governing chip and honest "field guide weight" sourcing. STORY.md canonises "The Raven, and the law of weight and wit". Tests: `tests/test_raven_weight_and_wit_20260812.py`; the size/roles suite's generated-stats class ladder moved to tiny/small/LARGE/giant (the stub Buzzard now weighs its true 780 g). Previously citizen-workers-timber-homes v253: the villages become a real city-builder loop. Every producing yard — Grain Farm, Lumber Camp, Quarry, Market Hall, Chapel — now carries `workers: 1` and stands idle until a villager runs it; `villageWorkforce()` deals scarce hands out by `workPriority` (food → timber → stone → trade → chapel) and production, flat coins/timber and the market tax boost all gate on the crew. The stone-free 🛖 Timber Cabin (new `cabin` building, first in `EMPIRE_BUILDINGS`) is the intended first build — coins and timber only — and rebuilds at level 2 into the 🏠 Stone Cottage via the new `tiers`/`costLevels` fields (`villageBuildingTier`, stepped `villageBuildingCost`). The quarry's founding crew is gone (an empty town's quarry cuts nothing; the first-cut 10-stone grant survives), superseding the v221 empty-town pin in `test_quarry_stone_economy_20260804.py`. STORY.md canonises the **village folk**: a separate human-like species, simpler than the birds — residents and workers, never protagonists; birds keep every named part. Previously academy-training-dock v252: the Kitchen/Quests/Stores quick icons moved again, to the bottom dock flanking the Scan orb. Previously hold-to-steer v251: every 3D stage — Academy tree, villages, town squares — now lets the page scroll over it; only a finger held still for ~300 ms grabs the camera (`touch_steer_core.js`, a pure Node-testable gate wired into all three engines), a mouse or pen steers at once and a pinch always steers. The same release moves the Kitchen/Quests/Stores quick icons from mid-right (they covered claim buttons) to the top left under the header, and flips the tutorial's side pointer to match. Previously academy-2d-default v250: the Academy opens in the painted 2D tree — the tutorial's tap-the-tree building step misfired on the 3D canvas on some phones, so `academyViewMode()` now defaults to `'2d'` and only a saved `'3d'` choice opens the 3D tree, which stays one tap away on the same toggle. Previously walking-story-quests v249: The Twenty Roads land — `walking_story_core.js` carries a fixed campaign of 20 real-world walking quests, identical for every player on Earth: tiered to walk size (stroll/ramble/trek), each told by a named NPC with intro/milestone/outro dialogue riding the ordered waymarkers, each hiding a Feathered Folio lore scroll tying the roads to the Academy and Empire canon, and each paying real catalogue gear/materials/xp-scrolls on first completion. `index.html` attaches the next untold tale at quest activation and keeps completion/scroll state in `gameState.walkingStories`. Previously conquest-world-levels v248: conquest difficulty lands — `world_level_core.js` turns the realm pyramid into a WORLD LEVEL, liberation garrisons fight at their land's stamped level (world level + distance band from the cradle village), the atlas stamps dark villages with AC-style recommended levels and danger colours, the Fletcher's Forge gains five upgradeable hearths that gate rarities and temper all equipped gear (`gameState.forgeLevel`), and `battleRewards` scales with the beaten squad's level. Early-game easy battles are untouched. Previously battle-faint auto-hospital v247: a bird knocked out in battle is carried straight to the Bird Hospital by `admitFaintedBirdToHospital` in `endPerchBattle` — no player taps — and the v239 discharge sweep sends it home at full HP. This release also moves the newest-release test pins on from v245, which find-your-bird-v246 had left behind. Over live reconcile v245: the production server had advanced through five releases that never reached GitHub — birdex-direct-recruit-v240 … distributed-game-hud-v244 — while main advanced through four others, and the auto-deploy's drift guard correctly froze all updates. The live deltas were recovered byte-exact over HTTPS and three-way merged; both lineages survive in `BURBZ_CACHE`. **Lesson repeated from v217: work deployed straight to the VPS without a PR WILL collide — always promote through GitHub.**)

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
| `*_core.js` | Extracted, individually-testable modules (`scan_economy_core.js`, `bird_diet_hunger_core.js`, `diet_hunger_core.js`, `merlin_companion_core.js`, `quest_core.js`, `academy_*_core.js`, `battle_core.js`, `empire_map_core.js`, `empire_realm_core.js`, …). Each is loaded by `index.html` **and** `require()`d by a test. They export via the `(function(root){ … })(globalThis)` UMD-ish pattern so they run in both the browser and Node. `empire_realm_core.js` is the Crusader-Kings endgame maths: village→county clustering plus the NESTED feudal pyramid (`deriveRealm`: 3 villages → County, 2 counties/600 km → Duchy, 2 duchies/2000 km → Kingdom, 2 kingdoms → Empire — every tier made of the tier below, never of headcounts), liege-aware crown titles and unity taxes (`crownTitle`, `regionUnityBonus`), county map-coverage radius (`regionCoverageRadiusKm`), and trade-route income/cost/arcs; `index.html` surfaces none of it until the first county actually exists — from then on each county is run from its own County Hall screen (code ids keep the historical `region` name: `screen-region`). |
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
