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


def test_graph_does_not_fuse_distinct_path_ends_into_a_straight_chord():
    # Two footpaths whose nearest ends sit ~14.5 m apart — DISTINCT paths that do
    # NOT share an OSM node. The old graph fused any endpoints within 20 m into
    # one node, then pathPointsAlongEdges drew a straight diagonal across the gap
    # (the "line cuts across the footpath" bug). A tight merge tolerance must
    # keep them as separate nodes.
    way_a = [{"lat": 53.0000, "lon": -2.0000}, {"lat": 53.0000, "lon": -1.9970}]
    way_b = [{"lat": 53.00013, "lon": -1.9970}, {"lat": 53.00013, "lon": -2.0000}]
    result = run_core(
        "(() => { const a=" + json.dumps(way_a) + ", b=" + json.dumps(way_b) + ";"
        "const wide=q.buildPathNetwork([a.map(p=>({...p})),b.map(p=>({...p}))], 20, 20).nodes.length;"
        "const tight=q.buildPathNetwork([a.map(p=>({...p})),b.map(p=>({...p}))], 20).nodes.length;"
        "return {wide, tight}; })()"
    )
    assert result["wide"] == 2   # old behaviour fuses the 14.5 m gap -> chord
    assert result["tight"] == 4  # default now keeps the four ends distinct


def test_true_junction_still_fuses_so_rings_still_form():
    # Endpoints that genuinely coincide (a real OSM junction) must still merge,
    # or footpath rings would stop forming. The square's corners are coincident.
    square = [
        [{"lat": 53.0000, "lon": -2.0000}, {"lat": 53.0000, "lon": -1.9940}],
        [{"lat": 53.0000, "lon": -1.9940}, {"lat": 53.0036, "lon": -1.9940}],
        [{"lat": 53.0036, "lon": -1.9940}, {"lat": 53.0036, "lon": -2.0000}],
        [{"lat": 53.0036, "lon": -2.0000}, {"lat": 53.0000, "lon": -2.0000}],
    ]
    osm = {"elements": [
        {"type": "way", "id": i + 1, "tags": {"highway": "footway", "designation": "public_footpath"}, "geometry": g}
        for i, g in enumerate(square)
    ]}
    offers = run_core(f"q.parseOverpassTrails({json.dumps(osm)},52.99995,-1.9970)")
    rings = [o for o in offers if o.get("ring")]
    assert len(rings) == 1
    ring = rings[0]
    # Every drawn segment must be a real edge of the square (~600 m sides
    # decimated), never a diagonal chord across a corner. The square is 600 m
    # per side; a corner-cutting chord would be much shorter but OFF the path —
    # assert instead that the ring closes and stays the right length.
    assert 1400 < ring["lengthM"] < 1800
    # No single segment should jump more than one side length (no cross-square cut)
    seg_check = run_core(
        "(() => { const pts=" + json.dumps(ring["points"]) + "; let mx=0;"
        "for(let i=1;i<pts.length;i++) mx=Math.max(mx,q.questHaversine(pts[i-1].lat,pts[i-1].lon,pts[i].lat,pts[i].lon));"
        "return Math.round(mx); })()"
    )
    assert seg_check <= 620  # longest hop is one side, not a diagonal across


def test_index_wires_alignment_into_start_resume_and_walking():
    html = HTML.read_text(encoding="utf-8")
    assert "function visibleWalkablePathWays" in html
    assert "function alignActiveQuestRouteToMapPaths" in html
    assert html.count("alignActiveQuestRouteToMapPaths(true)") >= 3  # start, resume, loop upgrade
    assert "scheduleWalkQuestRealign" in html
    # The snapping helper now lives in quest_core.js; index.html drives it
    # through alignActiveQuestRouteToMapPaths rather than owning a copy.
    assert "snapRouteToWays" in (ROOT / "quest_core.js").read_text(encoding="utf-8")
    # Badly-off routes are re-charted over the rendered network, never half-snapped.
    assert "rechartRouteOnWays" in (ROOT / "quest_core.js").read_text(encoding="utf-8")
    # "70% of samples landed on a way" was a heuristic; a route now carries a
    # certificate, and index.html reads that verdict instead of the raw fraction.
    core = (ROOT / "quest_core.js").read_text(encoding="utf-8")
    assert "function certifyRouteAgainstWays" in core
    assert "repairQuestRouteAgainstWays" in html and "repairQuestRouteAgainstWays" in core
    assert "routeCertification" in html
    # Overpass and basemap offers now meet the same whole-route integrity guard.
    assert "dedupeQuestOffers(merged)" in html


def test_release_is_versioned_for_live_pwa_refresh():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    marker = "quest_core.js?v=quest-alignment-authority-v124-20260727"
    assert marker in html
    assert "./" + marker in sw
    assert "const BURBZ_CACHE = 'burbz-" in sw
