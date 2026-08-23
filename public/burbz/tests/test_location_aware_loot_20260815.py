"""Map loot now reads the land it lies on.

Before this change every pickup rolled from one flat table, so the beach,
the high street and the oak wood all dropped the same mix. Now each pickup
takes the habitat of its nearest mapped OpenStreetMap feature (the same
features that place the area birds) and rolls from habitat weights:

* rivers and lakes hold fish — live minnows, rising trout — plus pondweed
  and reeds for the waterbirds;
* the coast washes up sand eels, shore snails, driftwood timber and the
  odd wrecked treasure chest;
* woodland drops fallen branches, oak twigs, acorns and wood mice;
* streets fill with coins, lost purses and pigeon rations — town loot;
* with no mapped feature loaded yet, the old neutral table still applies,
  so loot never vanishes when Overpass is slow or down.

Habitat-only finds (weight 0 plus `biomes`) can never appear outside their
listed ground, and the daily seeded spawn stays deterministic.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

CURRENT_BUILD = "timber-village-builds-v309-20260823"
PREVIOUS_RELEASE_PIN = "steven-the-gull-v270-20260815"

KNOWN_HABITATS = {"water", "wetland", "woodland", "heath", "park", "farmland",
                  "grassland", "urban", "coast", "hills"}


def run_node(script: str) -> dict:
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=90)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def forage_block(html: str) -> str:
    return html[html.index("const MAP_PICKUP_TYPES = ["):html.index("const MAP_PICKUP_CELL_DEG")]


# ---------------------------------------------------------------------------
# Source wiring
# ---------------------------------------------------------------------------

def test_release_is_pinned_and_reaches_players():
    html = HTML.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in SW.read_text(encoding="utf-8").splitlines() if "const BURBZ_CACHE" in line)
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)  # this fix reaches players


def test_habitat_finds_feed_real_game_systems():
    forage = forage_block(HTML.read_text(encoding="utf-8"))
    # Fish and marine food land in the Stores larder the kitchen already serves.
    for ingredient in ("live_minnow", "river_trout", "sand_eel", "shore_snail_mix",
                       "pondweed_tangle", "pigeon_prey_ration", "windfall_apple"):
        assert f"addLarderIngredient('{ingredient}', 1)" in forage, ingredient
    # Driftwood and deadfall grant real building timber.
    assert forage.count("addBranches(2)") == 2


def test_every_larder_pickup_names_a_real_kitchen_ingredient():
    forage = forage_block(HTML.read_text(encoding="utf-8"))
    ids = sorted(set(re.findall(r"addLarderIngredient\('([a-z_]+)', 1\)", forage)))
    out = run_node(
        "global.window = global;"
        "const K = require('./kitchen_pantry_core.js');"
        "console.log(JSON.stringify(Object.keys(K.INGREDIENTS)));"
    )
    for ingredient_id in ids:
        assert ingredient_id in out, ingredient_id


def test_biome_keys_are_real_habitats():
    forage = forage_block(HTML.read_text(encoding="utf-8"))
    for biomes in re.findall(r"biomes:\{([^}]*)\}", forage):
        for key in re.findall(r"([a-z]+):", biomes):
            assert key in KNOWN_HABITATS, key


def test_loot_pipeline_is_wired_into_the_live_map():
    html = HTML.read_text(encoding="utf-8")
    # The Overpass fetch for bird spawns also feeds the loot survey.
    assert "setLootHabitatFeatures(features); const spawns = buildBirdSpawns(lat, lon, features);" in html
    # Each pickup rolls with its own ground.
    assert "type: pickupTypeForSeed(s, ground.habitat)" in html
    # Fresh survey → markers re-read the land.
    assert "liveMapLootFeatureStamp" in html[html.index("function mapPickupRenderKey("):html.index("function updateMapPickupReachability(")]


# ---------------------------------------------------------------------------
# Runtime behaviour, driven through node
# ---------------------------------------------------------------------------

def _fn(html: str, name: str) -> str:
    start = html.index("function " + name)
    # Skip the parameter list first — defaults like (tags = {}) hold braces.
    i = html.index("(", start)
    depth = 0
    for i in range(i, len(html)):
        if html[i] == "(":
            depth += 1
        elif html[i] == ")":
            depth -= 1
            if depth == 0:
                break
    i = html.index("{", i)
    depth = 0
    for i in range(i, len(html)):
        if html[i] == "{":
            depth += 1
        elif html[i] == "}":
            depth -= 1
            if depth == 0:
                break
    return html[start:i + 1]


def _const(html: str, pattern: str) -> str:
    match = re.search(pattern, html)
    assert match, pattern
    return match.group(0)


def _runtime_harness(html: str) -> str:
    """The pickup pipeline with tiny stand-ins for game glue."""
    table = forage_block(html).rstrip()
    return "\n".join([
        "const gameState = { player: { branches: 0 }, inventory: { items: {}, gear: {} }, pantry: {}, lootPity: {} };",
        "const PANTRY_CAP = {}; const CHEST_SVG = 'chest';",
        "const larder = {};",
        "function addLarderIngredient(id, n) { larder[id] = (larder[id] || 0) + n; return true; }",
        "function addBranches(n) { gameState.player.branches += n; }",
        "function addCoins() {} function addPlayerXp() {} function clamp(v) { return v; }",
        "function grantLootDrops() { return []; } function lootLinesToText() { return ''; }",
        "function lootCore() { return { rollLoot: () => [] }; }",
        "function randomXpScrollKey() { return 'x'; } function addBirdXpItemToBag() {}",
        "function birdXpItem() { return { label: 'x' }; } function birdXpItemDetail() { return ''; }",
        "function mapDistanceMeters(a, b) { const dLat = (a.lat - b.lat) * 111320; const dLon = (a.lon - b.lon) * 111320 * Math.cos(b.lat * Math.PI / 180); return Math.hypot(dLat, dLon); }",
        _fn(html, "burbzHash32"),
        _fn(html, "villageRngFrom"),
        _fn(html, "classifyHabitat"),
        table,
        _const(html, r"const MAP_PICKUP_CELL_DEG = [^\n]+;"),
        _const(html, r"const PICKUP_HABITAT_RANGE_M = \d+;"),
        _const(html, r"const PICKUP_HABITAT_REACH_M = \d+;"),
        _const(html, r"const PICKUP_BROAD_HABITATS = new Set\([^\n]+\);"),
        "let liveMapLootFeatures = []; let liveMapLootFeatureStamp = 0;",
        _fn(html, "setLootHabitatFeatures"),
        _fn(html, "pickupGroundAt"),
        _fn(html, "pickupHabitatAt"),
        _fn(html, "pickupWeightFor"),
        _fn(html, "pickupTypeForSeed"),
        "function pickupDayKey() { return '2026-08-15'; }",
        _fn(html, "mapPickupsNear"),
    ])


def _rolled_ids(habitat) -> str:
    habitat_js = "null" if habitat is None else f"'{habitat}'"
    return f"""
