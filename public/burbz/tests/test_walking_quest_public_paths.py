import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "quest_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def run_core(expression: str):
    source = (
        "global.window=global; require('./quest_core.js'); "
        "const q=global.BurbzQuestCore; console.log(JSON.stringify(" + expression + "));"
    )
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_unnamed_walkable_osm_footways_become_real_quest_offers():
    osm = {
        "elements": [
            {
                "type": "way",
                "id": 1001,
                "tags": {"highway": "footway"},
                "geometry": [
                    {"lat": 53.0, "lon": -2.0},
                    {"lat": 53.004, "lon": -2.0},
                ],
            }
        ]
    }
    offers = run_core(f"q.parseOverpassTrails({json.dumps(osm)},53,-2)")
    assert len(offers) == 1
    assert offers[0]["kind"] == "footpath"
    assert offers[0]["name"].startswith("Mapped Footpath")
    assert offers[0]["lengthM"] > 400


def test_private_or_no_access_paths_never_become_quests():
    osm = {
        "elements": [
            {
                "type": "way",
                "id": 2001,
                "tags": {"highway": "footway", "access": "private"},
                "geometry": [{"lat": 53.0, "lon": -2.0}, {"lat": 53.005, "lon": -2.0}],
            },
            {
                "type": "way",
                "id": 2002,
                "tags": {"highway": "path", "foot": "no"},
                "geometry": [{"lat": 53.0, "lon": -2.001}, {"lat": 53.005, "lon": -2.001}],
            },
        ]
    }
    offers = run_core(f"q.parseOverpassTrails({json.dumps(osm)},53,-2)")
    assert offers == []


def test_separate_public_paths_are_not_joined_by_off_map_straight_lines():
    osm = {
        "elements": [
            {
                "type": "way",
                "id": 3001,
                "tags": {"highway": "footway", "designation": "public_footpath"},
                "geometry": [{"lat": 53.0, "lon": -2.0}, {"lat": 53.004, "lon": -2.0}],
            },
            {
                "type": "way",
                "id": 3002,
                "tags": {"highway": "footway", "designation": "public_footpath"},
                "geometry": [{"lat": 53.0043, "lon": -2.0}, {"lat": 53.0083, "lon": -2.0}],
            },
        ]
    }
    offers = run_core(f"q.parseOverpassTrails({json.dumps(osm)},53,-2)")
    assert len(offers) == 2
    for offer in offers:
        jumps = run_core(
            "(() => { const p=" + json.dumps(offer["points"]) + "; return p.slice(1).map((x,i)=>q.questHaversine(p[i].lat,p[i].lon,x.lat,x.lon)); })()"
        )
        assert max(jumps) < 500


def test_quest_start_is_projected_to_nearest_point_on_visible_path_segment():
    points = [{"lat": 53.0, "lon": -2.0}, {"lat": 53.0, "lon": -1.99}]
    result = run_core(
        "(() => { const out=q.normaliseTrailForPlayer("
        + json.dumps(points)
        + ",53.000045,-1.995,6000); return {start:out[0],dist:q.questHaversine(53.000045,-1.995,out[0].lat,out[0].lon)}; })()"
    )
    assert result["dist"] < 8
    assert abs(result["start"]["lon"] + 1.995) < 0.0001


def test_five_metre_start_fix_triggers_even_when_phone_accuracy_is_85m():
    quest = {
        "startedAt": 1,
        "distanceWalkedM": 0,
        "lastFix": None,
        "birdsCaptured": [],
        "chestsOpened": 0,
        "checkpoints": [
            {"kind": "npc", "lat": 53.0, "lon": -2.0, "reached": False},
            {"kind": "finish", "lat": 53.01, "lon": -2.0, "reached": False},
        ],
    }
    result = run_core(
        "(() => { const quest="
        + json.dumps(quest)
        + "; const near=q.destPoint(53,-2,90,5); const events=q.questProcessFix(quest,near.lat,near.lon,85,1000); return {types:events.map(e=>e.type),reached:quest.checkpoints[0].reached,distance:quest.distanceWalkedM}; })()"
    )
    assert result["types"] == ["npc"]
    assert result["reached"] is True
    assert result["distance"] == 0


def test_render_hides_finish_flag_until_every_required_marker_is_reached():
    html = HTML.read_text(encoding="utf-8")
    assert "questFinishIsReady" in html
    assert "if (cp.kind === 'finish' && !window.BurbzQuestCore.questFinishIsReady(quest)) return" in html
    assert "questOnPositionFix(liveMapLastPosition.lat, liveMapLastPosition.lon" in html


def test_visible_map_footpaths_are_merged_into_quest_discovery():
    features = [
        {
            "type": "Feature",
            "properties": {"class": "path", "subclass": "footway", "name": "Canal Walk"},
            "geometry": {
                "type": "LineString",
                "coordinates": [[-2.0, 53.0], [-2.0, 53.004]],
            },
        }
    ]
    offers = run_core(f"q.parseMapWalkableFeatures({json.dumps(features)},53,-2)")
    assert len(offers) == 1
    assert offers[0]["name"] == "Canal Walk"
    assert offers[0]["source"] == "visible-map"
    html = HTML.read_text(encoding="utf-8")
    assert "function visibleMapWalkingQuestOffers(" in html
    assert "mergeQuestOffers(offers, visibleMapWalkingQuestOffers(lat, lon))" in html


def test_release_is_versioned_for_live_pwa_refresh():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    marker = "quest_core.js?v=quest-path-alignment-20260723"
    assert marker in html
    assert "./" + marker in sw
    assert "const BURBZ_CACHE = 'burbz-" in sw
