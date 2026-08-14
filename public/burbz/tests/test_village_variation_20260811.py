"""No two villages alike — v250, 2026-08-11.

Yaan's ask, in two halves:

1. **Much more variation** — No-Man's-Sky-style procedural maths: many more
   colours, more details, different kinds of buildings. The new
   village_variation_core.js rolls every village a DNA card (wall build, roof
   craft, colour washes, trim and door paints, window glow, banner cloth) and
   re-keys the base palette through pure hue maths — HSL rotations and
   golden-angle colour runs — so no two settlements wear the same coat.
2. **The town IS its villages** — the Town Square's districts used to be
   generic stand-ins in the town's shared palette. Now each district replays
   its member village's own opening dice (palette, size, plan) and DNA, so
   the quarter on screen carries the same colours, roofs, trades and landmark
   family as the village screen its tap travels into.
"""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "village_variation_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
UPDATER = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"

OWN_RELEASE_PIN = "village-variation-v260-20260813"
PREVIOUS_RELEASE_PIN = "walking-story-quests-v249-20260811"
CURRENT_BUILD = "empire-zoom-levels-v268-20260814"


def run_core(expression: str):
    script = f"const core=require({json.dumps(str(CORE))}); console.log(JSON.stringify({expression}));"
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(html, name):
    start = html.index("function " + name + "(")
    return html[start:html.index("\nfunction ", start)]


# ---------------------------------------------------------------------------
# Core maths: the DNA card
# ---------------------------------------------------------------------------

def test_dna_is_deterministic_and_distinct_across_seeds():
    a = run_core("core.villageDNA(12345)")
    b = run_core("core.villageDNA(12345)")
    c = run_core("core.villageDNA(54321)")
    assert a == b                      # same seed, same card, forever
    assert a != c                      # different seed, different village
    # Neighbouring seeds diverge too — the card is hashed, not sliding.
    d = run_core("core.villageDNA(12346)")
    assert a != d


def test_dna_card_carries_a_full_identity():
    dna = run_core("core.villageDNA(777)")
    assert dna["wallStyle"] in ("timber", "stone", "brick", "painted")
    assert dna["roofStyle"] in ("thatch", "slate", "tile", "shingle")
    assert len(dna["roofs"]) == 6
    for hexes in dna["roofs"] + [dna["plasterWash"], dna["trim"], dna["door"]] + dna["banners"]:
        assert 0 <= hexes <= 0xFFFFFF
    assert dna["windowGlow"]["rgb"].count(",") == 2
    assert 0 <= dna["crookedness"] <= 1 and 0 <= dna["prosperity"] <= 1


def test_every_wall_and_roof_style_actually_occurs():
    styles = run_core(
        "(() => { const w = new Set(), r = new Set();"
        "for (let s = 0; s < 400; s++) { const d = core.villageDNA(s); w.add(d.wallStyle); r.add(d.roofStyle); }"
        "return { walls: [...w].sort(), roofs: [...r].sort() }; })()"
    )
    assert styles["walls"] == ["brick", "painted", "stone", "timber"]
    assert styles["roofs"] == ["shingle", "slate", "thatch", "tile"]


def test_roof_runs_walk_the_golden_angle_inside_their_band():
    # A slate run stays in the cool band; a tile run stays terracotta.
    runs = run_core(
        "(() => { const r = core.villageRng(9); const slate = core.roofColorRun('slate', 0.2, 6, r);"
        "const r2 = core.villageRng(9); const tile = core.roofColorRun('tile', 0.2, 6, r2);"
        "return { slate: slate.map(h => core.hexToHsl(h)), tile: tile.map(h => core.hexToHsl(h)),"
        "distinct: new Set(slate).size };})()"
    )
    band = run_core("core.ROOF_BANDS.slate")
    for c in runs["slate"]:
        assert band["lo"] - 0.001 <= c["h"] <= band["hi"] + 0.001
    assert runs["distinct"] >= 5  # six draws, essentially never a repeat
    for c in runs["tile"]:
        h = c["h"] if c["h"] > 0.5 else c["h"] + 1  # terracotta wraps hue 0
        assert 0.97 <= h <= 1.08 or c["s"] == 0


