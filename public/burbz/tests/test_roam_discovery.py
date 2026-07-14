import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "side_quest_core.js"
QUEST_CORE = ROOT / "quest_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def run_core(expression):
    source = (
        "global.window=global; require('./side_quest_core.js'); require('./quest_core.js');"
        " const s=global.BurbzSideQuestCore; const q=global.BurbzQuestCore;"
        " console.log(JSON.stringify(" + expression + "));"
    )
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


# ---------------- Free-walk recording ----------------

def walk_fixes_expr(n_fixes, step_lat="0.0004"):
    # ~44 m north per fix, 30 s apart: valid walking pace for the glitch guard.
    return (
        "(() => { const roam=s.createRoamState(1000);"
        " for (let i=0;i<" + str(n_fixes) + ";i++) s.recordRoamFix(roam, 53 + i*" + step_lat + ", -2, 10, 1000 + i*30000);"
        " return roam; })()"
    )


def test_roam_walk_records_a_breadcrumb_path_and_distance():
    roam = run_core(walk_fixes_expr(10))
    assert len(roam["path"]) >= 9
    assert roam["distanceM"] > 350
    assert roam["path"][0] == [53, -2]


def test_roam_walk_ignores_low_accuracy_and_teleport_fixes():
    roam = run_core(
        "(() => { const roam=s.createRoamState(1000);"
        " s.recordRoamFix(roam, 53, -2, 10, 1000);"
        " s.recordRoamFix(roam, 53.0004, -2, 300, 31000);"  # hopeless accuracy
        " s.recordRoamFix(roam, 54, -2, 10, 61000);"  # 111 km teleport
        " return roam; })()"
    )
    assert roam["distanceM"] == 0
    assert len(roam["path"]) <= 2  # glitch fixes never extend the trail meaningfully


def test_roam_walk_becomes_quest_ready_after_the_playability_floor():
    result = run_core(
        "(() => { const roam=s.createRoamState(1000); let ready=false;"
        " for (let i=0;i<12;i++) { const r=s.recordRoamFix(roam, 53 + i*0.0004, -2, 10, 1000 + i*30000); if (r.becameQuestReady) ready=true; }"
        " return { ready, len: s.roamPathLengthM(roam), min: s.WALK_QUEST_MIN_M }; })()"
    )
    assert result["ready"] is True
    assert result["len"] >= result["min"]


def test_stale_or_malformed_roam_state_starts_a_fresh_wander():
    assert run_core("s.roamStateStale(null, 5)") is True
    assert run_core("s.roamStateStale({ path: 'nope' }, 5)") is True
    expr = (
        "(() => { const roam=s.createRoamState(0); s.recordRoamFix(roam, 53, -2, 10, 0);"
        " return [s.roamStateStale(roam, 60000), s.roamStateStale(roam, s.ROAM_SESSION_GAP_MS + 60000)]; })()"
    )
    fresh, stale = run_core(expr)
    assert fresh is False
    assert stale is True


# ---------------- Walk -> quest conversion ----------------

def test_walked_path_becomes_a_quest_offer_starting_under_the_player():
    offer = run_core(
        "(() => { const roam=s.createRoamState(1000);"
        " for (let i=0;i<12;i++) s.recordRoamFix(roam, 53 + i*0.0004, -2, 10, 1000 + i*30000);"
        # player stands at the walk's END, so the offer starts there and leads home
        " return s.walkedPathToOffer(roam, 53.0044, -2, { name: 'Test Wander' }); })()"
    )
    assert offer["kind"] == "retrace"
    assert offer["name"] == "Test Wander"
    assert offer["startDistM"] < 50
    assert abs(offer["points"][0]["lat"] - 53.0044) < 0.0005
    assert abs(offer["points"][-1]["lat"] - 53.0) < 0.0005


