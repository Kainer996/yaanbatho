"""Skyclash: field any bird you like, on cards that are all the same size.

Two complaints from one screenshot of a real fight. The Great Spotted
Woodpecker's card was nearly twice as wide as its squadmates', and the turn
meter decided which bird the player was allowed to use.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
HTML = INDEX.read_text(encoding="utf-8")


def _node(script: str):
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(name: str) -> str:
    start = HTML.index("function " + name + "(")
    depth, i, seen = 0, HTML.index("{", start), False
    while i < len(HTML):
        if HTML[i] == "{":
            depth, seen = depth + 1, True
        elif HTML[i] == "}":
            depth -= 1
            if seen and depth == 0:
                return HTML[start:i + 1]
        i += 1
    raise AssertionError("unterminated function " + name)


# A fast bird and a slow one, so "whose meter filled" and "who swings" can
# actually disagree.
SWIFT = {"species": "Common Swift", "maxHp": 120, "hp": 120, "atk": 55, "def": 45,
         "spd": 90, "int": 50, "cha": 50, "stamina": 60, "level": 5}
PECKER = {"species": "Great Spotted Woodpecker", "maxHp": 130, "hp": 130, "atk": 70,
          "def": 55, "spd": 30, "int": 50, "cha": 50, "stamina": 60, "level": 5}
CROW = {"species": "Carrion Crow", "maxHp": 125, "hp": 125, "atk": 60, "def": 50,
        "spd": 55, "int": 50, "cha": 50, "stamina": 60, "level": 5}

SETUP = f"""
const core = require('./battle_core.js');
const SWIFT = {json.dumps(SWIFT)}, PECKER = {json.dumps(PECKER)}, CROW = {json.dumps(CROW)};
function battle(opts) {{
  const o = opts || {{}};
  const p = [SWIFT, PECKER].map((b, i) => core.buildFighter({{ ...b, ...(o.player || {{}}), id:'p' + i }}));
  const q = [CROW, CROW].map((b, i) => core.buildOpponentFighter(
    {{ ...b, ...(o.foe || {{}}), id:'o' + i, species: i ? 'Eurasian Wren' : 'Mute Swan' }}, 2, 'seed' + i));
  return core.createBattle({{ playerFighters:p, opponentFighters:q, seed:'fieldany', tier:2 }});
}}
// Wind the meter on until the player's fast bird holds the turn.
function toPlayerTurn(b) {{
  for (let guard = 0; guard < 200; guard++) {{
    const t = core.tickToNextTurn(b);
    if (!t) return null;
    if (t.side === 'player') return t;
    core.resolveAction(b, core.aiChooseAction(b));
  }}
  return null;
}}
"""


def test_any_living_bird_of_yours_can_take_the_turn():
    payload = _node(SETUP + """
const b = battle();
const first = toPlayerTurn(b);
const before = core.actingFighter(b).name;
const ok = core.chooseActingFighter(b, 1);
const after = core.actingFighter(b).name;
// The move list follows the bird, not the meter.
const moves = core.availableActions(b).map(a => a.skill.label);
console.log(JSON.stringify({
  ok, before, after, meterHolder: b.turnHolder,
  actingIndex: b.acting.index,
  moves, pecker: b.teams.player[1].skills.map(s => s.label)
}));
""")
    assert payload["ok"] is True
    assert payload["before"] == "Common Swift"          # the meter picked the fast bird
    assert payload["after"] == "Great Spotted Woodpecker"  # the player picked otherwise
    assert payload["actingIndex"] == 1
    assert payload["meterHolder"] == {"side": "player", "index": 0}
    assert payload["moves"] == payload["pecker"]


def test_only_your_own_living_birds_can_be_fielded():
    payload = _node(SETUP + """
