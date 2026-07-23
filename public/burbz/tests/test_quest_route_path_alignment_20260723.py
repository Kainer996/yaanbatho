"""Quest routes must trace the real footpath, not cut straight across it.

Two defences ship together:
  * simplifyRoute — shape-preserving decimation (Douglas-Peucker over real
    vertices) replaces the old even-resampling for stored/drawn routes, which
    chorded bends into straight cuts.
  * snapRouteToWays / snapPointToWays — re-snap a route (and its markers)
    onto the walkable ways rendered in the basemap tiles, so the golden line
    hugs the same footpaths the player sees, even when the trail source
    (Overpass mirror, router) disagrees slightly with the basemap.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
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


def dense_l_path():
    # A sharp L: ~1.5 km north then ~1.5 km east, vertices every ~5 m.
    pts = [{"lat": 53 + i * 0.000045, "lon": -2.0} for i in range(301)]
    pts += [{"lat": 53.0135, "lon": -2.0 + i * 0.000075} for i in range(1, 301)]
    return pts


def test_simplify_route_keeps_corners_instead_of_cutting_them():
    pts = dense_l_path()
    result = run_core(
        "(() => { const pts=" + json.dumps(pts) + ";"
        "const out=q.simplifyRoute(pts, 40);"
        "return {n:out.length,"
        "cornerDistM:q.nearestPointOnRoute(out, 53.0135, -2.0, false).distanceM,"
        "allOriginal:out.every(p=>pts.some(o=>o.lat===p.lat&&o.lon===p.lon))}; })()"
    )
    assert result["n"] <= 40
    assert result["allOriginal"]  # kept points are real path vertices
    assert result["cornerDistM"] < 1  # the corner survives — no straight cut


def test_quest_route_follows_the_sharp_corner_of_its_source_path():
    pts = dense_l_path()
    result = run_core(
        "(() => { const offer={kind:'footpath',name:'L',points:" + json.dumps(pts) + "};"
        "const quest=q.buildQuestFromOffer(offer,{rand:()=>0.4,now:1});"
        "const route=quest.route.map(p=>({lat:p[0],lon:p[1]}));"
        "return q.nearestPointOnRoute(route, 53.0135, -2.0, false).distanceM; })()"
    )
    # Even resampling put the corner ~3+ m off the drawn line; DP keeps it on.
    assert result < 1.5


def test_snap_route_to_ways_hugs_the_rendered_footpath():
    # The rendered footpath: 500 m north then 500 m east.
    way = [{"lat": 53 + i * 0.00045, "lon": -2.0} for i in range(11)]
    way += [{"lat": 53.0045, "lon": -2.0 + i * 0.00075} for i in range(1, 11)]
    # A stale straight route running ~25 m east of the north leg.
    route = [{"lat": 53 + i * 0.001125, "lon": -1.999627} for i in range(5)]
    result = run_core(
        "(() => { const ways=[" + json.dumps(way) + "]; const route=" + json.dumps(route) + ";"
        "const res=q.snapRouteToWays(route, ways, {maxSnapM:32, stepM:12});"
        "const worst=Math.max.apply(null, res.points.map(p=>q.nearestPointOnRoute(ways[0],p.lat,p.lon,false).distanceM));"
        "return {worst:worst, frac:res.snappedFraction, n:res.points.length}; })()"
    )
    assert result["frac"] > 0.9
    assert result["n"] >= 5
    assert result["worst"] < 2  # every drawn point now sits ON the footpath


def test_snap_route_leaves_points_alone_when_no_way_is_near():
    way = [{"lat": 53.02, "lon": -2.0}, {"lat": 53.03, "lon": -2.0}]  # ~2 km away
    route = [{"lat": 53.0, "lon": -2.0}, {"lat": 53.001, "lon": -2.0}]
    result = run_core(
        "(() => { const res=q.snapRouteToWays(" + json.dumps(route) + ", [" + json.dumps(way) + "], {maxSnapM:32});"
        "return {frac:res.snappedFraction, first:res.points[0], last:res.points[res.points.length-1]}; })()"
    )
    assert result["frac"] == 0
    assert result["first"] == {"lat": 53.0, "lon": -2.0}
    assert result["last"] == {"lat": 53.001, "lon": -2.0}


def test_snap_point_to_ways_nudges_markers_onto_the_path():
    way = [{"lat": 53.0, "lon": -2.0}, {"lat": 53.01, "lon": -2.0}]
    near = run_core(f"q.snapPointToWays({{lat:53.005, lon:-1.99973}}, [{json.dumps(way)}], 32)")
    assert near is not None
    assert near["distM"] < 32
    assert abs(near["lon"] - (-2.0)) < 1e-9  # landed on the way itself
    far = run_core(f"q.snapPointToWays({{lat:53.005, lon:-1.997}}, [{json.dumps(way)}], 32)")
    assert far is None  # ~200 m away: never yanked across the map


def square_network():
    # Four ways forming a ~1.6 km square — stands in for the rendered basemap.
    return [
        [{"lat": 53.0000, "lon": -2.0000}, {"lat": 53.0000, "lon": -1.9940}],
        [{"lat": 53.0000, "lon": -1.9940}, {"lat": 53.0036, "lon": -1.9940}],
        [{"lat": 53.0036, "lon": -1.9940}, {"lat": 53.0036, "lon": -2.0000}],
        [{"lat": 53.0036, "lon": -2.0000}, {"lat": 53.0000, "lon": -2.0000}],
    ]


def test_rechart_rebuilds_a_stale_ring_on_the_rendered_network():
    # A stale ring whose geometry mostly misses the rendered square (offset
    # ~150 m south) — snapping can't fix it, recharting must.
    stale = [
        {"lat": 52.99865, "lon": -1.9995},
        {"lat": 52.9975, "lon": -1.997},
        {"lat": 52.99865, "lon": -1.9945},
        {"lat": 52.9998, "lon": -1.997},
        {"lat": 52.99865, "lon": -1.9995},
    ]
    result = run_core(
        "(() => { const ways=" + json.dumps(square_network()) + ";"
        "const stale=" + json.dumps(stale) + ";"
        "const redo=q.rechartRouteOnWays(stale, ways, {startLat:52.99995, startLon:-1.997});"
        "if (!redo) return {redo:null};"
        "const worst=Math.max.apply(null, redo.points.map(p=>"
        "  Math.min.apply(null, ways.map(w=>q.nearestPointOnRoute(w,p.lat,p.lon,false).distanceM))));"
        "const closes=q.questHaversine(redo.points[0].lat,redo.points[0].lon,"
        "  redo.points[redo.points.length-1].lat,redo.points[redo.points.length-1].lon);"
        "return {ring:redo.ring, lengthM:redo.lengthM, worst:worst, closes:closes}; })()"
    )
    assert result.get("ring") is True
    assert 1400 < result["lengthM"] < 1900
    assert result["worst"] < 25  # the new walk lies ON the rendered ways
    assert result["closes"] < 25  # and still ends where it began


def test_rechart_refuses_when_no_rendered_path_is_near_the_start():
    stale = [{"lat": 52.99, "lon": -1.997}, {"lat": 52.985, "lon": -1.997}, {"lat": 52.99, "lon": -1.997}]
    result = run_core(
        "q.rechartRouteOnWays(" + json.dumps(stale) + ", " + json.dumps(square_network()) + ", {})"
    )
    assert result is None  # >160 m from any way: keep the old route, invent nothing


def test_index_wires_alignment_into_start_resume_and_walking():
    html = HTML.read_text(encoding="utf-8")
    assert "function visibleWalkablePathWays" in html
    assert "function alignActiveQuestRouteToMapPaths" in html
    assert html.count("alignActiveQuestRouteToMapPaths(true)") >= 3  # start, resume, loop upgrade
    assert "scheduleWalkQuestRealign" in html
    assert "snapRouteToWays" in html
    # Badly-off routes are re-charted over the rendered network, never half-snapped.
    assert "rechartRouteOnWays" in html
    assert "snappedFraction >= 0.7" in html
    # And a basemap-charted ring outranks a mirror-sourced one at discovery.
    assert "visibleRing" in html


def test_release_is_versioned_for_live_pwa_refresh():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    marker = "quest_core.js?v=quest-path-alignment-r2-20260723"
    assert marker in html
    assert "./" + marker in sw
    assert "const BURBZ_CACHE = 'burbz-" in sw
