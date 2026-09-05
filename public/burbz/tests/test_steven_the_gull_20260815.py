"""Steven, the Rook Witch and the Market Magpie are special characters.

An Easter egg, by request. Any Herring Gull that joins the flock arrives
already answering to Steven, and gulls recruited before this release pick
the name up on the next load — local save and cloud save alike. A player
can still rename their gull to anything they like; only the empty default
belongs to Steven. Clearing the name hands it straight back, because a
Herring Gull was always Steven underneath.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
ROOK_WITCH_ART = ROOT / "bird-art-cache" / "rook_witch_blackfeather_hex_burbz_manga_20260904.png"

CURRENT_BUILD = "painted-forge-anvil-v351-20260905"
PREVIOUS_RELEASE_PIN = "steven-the-gull-v270-20260815"


def _fn(html: str, name: str) -> str:
    start = html.index("function " + name)
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


def _harness(html: str) -> str:
    """Create birds and resolve special characters with tiny game-glue stubs."""
    return "\n".join([
        "function findSpeciesProfile() { return null; }",
        "function determineBirdRarity() { return 'common'; }",
        "function generateBirdStats() { return { hp: 100 }; }",
        "function resolveBuiltInBirdArt() { return null; }",
        "function defaultBirdCare() { return {}; }",
        "function hashStr() { return 1; }",
        "function escapeHtml(value) { return String(value ?? ''); }",
        "const BIRD_BIOLOGY_STATS_VERSION = 1;",
        _fn(html, "specialBirdCharacterFor"),
        _fn(html, "applySpecialBirdCharacter"),
        _fn(html, "specialBirdCharacterBadgeHTML"),
        _fn(html, "specialBirdCharacterPanelHTML"),
        _fn(html, "easterEggBirdName"),
        _fn(html, "applyEasterEggBirdName"),
        _fn(html, "createBirdEntry"),
        _fn(html, "birdNickname"),
    ])


def run_node(script: str) -> dict:
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_release_is_pinned_and_reaches_players():
    html = HTML.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in SW.read_text(encoding="utf-8").splitlines() if "const BURBZ_CACHE" in line)
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)  # this fix reaches players


def test_a_new_herring_gull_is_already_called_steven():
    html = HTML.read_text(encoding="utf-8")
    out = run_node(_harness(html) + """
const gull = createBirdEntry('Herring Gull', 'Larus argentatus', 0.9);
const euro = createBirdEntry('European Herring Gull', 'Larus argentatus', 0.9);
const robin = createBirdEntry('Robin', 'Erithacus rubecula', 0.9);
console.log(JSON.stringify({
  gull: birdNickname(gull),
  euro: birdNickname(euro),
  robin: birdNickname(robin)
}));
""")
    assert out["gull"] == "Steven"
    assert out["euro"] == "Steven"  # any herring gull, whatever the prefix
    assert out["robin"] == ""        # everyone else stays nameless by default


def test_steven_and_the_rook_witch_are_real_special_characters():
    html = HTML.read_text(encoding="utf-8")
    out = run_node(_harness(html) + """
const gull = createBirdEntry('Herring Gull', 'Larus argentatus', 0.9);
const rook = createBirdEntry('Rook', 'Corvus frugilegus', 0.9);
const robin = createBirdEntry('Robin', 'Erithacus rubecula', 0.9);
console.log(JSON.stringify({
  gull: { name: gull.customName, id: gull.specialCharacterId, move: gull.specialMove },
  rook: { name: rook.customName, id: rook.specialCharacterId, move: rook.specialMove, magic: rook.specialMagicPower, stat: rook.mag },
  robin: { id: robin.specialCharacterId || null },
  rookBadge: specialBirdCharacterBadgeHTML(rook),
  rookPanel: specialBirdCharacterPanelHTML(rook)
}));
""")
    assert out["gull"] == {
        "name": "Steven",
        "id": "steven-herring-gull",
        "move": "Chip Raid",
    }
    assert out["rook"] == {
        "name": "The Rook Witch",
        "id": "rook-witch",
        "move": "Blackfeather Hex",
        "magic": 118,
        "stat": 118,
    }
    assert out["robin"]["id"] is None
    assert "SPECIAL CHARACTER" in out["rookBadge"]
    assert "Witch" in out["rookBadge"]
    assert "The Rook Witch" in out["rookPanel"]
    assert "Magic power: 118" in out["rookPanel"]


def test_the_market_magpie_is_a_real_special_character():
    html = HTML.read_text(encoding="utf-8")
    out = run_node(_harness(html) + """