const b = battle();
toPlayerTurn(b);
const started = b.acting.index;
b.teams.player[1].fainted = true;
const results = {
  fainted: core.chooseActingFighter(b, 1),
  offRoster: core.chooseActingFighter(b, 9),
  negative: core.chooseActingFighter(b, -1),
  alreadyActing: core.chooseActingFighter(b, started)
};
// And nothing above could have moved the turn off the bird that held it.
results.stillActing = b.acting.index === started;
// The opponent's own turn is not the player's to hand out.
const c = battle();
let oppTurn = null;
for (let i = 0; i < 200 && !oppTurn; i++) {
  const t = core.tickToNextTurn(c);
  if (t.side === 'opponent') { oppTurn = t; break; }
  core.resolveAction(c, { skillIndex:0, targetIndex:0 });
}
results.onTheirTurn = core.chooseActingFighter(c, 1);
results.theirBirdKeptIt = c.acting.side === 'opponent';
console.log(JSON.stringify(results));
""")
    assert payload["fainted"] is False
    assert payload["offRoster"] is False
    assert payload["negative"] is False
    assert payload["alreadyActing"] is False
    assert payload["stillActing"] is True
    assert payload["onTheirTurn"] is False
    assert payload["theirBirdKeptIt"] is True


def test_the_same_bird_can_fight_every_single_turn():
    payload = _node(SETUP + """
const b = battle({ player:{ maxHp:200000, hp:200000 }, foe:{ maxHp:200000, hp:200000 } });
const swung = [];
for (let round = 0; round < 12; round++) {
  const t = toPlayerTurn(b);
  if (!t) break;
  core.chooseActingFighter(b, 1);            // always the woodpecker
  swung.push(core.actingFighter(b).name);
  core.resolveAction(b, { skillIndex:0, targetIndex:0 });
}
console.log(JSON.stringify({ swung, hp: b.teams.opponent.map(f => f.hp) }));
""")
    assert len(payload["swung"]) == 12
    assert set(payload["swung"]) == {"Great Spotted Woodpecker"}
    # It really fought; it did not just hold the flag.
    assert min(payload["hp"]) < 200000


def test_cooldowns_tick_once_a_turn_however_often_you_change_your_mind():
    payload = _node(SETUP + """
// Tough enough to still be standing on the second turn — this test is about
// cooldowns, not about surviving two crows.
const b = battle({ player:{ maxHp:200000, hp:200000 }, foe:{ maxHp:200000, hp:200000 } });
toPlayerTurn(b);
const pecker = b.teams.player[1];
const cdSkill = pecker.skills.find(s => s.cd > 0);
cdSkill.cdLeft = 3;
// Swap back and forth five times inside the one turn.
for (let i = 0; i < 5; i++) { core.chooseActingFighter(b, 1); core.chooseActingFighter(b, 0); }
core.chooseActingFighter(b, 1);
const afterSwapping = cdSkill.cdLeft;
core.resolveAction(b, { skillIndex:0, targetIndex:0 });
// Next turn it should tick once more, not five times.
toPlayerTurn(b);
core.chooseActingFighter(b, 1);
console.log(JSON.stringify({ afterSwapping, nextTurn: cdSkill.cdLeft }));
""")
    assert payload["afterSwapping"] == 2   # three, minus this turn's single tick
    assert payload["nextTurn"] == 1


def test_the_meter_holder_pays_for_the_turn_not_the_bird_you_field():
    payload = _node(SETUP + """
const b = battle();
toPlayerTurn(b);
const holderBefore = b.teams.player[0].cr;
const fieldedBefore = b.teams.player[1].cr;
core.chooseActingFighter(b, 1);
core.resolveAction(b, { skillIndex:0, targetIndex:0 });
console.log(JSON.stringify({
  holderBefore, fieldedBefore,
  holderAfter: b.teams.player[0].cr, fieldedAfter: b.teams.player[1].cr
}));
""")
    assert payload["holderBefore"] == 100          # the fast bird's meter was full
    assert payload["holderAfter"] == 0             # and spending the turn emptied it
    assert payload["fieldedBefore"] < 100
    # The bird you send in keeps its own readiness — it did not pay twice.
    assert payload["fieldedAfter"] == payload["fieldedBefore"]


def test_fielding_a_favourite_buys_the_flock_no_extra_turns():
    """Choosing who swings must not change how often the flock swings."""
    payload = _node(SETUP + """
