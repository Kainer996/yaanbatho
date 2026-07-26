import json
import subprocess
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def run_core(expression: str):
    source = (
        "global.window=global; require('./quest_core.js'); "
        "const q=global.BurbzQuestCore; console.log(JSON.stringify(" + expression + "));"
    )
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def footway(way_id, geometry, **extra_tags):
    tags = {"highway": "footway", "designation": "public_footpath"}
    tags.update(extra_tags)
    return {"type": "way", "id": way_id, "tags": tags, "geometry": geometry}


SQUARE = [
    footway(1, [{"lat": 53.0000, "lon": -2.0000}, {"lat": 53.0000, "lon": -1.9940}]),
    footway(2, [{"lat": 53.0000, "lon": -1.9940}, {"lat": 53.0036, "lon": -1.9940}]),
    footway(3, [{"lat": 53.0036, "lon": -1.9940}, {"lat": 53.0036, "lon": -2.0000}]),
    footway(4, [{"lat": 53.0036, "lon": -2.0000}, {"lat": 53.0000, "lon": -2.0000}]),
]


def test_open_route_with_eighty_seven_metre_gap_is_never_closed_by_a_chord():
    route = [
        {"lat": 53.0000, "lon": -2.0000},
        {"lat": 53.0040, "lon": -2.0000},
        {"lat": 53.0040, "lon": -1.9900},
        {"lat": 53.0000, "lon": -1.9987},
    ]
    result = run_core(
        "(() => { const src="
        + json.dumps(route)
        + "; const out=q.normaliseTrailForPlayer(src,53,-2,6000);"
        " const a=out[0], b=out[out.length-1];"
        " return {style:q.offerLoopStyle(out), gap:q.questHaversine(a.lat,a.lon,b.lat,b.lon), out}; })()"
    )
    assert result["style"] == "out-and-back"
    assert 80 < result["gap"] < 95
    assert result["out"][0] != result["out"][-1]


def test_closed_retrace_is_not_presented_as_a_loop():
    route = [
        {"lat": 53.0000, "lon": -2.0000},
        {"lat": 53.0040, "lon": -2.0000},
        {"lat": 53.0000, "lon": -2.0000},
    ]
    result = run_core(
        "(() => { const route="
        + json.dumps(route)
        + "; return {style:q.offerLoopStyle(route), area:q.ringAreaM2(route)}; })()"
    )
    assert result["style"] == "out-and-back"
    assert result["area"] < 1


def test_equivalence_handles_reversal_loop_rotation_and_different_sampling():
    a = [
        {"lat": 53.000, "lon": -2.000},
        {"lat": 53.000, "lon": -1.994},
        {"lat": 53.004, "lon": -1.994},
        {"lat": 53.004, "lon": -2.000},
        {"lat": 53.000, "lon": -2.000},
    ]
    # Same circuit, opposite direction, a different start, and an extra vertex.
    b = [
        {"lat": 53.004, "lon": -1.994},
        {"lat": 53.002, "lon": -1.994},
        {"lat": 53.000, "lon": -1.994},
        {"lat": 53.000, "lon": -2.000},
        {"lat": 53.004, "lon": -2.000},
        {"lat": 53.004, "lon": -1.994},
    ][::-1]
    result = run_core(
        "(() => { const a="
        + json.dumps(a)
        + ", b="
        + json.dumps(b)
        + "; return {ab:q.routeCoverageFraction(a,b,5),"
        " ba:q.routeCoverageFraction(b,a,5), same:q.routesEquivalent(a,b,{thresholdM:5})}; })()"
    )
    assert result["same"] is True
    assert result["ab"] > 0.98
    assert result["ba"] > 0.98


