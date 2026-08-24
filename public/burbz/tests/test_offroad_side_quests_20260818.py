"""Off-road side quests: stray 300 m from the main quest and a wander begins.

side_trail_core.js watches the player against the active walking quest's
golden route. Two straight fixes 300 m or more off-route open a side quest by
itself — random name, random finds, and Wayside Tales (hedge-lore found only
off the roads). The main quest keeps every marker and waits. One fix back
within 150 m banks the side quest quietly, every find kept.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
STORY_PATH = ROOT / "STORY.md"
UPDATER_PATH = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"
OWN_RELEASE_PIN = "offroad-side-quests-v283-20260818"
PREVIOUS_RELEASE_PIN = "living-settlements-v281-20260817"
CURRENT_BUILD = "magpie-market-v314-20260824"


def run_node(script: str):
    run = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert run.returncode == 0, run.stderr
    return json.loads(run.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start, name
    return html[start:end]


def test_distance_from_route_measures_against_the_whole_polyline():
    out = run_node("""
const S = require('./side_trail_core.js');
// A straight north-south route; ~0.0009 deg lon at this latitude is ~62 m.
const route = [[51.5, -1.2], [51.51, -1.2]];
console.log(JSON.stringify({
  onRoute: S.distanceFromRouteM(route, 51.505, -1.2),
  midOffset: Math.round(S.distanceFromRouteM(route, 51.505, -1.2043)),
  beyondEnd: Math.round(S.distanceFromRouteM(route, 51.5127, -1.2)),
  objects: Math.round(S.distanceFromRouteM([{lat:51.5,lon:-1.2},{lat:51.51,lon:-1.2}], 51.505, -1.2043)),
  empty: S.distanceFromRouteM([], 51.5, -1.2),
  junk: S.distanceFromRouteM(route, NaN, -1.2)
}));
""")
    # The mid-route point projects onto the segment, not a vertex.
    assert out["onRoute"] < 1
    assert 280 <= out["midOffset"] <= 320
    # Past the end the nearest point is the endpoint itself (~300 m north).
    assert 280 <= out["beyondEnd"] <= 320
    assert out["objects"] == out["midOffset"]
    # No route or no fix can never read as "off route".
    assert out["empty"] is None or out["empty"] > 1e9
    assert out["junk"] is None or out["junk"] > 1e9


def test_the_trigger_needs_two_far_fixes_and_the_return_needs_one():
    out = run_node("""
const S = require('./side_trail_core.js');
const base = { questActive: true, sideActive: false, sideAuto: false, accuracy: 10 };
const far = { ...base, distM: 320 }, near = { ...base, distM: 200 };
const s1 = S.sideTrailStep({ strikes: 0 }, far);
const s2 = S.sideTrailStep(s1, far);
const interrupted = S.sideTrailStep(S.sideTrailStep({ strikes: 0 }, far), near);
const active = { ...base, sideActive: true, sideAuto: true };
console.log(JSON.stringify({
  constants: [S.SIDE_TRAIL_TRIGGER_M, S.SIDE_TRAIL_RETURN_M, S.SIDE_TRAIL_MAX_ACCURACY_M, S.SIDE_TRAIL_START_STRIKES],
  first: s1, second: s2, interrupted,
  badFix: S.sideTrailStep({ strikes: 1 }, { ...far, accuracy: 200 }),
  noQuest: S.sideTrailStep({ strikes: 1 }, { ...far, questActive: false }),
  comeHome: S.sideTrailStep({ strikes: 0 }, { ...active, distM: 120 }),
  stillOut: S.sideTrailStep({ strikes: 0 }, { ...active, distM: 220 }),
  manualSide: S.sideTrailStep({ strikes: 0 }, { ...base, sideActive: true, sideAuto: false, distM: 120 })
}));
""")
    assert out["constants"] == [300, 150, 80, 2]
    # One GPS jump never starts a wander; the second far fix does.
    assert out["first"] == {"action": None, "strikes": 1}
    assert out["second"] == {"action": "start", "strikes": 0}
    # A near fix in between resets the count.
    assert out["interrupted"] == {"action": None, "strikes": 0}
    # Sloppy GPS and quest-less walks decide nothing.
    assert out["badFix"]["action"] is None and out["badFix"]["strikes"] == 0
    assert out["noQuest"]["action"] is None
    # Coming home banks an auto wander at once; 220 m is inside the hysteresis
    # band, so nothing flaps. A manual Side Quest is never auto-ended.
    assert out["comeHome"]["action"] == "end"
    assert out["stillOut"]["action"] is None
    assert out["manualSide"]["action"] is None


def test_wayside_tales_are_whole_canon_and_never_repeat_until_read_dry():
    out = run_node("""
