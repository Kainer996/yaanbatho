"""release-polish-v342-20260901 — the pre-release polish pass.

Yaan's ask, days before release: fix bugs, glitches, overlapping icons,
icons that make no sense, stale quest and tutorial copy, and rough edges.
The biggest single ask by name: tapping Build at the Academy must carry the
player to the tree instead of leaving them to scroll up.

What this suite pins:
- The Academy build flow scrolls to the tree (2D) or builds at once (3D).
- Merlin's perch never covers controls: it hides on the screens whose
  top-right corner belongs to the game (Empire's LEDGER, the arena record,
  a room's Back button, the hall ledgers).
- The dock's Scan label stays on screen (the 46px lens pushed it off).
- The scan waveform box only shows while the microphone is open.
- The photo viewer's CLOSE button is wired (it threw ReferenceError).
- Stale copy is gone: the Roost, the Academy "tavern", "Explore Quests",
  battle "charm", quests that said Discover but meant Recruit, the diary
  and story copy that skipped the Town tier.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")
OWN = "release-polish-v342-20260901"


# ---- release plumbing -------------------------------------------------------

def test_build_id_and_cache_segment():
    # v343 shipped after us: the build id moved on, the cache lineage keeps us.
    assert "const BURBZ_BUILD = '" in HTML
    # Membership, never the tail — the next release appends after us.
    assert OWN in SW


def test_edited_cores_rolled_their_pins_everywhere():
    for core in ("walking_story_core.js", "merlin_companion_core.js", "diary_core.js"):
        pin = f"{core}?v={OWN}"
        assert pin in HTML, core
        assert pin in SW, core
        assert re.search(re.escape(core) + r"\?v=(?!" + re.escape(OWN) + ")", SW) is None, (
            core + " still carries an old pin somewhere in sw.js")


# ---- the Academy build flow -------------------------------------------------

def test_build_button_carries_the_player_to_the_tree():
    assert "function academyScrollToTree()" in HTML
    start = HTML.index("function academyStartPlaceBuilding(")
    body = HTML[start:HTML.index("\nfunction ", start + 10)]
    assert "academyScrollToTree()" in body
    # In 3D every building keeps its own branch: build at once, no dead tap.
    assert "academyViewMode() === '3d'" in body
    assert "academyBuildBuilding(id)" in body


def test_the_build_button_says_build():
    assert "(placing ? 'Tap tree' : 'Build')" in HTML
    assert "(placing ? 'Tap tree' : 'Place')" not in HTML


def test_tutorial_teaches_the_build_button_by_its_new_name():
    assert "Tap Build on the Barracks" in HTML
    assert "Tap Place on the Barracks" not in HTML


# ---- Merlin's perch stays off the controls ----------------------------------

def test_perch_hides_where_the_corner_belongs_to_the_game():
    for screen in ("village", "battle", "academy-room", "town", "region", "county"):
        assert f'body[data-active-screen="{screen}"] .merlin-perch-assembly' in HTML, screen
    rule_at = HTML.index('body[data-active-screen="village"] .merlin-perch-assembly')
    block = HTML[rule_at:HTML.index("}", rule_at)]
    assert "display: none" in block


def test_merlin_rig_loads_by_relative_path():
    sprite = re.search(r'<button class="pet-sprite" id="petSprite".*?</button>', HTML, re.S).group(0)
    assert 'src="assets/merlin/merlin-body.webp"' in sprite
    assert "/burbz/assets/merlin/" not in HTML


# ---- the dock island --------------------------------------------------------

def test_scan_icon_matches_its_neighbours_so_its_label_stays_on_screen():
    rule = re.search(r"\.nav-scan \.nav-icon \{([^}]*)\}", HTML).group(1)
    assert "width: 38px" in rule and "height: 38px" in rule
    anchor_rule = re.search(r"\.bottom-dock-anchor \.nav-scan \.nav-icon \{([^}]*)\}", HTML).group(1)
    assert "width: 38px" in anchor_rule
    island = re.search(r"\.bottom-dock-anchor \{([^}]*)\}", HTML).group(1)
    assert "height: var(--dock-row)" in island


# ---- the scan waveform ------------------------------------------------------

def test_waveform_only_shows_while_listening():
    rule = re.search(r"\.scan-waveform \{([^}]*)\}", HTML).group(1)
    assert "display: none" in rule
    assert ".scan-waveform.show { display: block; }" in HTML
    assert "$('waveformContainer')?.classList.toggle('show', active);" in HTML


# ---- wiring -----------------------------------------------------------------

def test_photo_viewer_close_button_is_exported():
    export = re.search(r"Object\.assign\(window, \{ academyBuildBuilding.*?\}\);", HTML, re.S).group(0)
    assert "closePlayerBirdPhotoViewer" in export


def test_tutorial_back_press_guard_and_qualified_errand_event():
    back = HTML[HTML.index("function handleBurbzBackPress()"):]
    back = back[:back.index("\nfunction ", 10)]
    assert "merlinTutActive" in back
    assert "burbzTutorialAction('expedition-sent:' + quest.templateId);" in HTML
    assert "event:'expedition-sent:merlin_first_flight'" in HTML


def test_full_replay_skips_the_town_hall_without_a_town():
    assert "chapterId !== 'town'" in HTML
    assert "currentTownSettlement === 'function' && currentTownSettlement()" in HTML


# ---- stale copy is gone -----------------------------------------------------

def test_the_roost_and_other_ghosts_left_the_copy():
    assert "Enough timber for The Roost" not in HTML
    assert "needs The Roost" not in HTML
    assert "Academy tavern afterwards" not in HTML
    assert "open Explore Quests" not in HTML
    assert "'Fight or charm'" not in HTML
    assert "Real birdwatching restores the Kingdom of Burbz" in HTML


def test_quests_say_recruit_when_they_mean_recruit():
    for phrase in ("Recruit 3 birds today", "Recruit any bird", "Recruit 10 birds this week",
                   "Recruit a Rare or better bird", "Recruit 10 unique species",
                   "Recruit a Legendary bird", "'First Recruit'"):
        assert phrase in HTML, phrase


def test_every_errand_has_an_authored_board_line():
    info = HTML[HTML.index("const QUEST_TEMPLATE_INFO = {"):]
    info = info[:info.index("};")]
    assert "ingot_pour:" in info and "envoy_parley:" in info


def test_market_hall_stopped_being_a_24_hour_convenience_store():
    assert "🏪" not in HTML
    assert "icon: '⛺', name: 'Market Hall'" in HTML


# ---- the cores' copy matches the shipped progression ------------------------

def test_walking_stories_teach_the_town_tier():
    story = (ROOT / "walking_story_core.js").read_text(encoding="utf-8")
    assert "a town rises" in story and "a county rises" not in story
    assert "found a TOWN" in story and "found a COUNTY" not in story
    assert "Aviary Gardens" not in story
    assert "the first town moot" in story


def test_merlin_tips_match_the_living_game():
    tips = (ROOT / "merlin_companion_core.js").read_text(encoding="utf-8")
    assert "Hospital and Roost" not in tips
    assert "Liberation Battles free villages" in tips


def test_diary_frees_villages_not_towns():
    diary = (ROOT / "diary_core.js").read_text(encoding="utf-8")
    assert "'the village'" in diary
    assert "' village' + (t.towns === 1" in diary
    assert "village freed and trail walked" in HTML


def test_story_canon_carries_the_shipped_numbers():
    story_md = (ROOT / "STORY.md").read_text(encoding="utf-8")
    assert "16 folk" in story_md and "40 folk" not in story_md
    assert "rest free in the tree" in story_md