def test_equivalence_keeps_routes_with_only_a_shared_trunk_distinct():
    a = [
        {"lat": 53.000, "lon": -2.000},
        {"lat": 53.000, "lon": -1.994},
        {"lat": 53.004, "lon": -1.994},
        {"lat": 53.004, "lon": -2.000},
        {"lat": 53.000, "lon": -2.000},
    ]
    b = [
        {"lat": 53.000, "lon": -2.000},
        {"lat": 53.000, "lon": -1.994},  # shared trunk
        {"lat": 52.996, "lon": -1.994},
        {"lat": 52.996, "lon": -2.000},
        {"lat": 53.000, "lon": -2.000},
    ]
    assert run_core(
        "q.routesEquivalent(" + json.dumps(a) + "," + json.dumps(b) + ",{thresholdM:12})"
    ) is False


def test_parse_deduplicates_synthetic_ring_and_same_cluster_route():
    offers = run_core(f"q.parseOverpassTrails({json.dumps({'elements': SQUARE})},52.99995,-1.9970)")
    assert len(offers) == 1
    assert offers[0]["ring"] is True
    assert offers[0]["name"] == "Footpath Ring"
    assert set(offers[0]["sourceRefs"]) == {
        "footpath-cluster/0",
        "footpath-ring/53.00000,-1.99700",
    }


def test_relation_and_public_member_way_collapse_with_public_offer_preferred():
    geometry = [{"lat": 53.0, "lon": -2.0}, {"lat": 53.0045, "lon": -2.0}]
    osm = {
        "elements": [
            {
                "type": "relation",
                "id": 10,
                "tags": {"route": "hiking", "name": "Same Trail"},
                "members": [{"type": "way", "ref": 20, "geometry": geometry}],
            },
            footway(20, geometry, name="Same Trail"),
        ]
    }
    offers = run_core(f"q.parseOverpassTrails({json.dumps(osm)},53,-2.0001)")
    assert len(offers) == 1
    assert offers[0]["kind"] == "footpath"
    assert offers[0]["ref"] == "way/20"
    assert set(offers[0]["sourceRefs"]) == {"rel/10", "way/20"}


def test_map_discovery_preserves_tags_and_rejects_urban_or_unknown_classes():
    def feature(index, cls, **properties):
        props = {"class": cls, "name": cls.title(), **properties}
        return {
            "type": "Feature",
            "properties": props,
            "geometry": {
                "type": "LineString",
                "coordinates": [[-2 + index * 0.001, 53], [-2 + index * 0.001, 53.004]],
            },
        }

    features = [
        feature(0, "pedestrian"),
        feature(1, "cycleway"),
        feature(2, "steps"),
        feature(3, "track"),
        feature(
            4,
            "path",
            subclass="footway",
            designation="public_footpath",
            foot="designated",
            surface="gravel",
            name="Canal Walk",
        ),
    ]
    result = run_core(
        "(() => { const f="
        + json.dumps(features)
        + "; return {offers:q.parseMapWalkableFeatures(f,53,-1.996),"
        " align:f.slice(0,4).map(x=>q.isEligibleMapTransportationFeature(x)),"
        " discover:f.slice(0,4).map(x=>q.isEligibleQuestDiscoveryFeature(x))}; })()"
    )
    assert result["align"] == [True, True, True, True]
    assert result["discover"] == [False, False, False, False]
    assert len(result["offers"]) == 1
    assert result["offers"][0]["name"] == "Canal Walk"
    assert result["offers"][0]["kind"] == "footpath"
    assert result["offers"][0]["tags"]["highway"] == "footway"
    assert result["offers"][0]["tags"]["designation"] == "public_footpath"
    assert result["offers"][0]["tags"]["surface"] == "gravel"


