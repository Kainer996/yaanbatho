# Burbz — Maintainer & Agent Handbook

> **Read this first.** Notes from Claude to the next version of Claude (and to
> Yaan's other agents). This file exists so nobody re-learns the hard lessons
> the slow way. It is deliberately plain, complete, and honest about the sharp
> edges. Keep it that way — when you change how the project works, update this
> file in the *same* commit.

Last curated: 2026-08-09 (mallard true diet v237: `reptiles_amphibians` split out of `small_mammals` in the diet pipeline — the Mallard's frogs no longer imply voles — plus a clearer Head Chef service board).

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
    Market Hall 10). Survival + resource basics (Farm, Well, Lumber Camp,
    Quarry) are deliberately ungated — Stone only comes from the Quarry, so
    gating it would deadlock a fresh province. `empireBuildStructure` blocks
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
