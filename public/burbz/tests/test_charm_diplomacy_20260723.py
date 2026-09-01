"""Charm (CHA) diplomacy: the Crowbar as the charm room, diplomacy quests,
and robins/wrens as the Kingdom's charm icons.

Rewritten for mercy-streak-attack-preview-v287: the in-battle Parley move is
retired at Yaan's request — it confused players and rarely worked. Charm
keeps its whole out-of-battle life: the Crowbar grows it, diplomacy quests
pay on it, and the envoy still flies. These contracts pin both sides — the
move is gone from the engine, and the charm economy still stands."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"


def _node(script: str):
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_no_fighter_carries_parley_any_more():
    payload = _node("""
const core = require('./battle_core.js');
const robin = core.buildFighter({ id:'r', species:'European Robin', maxHp:70, hp:70, atk:20, def:30, spd:50, int:50, cha:100, stamina:50 });
const eagle = core.buildFighter({ id:'e', species:'Golden Eagle', maxHp:140, hp:140, atk:100, def:90, spd:80, int:70, cha:20, stamina:80 });
const battle = core.createBattle({ playerFighters:[robin], opponentFighters:[eagle], seed:'no_parley' });
core.tickToNextTurn(battle);
const acts = core.availableActions(battle);
console.log(JSON.stringify({
  robinHasParley: robin.skills.some(s => s.id === 'parley'),
  eagleHasParley: eagle.skills.some(s => s.id === 'parley'),
  actionKinds: acts.map(a => a.skill.kind),
  parleyExportGone: core.PARLEY === undefined && core.PARLEY_WINOVER_HP_PCT === undefined,
  charmResolveGone: core.charmResolve === undefined
}));
""")
    assert payload["robinHasParley"] is False
    assert payload["eagleHasParley"] is False
    assert "parley" not in payload["actionKinds"]
    assert payload["parleyExportGone"] is True
    assert payload["charmResolveGone"] is True


def test_engine_source_dropped_the_parley_branches():
    # The header comment may say the move retired; the code may not carry it.
    core_src = (ROOT / "battle_core.js").read_text(encoding="utf-8")
    assert "'parley'" not in core_src
    assert "PARLEY" not in core_src
    assert "charmResolve" not in core_src
    html = INDEX.read_text(encoding="utf-8")
    # The battle move stays gone. The Diplomacy Envoy errand keeps its id —
    # v287's own rule: "diplomacy lives on in envoy quests" (release-polish-v342
    # gave that errand its board line, which names the id).
    assert "parley" not in html.lower().replace("envoy_parley", "")


def test_legacy_goodwill_rewards_stay_harmless():
    # endPerchBattle still passes a swayed count (always 0 now) — the reward
    # maths must keep accepting it without paying phantom coins.
    payload = _node("""
const core = require('./battle_core.js');
console.log(JSON.stringify({
  plain: core.battleRewards(2, 'player', {}),
  legacy: core.battleRewards(2, 'player', { swayed: 0 })
}));
""")
    assert payload["plain"]["charmCoins"] == 0
    assert payload["legacy"]["charmCoins"] == 0
    assert payload["legacy"]["swayed"] == 0


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
    # The copy tells the truth after the retirement: charm pays on quests,
    # and no surface promises an in-battle win-over any more.
    assert "Charm pays on diplomacy quests" in html
    assert "the stat that pays on diplomacy quests" in html
    assert "win a foe over without a blow" not in html
    assert "wins Parleys" not in html