const ids = new Set();
for (let seed = 0; seed < 6000; seed++) ids.add(pickupTypeForSeed(seed, {habitat_js}).id);
console.log(JSON.stringify([...ids]));
"""


def _roll(html, habitat):
    script = _runtime_harness(html) + _rolled_ids(habitat)
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=90)
    assert result.returncode == 0, result.stderr
    return set(json.loads(result.stdout))


def test_water_holds_fish_and_waterweed():
    ids = _roll(HTML.read_text(encoding="utf-8"), "water")
    assert {"minnow", "trout", "pondweed", "reed", "frog"} <= ids
    # Dry-land and town-only loot stays out of the water.
    assert not {"deadfall", "pigeonration", "windfall", "deercarrion"} & ids


def test_the_coast_washes_up_marine_finds():
    ids = _roll(HTML.read_text(encoding="utf-8"), "coast")
    assert {"sandeel", "shoresnails", "driftwood"} <= ids
    # River fish don't rise in the surf; forest deadfall stays in the woods.
    assert not {"trout", "minnow", "deadfall", "windfall"} & ids


def test_woodland_is_rich_in_timber_and_forest_forage():
    ids = _roll(HTML.read_text(encoding="utf-8"), "woodland")
    assert {"deadfall", "twig", "acorns", "woodmouse"} <= ids
    assert not {"minnow", "trout", "driftwood", "shoresnails", "pigeonration"} & ids


def test_town_streets_drop_town_loot():
    ids = _roll(HTML.read_text(encoding="utf-8"), "urban")
    assert {"coins", "purse", "pigeonration"} <= ids
    assert not {"minnow", "trout", "shoresnails", "deadfall", "driftwood", "deercarrion"} & ids


def test_neutral_ground_keeps_the_classic_table():
    ids = _roll(HTML.read_text(encoding="utf-8"), None)
    assert {"coins", "berries", "twig", "chest"} <= ids
    # Habitat-only finds never appear without a habitat.
    assert not {"minnow", "trout", "shoresnails", "pondweed", "driftwood",
                "deadfall", "pigeonration", "windfall"} & ids


def test_nearest_feature_decides_the_ground():
    html = HTML.read_text(encoding="utf-8")
    script = _runtime_harness(html) + """