def test_colour_maths_round_trips():
    assert run_core("core.hslToHex(0, 1, 0.5)") == 0xFF0000
    assert run_core("core.mixHex(0x000000, 0xffffff, 0.5)") == 0x808080
    back = run_core("core.hexToHsl(core.hslToHex(0.33, 0.5, 0.4))")
    assert abs(back["h"] - 0.33) < 0.01


def test_vary_palette_rekeys_colours_but_keeps_the_scene_contract():
    result = run_core(
        "(() => { const pal = { sky: 0x181430, ground: 0x24331a, plaster: 0xd9cbb0, timber: 0x3a2812,"
        "stone: 0x6b675e, roofs: [1, 2, 3], hemiSky: 0x6a7ab0, hemiGround: 0x2a2112,"
        "speck: [120,150,60], weather: 'snow', leaf: 0x2c3a18 };"
        "const a = core.varyPalette(pal, core.villageDNA(1));"
        "const b = core.varyPalette(pal, core.villageDNA(2));"
        "return { aw: a.weather, aspeck: a.speck, aroofs: a.roofs.length, hasDna: !!a.dna,"
        "same: JSON.stringify([a.plaster, a.roofs]) === JSON.stringify([b.plaster, b.roofs]),"
        "original: pal.roofs.length }; })()"
    )
    assert result["aw"] == "snow"          # weather (and its snowman) survives
    assert result["aspeck"] == [120, 150, 60]
    assert result["aroofs"] == 6           # DNA roof run replaces the stock five
    assert result["hasDna"] is True        # builders read pal.dna for styling
    assert result["same"] is False         # two seeds, two coats of paint
    assert result["original"] == 3         # the base palette is never mutated


def test_village_plan_replays_the_scene_builders_exact_dice():
    # The core's rng IS the game's villageRngFrom — bit for bit.
    html = HTML.read_text(encoding="utf-8")
    rng = function_source(html, "villageRngFrom")
    for token in ("0x6D2B79F5", "Math.imul(a ^ a >>> 15, 1 | a)", "61 | t", "4294967296"):
        assert token in rng
    plan = run_core("core.villagePlan(999, 10)")
    draws = run_core("(() => { const r = core.villageRng(999); return [r(), r(), r()]; })()")
    assert plan["paletteIndex"] == int(draws[0] * 10)
    assert plan["tier"] == (0 if draws[1] < 0.34 else 1 if draws[1] < 0.74 else 2)
    layout = ("green" if draws[2] < 0.22 else "crossroads" if draws[2] < 0.42
              else "riverside" if draws[2] < 0.62 else "lane" if draws[2] < 0.82 else "hamlet")
    assert plan["layout"] == layout
    # And the thresholds above are the ones buildVillageScene actually rolls.
    scene = function_source(html, "buildVillageScene")
    assert "sizeRoll < 0.34 ? 0 : sizeRoll < 0.74 ? 1 : 2" in scene
    assert "layoutRoll < 0.22 ? 'green' : layoutRoll < 0.42 ? 'crossroads' : layoutRoll < 0.62 ? 'riverside' : layoutRoll < 0.82 ? 'lane' : 'hamlet'" in scene


def test_landmark_ledger_is_deterministic_and_true_to_tier():
    a = run_core("core.landmarkPlan(123, 2, 10)")
    b = run_core("core.landmarkPlan(123, 2, 10)")
    assert a == b                                  # same seed, same skyline
    assert a["count"] in (2, 3)                    # a market town raises 2-3
    assert len(a["picks"]) == 3 and len(set(a["picks"])) == 3
    assert all(0 <= p < 10 for p in a["picks"])
    assert a["signature"] == a["picks"][0]
    # A hamlet may raise none — and then it has no signature to fake.
    hamlets = run_core(
        "(() => { const out = [];"
        "for (let s = 0; s < 60; s++) { const p = core.landmarkPlan(s, 0, 10);"
        "out.push([p.count, p.signature]); } return out; })()"
    )
    assert any(c == 0 and sig is None for c, sig in hamlets)
    assert any(c == 1 and sig is not None for c, sig in hamlets)
    # The ledger rides its own stream: tier only gates the count, never the picks.
    t0 = run_core("core.landmarkPlan(55, 0, 10)")
    t2 = run_core("core.landmarkPlan(55, 2, 10)")
    assert t0["picks"] == t2["picks"]


