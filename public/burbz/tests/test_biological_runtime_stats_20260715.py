import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"


def _runtime_stats(profile, rarity, base_power):
    source = INDEX.read_text(encoding="utf-8")
    start = source.index("function generateBirdStats(")
    end = source.index("\nfunction ", start + 1)
    function_source = source[start:end]
    script = f"""
const profile = {json.dumps(profile)};
function findSpeciesProfile() {{ return profile; }}
function speciesPersonalityBase() {{ return 5; }}
function clamp(value, min, max) {{ return Math.max(min, Math.min(max, value)); }}
function hashStr() {{ return 0; }}
function seededRandom() {{ return () => 0.5; }}
const SPECIAL_MOVES = ['Wingbeat'];
const BIRD_EMOJIS = ['bird'];
{function_source}
console.log(JSON.stringify(generateBirdStats(profile.name, {base_power}, {json.dumps(rarity)})));
"""
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_profile_runtime_stats_are_biology_only_not_rarity_or_legacy_power():
    profile = {
        "id": "test_bird",
        "name": "Test Bird",
        "traits": [],
        "stats": {"hp": 4, "stamina": 6, "strength": 3, "def": 4, "spd": 7, "int": 8},
    }
    common = _runtime_stats(profile, "common", 30)
    legendary = _runtime_stats(profile, "legendary", 300)
    for key in ("hp", "maxHp", "atk", "def", "spd", "int", "cha", "stamina", "power", "basePower"):
        assert common[key] == legendary[key], key


def test_biological_comparisons_survive_runtime_conversion():
    robin = {
        "id": "european_robin", "name": "European Robin", "traits": [],
        "stats": {"hp": 3, "stamina": 5, "strength": 2, "def": 3, "spd": 5, "int": 5},
    }
    eagle = {
        "id": "golden_eagle", "name": "Golden Eagle", "traits": [],
        "stats": {"hp": 10, "stamina": 8, "strength": 10, "def": 9, "spd": 8, "int": 7},
    }
    crow = {
        "id": "carrion_crow", "name": "Carrion Crow", "traits": [],
        "stats": {"hp": 5, "stamina": 7, "strength": 5, "def": 5, "spd": 6, "int": 9},
    }
    gull = {
        "id": "herring_gull", "name": "Herring Gull", "traits": [],
        "stats": {"hp": 6, "stamina": 8, "strength": 6, "def": 6, "spd": 7, "int": 5},
    }
    robin_runtime = _runtime_stats(robin, "legendary", 300)
    eagle_runtime = _runtime_stats(eagle, "common", 30)
    crow_runtime = _runtime_stats(crow, "common", 30)
    gull_runtime = _runtime_stats(gull, "legendary", 300)
    assert robin_runtime["atk"] < eagle_runtime["atk"]
    assert robin_runtime["power"] < eagle_runtime["power"]
    assert crow_runtime["int"] > gull_runtime["int"]


def test_legacy_flock_migration_recalibrates_stats_but_preserves_level_training_and_health():
    source = INDEX.read_text(encoding="utf-8")
    generate_start = source.index("function generateBirdStats(")
    generate_end = source.index("\nconst BIRD_BIOLOGY_STATS_VERSION", generate_start)
    migration_start = source.index("const BIRD_BIOLOGY_STATS_VERSION", generate_end)
    migration_end = source.index("\nfunction determineBirdRarity", migration_start)
    functions = source[generate_start:generate_end] + "\n" + source[migration_start:migration_end]
    profile = {
        "id": "test_bird", "name": "Test Bird", "traits": [],
        "stats": {"hp": 4, "stamina": 6, "strength": 3, "def": 4, "spd": 7, "int": 8},
    }
    script = f"""
const profile = {json.dumps(profile)};
function findSpeciesProfile(name) {{ return name === profile.name ? profile : null; }}
function speciesPersonalityBase() {{ return 5; }}
function clamp(value, min, max) {{ return Math.max(min, Math.min(max, value)); }}
function hashStr() {{ return 0; }}
function seededRandom() {{ return () => 0.5; }}
const SPECIAL_MOVES = ['Wingbeat'];
const BIRD_EMOJIS = ['bird'];
{functions}
const oldBird = {{species:'Test Bird', rarity:'legendary', level:5, hp:220, maxHp:440, atk:500, def:500, spd:500, int:500, stamina:500, training:{{hpBonus:10,atkBonus:5,defBonus:4,spdBonus:3,intBonus:2,staminaBonus:1,chaBonus:6}}}};
const migrated = migrateBirdToBiologyStats(oldBird);
const unknown = {{species:'Unknown Legacy Bird',hp:77,maxHp:88}};
console.log(JSON.stringify({{migrated, unknown:migrateBirdToBiologyStats(unknown)}}));
"""
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    bird = payload["migrated"]
    assert bird["biologyStatsVersion"] == "bird-biology-runtime-v2-20260715"
    assert bird["maxHp"] == 106  # biology 80 * level 1.2, plus 10 trained HP
    assert bird["hp"] == 53      # preserves the prior 50% health ratio
    assert bird["atk"] == 41     # biology 30 * level 1.2, plus 5 trained ATK
    assert bird["int"] == 98     # biology 80 * level 1.2, plus 2 trained INT
    assert payload["unknown"] == {"species": "Unknown Legacy Bird", "hp": 77, "maxHp": 88}
    assert "b = migrateBirdToBiologyStats(b);" in source
