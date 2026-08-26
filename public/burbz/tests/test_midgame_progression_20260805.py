"""Mid-game progression: buildings unlock across trainer levels, not all at once.

Before this release the whole Academy was open by trainer level 8 (three rooms
at level 1, the rest packed into 2-8) and NOTHING in the game gated on player
level afterwards. Now the curve is a slow burn: the tutorial trio stays at
level 1, the teaching rooms arrive one per level, and the four specialist
rooms are spaced out to trainer level 12. Village growth halls (Cottage Row,
Alehouse, Chapel, Market Hall) gate on trainer levels 5-10, every level-up
pays a construction grant, and the level-up celebration names what it just
unlocked so a level always means something concrete.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
MIDGAME_RELEASE = "midgame-progression-v227-20260805"
ACADEMY_CORE_PIN = "roost-retired-v302-20260820"
CURRENT_BUILD = "field-any-bird-v330-20260826"
# magpie-market-v316 edited this core, so it ships under that tag now.
ACADEMY_CORE_PIN = "iron-ingot-errand-v326-20260825"

# The intended curve, in full. A change to any gate is a design decision and
# should be made here on purpose, not slip through by accident.
ACADEMY_UNLOCKS = {
    "outdoors": 1,
    "tavern": 1,
    "training": 2,
    "quest_roost": 3,
    "kitchen": 4,
    # magpie-market-v316: trade is the fifth room on the ladder, so the
    # Hospital and The Crowbar each slipped one gate to make room.
    "magpie_market": 5,
    "hospital": 6,
    "crowbar": 7,
    "workshop": 8,
    "library": 9,
    "nursery": 11,
    "observatory": 12,
}
# The Entertainment House and the Iron Foundry joined the list with the towns-3D
# release and carry their own gates; the pin had not been told.
EMPIRE_UNLOCKS = {
    "storehouse": 4,
    "cottages": 5,
    "tavern": 6,
    "entertainment": 7,
    "chapel": 8,
    "foundry": 9,
    "market": 10,
}
EMPIRE_ALWAYS_OPEN = {"farm", "well", "lumber", "quarry"}


def _node_json(source: str):
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def _function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start, name
    return html[start:end]


def _academy_rooms():
    return _node_json(
        "const core=require('./academy_treehouse_core.js');"
        "console.log(JSON.stringify(core.getAcademyRooms()));"
    )


def test_academy_unlocks_span_the_mid_game_exactly_as_designed():
    by_id = {room["id"]: room for room in _academy_rooms()}
    assert {rid: room["unlockLevel"] for rid, room in by_id.items()} == ACADEMY_UNLOCKS
    # A slow burn, not a sprint: the last unlock is a real mid-game goal and no
    # level above 1 opens more than one Academy room at once.
    assert max(ACADEMY_UNLOCKS.values()) >= 12
    later_levels = [lv for lv in ACADEMY_UNLOCKS.values() if lv > 1]
    assert len(later_levels) == len(set(later_levels))


def test_room_costs_climb_with_their_unlock_levels():
    # Every later unlock level is also a bigger savings goal: the cheapest room
    # of each level costs at least as much as the priciest room below it.
    rooms = [r for r in _academy_rooms() if r["id"] != "outdoors"]
    by_level = {}
    for room in rooms:
        by_level.setdefault(room["unlockLevel"], []).append(room["cost"])
    levels = sorted(by_level)
    for lower, higher in zip(levels, levels[1:]):
        assert min(by_level[higher]) >= max(by_level[lower]), (lower, higher)


def test_story_chain_asks_for_buildings_in_unlock_order():
    html = HTML_PATH.read_text(encoding="utf-8")
    chain = html[html.index("const PLAYER_QUESTS = [") : html.index("function activePlayerQuest()")]
    build_ids = re.findall(r"type:'build_(\w+)'", chain)
    gates = [ACADEMY_UNLOCKS[bid] for bid in build_ids]
    assert gates == sorted(gates), list(zip(build_ids, gates))


def test_level_ups_pay_a_construction_grant_on_every_xp_path():
    html = HTML_PATH.read_text(encoding="utf-8")
    source = "\n".join(
        _function_source(html, name)
        for name in ("playerLevelUpGrant", "applyPlayerXpState")
    )
    result = _node_json(
        """
const XP_PER_LEVEL = (lv) => Math.floor(80 + lv * 40 + Math.pow(lv, 1.5) * 10);
let gameState = { player: { level: 1, xp: 0, coins: 0, branches: 0 } };
""" + source + """
const leveled = applyPlayerXpState(330);   // enough for level 1 -> 3
const after = { ...gameState.player };
const flat = applyPlayerXpState(1);        // no level: no grant
console.log(JSON.stringify({ leveled, after, flat, finalCoins: gameState.player.coins }));
"""
    )
    assert result["leveled"] is True
    assert result["after"]["level"] == 3
    # Grant is per level gained: (20+2*5)+(20+3*5) coins, (4+2*2)+(4+3*2) timber.
    assert result["after"]["coins"] == 65
    assert result["after"]["branches"] == 18
    assert result["flat"] is False and result["finalCoins"] == 65


def test_level_up_celebration_names_what_it_unlocked():
    html = HTML_PATH.read_text(encoding="utf-8")
    announce = _function_source(html, "announcePlayerLevelUps")
    assert "academyUnlocksAtLevel" in announce
    assert "empireUnlocksAtLevel" in announce
    assert "NEW BUILDING" in announce
    # A level that opens nothing still points at the next goal on the horizon.
    assert "nextAcademyUnlock" in announce
    # Both the direct and the batched XP paths celebrate through it.
    assert "announcePlayerLevelUps(previousLevel)" in _function_source(html, "addPlayerXp")
    assert "announcePlayerLevelUps(previousPlayerLevel)" in _function_source(html, "claimBirdExpedition")


def test_village_growth_halls_gate_on_trainer_level_but_survival_never_does():
    html = HTML_PATH.read_text(encoding="utf-8")
    block = html[html.index("const EMPIRE_BUILDINGS = [") : html.index("const EMPIRE_BUILDING_INDEX")]
    gates = {}
    for line in block.splitlines():
        m = re.search(r"\{ id: '(\w+)',", line)
        if not m:
            continue
        lock = re.search(r"unlockLevel: (\d+)", line)
        gates[m.group(1)] = int(lock.group(1)) if lock else None
    assert {k: v for k, v in gates.items() if v} == EMPIRE_UNLOCKS
    # Food, water, timber and stone must stay ungated or a fresh province
    # could never bootstrap its economy.
    assert all(gates[bid] is None for bid in EMPIRE_ALWAYS_OPEN)

    build_fn = _function_source(html, "empireBuildStructure")
    assert "trainerLevel < unlockLevel" in build_fn
    # Only NEW structures gate; anything an old save built may still upgrade.
    assert "level === 0 && trainerLevel < unlockLevel" in build_fn
    # And the desk shows the lock instead of a dead buy button.
    assert "UNLOCKS AT TRAINER LV" in html


def test_release_is_query_busted_everywhere():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    assert f'academy_treehouse_core.js?v={ACADEMY_CORE_PIN}' in html
    assert f"./academy_treehouse_core.js?v={ACADEMY_CORE_PIN}" in sw
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert MIDGAME_RELEASE in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
