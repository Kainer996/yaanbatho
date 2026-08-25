"""Free your first village — the three moves straight after the tutorial.

The moment Merlin stops talking, the player quest chain asks for the game's
biggest promise in order: open the Empire map, take the nearest village back
from the darkness, then go outside and find a real bird.

Three things have to hold for that to be a win rather than a wall:

1. A village stands beside the player. The procedural grid drops one roughly
   every 2.2 km, which can leave a new player kilometres from their first
   target, so a CRADLE village is planted a short walk from wherever the atlas
   first found them.
2. Merlin fights. He is not a recruited companion, so a brand new player has
   an empty flock — and the Liberation Battle used to refuse them outright.
3. The battle cannot be lost. Two feeble evil Burbz hold the village, at fixed
   numbers rather than scaled ones, and the player's birds cannot be knocked
   out in that one fight.
"""
import json
import math
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
BATTLE_CORE = (ROOT / "battle_core.js").read_text(encoding="utf-8")
OWN_RELEASE_PIN = "free-your-first-village-v327-20260825"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start, name
    return html[start:end]


def player_quest_ids(html: str) -> list:
    block = html.split("const PLAYER_QUESTS = [", 1)[1].split("\n];", 1)[0]
    return re.findall(r"\{ id:'([a-z0-9_]+)'", block)


# --- 1. The chain -----------------------------------------------------------

def test_the_chain_opens_with_empire_then_liberation_then_a_real_bird():
    ids = player_quest_ids(HTML)
    assert ids[:3] == ["pq_open_empire", "pq_liberate", "pq_first_bird"], ids[:6]
    # Each id appears exactly once — the liberation link moved, it was not copied.
    assert len(ids) == len(set(ids))
    assert "Open your Empire map" in HTML
    assert "Send Merlin to free the village nearest you" in HTML


def test_opening_the_empire_screen_is_what_completes_the_first_link():
    switch = function_source(HTML, "switchScreen")
    assert "markEmpireMapOpened()" in switch
    mark = function_source(HTML, "markEmpireMapOpened")
    assert "empireMapOpens" in mark
    assert "saveState()" in mark
    assert "measure:() => empireMapOpenCount()" in HTML


# --- 2. A village beside the player -----------------------------------------

def test_a_village_is_planted_within_a_short_walk_of_a_new_player():
    offset = float(re.search(r"const CRADLE_VILLAGE_OFFSET_DEG = ([0-9.]+);", HTML).group(1))
    # The cradle sits `offset` north and 0.6 * offset east (longitude corrected),
    # so its distance from the player is the same everywhere on Earth.
    metres_per_degree_lat = 111_320
    north = offset * metres_per_degree_lat
    east = offset * 0.6 * metres_per_degree_lat
    distance = math.hypot(north, east)
    assert 60 < distance < 250, distance


def test_the_cradle_is_a_real_village_and_never_shares_a_seed():
    plant = function_source(HTML, "ensureEmpireCradleSite")
    # Its own map cell's seed: the same scheme as every other village.
    assert "core.villageCellSeed(" in plant
    # Planted once, and only while the player holds nothing at all.
    assert "if (empire.cradleSite) return empireCradleSite();" in plant
    assert "Object.keys(empire.liberationVictories).length || Object.keys(empire.villages).length" in plant
    # The cell it occupies yields the cradle instead of whatever it had rolled,
    # so one seed can never name two places.
    cell = function_source(HTML, "villageInCell")
    assert "const cradle = empireCradleSite();" in cell
    assert "cradle.cellI === i && cradle.cellJ === j" in cell
    # Planted from the live map and from the Empire atlas.
    assert "ensureEmpireCradleSite();" in function_source(HTML, "drawVillageMarkers")