def test_repair_uses_controlled_small_offset_snap_and_certifies_it():
    way = [{"lat": 53.0, "lon": -2.0}, {"lat": 53.005, "lon": -2.0}]
    stale = [{"lat": 53.0, "lon": -1.9997}, {"lat": 53.005, "lon": -1.9997}]
    result = run_core(
        "(() => { const way="
        + json.dumps(way)
        + ", stale="
        + json.dumps(stale)
        + "; const quest={route:stale.map(p=>[p.lat,p.lon]),loopStyle:'out-and-back',"
        "routeAlignmentVersion:0,routeCertification:{status:'uncertified'},checkpoints:[]};"
        " const repair=q.repairQuestRouteAgainstWays(quest,[way],{});"
        " const pts=quest.route.map(p=>({lat:p[0],lon:p[1]}));"
        " const worst=Math.max(...pts.map(p=>q.nearestPointOnRoute(way,p.lat,p.lon,false).distanceM));"
        " return {repair,worst,original:quest.routeOriginal}; })()"
    )
    assert result["repair"]["status"] == "certified"
    assert result["repair"]["changed"] is True
    assert result["worst"] < 0.5
    assert result["original"][0] == [53.0, -1.9997]


def test_repair_anchors_to_original_trailhead_and_refuses_unrelated_network():
    result = run_core(
        """(() => {
          function square(lat,lon){ return [
            [{lat,lon},{lat,lon:lon+.006}],
            [{lat,lon:lon+.006},{lat:lat+.0036,lon:lon+.006}],
            [{lat:lat+.0036,lon:lon+.006},{lat:lat+.0036,lon}],
            [{lat:lat+.0036,lon},{lat,lon}]
          ]; }
          const a=square(53,-2), b=square(53.02,-2);
          const stale=[
            {lat:52.9998,lon:-2.0002},{lat:52.9998,lon:-1.9938},
            {lat:53.0038,lon:-1.9938},{lat:53.0038,lon:-2.0002},
            {lat:52.9998,lon:-2.0002}
          ];
          function quest(){ return {route:stale.map(p=>[p.lat,p.lon]),loopStyle:'loop',
            routeAlignmentVersion:0,routeCertification:{status:'uncertified'},checkpoints:[]}; }
          const both=quest(), onlyWrong=quest();
          const fixed=q.repairQuestRouteAgainstWays(both,a.concat(b),{startLat:53.02,startLon:-1.997});
          const rejected=q.repairQuestRouteAgainstWays(onlyWrong,b,{startLat:53.02,startLon:-1.997});
          return {fixed,rejected,fixedStart:both.route[0],wrongStart:onlyWrong.route[0]};
        })()"""
    )
    assert result["fixed"]["status"] == "certified"
    assert result["fixedStart"] == [53.0, -2.0]
    assert result["rejected"]["status"] == "pending"
    assert result["rejected"]["changed"] is False
    assert result["wrongStart"] == [52.9998, -2.0002]


def test_compiled_way_index_is_cached_and_deduplicates_reverse_geometry():
    result = run_core(
        """(() => {
          const way=[{lat:53,lon:-2},{lat:53.004,lon:-2}];
          const ways=[way,way.slice().reverse()];
          const a=q.compileWalkableWays(ways), b=q.compileWalkableWays(ways);
          const cert=q.certifyRouteAgainstWays(way,[],a);
          return {same:a===b,ways:a.ways.length,segments:a.segments.length,certified:cert.certified};
        })()"""
    )
    assert result == {"same": True, "ways": 1, "segments": 1, "certified": True}


def test_final_offer_merge_and_display_both_apply_whole_route_deduplication():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    assert "dedupeQuestOffers(merged)" in html
    assert "core.dedupeQuestOffers(displayOffers)" in html
    assert "mapDistanceMeters(cs, es)" not in html


def test_generated_map_landmarks_are_small_transparent_and_cached_offline():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    names = [
        "map-landmark-field.webp",
        "map-landmark-grove.webp",
        "map-landmark-water.webp",
    ]
    for name in names:
        path = ROOT / "assets" / "ui" / name
        assert path.exists()
        assert path.stat().st_size < 15_000
        with Image.open(path) as image:
            assert image.size == (144, 144)
            assert image.mode == "RGBA"
            assert image.getextrema()[3][0] == 0
        assert f"assets/ui/{name}" in html
        assert f"./assets/ui/{name}" in sw
    assert "MEDIEVAL_HABITAT_PROPS" not in html
    assert "propSway" not in html
    assert "if (!spawn || !spawn.realFeature) continue;" in html
