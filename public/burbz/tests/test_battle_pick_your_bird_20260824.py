"""Yaan's asks (2026-08-24), pinned as `battle-pick-your-bird-v314-20260824`:

> "During the battles can you have it so that the player can select which bird
> they want to use for the attack so they can use any bird at any time? Also
> have it so that the bird that is hit lights up and shakes slightly so the
> player knows which bird is taking damage, both on the enemy's side and the
> player's side please. Also when the player taps on the move that they are
> about to use and then taps on the bird that they are about to attack (the
> evil bird), have the health bar of the evil bird glow red to show how much
> damage will come off for that particular attack please."

**1. Send in any bird.** Turns are dealt by the Combat Readiness meter, so
"any bird at any time" needed a rule, not just a tap handler. The rule: the
turn is the resource and the player chooses who spends it. `substituteActor`
SWAPS readiness between the bird that came up and the bird sent in — nothing
is created or destroyed. Reset the substitute's meter instead and the ready
bird would still sit at 100, handing out an endless run of turns.

The turn's cooldown tick travels with it: `tickTurnCooldowns` records which
skills it moved so `untickTurnCooldowns` can hand them back, and swapping to
and fro never banks a free cooldown.

**2. The struck bird lights up and shakes**, on both sides. The shake class
already existed but was set on a card that `renderArena` replaced in the same
tick — the element died before a frame was ever painted, so the animation
never played. The card is marked during the event and lit *after* the
re-render.

**3. The aimed blow is drawn on the target's own health bar.** A white tick
marks where the bar will end and the slice to its right glows red, so a graze
and a killing blow look different at a glance. Only the bird actually being
aimed at glows; a move that hits the whole squad glows on all of them.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
BATTLE_CORE = ROOT / "battle_core.js"
UPDATER = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"

OWN_RELEASE_PIN = "battle-pick-your-bird-v314-20260824"
PREVIOUS_RELEASE_PIN = "bird-card-carry-charm-v313-20260824"
CURRENT_BUILD = "battle-pick-your-bird-v314-20260824"

# A squad with a wide speed spread, so a substitution really does move a turn
# between a sprinter and a plodder. HP is huge on purpose: nobody faints, so a
# run measures the turn meter and nothing else.
SQUAD = """
const core = require(%s);
const bird = (name, spd) => ({ id:name, commonName:name, species:name, level:5, spd,
  atk:40, def:50, int:50, mag:40, stamina:60, maxHp:1000000, hp:1000000, rarity:'common' });
const mk = b => core.buildFighter(b, {});
const newBattle = () => core.createBattle({
  playerFighters: [mk(bird('Swift', 95)), mk(bird('Slow', 20)), mk(bird('Mid', 55))],
  opponentFighters: [mk(bird('Rival A', 60)), mk(bird('Rival B', 40))],
  seed: 'pick-your-bird'
});
""" % json.dumps(str(BATTLE_CORE))


def run_node(source: str):
    result = subprocess.run(
        ["node", "-e", source],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
        timeout=180,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(source: str, name: str) -> str:
    start = source.index(f"function {name}(")
    end = source.find("\nfunction ", start + 10)
    if end == -1:
        end = len(source)
    return source[start:end]


def html_text() -> str:
    return HTML.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# 1. Sending in any bird — the rule, not just the tap
# ---------------------------------------------------------------------------

def test_the_core_offers_a_substitution_and_ships_it():
    core = BATTLE_CORE.read_text(encoding="utf-8")
    assert "function substituteActor(battle, index)" in core
    assert "substituteActor," in core  # exported
    exported = run_node(
        f"const c = require({json.dumps(str(BATTLE_CORE))});"
        "process.stdout.write(JSON.stringify(typeof c.substituteActor));"
    )
    assert exported == "function"


def test_readiness_is_swapped_never_granted():
    out = run_node(SQUAD + """
const b = newBattle();
core.tickToNextTurn(b);
const total = () => b.teams.player.reduce((s, f) => s + f.cr, 0);
const before = total();
const cameUp = b.acting.index;
const sentIn = [0, 1, 2].find(i => i !== cameUp);
const readinessBefore = { up: b.teams.player[cameUp].cr, in: b.teams.player[sentIn].cr };
core.substituteActor(b, sentIn);
process.stdout.write(JSON.stringify({
  conserved: Math.abs(total() - before) < 1e-9,
  substituteHoldsTheTurn: b.acting.index === sentIn && b.teams.player[sentIn].cr === readinessBefore.up,
  steppedAsideTookTheOther: b.teams.player[cameUp].cr === readinessBefore.in,
  readyWasFull: readinessBefore.up === 100
}));
""")
    assert out["readyWasFull"] is True
    assert out["conserved"] is True
    assert out["substituteHoldsTheTurn"] is True
    assert out["steppedAsideTookTheOther"] is True


def test_no_strategy_of_substitution_buys_extra_turns():
    """The greediest swapping must not shift the share of turns."""
    out = run_node(SQUAD + """
