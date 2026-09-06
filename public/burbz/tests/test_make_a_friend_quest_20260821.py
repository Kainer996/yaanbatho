"""The sixth player quest stays indoors.

Yaan, from his phone: "Grow the Burbz book" — discover five different species
with Scan — sat sixth in the chain, right after the first recruit. Five wild
birds is a long walk to ask for that early, and it stalls a player who cannot
get out. It is replaced by "Make a friend": preen the companion you just took
in and grow the bond between you. Nothing to leave the house for, and it
teaches the bond ritual the chain never covered.

The Burbz book still grows later — "Budding ornithologist" at ten species
keeps the collecting goal for a player who has been out in the world.
"""
import json
import subprocess
from pathlib import Path

BURBZ = Path(__file__).resolve().parents[1]
HTML_PATH = BURBZ / "index.html"
HTML = HTML_PATH.read_text(encoding="utf-8")
SW = (BURBZ / "sw.js").read_text(encoding="utf-8")

RELEASE_PIN = "woodland-ui-polish-v352-20260906"
OWN_RELEASE_PIN = "make-a-friend-v305-20260821"

INDOOR_GO = {"academy", "birdex", "battle", "forge", "quests", "inventory"}


def player_quests():
    start = HTML.index("const PLAYER_QUESTS = [")
    end = HTML.index("\n];", start) + 3
    source = HTML[start:end] + "\nconsole.log(JSON.stringify(PLAYER_QUESTS));"
    result = subprocess.run(
        ["node", "-e", source], cwd=BURBZ, text=True, encoding="utf-8", capture_output=True
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_the_five_species_link_is_gone_from_the_chain():
    ids = [q["id"] for q in player_quests()]
    assert "pq_species_5" not in ids
    assert "pq_species_5" not in HTML


def test_make_a_friend_takes_its_place_right_after_the_first_diet():
    quests = player_quests()
    ids = [q["id"] for q in quests]
    assert ids.index("pq_preen") == ids.index("pq_true_diet") + 1
    assert ids.index("pq_preen") == ids.index("pq_build_training") - 1
    # One swapped, none lost — the length only ever moves when links are
    # deliberately added, as village-chain-v307 did at the far end and the
    # Magpie Market did in the middle.
    assert len(quests) == 37

    quest = next(q for q in quests if q["id"] == "pq_preen")
    assert quest["name"] == "Make a friend"
    assert quest["type"] == "bird_preened"
    assert quest["target"] == 1
    assert quest["go"] == "birdex"


def test_every_link_before_the_walk_can_be_done_indoors():
    # Scan needs a real bird outside, and the map needs a real walk. Neither
    # may gate the early chain: the first outdoor ask is the first bird, and
    # after that the player stays in until "Go for a walk".
    quests = player_quests()
    ids = [q["id"] for q in quests]
    early = quests[ids.index("pq_first_bird") + 1:ids.index("pq_walk_adventure")]
    for quest in early:
        assert quest["go"] in INDOOR_GO, (quest["id"], quest["go"])


def test_the_burbz_book_still_grows_later_in_the_chain():
    quests = player_quests()
    book = next(q for q in quests if q["id"] == "pq_species_10")
    assert book["type"] == "discover" and book["target"] == 10
    ids = [q["id"] for q in quests]
    assert ids.index("pq_species_10") > ids.index("pq_walk_adventure")


def test_a_preen_moves_the_quest_the_moment_it_lands():
    body = HTML[HTML.index("function preenBird(birdId)"):HTML.index("function discoveredSpeciesRecords()")]
    # Only a preen that actually happened counts — the cooldown path returns
    # before the event fires.
    assert body.index("if (!result.ok)") < body.index("updateQuestProgress('bird_preened', 1)")
    assert "updateQuestProgress('bird_preened', 1);" in body


def test_the_goal_completes_from_saved_state_when_its_turn_comes():
    # A player who preened before reaching this link finds it already done.
    line = HTML[HTML.index("{ id:'pq_preen',"):HTML.index("{ id:'pq_build_training',")]
    assert "b.bond && Number(b.bond.preens)" in line


def test_release_stamp_reaches_runtime_and_service_worker():
    assert f"const BURBZ_BUILD = '{RELEASE_PIN}';" in HTML
    assert RELEASE_PIN in SW
    assert OWN_RELEASE_PIN in SW  # lineage kept