def test_too_short_a_wander_cannot_become_a_quest():
    assert run_core(
        "(() => { const roam=s.createRoamState(1000);"
        " s.recordRoamFix(roam, 53, -2, 10, 1000); s.recordRoamFix(roam, 53.0004, -2, 10, 31000);"
        " return s.walkedPathToOffer(roam, 53.0004, -2); })()"
    ) is None


def test_retrace_offer_builds_a_full_quest_without_out_and_back_doubling():
    quest = run_core(
        "(() => { const roam=s.createRoamState(1000);"
        " for (let i=0;i<14;i++) s.recordRoamFix(roam, 53 + i*0.0004, -2, 10, 1000 + i*30000);"
        " const offer=s.walkedPathToOffer(roam, 53.0052, -2);"
        " return q.buildQuestFromOffer(offer, { rand: () => 0.42, now: 5 }); })()"
    )
    assert quest["type"] == "retrace"
    assert quest["loopStyle"] == "loop"  # the walked trail IS the route, never doubled
    assert quest["lengthM"] < 800  # ~578 m walk stays ~578 m, not x2
    kinds = [cp["kind"] for cp in quest["checkpoints"]]
    assert kinds[0] == "npc" and kinds[-1] == "finish"
    assert "chest" in kinds


def test_self_contained_offer_kinds_skip_loop_home_charting():
    assert run_core("[s.SIDE_QUEST_TEMPLATES.length >= 4, q.offerIsSelfContained({kind:'side'}), q.offerIsSelfContained({kind:'retrace'}), q.offerIsSelfContained({kind:'adventure'}), q.offerIsSelfContained({kind:'footpath'})]") == [
        True, True, True, True, False
    ]


# ---------------- Side-quest scrolls ----------------

def test_side_quest_scroll_contents_are_deterministic_per_seed():
    a, b, c = run_core("[s.sideQuestForSeed(12345), s.sideQuestForSeed(12345), s.sideQuestForSeed(12346)]")
    assert a == b
    assert a["name"] and a["brief"] and a["giver"] and a["lenM"] > 0
    assert (a["template"], a["giver"]) != (c["template"], c["giver"]) or a != c


def test_side_quest_offer_is_a_loop_anchored_at_the_scroll():
    offer = run_core(
        "(() => { const scroll={ ...s.sideQuestForSeed(7), lat: 53.5, lon: -2.25, key: '1:2:0' };"
        " let x=0.37; const rand=() => { x=(x*9301+49297)%233280/233280; return x; };"
        " return s.sideQuestOffer(scroll, rand); })()"
    )
    assert offer["kind"] == "side"
    assert offer["points"][0] == {"lat": 53.5, "lon": -2.25}
    assert offer["points"][-1] == {"lat": 53.5, "lon": -2.25}
    assert offer["lengthM"] > 300
    assert offer["ref"].startswith("side/")


# ---------------- Game wiring ----------------

def test_roam_discovery_is_wired_into_the_game_shell():
    html = HTML.read_text(encoding="utf-8")
    assert '<script src="side_quest_core.js?v=roam-discovery-v1-20260714"></script>' in html
    # scrolls scattered on the live map through the daily pickup system
    assert "id:'sidequest', glyph:SCROLL_SVG" in html
    assert "openSideQuestScrollSheet(pickup)" in html
    assert "acceptSideQuestScroll" in html
    # scrolls stay hidden while a quest owns the map
    assert "p.type.id !== 'sidequest' || !activeWalkingQuest()" in html
    # the free wander is recorded and drawn whenever no quest is active
    assert "roamOnPositionFix(lat, lon, accuracy, tOverride)" in html
    assert "burbz-roam-trail" in html
    # and it can be turned into a quest from the quest board
    assert "Retrace your wander" in html
    assert "startRoamRetraceQuest" in html
    assert "resetRoamWalk(); // the wander is over" in html


def test_roam_discovery_release_is_cached_offline():
    sw = SW.read_text(encoding="utf-8")
    assert "./side_quest_core.js?v=roam-discovery-v1-20260714" in sw
    assert "burbz-roam-discovery" in sw