const magpie = createBirdEntry('Magpie', 'Pica pica', 0.9);
const australian = createBirdEntry('Australian Magpie', 'Gymnorhina tibicen', 0.9);
console.log(JSON.stringify({
  magpie: {
    name: magpie.customName,
    id: magpie.specialCharacterId,
    role: magpie.specialCharacterRole,
    move: magpie.specialMove
  },
  australian: australian.specialCharacterId || null,
  badge: specialBirdCharacterBadgeHTML(magpie),
  panel: specialBirdCharacterPanelHTML(magpie)
}));
""")
    assert out["magpie"] == {
        "name": "The Market Magpie",
        "id": "market-magpie",
        "role": "Marketplace Maestro",
        "move": "Shiny Snatch",
    }
    assert out["australian"] is None
    assert "SPECIAL CHARACTER" in out["badge"]
    assert "triples its effectiveness" in out["panel"]


def test_the_rook_witch_has_her_own_full_card_painting():
    html = HTML.read_text(encoding="utf-8")
    art_url = "/burbz/bird-art-cache/rook_witch_blackfeather_hex_burbz_manga_20260904.png"
    card_map = html[html.index("const BUILT_IN_BIRD_CARD_ART = Object.freeze({"):]
    card_map = card_map[:card_map.index("});")]
    assert f"'Rook': '{art_url}'" in card_map
    assert ROOK_WITCH_ART.exists()
    # Real generated PNG, never an unhydrated Git LFS pointer.
    assert ROOK_WITCH_ART.read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
    assert ROOK_WITCH_ART.stat().st_size > 1_000_000


def test_special_character_names_are_added_to_old_saves_but_player_names_win():
    html = HTML.read_text(encoding="utf-8")
    out = run_node(_harness(html) + """
const oldRook = applySpecialBirdCharacter({ commonName: 'Rook' });
const namedRook = applySpecialBirdCharacter({ commonName: 'Rook', customName: 'Morgana', mag: 140 });
const scientificOnly = applySpecialBirdCharacter({ scientificName: 'Larus argentatus' });
console.log(JSON.stringify({ oldRook, namedRook, scientificOnly }));
""")
    assert out["oldRook"]["customName"] == "The Rook Witch"
    assert out["namedRook"]["customName"] == "Morgana"
    assert out["namedRook"]["specialCharacterId"] == "rook-witch"
    assert out["oldRook"]["mag"] == 118
    assert out["namedRook"]["mag"] == 140
    assert out["scientificOnly"]["customName"] == "Steven"


def test_special_characters_have_matching_battle_signatures():
    out = run_node("""
const core = require('./battle_core.js');
const rook = core.signatureFor('Rook', 'corvid');
console.log(JSON.stringify({
  rook: { label: rook.label, power: rook.power, aoe: rook.aoe, crShred: rook.crShred, debuff: rook.rider },
  gull: core.signatureFor('Herring Gull', 'seabird').label
}));
""")
    assert out == {
        "rook": {
            "label": "Blackfeather Hex",
            "power": 118,
            "aoe": True,
            "crShred": 0.2,
            "debuff": {"kind": "debuff", "stat": "def", "pct": 0.3, "turns": 3},
        },
        "gull": "Chip Raid",
    }


def test_a_players_own_name_for_their_gull_is_respected():
    html = HTML.read_text(encoding="utf-8")
    out = run_node(_harness(html) + """
const dave = applyEasterEggBirdName({ commonName: 'Herring Gull', customName: 'Dave' });
const blank = applyEasterEggBirdName({ commonName: 'Herring Gull', customName: '  ' });
const crow = applyEasterEggBirdName({ commonName: 'Carrion Crow' });
console.log(JSON.stringify({ dave: dave.customName, blank: blank.customName, crow: crow.customName || null }));
""")
    assert out["dave"] == "Dave"      # a chosen name always wins
    assert out["blank"] == "Steven"  # whitespace is not a name
    assert out["crow"] is None


def test_existing_saves_meet_steven_on_load():
    html = HTML.read_text(encoding="utf-8")
    # Local saves: the loadState flock migration sweep.
    load_start = html.index("function loadState()")
    load = html[load_start:html.index("function saveState", load_start)]
    assert "gameState.flock.forEach(applySpecialBirdCharacter)" in load
    # Cloud saves: mergeCloudState runs the same sweep.
    merge_start = html.index("function mergeCloudState(")
    merge = html[merge_start:html.index("async function loadCloudProgress", merge_start)]
    assert "applySpecialBirdCharacter(b)" in merge


def test_clearing_a_gulls_name_hands_it_straight_back():
    html = HTML.read_text(encoding="utf-8")
    rename_start = html.index("function renameCompanionBird(")
    rename = html[rename_start:html.index("function birdBondCore(", rename_start)]
    assert "const eggName = !clean && easterEggBirdName(bird);" in rename
    assert "if (eggName) bird.customName = eggName;" in rename
    assert "No use. Every Herring Gull is Steven." in rename

def test_the_birdex_discovered_card_shows_the_name_before_recruiting():
    html = HTML.read_text(encoding="utf-8")
    # The DISCOVERED card renders the nickname line, and its bird comes from
    # createBirdFromDiscovery -> createBirdEntry, which names the gull.
    card_start = html.index("function createKnownSpeciesCardHTML(")
    card = html[card_start:html.index("DISCOVERED", card_start) + 2000]
    assert 'card-nickname">${escapeHtml(birdNickname(bird))}' in card
    assert "createKnownSpeciesCardHTML(createBirdFromDiscovery(row.discoveredRecord)" in html