def test_district_identity_bundles_plan_dna_and_palette():
    result = run_core(
        "(() => { const bank = [{ plaster: 0xd9cbb0, timber: 0x3a2812, stone: 0x6b675e, sky: 1, ground: 2,"
        "hemiSky: 3, hemiGround: 4, roofs: [5], leaf: 6 }];"
        "const id = core.districtIdentity(42, bank);"
        "return { hasPlan: !!id.plan, hasDna: !!id.dna, roofs: id.palette.roofs.length }; })()"
    )
    assert result["hasPlan"] and result["hasDna"] and result["roofs"] == 6


# ---------------------------------------------------------------------------
# index.html wiring: the village scene
# ---------------------------------------------------------------------------

def test_village_scene_rolls_its_palette_then_rekeys_it_with_dna():
    html = HTML.read_text(encoding="utf-8")
    scene = function_source(html, "buildVillageScene")
    # The pinned palette roll survives; DNA re-keys it; daylight still grades it.
    assert "VILLAGE_PALETTES[Math.floor(r() * VILLAGE_PALETTES.length)]" in scene
    assert "villageVariedPalette(VILLAGE_PALETTES[Math.floor(r() * VILLAGE_PALETTES.length)], v.seed)" in scene
    assert "burbzDaylightPalette(basePal, daylight)" in scene
    helper = function_source(html, "villageVariedPalette")
    # A missing core changes nothing — classic palettes, classic look.
    assert "if (!core) return basePal;" in helper
    assert "core.varyPalette(basePal, core.villageDNA(seed))" in helper


def test_buildings_read_the_dna_card():
    html = HTML.read_text(encoding="utf-8")
    building = function_source(html, "villageMakeBuilding")
    assert "const dna = pal.dna || null;" in building
    for fragment in ("wallStyle === 'brick'", "wallStyle === 'stone'", "wallStyle === 'painted'",
                     "roofCraft === 'thatch'", "dna.windowGlow", "dna.door", "dna.trim",
                     "dna.crookedness", "dna.prosperity"):
        assert fragment in building, fragment
    cottage = function_source(html, "villageMakeCottage")
    for fragment in ("const dna = pal.dna || null;", "wallStyle === 'brick'",
                     "dna.roofStyle === 'thatch'", "dna.door", "dna.windowGlow.hex"):
        assert fragment in cottage, fragment


def test_new_landmarks_join_the_shared_skyline_pool():
    html = HTML.read_text(encoding="utf-8")
    assert "function villageMakeShrine(" in html
    assert "function villageMakeWatchtower(" in html
    # ONE pool, shared by both scenes, indexed by the landmark ledger.
    assert "const VILLAGE_LANDMARK_MAKERS = [villageMakeChurch, villageMakeWindmill, villageMakeManor, villageMakeRuinTower," in html
    assert "villageMakeShrine, villageMakeWatchtower];" in html
    scene = function_source(html, "buildVillageScene")
    # The village places exactly the ledger's picks; no core = classic rolls.
    assert "vvCore.landmarkPlan(v.seed, tier, VILLAGE_LANDMARK_MAKERS.length)" in scene
    assert "lmPlan ? lmPlan.count" in scene
    assert "VILLAGE_LANDMARK_MAKERS[lmPlan.picks[i]]" in scene
    assert "landmarkPool.splice(Math.floor(r() * landmarkPool.length), 1)[0]" in scene


def test_festival_cloth_is_dyed_in_the_villages_banners():
    html = HTML.read_text(encoding="utf-8")
    maypole = function_source(html, "villageMakeMaypole")
    assert "pal.dna.banners[0]" in maypole
    garland = function_source(html, "villageMakeGarland")
    assert "pal.dna.banners[0], pal.dna.banners[1]" in garland


# ---------------------------------------------------------------------------
# index.html wiring: the Town Square's districts are the real villages
# ---------------------------------------------------------------------------

