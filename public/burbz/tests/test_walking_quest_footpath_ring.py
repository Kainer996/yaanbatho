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


def footway(way_id, geometry):
    return {
        "type": "way",
        "id": way_id,
        "tags": {"highway": "footway", "designation": "public_footpath"},
        "geometry": geometry,
    }


# Four public footpaths forming a ~1.6 km square around the player.
SQUARE = [
    footway(1, [{"lat": 53.0000, "lon": -2.0000}, {"lat": 53.0000, "lon": -1.9940}]),
    footway(2, [{"lat": 53.0000, "lon": -1.9940}, {"lat": 53.0036, "lon": -1.9940}]),
    footway(3, [{"lat": 53.0036, "lon": -1.9940}, {"lat": 53.0036, "lon": -2.0000}]),
    footway(4, [{"lat": 53.0036, "lon": -2.0000}, {"lat": 53.0000, "lon": -2.0000}]),
]


def test_footpaths_next_to_player_always_offer_a_ring_that_returns_home():
    osm = {"elements": SQUARE}
    offers = run_core(f"q.parseOverpassTrails({json.dumps(osm)},52.99995,-1.9970)")
    rings = [o for o in offers if o.get("ring")]
    assert len(rings) == 1
    ring = rings[0]
    assert ring["kind"] == "footpath"
    assert ring["name"] == "Footpath Ring"
    assert ring["startDistM"] < 50  # starts on the footpath right next to the player
    assert 1400 < ring["lengthM"] < 1800
    style = run_core(f"q.offerLoopStyle({json.dumps(ring['points'])})")
    assert style == "loop"
    assert ring["points"][0] == ring["points"][-1]  # ends exactly at the start


def test_dead_end_spur_still_loops_home_via_the_ring_lollipop_style():
    spur = footway(5, [{"lat": 53.0000, "lon": -2.0000}, {"lat": 52.9975, "lon": -2.0000}])
    osm = {"elements": SQUARE + [spur]}
    offers = run_core(f"q.parseOverpassTrails({json.dumps(osm)},52.9976,-2.00005)")
    rings = [o for o in offers if o.get("ring")]
    assert len(rings) == 1
    ring = rings[0]
    assert ring["startDistM"] < 50
    assert ring["points"][0] == ring["points"][-1]
    assert ring["lengthM"] > 1600  # spur out + square ring + spur home


def test_when_no_ring_exists_a_straight_footpath_quest_is_still_created():
    # A single short footpath (~220 m) next to the player: too short for the
    # regular playable filter, and no loop is possible — the guarantee still
    # creates a straight quest.
    osm = {"elements": [footway(1, [{"lat": 53.0, "lon": -2.0}, {"lat": 53.002, "lon": -2.0}])]}
    offers = run_core(f"q.parseOverpassTrails({json.dumps(osm)},53.0005,-2.0002)")
    assert len(offers) == 1
    offer = offers[0]
    assert offer["kind"] == "footpath"
    assert offer["name"] == "Nearby Footpath Walk"
    assert offer["startDistM"] < 50
    assert not offer.get("ring")


def test_two_identical_parallel_ways_never_fake_a_ring():
    osm = {
        "elements": [
            footway(1, [{"lat": 53.0, "lon": -2.0}, {"lat": 53.004, "lon": -2.0}]),
            footway(2, [{"lat": 53.0, "lon": -2.0}, {"lat": 53.004, "lon": -2.0}]),
        ]
    }
    offers = run_core(f"q.parseOverpassTrails({json.dumps(osm)},53.001,-2.0001)")
    assert [o for o in offers if o.get("ring")] == []
    assert offers  # the footpath still yields a quest, just not a fake loop


def test_far_away_footpaths_do_not_synthesise_offers():
    osm = {"elements": [footway(1, [{"lat": 53.0, "lon": -2.0}, {"lat": 53.002, "lon": -2.0}])]}
    offers = run_core(f"q.parseOverpassTrails({json.dumps(osm)},53.01,-2.05)")
    assert offers == []


def test_dense_networks_widen_past_too_small_blocks_to_find_a_ring():
    # 8x8 grid of ~90 m blocks: the smallest cycles (~360 m) are below the ring
    # minimum, so the search must widen to a bigger block combination.
    elements = []
    way_id = 1
    for i in range(8):
        for j in range(8):
            p = lambda a, b: {"lat": 53 + a * 0.0008, "lon": -2 + b * 0.00135}
            if j < 7:
                elements.append(footway(way_id, [p(i, j), p(i, j + 1)]))
                way_id += 1
            if i < 7:
                elements.append(footway(way_id, [p(i, j), p(i + 1, j)]))
                way_id += 1
    offers = run_core(f"q.parseOverpassTrails({json.dumps({'elements': elements})},53.0028,-1.9953)")
    rings = [o for o in offers if o.get("ring")]
    assert len(rings) == 1
    assert rings[0]["lengthM"] >= 450


def test_ring_quest_builds_as_a_loop_with_finish_back_at_the_start():
    osm = {"elements": SQUARE}
    result = run_core(
        "(() => { const offers=q.parseOverpassTrails(" + json.dumps(osm) + ",52.99995,-1.9970);"
        "const ring=offers.find(o=>o.ring);"
        "const quest=q.buildQuestFromOffer(ring,{rand:()=>0.42,now:1});"
        "const fin=quest.checkpoints[quest.checkpoints.length-1];"
        "const start=quest.checkpoints[0];"
        "return {loopStyle:quest.loopStyle,type:quest.type,"
        "finishNearStartM:q.questHaversine(start.lat,start.lon,fin.lat,fin.lon)}; })()"
    )
    assert result["loopStyle"] == "loop"
    assert result["type"] == "footpath"
    assert result["finishNearStartM"] < 30


def test_ring_release_is_versioned_for_live_pwa_refresh():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    marker = "quest_core.js?v=bird-levelling-20260722"
    assert marker in html
    assert "./" + marker in sw
    assert "const BURBZ_CACHE = 'burbz-" in sw
