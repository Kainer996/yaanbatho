"""A fight that fits one screen, and an errand sheet that opens to the coins.

Yaan, from two screenshots: the battle screen was half narration and would not
fit without scrolling, nobody knew what Focus was, and the quest sheet opened
into a small box you had to scroll twice to read.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
CORE = ROOT / "battle_core.js"
HTML = INDEX.read_text(encoding="utf-8")
CORE_JS = CORE.read_text(encoding="utf-8")


def _node(script: str):
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(name: str, html: str = HTML) -> str:
    start = html.index("function " + name + "(")
    depth, i, seen = 0, html.index("{", start), False
    while i < len(html):
        if html[i] == "{":
            depth, seen = depth + 1, True
        elif html[i] == "}":
            depth -= 1
            if seen and depth == 0:
                return html[start:i + 1]
        i += 1
    raise AssertionError("unterminated function " + name)


def rule(selector: str, html: str = HTML) -> str:
    match = re.search(r"^" + re.escape(selector) + r"\s*\{[^}]*\}", html, re.M)
    assert match, "no CSS rule for " + selector
    return match.group(0)


# ---------------------------------------------------------------------------
# Focus and Surge are gone
# ---------------------------------------------------------------------------

def test_the_focus_pool_is_gone_from_the_engine():
    payload = _node("""
const core = require('./battle_core.js');
const mk = (id, sp) => core.buildFighter({ id, species:sp, maxHp:110, hp:110, atk:50, def:45,
  spd:50, int:50, cha:50, stamina:55, level:5 });
const b = core.createBattle({
  playerFighters:[mk('p0','Eurasian Magpie'), mk('p1','European Robin')],
  opponentFighters:[mk('o0','Carrion Crow'), mk('o1','Great Tit')],
  seed:'nofocus', tier:2, playerFocusStart: 7 });
const acts = (core.tickToNextTurn(b), core.availableActions(b));
console.log(JSON.stringify({
  keys: Object.keys(b),
  surgeCost: core.SURGE_COST === undefined, focusMax: core.FOCUS_MAX === undefined,
  addFocus: core.addFocus === undefined,
  actionKeys: Object.keys(acts[0] || {})
}));
""")
    assert "focus" not in payload["keys"]          # even playerFocusStart is ignored
    assert payload["surgeCost"] and payload["focusMax"] and payload["addFocus"]
    assert "canSurge" not in payload["actionKeys"]


def test_a_whole_battle_runs_without_a_focus_pool():
    payload = _node("""
const core = require('./battle_core.js');
const mk = (id, sp) => core.buildFighter({ id, species:sp, maxHp:110, hp:110, atk:52, def:45,
  spd:50, int:50, cha:50, stamina:55, level:5 });
function run() {
  const b = core.createBattle({
    playerFighters:[mk('p0','Eurasian Magpie'), mk('p1','European Robin')],
    opponentFighters:[mk('o0','Carrion Crow'), mk('o1','Great Tit')], seed:'runs', tier:2 });
  let guard = 0;
  while (b.phase !== 'over' && guard++ < 800) {
    if (!core.tickToNextTurn(b)) break;
    core.resolveAction(b, core.aiChooseAction(b));
  }
  return { over: b.phase === 'over', winner: b.winner, turns: b.turn };
}
console.log(JSON.stringify({ a: run(), b: run() }));
""")
    assert payload["a"]["over"] is True
    assert payload["a"] == payload["b"]            # still deterministic
    assert payload["a"]["turns"] > 4


def test_surging_a_skill_is_no_longer_a_hidden_multiplier():
    """An old save or a stale caller passing surge:true must not buy damage."""
    payload = _node("""
const core = require('./battle_core.js');
const att = core.buildFighter({ id:'a', species:'Eurasian Sparrowhawk', maxHp:130, hp:130,
  atk:82, def:56, spd:70, int:55, cha:40, stamina:55 });
const foe = core.buildFighter({ id:'d', species:'Common Blackbird', maxHp:95, hp:95,
  atk:44, def:40, spd:52, int:48, cha:52, stamina:45 });