// Nothing can die, so the two runs cannot diverge through knockouts.
function run(alwaysField) {
  const b = battle({ player:{ maxHp:900000, hp:900000 }, foe:{ maxHp:900000, hp:900000 } });
  const sides = [];
  for (let i = 0; i < 60; i++) {
    const t = core.tickToNextTurn(b);
    if (!t) break;
    sides.push(t.side);
    if (t.side === 'player') {
      if (alwaysField) core.chooseActingFighter(b, 1);
      core.resolveAction(b, { skillIndex:0, targetIndex:0 });
    } else {
      core.resolveAction(b, { skillIndex:0, targetIndex:0 });
    }
  }
  return { player: sides.filter(s => s === 'player').length,
           opponent: sides.filter(s => s === 'opponent').length, order: sides.join('') };
}
console.log(JSON.stringify({ meterPicks: run(false), youPick: run(true) }));
""")
    assert payload["meterPicks"]["player"] > 0
    assert payload["meterPicks"] == payload["youPick"]


def test_buff_durations_still_run_down_when_you_field_someone_else():
    """A rally parked on a bird that never holds the meter must still expire."""
    payload = _node(SETUP + """
const b = battle();
toPlayerTurn(b);
const holder = b.teams.player[0], fielded = b.teams.player[1];
holder.mods = [{ stat:'atk', pct:0.3, turns:2 }];
fielded.mods = [{ stat:'atk', pct:0.3, turns:2 }];
core.chooseActingFighter(b, 1);
core.resolveAction(b, { skillIndex:0, targetIndex:0 });
console.log(JSON.stringify({
  holderTurnsLeft: (holder.mods[0] || {}).turns,
  fieldedTurnsLeft: (fielded.mods[0] || {}).turns
}));
""")
    assert payload["holderTurnsLeft"] == 1
    assert payload["fieldedTurnsLeft"] == 1


def test_arena_cards_cannot_be_stretched_by_a_long_bird_name():
    squad = re.search(r"^\.arena-squad \{[^}]*\}", HTML, re.M).group(0)
    unit = re.search(r"^\.arena-unit \{[^}]*\}", HTML, re.M).group(0)
    name = re.search(r"^\.arena-unit \.au-name \{[^}]*\}", HTML, re.M).group(0)
    # `1fr` is `minmax(auto, 1fr)`: a track can never shrink below its item's
    # content, which is exactly how one long name took the row apart.
    assert "repeat(4, minmax(0, 1fr))" in squad
    assert "repeat(4, 1fr)" not in squad
    assert "min-width:0" in unit
    # A nowrap name is the content that pushed the track open.
    assert "white-space:nowrap" not in name
    assert "-webkit-line-clamp:2" in name
    # A fixed name box keeps every card's bars on the same line.
    assert "height:2.3em" in name


def test_your_row_shows_which_birds_you_can_send_in():
    assert ".arena-squad.player .arena-unit.pickable" in HTML
    unit_html = function_source("arenaUnitHTML")
    assert "if (o.pickable) cls.push('pickable');" in unit_html
    render = function_source("renderArena")
    # Marked only on your own living birds, on your turn, and never on the one
    # already holding it.
    assert "pickable: playerActing && side === 'player' && !f.fainted && acting.index !== i" in render


def test_tapping_your_own_bird_fields_it():
    pick = function_source("battleTargetPick")
    assert "if (side === 'player') { battleFieldBird(index); return; }" in pick
    field = function_source("battleFieldBird")
    assert "core.chooseActingFighter(b, index)" in field
    # A different bird brings different moves, so the half-made plan goes back.
    assert "battleState.pendingSkillIndex = null;" in field
    assert "battleState.pendingTargetIndex = null;" in field
    # And the fight tells the player the choice is theirs.
    assert "or tap another bird" in function_source("renderArena")


CURRENT_BUILD = "woodland-ui-polish-v352-20260906"
# battle_core.js pins the release that last CHANGED it, not the head build —
# later releases that leave the core alone must not churn every phone's cache.
BATTLE_CORE_PIN = "little-folk-residents-v350-20260905"
PREVIOUS_BUILD = "trail-mode-v329-20260825"


def test_release_is_versioned_and_the_changed_core_is_precached_everywhere():
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_BUILD in cache_line          # lineage kept
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    # A stale battle_core in a phone's service-worker cache would ship the new
    # arena against the old turn engine, so the pin has to move in all three.
    assert f'battle_core.js?v={BATTLE_CORE_PIN}' in HTML
    assert sw.count(f"'./battle_core.js?v={BATTLE_CORE_PIN}'") == 3
    # battle_core.js already ships; the live updater must still be carrying it.
    updater = (ROOT.parents[1] / "scripts" / "update-live-burbz.sh").read_text(encoding="utf-8")
    assert '"battle_core.js"' in updater
