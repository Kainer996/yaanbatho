"""mercy-streak-attack-preview-v287 — three asks from Yaan in one release.

1. MERCY RULE: difficulty gates on the win streak, not the player's level.
   Under four straight wins every squad fights at 0.3 strength — Yaan's
   level-12 three-raptor flock must be all but guaranteed to win. Wins 4-6
   ramp 0.5/0.7/0.85; the seventh brings full strength; a loss resets.
   (The streak plumbing itself is pinned in the rewritten
   test_early_game_* suites.)

2. ATTACK PREVIEW: attacks aim before they land. Pick a move, see its
   projected damage on every living rival, tap one to lock the target, and
   the ATTACK button shows the damage range before the blow. The new pure
   core function is previewDamage — computeDamage with the dice removed.

3. PARLEY RETIRED: pinned in the rewritten test_charm_diplomacy suite; the
   release plumbing here proves the moved cores actually shipped.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
OWN_RELEASE_PIN = "mercy-streak-attack-preview-v287-20260819"
PREVIOUS_RELEASE_PIN = "battle-progression-fixes-v286-20260819"
CURRENT_BUILD = "kitchen-clean-table-v333-20260827"


def _node(script: str):
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=120)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start, name
    return html[start:end]


# ---- previewDamage: honest odds, no dice, no side effects -------------------

def test_preview_brackets_every_non_crit_roll():
    payload = _node("""
const core = require('./battle_core.js');
const mk = () => ({
  att: core.buildFighter({ id:'a', species:'Eurasian Sparrowhawk', maxHp:130, hp:130, atk:82, def:56, spd:70, int:55, cha:40, stamina:55, mag:30 }),
  def: core.buildFighter({ id:'d', species:'Common Blackbird', maxHp:95, hp:95, atk:44, def:40, spd:52, int:48, cha:52, stamina:45, mag:66 })
});
const probe = mk();
const skill = probe.att.skills[0];
const preview = core.previewDamage(probe.att, probe.def, skill, {});
const before = JSON.stringify([probe.att, probe.def]);
core.previewDamage(probe.att, probe.def, skill, {});
const untouched = before === JSON.stringify([probe.att, probe.def]);
let inBand = 0, crits = 0, total = 0;
for (let seed = 0; seed < 200; seed++) {
  const t = mk();
  // The attacker is faster, so the first acting fighter is always ours —
  // this drives the REAL damage path, not a re-derivation of it.
  const battle = core.createBattle({ playerFighters:[t.att], opponentFighters:[t.def], seed:'pv_' + seed });
  core.tickToNextTurn(battle);
  const events = core.resolveAction(battle, { skillIndex: 0, targetIndex: 0 });
  const hit = events.find(e => e.type === 'damage');
  if (!hit) continue;
  total++;
  if (hit.crit) { crits++; continue; }
  if (hit.dmg >= preview.min && hit.dmg <= preview.max) inBand++;
}
console.log(JSON.stringify({ preview, untouched, inBand, crits, total }));
""")
    p = payload["preview"]
    assert payload["untouched"] is True                    # pure: zero mutation
    assert 0 < p["min"] <= p["avg"] <= p["max"]
    assert p["mult"] == 1.6                                # raptor > songbird
    # Every non-crit roll of the real damage maths lands inside the band.
    assert payload["inBand"] == payload["total"] - payload["crits"]
    assert payload["crits"] < payload["total"]             # sample saw both kinds


def test_preview_prices_split_and_barriers():
    payload = _node("""