def test_town_districts_replay_their_villages_own_dice():
    html = HTML.read_text(encoding="utf-8")
    scene = function_source(html, "buildTownScene")
    assert "vcore.villagePlan(seed, VILLAGE_PALETTES.length)" in scene
    assert "villageVariedPalette(VILLAGE_PALETTES[plan.paletteIndex], seed)" in scene
    # Each district builds in ITS palette (dpal), to its own tier and plan.
    for fragment in ("const dTier = plan ? plan.tier : 1;",
                     "const dLayout = plan ? plan.layout : 'green';",
                     "villageMakeCottage(dr, dpal)",
                     "dLayout === 'lane'", "dLayout === 'hamlet'"):
        assert fragment in scene, fragment
    # One of the village's real trades keeps a shopfront on the yard.
    assert "villageShopKeysFor(seed)" in scene
    assert "villageMakeBuilding(tradeKey" in scene
    # The district's landmark IS the village's signature from the ledger —
    # and a village with no landmark gets an honest bare green, not a fake.
    assert "vcore.landmarkPlan(seed, dTier, VILLAGE_LANDMARK_MAKERS.length)" in scene
    assert "VILLAGE_LANDMARK_MAKERS[lmPlan.signature]" in scene
    assert "lmPlan.signature !== null" in scene
    # The pinned contracts survive: real geography, tap targets, name signs.
    assert "townDistrictLayout(settle" in scene
    assert "district.userData.districtSeed = seed" in scene
    assert "villageMakeSign(v.name" in scene
    assert "villageMakeSettlementStandard(r, pal, { tier: settle.tier, memberCount: settle.villageCount })" in scene


def test_town_districts_mirror_their_villages_ruin_state():
    html = HTML.read_text(encoding="utf-8")
    # One ledger, the village scene's exact thresholds.
    state_fn = function_source(html, "villageDistrictState")
    assert "dev <= 0 ? 0 : dev < 5 ? 1 : 2" in state_fn
    assert ".filter(ru => !ru.cleared)" in state_fn
    assert "villageConstructionFor(rec)" in state_fn
    village_scene = function_source(html, "buildVillageScene")
    assert "devLevel <= 0 ? 0 : devLevel < 5 ? 1 : 2" in village_scene  # same rule
    scene = function_source(html, "buildTownScene")
    assert "const dState = villageDistrictState(seed);" in scene
    # Wrecked and rebuilding districts show wreckage, not landmarks.
    assert "if (dRuin < 2) {" in scene
    assert "villageMakeWreckedBuilding(dr, dpal, dState.firstWreckKind || 'house')" in scene
    assert "villageMakeRubblePile(dr, dpal)" in scene
    # Trades, homes and landmarks all wait for stage 2 — a district shows
    # nothing pre-built while its village is still rebuilding (v267).
    assert "if (dRuin >= 2) {" in scene
    assert "if (dRuin === 2) {" in scene
    # A build rising in the village rises in its district.
    assert "villageMakeConstructionSite(dr, dpal, constructionProgress(dState.construction))" in scene
    # A wrecked district keeps no lamplit yard.
    assert "if (i < 8 && dRuin >= 1) {" in scene
    # Recovery keys the scene, so development rebuilds the square.
    key_fn = function_source(html, "townSceneKey")
    assert "villageDistrictState(v.seed)" in key_fn
    assert "st.ruinStage" in key_fn and "st.ruinsLeft" in key_fn
    assert "st.construction ? '+b' : ''" in key_fn


def test_town_adopts_the_shared_builders_smokes_and_signs():
    html = HTML.read_text(encoding="utf-8")
    scene = function_source(html, "buildTownScene")
    assert "const smokeMark = villageSmokes.length, signMark = villageSigns.length;" in scene
    assert "townSmokes = townSmokes.concat(villageSmokes.splice(smokeMark));" in scene
    assert "townSigns = townSigns.concat(villageSigns.splice(signMark));" in scene


def test_town_copy_tells_the_player_the_districts_are_real():
    html = HTML.read_text(encoding="utf-8")
    assert "Each district is one of your real villages" in html


# ---------------------------------------------------------------------------
# Release pins
# ---------------------------------------------------------------------------

def test_release_is_versioned_and_the_new_core_is_precached_everywhere():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f'<script src="village_variation_core.js?v={OWN_RELEASE_PIN}"></script>' in html
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line  # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert sw.count(f"'./village_variation_core.js?v={OWN_RELEASE_PIN}'") == 2
    updater = UPDATER.read_text(encoding="utf-8")
    assert '"village_variation_core.js"' in updater