const at = { lat: 51.5, lon: -0.12 };
const off = m => ({ lat: at.lat + m / 111320, lon: at.lon });
const read = () => pickupHabitatAt(at.lat, at.lon);
const out = {};
out.unsurveyed = read();                                                    // no features yet
setLootHabitatFeatures([{ ...off(100), tags: { natural: 'water' } }]);
out.pond = read();                                                          // close water wins
setLootHabitatFeatures([{ ...off(100), tags: { natural: 'coastline' } }]);
out.shore = read();
setLootHabitatFeatures([{ ...off(600), tags: { natural: 'wood' } }]);
out.deepWood = read();                                                      // broad cover reaches far
setLootHabitatFeatures([{ ...off(600), tags: { leisure: 'park' } }]);
out.farPark = read();                                                       // a point feature does not
setLootHabitatFeatures([{ ...off(2000), tags: { natural: 'wood' } }]);
out.streets = read();                                                       // beyond reach → town
const stampBefore = liveMapLootFeatureStamp;
setLootHabitatFeatures([]);                                                 // failed fetch
out.keptSurvey = liveMapLootFeatures.length > 0 && liveMapLootFeatureStamp === stampBefore;
console.log(JSON.stringify(out));
"""
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=90)
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout)
    assert out["unsurveyed"] is None
    assert out["pond"] == "water"
    assert out["shore"] == "coast"
    assert out["deepWood"] == "woodland"
    assert out["farPark"] == "urban"
    assert out["streets"] == "urban"
    assert out["keptSurvey"] is True


def test_pickups_near_water_carry_water_loot_and_stay_deterministic():
    html = HTML.read_text(encoding="utf-8")
    script = _runtime_harness(html) + """
const at = { lat: 51.5, lon: -0.12 };
setLootHabitatFeatures([{ lat: at.lat, lon: at.lon, tags: { natural: 'water' } }]);
const a = mapPickupsNear(at.lat, at.lon);
const b = mapPickupsNear(at.lat, at.lon);
const near = a.filter(p => mapDistanceMeters(p, at) <= 320);
console.log(JSON.stringify({
  count: a.length,
  deterministic: JSON.stringify(a.map(p => [p.key, p.type.id])) === JSON.stringify(b.map(p => [p.key, p.type.id])),
  nearWaterFlavoured: near.length > 0 && near.every(p => p.habitat === 'water'),
  waterOnlyIds: a.map(p => p.type.id).filter(id => ['minnow','trout','pondweed'].includes(id)).length
}));
"""
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=90)
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout)
    assert out["count"] > 0
    assert out["deterministic"] is True
    assert out["nearWaterFlavoured"] is True


def test_habitat_grants_deliver_the_goods():
    html = HTML.read_text(encoding="utf-8")
    script = _runtime_harness(html) + """
const byId = id => MAP_PICKUP_TYPES.find(t => t.id === id);
const r = villageRngFrom(7);
byId('minnow').grant(r);
byId('trout').grant(r);
byId('shoresnails').grant(r);
byId('pondweed').grant(r);
byId('pigeonration').grant(r);
byId('driftwood').grant(r);
byId('deadfall').grant(r);
console.log(JSON.stringify({ larder, branches: gameState.player.branches }));
"""
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=90)
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout)
    for ingredient in ("live_minnow", "river_trout", "shore_snail_mix", "pondweed_tangle", "pigeon_prey_ration"):
        assert out["larder"].get(ingredient) == 1, ingredient
    assert out["branches"] == 4  # driftwood + deadfall, 2 each


def test_water_loot_is_mostly_watery_and_fish_are_common():
    html = HTML.read_text(encoding="utf-8")
    script = _runtime_harness(html) + """
const counts = {};
for (let seed = 0; seed < 20000; seed++) { const id = pickupTypeForSeed(seed, 'water').id; counts[id] = (counts[id] || 0) + 1; }
console.log(JSON.stringify(counts));
"""
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=90)
    assert result.returncode == 0, result.stderr
    counts = json.loads(result.stdout)
    total = sum(counts.values())
    fish = counts.get("minnow", 0) + counts.get("trout", 0) + counts.get("sandeel", 0)
    watery = fish + sum(counts.get(k, 0) for k in ("pondweed", "reed", "frog", "dragonflies", "midges", "gritbank", "chest", "driftwood"))
    # Standing at the river, most drops belong to the water...
    assert watery / total > 0.55, watery / total
    # ...actual fish alone outnumber coins several times over.
    assert fish > counts.get("coins", 0) * 3, (fish, counts.get("coins", 0))


def test_watery_pickups_land_on_their_water():
    html = HTML.read_text(encoding="utf-8")
    script = _runtime_harness(html) + """
const at = { lat: 51.5, lon: -0.12 };
const river = { lat: at.lat + 0.001, lon: at.lon, tags: { waterway: 'river' } };
setLootHabitatFeatures([river]);
const pickups = mapPickupsNear(at.lat, at.lon).filter(p => p.habitat === 'water');
const dists = pickups.map(p => mapDistanceMeters(p, river));
console.log(JSON.stringify({ count: pickups.length, maxDist: Math.max(...dists) }));
"""
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=90)
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout)
    assert out["count"] > 0
    assert out["maxDist"] <= 80  # the shoal floats on the river, not the towpath