def test_the_cradle_is_the_village_the_generator_hands_back():
    """Run the real seeded-village pipeline in Node with a cradle planted."""
    start = HTML.index("// ---- Seeded randomness")
    end = HTML.index("function nearestVillageTo")
    pipeline = HTML[start:end]
    script = (
        "globalThis.BurbzEmpireRealmCore=require('./empire_realm_core.js');\n"
        "const core = globalThis.BurbzEmpireRealmCore;\n"
        "const HERE = { lat: 52.4862, lon: -1.8904 };\n"
        "const OFFSET = __OFFSET__;\n"
        "const cosLat = Math.max(0.2, Math.cos(HERE.lat * Math.PI / 180));\n"
        "const CRADLE = { lat: HERE.lat + OFFSET, lon: HERE.lon + (OFFSET * 0.6) / cosLat };\n"
        "CRADLE.seed = core.villageCellSeed(Math.floor(CRADLE.lat / 0.02), Math.floor(CRADLE.lon / 0.02));\n"
        "function ensureEmpireState() { return { cradleSite: CRADLE, villages: {}, liberationVictories: {} }; }\n"
        "function normaliseVillageCoordinate(v, lo, hi) { const n = Number(v); "
        "return Number.isFinite(n) && n >= lo && n <= hi ? n : null; }\n"
        + pipeline +
        "\nconst near = villagesNearLatLng(HERE.lat, HERE.lon, 2);\n"
        "const metres = (a, b) => { const R = 6371000, r = d => d * Math.PI / 180;\n"
        "  const dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);\n"
        "  const x = Math.sin(dLat/2)**2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon/2)**2;\n"
        "  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x))); };\n"
        "const sorted = near.map(v => ({ ...v, d: metres(HERE, v) })).sort((a, b) => a.d - b.d);\n"
        "console.log(JSON.stringify({ nearest: sorted[0], cradleSeed: CRADLE.seed,\n"
        "  seeds: near.map(v => v.seed), unique: new Set(near.map(v => v.seed)).size === near.length }));"
    ).replace("__OFFSET__", re.search(r"const CRADLE_VILLAGE_OFFSET_DEG = ([0-9.]+);", HTML).group(1))
    run = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=120)
    assert run.returncode == 0, run.stderr
    out = json.loads(run.stdout)
    # The nearest settlement is the cradle, a short walk away, and it appears once.
    assert out["nearest"]["seed"] == out["cradleSeed"]
    assert out["nearest"]["d"] < 250, out["nearest"]["d"]
    assert out["nearest"]["name"]
    assert out["seeds"].count(out["cradleSeed"]) == 1
    assert out["unique"]


def test_a_village_screen_always_carries_its_coordinates():
    # A village picked by the screen itself used to arrive without lat/lon, and
    # the Liberation Battle rejected it as an unreal place.
    current = function_source(HTML, "currentVillage")
    assert "lat: normaliseVillageCoordinate(near.lat, -90, 90)" in current
    assert "lon: normaliseVillageCoordinate(near.lon, -180, 180)" in current


# --- 3. Merlin fights -------------------------------------------------------

def test_merlin_is_always_on_the_squad_sheet():
    roster = function_source(HTML, "getBattleFlock")
    assert "merlinBattleBird()" in roster
    assert "b.id !== MERLIN_GUIDE.id" in roster  # never listed twice

    available = function_source(HTML, "birdBattleAvailable")
    assert "if (isMerlinCompanion(bird)) return true;" in available
    ready = function_source(HTML, "birdBattleReady")
    assert "isMerlinCompanion(bird) || birdWorkReadiness(bird, 'battle').ok" in ready

    # No post, drill, errand, sleep or empty stomach benches him.
    select = function_source(HTML, "renderBattleSelect")
    assert "roster.filter(b => birdBattleAvailable(b))" in select
    assert "flock.filter(birdBattleReady)" in select
    start = function_source(HTML, "startPerchBattle")
    assert "!isMerlinCompanion(b) && birdAssignedPost(b.id)" in start
    assert "!isMerlinCompanion(b) && (birdHasActiveTraining(b.id) || birdHasActiveExpedition(b.id))" in start
    assert "team.find(b => !birdBattleReady(b))" in start


def test_an_empty_flock_no_longer_blocks_the_first_liberation():
    begin = function_source(HTML, "beginVillageLiberation")
    assert "!Array.isArray(gameState.flock) || !gameState.flock.length" not in begin
    assert "if (!getBattleFlock().length)" in begin


# --- 4. The battle cannot be lost -------------------------------------------

def test_the_first_garrison_is_two_guards_at_fixed_feeble_numbers():
    assert "const FIRST_GARRISON_SIZE = 2;" in HTML
    assert "const FIRST_GARRISON_HP = 20;" in HTML
    assert "const FIRST_GARRISON_STAT = 4;" in HTML
    weaken = function_source(HTML, "weakenFirstGarrison")
    assert "opponents.slice(0, FIRST_GARRISON_SIZE)" in weaken
    # Fixed, not scaled: whichever evil Burbz the roster picks, this is what stands.
    assert "b.maxHp *" not in weaken
    assert "b.atk *" not in weaken
    first = function_source(HTML, "isFirstLiberationBattle")
    assert "liberationVictories" in first and "empireVillages().length === 0" in first


