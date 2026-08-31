"""The first law of the canon (burbz-zombie-canon-v291): Burbz names the
enemy, and the Z is for zombie.

Yaan's law, written into the game: the Burbz are the usurper's zombie flock —
dead bird-shapes raised by shadow magic — and they have taken over the
kingdom. The game bears their name because saving the world from the Burbz is
the task. The player's own birds are never Burbz: they are living birds and
companions. The tone stays non-gory: beaten Burbz are dispelled and laid back
to rest, never harmed as living things.
"""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
STORY = ROOT / "STORY.md"
AGENTS = ROOT / "AGENTS.md"
SW = ROOT / "sw.js"
OWN_RELEASE_PIN = "forge-opens-on-the-anvil-v323-20260825"
CURRENT_BUILD = "gentle-start-v338-20260831"


def test_release_is_wired():
    html = HTML.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    sw = SW.read_text(encoding="utf-8")
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert OWN_RELEASE_PIN in cache_line  # this canon's own segment, kept for ever
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)


def test_story_opens_with_the_first_law():
    story = STORY.read_text(encoding="utf-8")
    law = story.index("## The first law — the name of the enemy")
    # The law leads the canon: it stands before every other section.
    assert law < story.index("## The two worlds")
    assert "The Z is for zombie" in story
    assert "save the world from the Burbz" in story
    assert "The player's own birds are never Burbz" in story


def test_the_enemy_is_a_zombie_flock_in_the_enemies_section():
    story = STORY.read_text(encoding="utf-8")
    section = story[story.index("## The evil Burbz — the enemies the birds fight"):]
    section = section[:section.index("\n## ", 10)]
    assert "the Z is for zombie" in section
    assert "zombies raised by the usurper's shadow magic" in section
    # The zombie law never touches the moral frame: nothing living is harmed.
    assert "laid back to rest" in section
    assert "never injury or death" in section


def test_terminology_reserves_the_name_for_the_enemy():
    story = STORY.read_text(encoding="utf-8")
    terms = story[story.index("## Canon terminology"):]
    assert "the Z is for zombie" in terms
    assert "for them and for nothing else" in terms
    # The older canon markers other suites pin must survive the rewrite.
    for marker in (
        "squads of evil Burbz",
        "never against free, ordinary birds",
        "No town is destroyed",
    ):
        assert marker in story, marker


def test_agents_handbook_carries_the_name_law():
    agents = AGENTS.read_text(encoding="utf-8")
    assert "The name law (first law of the canon)" in agents
    assert "the Z is for zombie" in agents


def test_the_battle_tutorial_teaches_the_law():
    # The em dash is stored as an escape (\\u2014) in the tutorial strings, so
    # the pin checks the phrases either side of it. The whole step must stay
    # glance-readable (the tutorial suite caps steps at 150 characters).
    html = HTML.read_text(encoding="utf-8")
    assert "The Burbz are zombie birds" in html
    assert "the Z is for zombie." in html
    assert "You only fight them, never free living birds." in html


def test_player_birds_are_never_called_burbz_in_copy():
    html = HTML.read_text(encoding="utf-8")
    # The old bird-card fallback claimed captured birds for the enemy's name.
    assert "your Burbz collection" not in html
    assert "flies with your free flock" in html
