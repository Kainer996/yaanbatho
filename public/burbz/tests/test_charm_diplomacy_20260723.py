"""Charm (CHA) diplomacy: Parley in battle, the Crowbar as the charm room,
diplomacy quests, and robins/wrens as the Kingdom's charm icons."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"


def _node(script: str):
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_every_fighter_carries_parley_and_it_targets_foes():
    payload = _node("""
const core = require('./battle_core.js');
const robin = core.buildFighter({ id:'r', species:'European Robin', maxHp:70, hp:70, atk:20, def:30, spd:50, int:50, cha:100, stamina:50 });
const eagle = core.buildFighter({ id:'e', species:'Golden Eagle', maxHp:140, hp:140, atk:100, def:90, spd:80, int:70, cha:20, stamina:80 });
const battle = core.createBattle({ playerFighters:[robin], opponentFighters:[eagle], seed:'parley_targets' });
core.tickToNextTurn(battle);
const acts = core.availableActions(battle);
const parley = acts.find(a => a.skill.id === 'parley');
console.log(JSON.stringify({
  robinHasParley: robin.skills.some(s => s.id === 'parley'),
  eagleHasParley: eagle.skills.some(s => s.id === 'parley'),
  parleyStat: core.PARLEY.stat,
  needsTarget: parley ? parley.needsTarget : false,
  targetsFoes: parley ? parley.targets.length > 0 : false
}));
""")
    assert payload["robinHasParley"] is True
    assert payload["eagleHasParley"] is True
    assert payload["parleyStat"] == "cha"      # diplomacy runs on Charm
    assert payload["needsTarget"] is True
    assert payload["targetsFoes"] is True


def test_charming_player_bird_wins_over_a_weakened_foe():
    payload = _node("""
const core = require('./battle_core.js');
// A charming robin (CHA 100) parleys with a weakened, weak-willed foe.
// Deterministic seeded RNG: at least one of a handful of seeds must land
// the win-over, and every win-over must count the foe as out of the fight.
let sway = null;
for (let i = 0; i < 8 && !sway; i++) {
  const robin = core.buildFighter({ id:'r', species:'European Robin', maxHp:70, hp:70, atk:20, def:30, spd:90, int:50, cha:100, stamina:50 });
  const foe = core.buildFighter({ id:'e', species:'Golden Eagle', maxHp:140, hp:40, atk:100, def:90, spd:10, int:20, cha:20, stamina:80 });
  const battle = core.createBattle({ playerFighters:[robin], opponentFighters:[foe], seed:'sway_' + i });
  core.tickToNextTurn(battle);
  const idx = battle.teams.player[0].skills.findIndex(s => s.id === 'parley');
  const events = core.resolveAction(battle, { skillIndex: idx, targetIndex: 0 });
  if (events.some(e => e.type === 'sway')) {
    sway = { seed: i,
      foeOut: battle.teams.opponent[0].fainted && battle.teams.opponent[0].swayed,
      winner: battle.winner,
      peaceful: events.every(e => e.type !== 'damage') };
  }
}
console.log(JSON.stringify(sway || { failed: true }));
""")
    assert payload.get("failed") is not True, "no seed produced a win-over"
    assert payload["foeOut"] is True          # a swayed foe leaves the fight
    assert payload["winner"] == "player"      # last foe won over = victory
    assert payload["peaceful"] is True        # diplomacy deals no damage


def test_parley_saps_will_but_a_proud_foe_at_full_health_never_turns():
    payload = _node("""
const core = require('./battle_core.js');
const robin = core.buildFighter({ id:'r', species:'European Robin', maxHp:70, hp:70, atk:20, def:30, spd:90, int:50, cha:120, stamina:50 });
const foe = core.buildFighter({ id:'e', species:'Golden Eagle', maxHp:140, hp:140, atk:100, def:90, spd:10, int:70, cha:40, stamina:80 });
const battle = core.createBattle({ playerFighters:[robin], opponentFighters:[foe], seed:'sap_will' });
core.tickToNextTurn(battle);
const idx = battle.teams.player[0].skills.findIndex(s => s.id === 'parley');
core.resolveAction(battle, { skillIndex: idx, targetIndex: 0 });
console.log(JSON.stringify({
  stillFighting: !battle.teams.opponent[0].fainted,
  willSapped: battle.teams.opponent[0].mods.some(m => m.stat === 'atk' && m.pct < 0),
  threshold: core.PARLEY_WINOVER_HP_PCT
}));
""")
    assert payload["stillFighting"] is True   # full-health foes can't be flipped
    assert payload["willSapped"] is True      # but their will to fight drops
    assert 0 < payload["threshold"] < 1


def test_evil_burbz_parley_never_steals_a_loyal_companion():
    payload = _node("""