const core = require('./battle_core.js');
const att = core.buildFighter({ id:'a', species:'Eurasian Sparrowhawk', maxHp:130, hp:130, atk:82, def:56, spd:70, int:55, cha:40, stamina:55, mag:30 });
const foe = core.buildFighter({ id:'d', species:'Common Blackbird', maxHp:95, hp:95, atk:44, def:40, spd:52, int:48, cha:52, stamina:45, mag:66 });
const skill = att.skills[0];
const plain = core.previewDamage(att, foe, skill, {});
// v331 retired Surge; the option is inert rather than a secret multiplier.
const surged = core.previewDamage(att, foe, skill, { surge:true });
const split = core.previewDamage(att, foe, skill, { aoeSplit:true });
foe.barrier = 9999;
const walled = core.previewDamage(att, foe, skill, {});
const pierced = core.previewDamage(att, foe, { ...skill, rider:{ kind:'pierce' } }, {});
console.log(JSON.stringify({ plain, surged, split, walled, pierced, barrierIntact: foe.barrier === 9999 }));
""")
    assert payload["surged"]["avg"] == payload["plain"]["avg"]  # Surge is gone
    assert payload["split"]["avg"] < payload["plain"]["avg"]    # AoE split priced in
    assert payload["walled"]["blocked"] is True
    assert payload["walled"]["max"] == 0                        # a full wall soaks it all
    assert payload["pierced"]["blocked"] is False
    assert payload["pierced"]["min"] >= payload["plain"]["min"] # pierce ignores the wall
    assert payload["barrierIntact"] is True                     # preview never spends it


# ---- The aim-then-strike flow in the arena ----------------------------------

def test_attacks_aim_and_confirm_instead_of_firing_on_tap():
    html = HTML_PATH.read_text(encoding="utf-8")
    select = function_source(html, "battleSelectSkill")
    # Support moves still cast on one tap; attacks go pending instead.
    assert "if (a.skill.kind !== 'attack') { battleResolvePlayer(skillIndex, (a.targets || [])[0]); return; }" in select
    assert "battleState.pendingSkillIndex = skillIndex;" in select
    # A lone rival aims itself; tapping the chosen move again puts it back.
    assert "liveTargets.length === 1 ? liveTargets[0] : null" in select
    assert "battleState.pendingSkillIndex = null;" in select
    # The old quick-cast is gone: selecting never resolves an attack.
    assert "quick-cast" not in select
    pick = function_source(html, "battleTargetPick")
    assert "battleState.pendingTargetIndex = index;" in pick
    assert "battleResolvePlayer" not in pick                 # aiming never strikes
    confirm = function_source(html, "battleConfirmAttack")
    assert "battleResolvePlayer(skillIndex, target)" in confirm
    assert "Tap an evil Burb to aim first" in confirm
    # The button is reachable from generated onclick HTML.
    assert "battleConfirmAttack," in html                    # window exposure list
    assert 'onclick="battleConfirmAttack()"' in html


def test_arena_shows_the_damage_before_the_blow():
    html = HTML_PATH.read_text(encoding="utf-8")
    render = function_source(html, "renderArena")
    assert "core.previewDamage(me, x.f, a.skill," in render
    assert "attack-confirm-btn" in render
    assert "⚔️ ATTACK " in render and "⚔️ ATTACK ALL" in render
    assert "super effective!" in render
    # Liberation battles keep their gentle wording on the button too.
    assert "battleState.liberation ? 'resolve' : 'dmg'" in render
    unit = function_source(html, "arenaUnitHTML")
    assert "au-dmg-preview" in unit
    assert "au-target-flag" in unit and "🎯 TARGET" in unit
    # The preview badge and confirm button are styled.
    for cls in (".arena-unit .au-dmg-preview", ".arena-unit.target-locked", ".move-btn.attack-confirm-btn"):
        assert cls in html, cls
    # v331 retired the eight-line battle intro: the ATTACK button itself carries
    # the damage, so the flow no longer needs narrating before the fight starts.
    assert "check the damage on the ATTACK button" not in html
    render = function_source(html, "renderArena")
    assert "⚔️ ATTACK " in render and "dmgWord" in render


def test_resolving_or_advancing_clears_the_aim():
    html = HTML_PATH.read_text(encoding="utf-8")
    resolve = function_source(html, "battleResolvePlayer")
    assert "battleState.pendingTargetIndex = null;" in resolve
    advance = function_source(html, "battleAdvance")
    assert "battleState.pendingTargetIndex = null;" in advance
    # Battle state opens with no aim taken.
    assert "pendingSkillIndex: null, pendingTargetIndex: null" in html


# ---- Release plumbing --------------------------------------------------------

def test_release_is_versioned_and_the_moved_cores_shipped():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line       # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    # battle_core (preview + parley) and walking_story_core (folio scroll)
    # changed in this release, so their cache pins moved everywhere.
    # academy_treehouse_core moved here too, then again with
    # training-your-way-v288 — its pin lives in that release's suite now.
    # battle_core moved again with free-your-first-village-v327 (the first
    # liberation is unloseable), so its pin lives in that release's suite now.
    for core in ("walking_story_core.js",):
        pin = f"{core}?v={OWN_RELEASE_PIN}"
        assert f'<script src="{pin}"></script>' in html, core
        assert sw.count(f"'./{pin}'") == 2, core