function share(strategy, turns) {
  const b = newBattle();
  let mine = 0, theirs = 0;
  for (let i = 0; i < turns; i++) {
    const t = core.tickToNextTurn(b);
    if (!t) break;
    if (t.side === 'player') {
      mine++;
      if (strategy !== 'none') {
        let pick = -1, best = strategy === 'greedy' ? -1 : Infinity;
        b.teams.player.forEach((f, i2) => {
          if (i2 === b.acting.index || f.fainted) return;
          if (strategy === 'greedy' ? f.cr > best : f.cr < best) { best = f.cr; pick = i2; }
        });
        if (pick >= 0) core.substituteActor(b, pick);
      }
    } else theirs++;
    const foe = t.side === 'player' ? 'opponent' : 'player';
    core.resolveAction(b, { skillIndex: 0, targetIndex: core.livingFighters(b, foe)[0].i });
  }
  return mine / (mine + theirs);
}
process.stdout.write(JSON.stringify({
  none: share('none', 4000), greedy: share('greedy', 4000), slowest: share('slowest', 4000)
}));
""")
    # Total readiness is conserved, so over a long run the share cannot drift.
    assert abs(out["greedy"] - out["none"]) < 0.005, out
    assert abs(out["slowest"] - out["none"]) < 0.005, out


def test_the_turns_cooldown_tick_travels_with_the_turn():
    out = run_node(SQUAD + """
const b = newBattle();
b.teams.player.forEach(f => f.skills.forEach(s => { s.cdLeft = 3; }));
core.tickToNextTurn(b);
const cd = i => b.teams.player[i].skills.map(s => s.cdLeft);
const cameUp = b.acting.index;
const other = [0, 1, 2].find(i => i !== cameUp);
const dealt = { up: cd(cameUp), other: cd(other) };
for (let i = 0; i < 11; i++) core.substituteActor(b, i % 2 === 0 ? cameUp : other);
process.stdout.write(JSON.stringify({
  dealt,
  afterSwapping: { up: cd(cameUp), other: cd(other) },
  acting: b.acting.index, cameUp, other
}));
""")
    # The bird the turn was dealt to ticked once; the other did not.
    assert out["dealt"]["up"] == [2, 2]
    assert out["dealt"]["other"] == [3, 3]
    # Eleven swaps later exactly one tick is still spent — never banked.
    holder = "up" if out["acting"] == out["cameUp"] else "other"
    waiting = "other" if holder == "up" else "up"
    assert out["afterSwapping"][holder] == [2, 2], out
    assert out["afterSwapping"][waiting] == [3, 3], out


def test_a_substitution_refuses_everything_it_should():
    out = run_node(SQUAD + """
