"""Arm the bird before its first fight, and never on an empty bag.

Yaan asked for an "equip a bird with an item" player quest. One already
existed — "Arm a companion" — but it sat behind "Win a battle" and carried a
quiet trap: a league win only drops gear about one time in five, so a player
could reach the link with nothing in the Stores and stall there. The same
dead end he had just hit on the five-species quest.

So the link moves ahead of the first battle (arm the bird, then fight), takes
Yaan's plain wording, and the Quest Roost above it now pays out a common pair
of Thorn Talons. Player quests can hand over gear at all now, which is how a
chain teaches a mechanic that needs an item without waiting on a loot roll.
"""
import json
import subprocess
from pathlib import Path

BURBZ = Path(__file__).resolve().parents[1]
HTML = (BURBZ / "index.html").read_text(encoding="utf-8")
SW = (BURBZ / "sw.js").read_text(encoding="utf-8")
LOOT_CORE = (BURBZ / "loot_crafting_core.js").read_text(encoding="utf-8")

RELEASE_PIN = "forge-opens-on-the-anvil-v321-20260825"
OWN_RELEASE_PIN = "arm-your-bird-v306-20260821"


def player_quests():
    start = HTML.index("const PLAYER_QUESTS = [")
    end = HTML.index("\n];", start) + 3
    source = HTML[start:end] + "\nconsole.log(JSON.stringify(PLAYER_QUESTS));"
    result = subprocess.run(
        ["node", "-e", source], cwd=BURBZ, text=True, encoding="utf-8", capture_output=True
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_the_equip_link_says_what_it_asks_for():
    quest = next(q for q in player_quests() if q["id"] == "pq_equip_gear")
    assert quest["name"] == "Equip a bird with an item"
    assert quest["desc"] == "Open the Forge and give a companion a piece of gear"
    assert quest["type"] == "gear_equipped"
    assert quest["go"] == "forge"


def test_the_bird_is_armed_before_its_first_battle():
    ids = [q["id"] for q in player_quests()]
    assert ids.index("pq_equip_gear") == ids.index("pq_build_quest_roost") + 1
    assert ids.index("pq_equip_gear") < ids.index("pq_first_win")
    # Still one chain with no duplicate ids; the length grew where
    # village-chain-v307 added its links, and again where the Magpie Market
    # added its build-and-trade pair — both well after this one.
    assert len(ids) == 34 == len(set(ids))


def test_the_roost_pays_the_gear_the_next_link_needs():
    quests = player_quests()
    roost = next(q for q in quests if q["id"] == "pq_build_quest_roost")
    assert roost["gear"] == {"thorn_talons": 1}
    # The payout is a real catalogue piece the Forge can fit.
    assert "thorn_talons:   { id:'thorn_talons',   slot:'weapon'" in LOOT_CORE


def test_a_player_quest_can_hand_over_gear():
    claim = HTML[HTML.index("function claimPlayerQuest(id)"):HTML.index("\nfunction renderPlayerQuests(")]
    assert "if (q.gear) grantLootDrops(" in claim
    assert "kind:'gear'" in claim
    # Only a claim pays out — an unclaimed link hands over nothing.
    assert claim.index("state.claimed = true;") < claim.index("if (q.gear)")


def test_the_card_names_the_gear_it_will_pay():
    card = HTML[HTML.index("const rewardBits = ['+' + active.reward + ' XP'];"):]
    card = card[:card.index("host.innerHTML =")]
    assert "active.gear" in card
    assert "item.icon + ' ' + item.label" in card


def test_release_stamp_reaches_runtime_and_service_worker():
    assert f"const BURBZ_BUILD = '{RELEASE_PIN}';" in HTML
    assert RELEASE_PIN in SW
    assert OWN_RELEASE_PIN in SW  # lineage kept