const S = require('./side_trail_core.js');
const totals = S.validateWaysideTales();
const allIds = S.WAYSIDE_TALES.map(t => t.id);
const fresh = S.nextWaysideTale(allIds.slice(1), () => 0.99);
const dry = S.nextWaysideTale(allIds, () => 0);
const kinds = { chest: 0, weapon: 0, questgiver: 0, lore: 0 };
for (let i = 0; i < 1000; i++) kinds[S.sideTrailDiscoveryKind(i / 1000)]++;
console.log(JSON.stringify({
  totals, allIds,
  freshId: fresh.id,
  dryId: dry.id,
  byId: S.waysideTaleById(allIds[0]).title,
  name: S.sideTrailQuestName(() => 0.1),
  kinds,
  folio: S.WAYSIDE_TALES.map(t => t.title + ' ' + t.text).join(' ')
}));
""")
    assert out["totals"]["tales"] == 12
    assert len(set(out["allIds"])) == 12
    # The one unread tale is always the next one; a read-dry pool re-opens.
    assert out["freshId"] == out["allIds"][0]
    assert out["dryId"] in out["allIds"]
    assert out["byId"]
    assert out["name"].startswith("The ")
    # Every classic find survives and lore joins them, all in real shares.
    assert min(out["kinds"].values()) >= 100
    # The hedge-lore stays canon: the usurper, Merlin and the Academy all
    # cast shadows off the road too.
    for anchor in ("usurper", "Merlin", "Academy", "evil Burbz", "hedge"):
        assert anchor in out["folio"], anchor


def test_html_starts_and_banks_the_wander_around_the_live_main_quest():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert f'<script src="side_trail_core.js?v={OWN_RELEASE_PIN}"></script>' in html
    # The position stream decides through the core, only while a quest is live.
    fix = function_source(html, "questOnPositionFix")
    assert "maybeToggleOffRoadSideQuest(quest, lat, lon, accuracy)" in fix
    toggle = function_source(html, "maybeToggleOffRoadSideQuest")
    assert "distanceFromRouteM(quest.route, lat, lon)" in toggle
    assert "sideTrailStep" in toggle
    # The auto wander is a real Side Quest with a parent and a random name.
    start = function_source(html, "startOffRoadSideQuest")
    assert "auto: true" in start
    assert "parentQuestId: quest.id" in start
    assert "sideTrailQuestName" in start
    # Banking is quiet, keeps every find, and never ticks the walk goal —
    # the main quest counts that on its own completion.
    end = html[html.index("async function endOffRoadSideQuest("):html.index("\n// A Side Quest survives app restarts")]
    assert "sideQuestClaimDiscovery(d.id, { quiet: true })" in end
    assert "auto: true" in end
    assert "updateQuestProgress" not in end
    # Finishing or abandoning the main quest banks a live wander too.
    assert "endOffRoadSideQuest('Main quest complete.')" in function_source(html, "completeWalkingQuest")
    assert "endOffRoadSideQuest('Quest abandoned.')" in function_source(html, "abandonWalkingQuest")
    # Both HUD lines can share the map card.
    hud = function_source(html, "updateWalkQuestHud")
    assert "side.name + ' live'" in hud


def test_lore_finds_are_persisted_claimed_once_and_shelved_in_the_folio():
    html = HTML_PATH.read_text(encoding="utf-8")
    spawn = function_source(html, "spawnSideQuestDiscovery")
    assert "sideTrailDiscoveryKind(roll)" in spawn
    assert "nextWaysideTale" in spawn
    assert "claim never rerolls" in spawn
    claim_start = html.index("async function sideQuestClaimDiscovery(")
    claim = html[claim_start:html.index("\n// --- Log + finish", claim_start)]
    assert "d.kind === 'lore'" in claim
    assert "sq.waysideTales.some(t => t.id === d.tale.id)" in claim
    folio = function_source(html, "openFeatheredFolioSheet")
    assert "Wayside Tales" in folio
    assert "data-wayside-tale" in folio
    # State survives saves; the lore marker draws as a scroll.
    assert "gameState.sideQuest.waysideTales = []" in html
    assert "d.kind === 'lore'" in function_source(html, "drawSideQuestOnMap")
    # The manual one-quest-at-a-time rule stays: only the auto path coexists.
    assert "End your Side Quest first" in html
    assert "Finish or abandon your current quest first'); return; }\n  if (sideQuestActive())" in html


def test_release_is_versioned_and_the_new_core_is_precached_everywhere():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line  # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert sw.count(f"'./side_trail_core.js?v={OWN_RELEASE_PIN}'") == 2
    updater = UPDATER_PATH.read_text(encoding="utf-8")
    assert '"side_trail_core.js"' in updater
    story = STORY_PATH.read_text(encoding="utf-8")
    assert "Wayside Tales" in story
    assert "side quest opens by" in story