const b = newBattle();
const before = core.substituteActor(b, 1);       // nothing is acting yet
core.tickToNextTurn(b);
const acting = b.acting.index;
const other = [0, 1, 2].find(i => i !== acting);
b.teams.player[other].fainted = true;
const results = {
  beforeAnyoneIsReady: before,
  sameBird: core.substituteActor(b, acting),
  faintedBird: core.substituteActor(b, other),
  offTheEnd: core.substituteActor(b, 9),
  negative: core.substituteActor(b, -1),
  nothingAtAll: core.substituteActor(null, 1)
};
b.teams.player[other].fainted = false;
// The evil Burbz fly their own order — no substituting on their turn.
while (b.acting && b.acting.side === 'player') {
  core.resolveAction(b, { skillIndex: 0, targetIndex: core.livingFighters(b, 'opponent')[0].i });
  core.tickToNextTurn(b);
}
results.opponentTurn = core.substituteActor(b, 0);
process.stdout.write(JSON.stringify(results));
""")
    assert out == {
        "beforeAnyoneIsReady": False, "sameBird": False, "faintedBird": False,
        "offTheEnd": False, "negative": False, "nothingAtAll": False,
        "opponentTurn": False,
    }


def test_the_arena_offers_the_swap_and_takes_the_tap():
    html = html_text()
    render = function_source(html, "renderArena")
    # Only a living bird that is not already holding the turn.
    assert "swappable: side === 'player' && playerActing && !f.fainted && acting.index !== i" in render
    unit = function_source(html, "arenaUnitHTML")
    assert "if (o.swappable) cls.push('swappable');" in unit
    assert "au-swap-flag" in unit and "SEND IN" in unit
    pick = function_source(html, "battleTargetPick")
    assert "core.substituteActor(b, index)" in pick
    # The move belonged to the bird that stepped aside.
    assert "battleState.pendingSkillIndex = null;" in pick
    assert "battleState.pendingTargetIndex = null;" in pick
    # An older cached core must not throw the arena.
    assert "typeof core.substituteActor !== 'function'" in pick
    assert "tap another of your birds to send it in instead" in html


# ---------------------------------------------------------------------------
# 2. The struck bird lights up and shakes — on both sides
# ---------------------------------------------------------------------------

def test_the_hit_is_lit_after_the_re_render_not_before():
    """renderArena rewrites both rows; a class set first dies with the card."""
    src = function_source(html_text(), "playBattleEvents")
    assert "struck = 'unit_' + ev.side + '_' + idx;" in src
    mark = src.index("struck = 'unit_'")
    render = src.index("renderArena();", mark)
    light = src.index("card.classList.add('hit')", mark)
    assert mark < render < light, "the card must be lit after the row is rebuilt"


def test_both_sides_light_up_because_the_side_comes_off_the_event():
    src = function_source(html_text(), "playBattleEvents")
    # ev.side on a damage event is the side that TOOK it, so one line serves
    # the evil Burbz and the flock alike.
    assert "struck = 'unit_' + ev.side + '_' + idx;" in src
    assert "'unit_player_'" not in src and "'unit_opponent_'" not in src


def test_the_hit_class_both_flashes_and_shakes():
    html = html_text()
    assert ".arena-unit.hit { animation:arenaShake .4s ease, arenaHitFlash .5s ease; }" in html
    assert "@keyframes arenaHitFlash" in html
    flash = html[html.index("@keyframes arenaHitFlash"):]
    flash = flash[:flash.index("}\n", flash.index("100%"))]
    assert "brightness(1.9)" in flash          # it lights up
    assert "box-shadow:0 0 22px" in flash      # and throws a glow
    # Reduced motion keeps the light, drops the shake.
    reduced = html[html.index("@media (prefers-reduced-motion: reduce) {\n  .arena-unit.hit"):]
    assert "animation:arenaHitFlash .5s ease;" in reduced[:200]


# ---------------------------------------------------------------------------
# 3. The aimed blow, drawn on the target's own health bar
# ---------------------------------------------------------------------------

def test_only_the_bird_being_aimed_at_glows():
    render = function_source(html_text(), "renderArena")
    assert "doomed: side === 'opponent' && !!pendingAct && !f.fainted" in render
    assert "(pendingAct.skill.aoe || battleState.pendingTargetIndex === i)" in render


def test_the_slice_is_the_health_the_blow_would_take():
    src = function_source(html_text(), "arenaUnitHTML")
    assert "const doomHp = Math.max(0, Math.min(f.hp, Math.round(o.preview.avg)));" in src
    assert "hpBarCls += ' doomed'" in src
    assert "o.preview.min >= f.hp ? ' lethal' : ''" in src
    assert "left:' + Math.max(0, pct - doomPct)" in src      # where the bar will end
    assert "width:' + Math.max(5, doomPct)" in src           # never a hairline
    assert "' · KO'" in src                                  # a killing blow says so


def test_the_bar_carries_a_tick_and_a_glow_so_a_graze_still_reads():
    html = html_text()
    assert ".arena-unit .au-hpbar { position:relative;" in html
    doomed = html[html.index(".arena-unit .au-hpbar.doomed {"):]
    doomed = doomed[:doomed.index("}")]
    assert "box-shadow:0 0 10px" in doomed
    slice_css = html[html.index(".arena-unit .au-hpbar .au-hp-doom {"):]
    slice_css = slice_css[:slice_css.index("}")]
    assert "border-left:2px solid #fff6f4" in slice_css   # where the bar will end
    assert "position:absolute" in slice_css
    assert "animation:hpDoomPulse" in slice_css
    assert ".arena-unit .au-hpbar.lethal" in html


def test_the_health_fill_still_renders_beside_the_slice():
    src = function_source(html_text(), "arenaUnitHTML")
    assert '<div class="au-hp-fill" style="width:\' + pct + \'%;' in src
    assert "+ doomSlice +" in src


# ---------------------------------------------------------------------------
# Release plumbing
# ---------------------------------------------------------------------------

def test_release_is_versioned_and_the_battle_core_pin_moved():
    html = html_text()
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line       # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    # battle_core changed, so its pin moved everywhere at once.
    pin = f"battle_core.js?v={OWN_RELEASE_PIN}"
    assert f'<script src="{pin}"></script>' in html
    assert sw.count(f"'./{pin}'") == 2
    assert "battle_core.js?v=mercy-streak-attack-preview-v287-20260819" not in html
    assert "battle_core.js?v=mercy-streak-attack-preview-v287-20260819" not in sw
    assert '"battle_core.js"' in UPDATER.read_text(encoding="utf-8")
