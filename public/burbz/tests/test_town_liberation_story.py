from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
STORY = ROOT / "STORY.md"


def empire_logic(html: str) -> str:
    start = html.index("// EMPIRE —")
    end = html.index("// ---- Scene state", start)
    return html[start:end]


def battle_logic(html: str) -> str:
    start = html.index("// BATTLE SYSTEM —")
    end = html.index("// PET COMPANION", start)
    return html[start:end]


def test_unclaimed_town_requires_a_liberation_battle_before_birdhouse():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    claim_start = logic.index("function claimCurrentVillage(")
    claim_end = logic.index("\nfunction renderVillageClaimBar", claim_start)
    claim = logic[claim_start:claim_end]
    assert "empireHasLiberationVictory" in claim
    assert "beginVillageLiberation" in claim
    assert claim.index("beginVillageLiberation") < claim.index("addCoins")
    assert "LIBERATION BATTLE" in logic
    assert "BUILD LIBERATION BIRDHOUSE" in logic
    assert "cancelEmpireLiberation" in logic
    assert "liberationCancelBtn" in html


def test_victory_records_liberation_and_returns_to_the_town():
    html = HTML.read_text(encoding="utf-8")
    battle = battle_logic(html)
    assert "pendingEmpireLiberation" in battle
    assert "completeEmpireLiberationVictory" in battle
    assert "TOWN LIBERATED!" in battle
    assert "RETURN TO" in battle
    assert "returnToLiberatedVillage" in battle


def test_malformed_pending_liberation_state_is_healed_before_rendering():
    html = HTML.read_text(encoding="utf-8")
    empire = empire_logic(html)
    assert "Array.isArray(empire.pendingLiberation)" in empire
    assert "validPendingLiberation" in empire
    assert "typeof pending.name !== 'string'" in empire


def test_liberation_battle_copy_uses_non_destructive_resolve_language():
    html = HTML.read_text(encoding="utf-8")
    empire = empire_logic(html)
    battle = battle_logic(html)
    assert "outmatch and free its shadow-bound occupying flock" in empire
    assert "liberationFriendlyBattleText" in battle
    assert "loses $1 resolve" in battle
    assert "⚔️ BEGIN LIBERATION BATTLE" not in empire


def test_liberation_battle_has_story_context_in_team_select_and_arena():
    html = HTML.read_text(encoding="utf-8")
    assert 'id="liberationBattleBanner"' in html
    battle = battle_logic(html)
    assert "LIBERATE " in battle
    assert "shadow-bound occupying flock" in battle
    assert "break the usurper's hold" in battle.replace("\\'", "'")


def test_story_canon_connects_real_world_liberation_to_the_kingdom_of_burbz():
    story = STORY.read_text(encoding="utf-8")
    required = [
        "Kingdom of Burbz",
        "Merlin's spell-tablet",
        "liberate the real world",
        "dark green",
        "light green",
        "Liberation Battle",
        "travelling abroad",
        "No town is destroyed",
    ]
    for marker in required:
        assert marker in story
    assert "Bird Burbs" not in story
    assert "kingdom of birds" not in story


def test_empire_screen_surfaces_the_liberation_story_to_players():
    html = HTML.read_text(encoding="utf-8")
    screen_start = html.index('id="screen-village"')
    screen_end = html.index('id="screen-quests"', screen_start)
    screen = html[screen_start:screen_end]
    assert 'class="empire-story-callout"' in screen
    assert "Kingdom of Burbz" in screen
    assert "liberated" in screen.lower()
