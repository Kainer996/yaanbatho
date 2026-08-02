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
    battle = battle_logic(html)
    tutorial = html[html.index("const MERLIN_TUTORIAL_STEPS = ["):html.index("\n];", html.index("const MERLIN_TUTORIAL_STEPS = ["))]
    assert "free the town" in tutorial
    assert "Liberation Battle" in tutorial
    assert "liberationFriendlyBattleText" in battle
    assert "loses $1 resolve" in battle
    assert "destroy the town" not in tutorial.lower()


def test_liberation_battle_has_story_context_in_team_select_and_arena():
    html = HTML.read_text(encoding="utf-8")
    assert 'id="liberationBattleBanner"' in html
    battle = battle_logic(html)
    assert "LIBERATE " in battle
    assert "shadow-bound occupying flock" in battle
    assert "break the usurper's hold" in battle.replace("\\'", "'")


def test_liberation_battle_removes_league_chrome_and_reaches_the_playable_arena():
    html = HTML.read_text(encoding="utf-8")
    battle_screen = html[html.index('id="screen-battle"'):html.index('id="screen-academy"')]
    battle = battle_logic(html)
    start = battle[battle.index("function startPerchBattle("):battle.index("\nfunction hpBarColor", battle.index("function startPerchBattle("))]

    assert '<div class="screen-title">PERCH LEAGUE</div>' not in battle_screen
    assert "leagueHeader.hidden = !!liberation" in battle
    # Setting .hidden is not enough on its own: .league-header carries an author
    # display:flex, which beats the UA sheet's [hidden]{display:none}. Without
    # this rule the Garden Perch tier card stays on screen over the town battle.
    assert ".league-header[hidden] { display:none; }" in html
    league_rule = html.index(".league-header {")
    assert html.index(".league-header[hidden]") > league_rule
    assert "PAUSE LIBERATION · PLAY PERCH LEAGUE" not in battle
    assert "applyTeamSynergies(playerFighters)" in start
    assert "applyTeamSynergies(opponentFighters)" in start
    assert "battle.synergies = { player: playerSynergies, opponent: opponentSynergies }" in start
    assert start.index("battle.synergies =") < start.index("battle.synergies.player")
    assert start.index("battle.synergies.player") < start.index("battleAdvance()")


def test_story_canon_connects_real_world_liberation_to_the_kingdom_of_burbz():
    story = STORY.read_text(encoding="utf-8")
    required = [
        "Kingdom of Burbz",
        "Merlin's spell-tablet",
        "liberate the real world",
        "usurper's shadow",
        "darkness lifts",
        "light green",
        "Liberation Battle",
        "travelling abroad",
        "No town is destroyed",
    ]
    for marker in required:
        assert marker in story
    assert "Bird Burbs" not in story
    assert "kingdom of birds" not in story


def test_tutorial_surfaces_liberation_story_without_repeating_it_on_empire_screen():
    html = HTML.read_text(encoding="utf-8")
    screen_start = html.index('id="screen-village"')
    screen_end = html.index('id="screen-quests"', screen_start)
    screen = html[screen_start:screen_end]
    tutorial = html[html.index("const MERLIN_TUTORIAL_STEPS = ["):html.index("\n];", html.index("const MERLIN_TUTORIAL_STEPS = ["))]
    assert 'class="empire-story-callout"' not in screen
    assert "Real birdwatching restores Burbz" in tutorial
    assert "Liberation Battle" in tutorial