const core = require('./battle_core.js');
// The usurper's charmer faces a weakened player bird: for every seed the
// parley may rattle morale, but a loyal companion is never won over.
const results = [];
for (let i = 0; i < 6; i++) {
  const charmer = core.buildFighter({ id:'c', species:'Common Myna', maxHp:100, hp:100, atk:40, def:40, spd:90, int:60, cha:200, stamina:50 });
  const weary = core.buildFighter({ id:'w', species:'European Robin', maxHp:70, hp:10, atk:20, def:30, spd:10, int:20, cha:20, stamina:50 });
  const battle = core.createBattle({ playerFighters:[weary], opponentFighters:[charmer], seed:'loyal_' + i });
  core.tickToNextTurn(battle);
  const idx = battle.teams.opponent[0].skills.findIndex(s => s.id === 'parley');
  core.resolveAction(battle, { skillIndex: idx, targetIndex: 0 });
  results.push(!battle.teams.player[0].fainted && !battle.teams.player[0].swayed);
}
console.log(JSON.stringify({ allLoyal: results.every(Boolean) }));
""")
    assert payload["allLoyal"] is True


def test_battle_rewards_pay_goodwill_coins_for_swayed_foes():
    payload = _node("""
const core = require('./battle_core.js');
console.log(JSON.stringify({
  plain: core.battleRewards(2, 'player', {}),
  charmed: core.battleRewards(2, 'player', { swayed: 2 }),
  loss: core.battleRewards(2, 'opponent', { swayed: 2 })
}));
""")
    assert payload["plain"]["charmCoins"] == 0
    assert payload["charmed"]["swayed"] == 2
    assert payload["charmed"]["charmCoins"] > 0
    assert payload["loss"]["charmCoins"] == 0


def test_diplomacy_envoy_quest_pays_on_charm():
    payload = _node("""
const academy = require('./academy_treehouse_core.js');
const templates = academy.getQuestTemplates();
const envoy = templates.find(t => t.id === 'envoy_parley');
const charmer = { id:'r', commonName:'European Robin', power:80, cha:120, int:40, spd:40, stamina:40 };
const brute = { id:'e', commonName:'Golden Eagle', power:80, cha:20, int:40, spd:40, stamina:40 };
const now = 1753228800000;
const charmerRun = academy.createBirdExpedition(charmer, 'envoy_parley', now);
const bruteRun = academy.createBirdExpedition(brute, 'envoy_parley', now);
console.log(JSON.stringify({
  exists: !!envoy, icon: envoy && envoy.icon, chaWeight: envoy && envoy.chaWeight,
  charmerBonus: charmerRun.rewards.charmBonus, bruteBonus: bruteRun.rewards.charmBonus
}));
""")
    assert payload["exists"] is True
    assert payload["icon"] == "🕊️"
    assert payload["chaWeight"] >= 2          # the heaviest charm weighting in the game
    assert payload["charmerBonus"] > payload["bruteBonus"]  # robins out-earn eagles here


def test_index_wires_charm_throughout():
    html = INDEX.read_text(encoding="utf-8")
    # Charm is the canonical stat table and robins/wrens top it
    assert "const BURBZ_CHARM" in html
    assert "robin: 10" in html
    assert "wren: 9," in html
    assert "BURBZ_PERSONALITY" not in html
    # CHA is shown on the bird info card and the card back
    assert 'bird-info-stat-label">CHA' in html
    assert 'card-back-stat-label">CHA' in html
    # The Crowbar trains Charm and says so
    assert "crowbar:     { stat:'cha',     label:'CHA' }" in html
    assert "+1 CHA every 30 min" in html
    # Battle UI teaches and renders Parley diplomacy
    assert "every bird can Parley" in html.lower() or "every bird can parley" in html.lower()
    assert "PARLEY_WINOVER_HP_PCT" in html
    assert "Won over by Charm" in html
    # Merlin's tutorial covers diplomacy
    assert "a bird with high Charm can win a foe over" in html
    assert "the stat that wins Parleys and diplomacy quests" in html
