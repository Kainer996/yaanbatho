"""At the bar you choose what the round does for your flock.

Yaan's ask, from The Wandering Perch: let players pick what they buy — one
round that fills every companion up, one that heals all HP, one beer that
lifts everyone's happiness. Before this, the bar poured a single Elderberry
Cordial that bundled HP and +20 happiness, and nothing at the bar could feed
a hungry flock at all.

This pins the menu and the rounds:

* five drinks — two boons that ride home on the banner (XP, coins) and three
  rounds poured on the spot for every companion in the flock;
* each round touches exactly one stat: Barleycorn Supper fills Fullness,
  Elderberry Cordial restores HP, Skylark Porter restores happiness;
* a round reaches every bird in the flock, not just the walker's lead bird;
* the one-round-per-quest gate still holds, and the flock rounds are marked
  in the sheet so the choice is obvious before you spend.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")


def drinks_block() -> str:
    start = HTML.index("const TRAIL_TAVERN_DRINKS = [")
    return HTML[start:HTML.index("];", start)]


def test_the_bar_offers_two_boons_and_three_rounds_for_the_flock():
    block = drinks_block()
    ids = re.findall(r"^  \{ id:'([a-z]+)'", block, re.M)
    assert ids == ["ale", "mead", "supper", "cordial", "porter"], ids
    # The two that ride home keep their banner boons.
    assert "xpMult:1.5" in block
    assert "tbCoinMult:2" in block
    # The three rounds each name a distinct whole-flock effect.
    for instant in ("flockFull", "flockHeal", "flockCheer"):
        assert f"instant:'{instant}'" in block, instant
    # The old bundled round is gone: no drink does HP and happiness at once.
    assert "flockRefresh" not in HTML


def test_each_round_changes_exactly_one_stat_across_the_whole_flock():
    start = HTML.index("const TAVERN_ROUNDS = {")
    rounds = HTML[start:HTML.index("\nfunction serveTavernRound(", start)]
    # Fullness round feeds through the tracked feeding path, not a raw poke.
    full = rounds[rounds.index("flockFull:"):rounds.index("flockHeal:")]
    assert "recordBirdFeedingRecovery(bird, 100," in full
    assert "hp" not in full.replace("hunger", "")  # it must not touch HP
    heal = rounds[rounds.index("flockHeal:"):rounds.index("flockCheer:")]
    assert "bird.hp = max" in heal
    assert "happiness" not in heal
    cheer = rounds[rounds.index("flockCheer:"):]
    assert "bird.care.happiness = 100" in cheer
    assert "bird.hp" not in cheer
    # Every round is served to the whole flock, one bird at a time.
    serve = HTML[HTML.index("function serveTavernRound("):]
    serve = serve[:serve.index("\n}")]
    assert "(gameState.flock || []).forEach(bird =>" in serve


def test_buying_a_round_keeps_the_one_per_quest_gate_and_names_the_flock():
    buy = HTML[HTML.index("function buyTrailTavernDrink("):]
    buy = buy[:buy.index("\n}")]
    # The gate: a quest that already bought a drink is refused outright.
    assert "quest.trailTavern.drinkBought) return;" in buy
    assert "serveTavernRound(drink.boon.instant)" in buy
    # A round poured for a content flock says so instead of faking an effect.
    assert "changed ? round.toast(changed) : round.none" in buy


def test_the_sheet_marks_which_drinks_reach_the_whole_flock():
    assert "🍺 Buy one round (one per quest)" in HTML
    assert "a round reaches every companion you walk with" in HTML
    assert 'tavern-drink-tag">WHOLE FLOCK' in HTML
    assert ".tavern-drink.for-flock" in HTML
