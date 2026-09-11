"""Saved detours require 500 metres and 40 minutes; return is explicit."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
STORY_PATH = ROOT / "STORY.md"
UPDATER_PATH = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"
OWN_RELEASE_PIN = "pocket-detours-v382-20260910"
PREVIOUS_RELEASE_PIN = "living-settlements-v281-20260817"
CURRENT_BUILD = "photo-recovery-v392-20260911"


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


def test_the_trigger_needs_forty_minutes_of_far_fixes_and_never_auto_returns():
    out = run_node("""
const S = require('./side_trail_core.js');
const start = 1800000000000;
const fix = (n, extra={}) => ({ questActive:true, questId:'q', distM:500, accuracy:10, now:start+n*60000, fixAt:start+n*60000, ...extra });
let state;
for(let n=0;n<40;n++)state=S.sideTrailStep(state,fix(n));
console.log(JSON.stringify({before:state,after:S.sideTrailStep(state,fix(40)),near:S.sideTrailStep(state,fix(40,{distM:499})),bad:S.sideTrailStep(state,fix(40,{accuracy:200})),returned:S.sideTrailStep(state,fix(40,{sideActive:true,sideAuto:true,distM:0}))}));
""")
    assert out["before"]["action"] is None
    assert out["after"]["action"] == "start"
    assert out["after"]["elapsedMs"] == 40 * 60000
    assert out["near"]["elapsedMs"] == 0
    assert out["bad"]["elapsedMs"] == 39 * 60000
    assert out["returned"]["action"] is None


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


def test_html_suspends_and_explicitly_resumes_the_original_without_claiming_loot():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert f'<script src="side_trail_core.js?v={OWN_RELEASE_PIN}"></script>' in html
    fix = function_source(html, "questOnPositionFix")
    assert "maybeToggleOffRoadSideQuest(quest, lat, lon, accuracy, tOverride)" in fix
    toggle = function_source(html, "maybeToggleOffRoadSideQuest")
    assert "quest.detourOriginalRoute || quest.route" in toggle
    assert "sideTrailStep" in toggle
    assert "step.action === 'end'" not in toggle
    start = function_source(html, "startOffRoadSideQuest")
    assert "auto:true" in start and "parentQuestId:quest.id" in start
    assert "sideTrailTheme" in start
    switch = function_source(html, "commitDetourTransition")
    assert "durableSaveState({throwOnFailure:true})" in switch
    assert "restoreGameStateSnapshot(snapshot)" in switch
    assert "questPocketSuspend" in switch and "questPocketResume" in switch
    assert "sideQuestClaimDiscovery" not in switch and "addPlayerXp" not in switch
    assert "endOffRoadSideQuest" not in function_source(html, "completeWalkingQuest")
    assert "endOffRoadSideQuest" not in function_source(html, "abandonWalkingQuest")
    assert "RESUME ORIGINAL" in function_source(html, "questDetourActionsHTML")


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
    # The original remains protected while a detour is active or suspended.
    assert "End your Side Quest first" in html
    assert "if (activeWalkingQuest() || savedOriginalQuest())" in html


def test_release_is_versioned_and_the_new_core_is_precached_everywhere():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line  # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert sw.count(f"'./side_trail_core.js?v={OWN_RELEASE_PIN}'") == 3
    updater = UPDATER_PATH.read_text(encoding="utf-8")
    assert '"side_trail_core.js"' in updater
    story = STORY_PATH.read_text(encoding="utf-8")
    assert "Wayside Tales" in story
    assert "side quest opens by" in story