def test_the_first_liberation_is_marked_unloseable():
    start = function_source(HTML, "startPerchBattle")
    assert "unloseable: !!(liberation && isFirstLiberationBattle())" in start
    # The rule lives in the battle core, and only ever protects the player.
    assert "unloseable: !!config.unloseable" in BATTLE_CORE
    assert "if (battle.unloseable && defSide === 'player') {" in BATTLE_CORE
    assert "defender.hp = 1;" in BATTLE_CORE


def test_even_a_feeble_bird_wins_the_first_liberation_every_time():
    """Drive the real engine: one weak level-1 bird against the token garrison."""
    script = """
const core = require('./battle_core.js');
const HP = 20, STAT = 4;                       // FIRST_GARRISON_HP / _STAT
const garrison = i => ({ id: 'evil_' + i, species: 'Grey Heron', commonName: 'Sooty Wren',
  rarity: 'uncommon', level: 1, maxHp: HP, hp: HP, atk: STAT, def: STAT, spd: STAT,
  int: STAT, cha: STAT, mag: STAT, stamina: STAT });
// Weaker than Merlin on every axis, untrained and carrying no gear.
const floorBird = () => ({ id: 'P0', species: 'Eurasian Wren', commonName: 'Floor Bird',
  level: 1, rarity: 'common', maxHp: 50, hp: 50, atk: 20, def: 20, spd: 20,
  int: 40, cha: 40, stamina: 30, mag: 30 });
const winners = [];
for (let seed = 0; seed < 200; seed++) {
  const player = [core.buildFighter(floorBird())];
  const foes = [0, 1].map(i => core.buildOpponentFighter(garrison(i), 0, 's' + seed + '_' + i));
  const battle = core.createBattle({ playerFighters: player, opponentFighters: foes,
    seed: 'firstlib_' + seed, tier: 0, unloseable: true });
  let guard = 0;
  while (battle.phase !== 'over' && guard++ < 900) {
    if (!core.tickToNextTurn(battle)) break;
    core.resolveAction(battle, core.aiChooseAction(battle));
  }
  winners.push(battle.winner);
}
console.log(JSON.stringify(winners));
"""
    run = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=180)
    assert run.returncode == 0, run.stderr
    winners = json.loads(run.stdout)
    assert len(winners) == 200
    assert all(w == "player" for w in winners), winners.count("opponent")


def test_an_ordinary_battle_can_still_be_lost():
    """The rally is scoped to that one fight — normal battles keep their teeth."""
    script = """
const core = require('./battle_core.js');
const weak = () => ({ id: 'P0', species: 'Goldcrest', commonName: 'Weak', level: 1,
  rarity: 'common', maxHp: 50, hp: 50, atk: 12, def: 12, spd: 15, int: 30, cha: 30,
  stamina: 25, mag: 20 });
const brute = i => ({ id: 'E' + i, species: 'Grey Heron', commonName: 'Brute', level: 20,
  rarity: 'epic', maxHp: 400, hp: 400, atk: 200, def: 150, spd: 120, int: 90, cha: 60,
  stamina: 90, mag: 80 });
let losses = 0;
for (let seed = 0; seed < 20; seed++) {
  const battle = core.createBattle({ playerFighters: [core.buildFighter(weak())],
    opponentFighters: [0, 1].map(i => core.buildOpponentFighter(brute(i), 4, 'b' + seed + '_' + i)),
    seed: 'normal_' + seed, tier: 4 });
  let guard = 0;
  while (battle.phase !== 'over' && guard++ < 900) {
    if (!core.tickToNextTurn(battle)) break;
    core.resolveAction(battle, core.aiChooseAction(battle));
  }
  if (battle.winner === 'opponent') losses++;
}
console.log(JSON.stringify({ losses }));
"""
    run = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=180)
    assert run.returncode == 0, run.stderr
    assert json.loads(run.stdout)["losses"] == 20


def test_release_is_pinned_in_the_service_worker_and_the_build_line():
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    # This release's own segment stays in the cache lineage for good, and the
    # build line names whichever release now leads that lineage.
    assert OWN_RELEASE_PIN in cache_line
    head = re.search(r"const BURBZ_BUILD = '([^']+)';", HTML).group(1)
    assert cache_line.rstrip("';").endswith(head)