console.log(JSON.stringify({
  plain: core.previewDamage(att, foe, att.skills[0], {}).avg,
  surged: core.previewDamage(att, foe, att.skills[0], { surge:true }).avg
}));
""")
    assert payload["surged"] == payload["plain"]


def test_the_thieving_birds_now_steal_a_moment_off_the_meter():
    """Focus was what a magpie used to snatch. It takes readiness instead."""
    assert "kind:'steal'" not in CORE_JS
    payload = _node("""
const core = require('./battle_core.js');
const magpie = core.buildFighter({ id:'m', species:'Eurasian Magpie', maxHp:110, hp:110,
  atk:60, def:45, spd:60, int:50, cha:50, stamina:55, level:5 });
const snatch = magpie.skills.find(s => s.label === 'Shiny Snatch');
const mark = core.buildFighter({ id:'x', species:'Carrion Crow', maxHp:400, hp:400, atk:40,
  def:40, spd:40, int:40, cha:40, stamina:40, level:5 });
const b = core.createBattle({ playerFighters:[magpie], opponentFighters:[mark], seed:'snatch', tier:2 });
core.tickToNextTurn(b);
while (b.acting.side !== 'player') { core.resolveAction(b, { skillIndex:0, targetIndex:0 }); core.tickToNextTurn(b); }
mark.cr = 80;
core.resolveAction(b, { skillIndex: magpie.skills.indexOf(snatch), targetIndex: 0 });
console.log(JSON.stringify({ shred: snatch.crShred, rider: snatch.rider, markCr: mark.cr }));
""")
    assert payload["shred"] > 0
    assert not payload["rider"]
    assert payload["markCr"] < 80                  # knocked back down the meter


def test_the_focus_rail_and_the_surge_button_are_gone_from_the_screen():
    assert 'id="arenaFocus"' not in HTML
    assert ".arena-focus" not in HTML
    assert ".focus-pips" not in HTML
    assert "surge-btn" not in HTML
    assert "battleToggleSurge" not in HTML
    assert "surgeArmed" not in HTML
    render = function_source("renderArena")
    assert "Focus" not in render
    assert "SURGE" not in render


# ---------------------------------------------------------------------------
# The narration is gone
# ---------------------------------------------------------------------------

def test_a_fight_opens_with_no_narration_at_all():
    start = function_source("startPerchBattle")
    assert "addBattleLog" not in start
    for gone in ("Skyclash: both squads fight at once", "The Speed meter decides who acts",
                 "descends on the perch", "check the damage on the ATTACK button",
                 "before you strike", "NIGHT WINGS!"):
        assert gone not in HTML, gone


def test_the_log_is_a_ticker_with_the_newest_line_on_top():
    add = function_source("addBattleLog")
    # Newest first, so the line that matters is the one you can always see even
    # when the box is squeezed to a single row.
    assert "log.insertBefore(entry, log.firstChild)" in add
    assert "log.children.length > 8" in add


# ---------------------------------------------------------------------------
# The fight fits one screen
# ---------------------------------------------------------------------------

def test_the_arena_is_one_screenful_by_construction():
    live = rule(".battle-arena.live")
    assert "display: flex" in live and "flex-direction: column" in live
    assert "height: 100%" in live
    # A clipped button is worse than a scrollbar: if a screen is too short even
    # for the tightened layout, the arena scrolls rather than hiding a button.
    assert "overflow-y: auto" in live
    assert "overflow: hidden" not in live
    # Every block keeps its size; the log alone gives ground.
    assert ".battle-arena.live > * { flex: 0 0 auto; }" in HTML
    log_rule = rule(".battle-arena.live > .battle-log")
    assert "flex: 0 1 auto" in log_rule and "min-height: 0" in log_rule
    # And the layout is switched on and off with the arena itself.
    assert "$('battleArena').classList.add('live');" in HTML
    assert HTML.count("$('battleArena').classList.remove('live');") == 2


def test_short_phones_get_a_tighter_arena():
    """Measured: at 360x667 the fight ran 13px past the nav bar without this."""
    # The camera screen has its own 740px block, so find the arena's.
    blocks = re.findall(r"@media \(max-height: 740px\) \{.*?\n\}", HTML, re.S)
    body = next((b for b in blocks if ".battle-arena.live" in b), None)
    assert body, "no short-screen arena block"
    assert ".arena-timeline { display: none; }" in body
    assert "max-height: 56px" in body               # the pictures come in
    assert "min-height: 46px" in body               # so do the buttons
    assert "@media (max-height: 640px)" in HTML


def test_the_banner_only_speaks_when_it_has_something_to_say():
    render = function_source("renderArena")
    assert "arenaSynergy.style.display = lines.length ? '' : 'none';" in render
    # It used to print a banner over every ordinary fight saying there was no
    # bonus. That emitted string is gone.
    assert "No mega family bonus in this squad" not in HTML
    # A Liberation Battle still names the village, on a line that stays put.
    assert "🕊️ LIBERATE " in render
    assert "shadow-bound occupying flock" in render


def test_the_potion_row_only_turns_up_when_a_bird_carries_one():
    render = function_source("renderArena")
    assert "const potionButton = !potion ? ''" in render
    assert "No potion equipped" not in HTML


# ---------------------------------------------------------------------------
# The quest sheet opens to the coins
# ---------------------------------------------------------------------------

def test_the_dispatch_sheet_opens_to_just_under_the_coins():
    send = rule(".quest-overlay-panel.is-send")
    assert "height:calc(100dvh - var(--burbz-header-h, 92px) - 6px)" in send
    assert "max-height:none" in send
    # SEND sits at the bottom, under the thumb, whatever the errand's copy runs to.
    assert ".quest-overlay-panel.is-send > .quest-send-btn { margin-top:auto; }" in HTML
    # Only the dispatch sheet is pinned; every other sheet sizes to its content.
    assert 'class="quest-overlay-panel is-send"' in HTML
    panel = rule(".quest-overlay-panel")
    assert "max-height:calc(100dvh - var(--burbz-header-h, 92px) - 6px)" in panel
    assert "82vh" not in panel


def test_the_header_height_is_measured_rather_than_guessed():
    """The header wraps and takes a safe-area inset, so a magic number drifts."""
    fn = function_source("syncHeaderHeightVar")
    assert "document.querySelector('.header')" in fn
    assert "getBoundingClientRect().height" in fn
    assert "setProperty('--burbz-header-h'" in fn
    assert "window.addEventListener('resize', syncHeaderHeightVar);" in HTML
    assert "window.addEventListener('orientationchange', syncHeaderHeightVar);" in HTML
    # Measured again every time a sheet is built, so a rotated phone is right.
    assert "syncHeaderHeightVar();" in function_source("questOverlayEl")


def test_the_whole_errand_fits_in_the_sheet():
    sheet = function_source("renderQuestSendSheet")
    assert "quest-duration-grid" in sheet
    assert "quest-bird-row" in sheet
    # The prose note that explained in a paragraph what each tile prints in
    # numbers is gone; the tiles and labels came in to make the errand fit.
    assert "quest-duration-economy-note" not in HTML
    grid = rule(".quest-duration-grid")
    assert "gap:6px" in grid
    assert "@media (max-height: 740px)" in HTML
    short = re.findall(r"@media \(max-height: 740px\) \{.*?\n\}", HTML, re.S)
    assert any(".quest-overlay-panel.is-send" in blk for blk in short)


# ---------------------------------------------------------------------------
# Release
# ---------------------------------------------------------------------------

CURRENT_BUILD = "feeding-menu-banked-coins-v337-20260831"
# battle_core.js pins the release that last CHANGED it, not the head build —
# later releases that leave the core alone must not churn every phone's cache.
BATTLE_CORE_PIN = "quiet-arena-v331-20260826"
PREVIOUS_BUILD = "field-any-bird-v330-20260826"


def test_release_is_versioned_and_the_changed_core_is_precached_everywhere():
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_BUILD in cache_line            # lineage kept
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    # A stale battle_core in a phone's service-worker cache would run the new
    # arena against an engine that still has a Focus pool.
    assert f"battle_core.js?v={BATTLE_CORE_PIN}" in HTML
    assert sw.count(f"'./battle_core.js?v={BATTLE_CORE_PIN}'") == 2
    updater = (ROOT.parents[1] / "scripts" / "update-live-burbz.sh").read_text(encoding="utf-8")
    assert '"battle_core.js"' in updater
