"""A quest may never be stuck on "Mapped footpaths are still loading" for ever.

Route alignment used to certify a quest ONLY against the walkable ways read out
of the basemap vector tiles currently loaded for the viewport. That evidence can
say "not proved yet"; it can never say "proved impossible" — so every failure
became `pending`, and `pending` was retried on map tile events with no end and
no other outcome. A route lying outside the loaded tiles (map zoomed out, quest
starting off-screen) is never proved by waiting, so the banner stayed up for as
long as the player cared to look at it.

Three defences ship together:
  * authoritative evidence — the mapped-path archive (the same OpenStreetMap
    data quests are discovered from) is queried for the whole route corridor,
    so alignment can reach a FINAL verdict: certified, or genuinely blocked.
    Discovery already downloads that network, so a discovered offer carries it
    and starting the quest costs no extra round-trip.
  * a bounded retry window — with no tiles and no archive answer the loop stops
    and says so, instead of promising a load that is never going to finish.
  * self-consistent geometry — an offer's stored route is chained and
    simplified within the corridor it is certified against, so a quest can
    never fail to align against the very paths it was built from.
"""
import json
import re
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


def run_core_async(expression: str):
    source = (
        "global.window=global; require('./quest_core.js'); "
        "const q=global.BurbzQuestCore; Promise.resolve(" + expression + ")"
        ".then(v => console.log(JSON.stringify(v)));"
    )
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def html_source() -> str:
    return HTML.read_text(encoding="utf-8")


def extract(function_name: str, src: str) -> str:
    """Pull a top-level `function name(...)` body out of index.html."""
    match = re.search(r"^(?:async )?function " + re.escape(function_name) + r"\(", src, re.M)
    assert match, "could not find " + function_name
    start = match.start()
    # Skip the parameter list — it may itself contain braces (destructured opts).
    i, paren = match.end() - 1, 0
    while i < len(src):
        if src[i] == "(":
            paren += 1
        elif src[i] == ")":
            paren -= 1
            if paren == 0:
                break
        i += 1
    depth, i, opened = 0, src.index("{", i), False
    while i < len(src):
        if src[i] == "{":
            depth += 1
            opened = True
        elif src[i] == "}":
            depth -= 1
            if opened and depth == 0:
                return src[start:i + 1]
        i += 1
    raise AssertionError("could not extract " + function_name)


def wiggly(lat0, lon0, n, d_lat, d_lon):
    """A path with real curvature — straight lines hide simplification error."""
    import math
    return [
        {
            "lat": round(lat0 + i * d_lat + math.sin(i / 2) * 0.00002, 7),
            "lon": round(lon0 + i * d_lon + math.cos(i / 3) * 0.00002, 7),
        }
        for i in range(n)
    ]


WAY_A = wiggly(53.0, -2.0, 40, 0.00012, 0.00003)
WAY_B = wiggly(WAY_A[-1]["lat"], WAY_A[-1]["lon"] - 0.00002, 40, 0.00002, 0.00016)
OSM = {
    "elements": [
        {"type": "way", "id": 1, "tags": {"highway": "footway", "designation": "public_footpath"}, "geometry": WAY_A},
        {"type": "way", "id": 2, "tags": {"highway": "footway", "designation": "public_footpath"}, "geometry": WAY_B},
        # Not walkable evidence, and never a quest.
        {"type": "way", "id": 3, "tags": {"highway": "residential", "name": "Mill Lane"},
         "geometry": wiggly(53.0, -1.997, 20, 0.0002, 0.0)},
        {"type": "way", "id": 4, "tags": {"highway": "footway", "access": "private"},
         "geometry": wiggly(53.0, -1.995, 20, 0.0002, 0.0)},
    ]
}


def test_alignment_evidence_is_tag_verified_walkable_ways_only():
    ways = run_core(f"q.overpassAlignmentWays({json.dumps(OSM)})")
    assert len(ways) == 2, "roads and private footways are not walkable evidence"
    assert run_core("q.isAlignmentEligibleTags({highway:'path'})") is True
    assert run_core("q.isAlignmentEligibleTags({highway:'footway',foot:'no'})") is False
    assert run_core("q.isAlignmentEligibleTags({highway:'track',access:'private'})") is False
    assert run_core("q.isAlignmentEligibleTags({highway:'residential'})") is False


def test_discovered_offers_carry_the_corridor_evidence_discovery_downloaded():
    offers = run_core(f"q.parseOverpassTrails({json.dumps(OSM)},52.9998,-2.0002)")
    assert offers, "the footpath cluster is a quest offer"
    for offer in offers:
        assert len(offer["alignmentWays"]) == 2, "starting a quest needs no second round-trip"


def test_a_quest_certifies_against_the_paths_it_was_built_from():
    # The exact case in the field: an offer discovered from the mapped-path
    # archive, started while the loaded tiles cannot prove it.
    result = run_core(
        f"(() => {{ const offers=q.parseOverpassTrails({json.dumps(OSM)},52.9998,-2.0002);"
        " const offer=offers[0];"
        " const quest=q.buildQuestFromOffer(offer,{rand:()=>0.4,now:1});"
        " const tiles=q.repairQuestRouteAgainstWays("
        "   q.buildQuestFromOffer(offer,{rand:()=>0.4,now:1}), []);"
        " const authority=q.repairQuestRouteAgainstWays(quest, offer.alignmentWays,"
        "   {authoritativeFullCoverage:true});"
        " return {tiles, authority, status:quest.routeCertification.status}; })()"
    )
    assert result["tiles"] == {"status": "pending", "reason": "tiles-not-ready"}
    assert result["authority"]["status"] == "certified", "complete evidence must settle it"
    assert result["status"] == "certified", "the quest is playable, not stuck loading"


def test_router_loop_carries_complete_mapped_route_evidence():
    outward = [{"lat": 53 + i * 0.0001, "lon": -2} for i in range(31)]
    returned = [
        [-2, 53.003],
        [-1.999, 53.003],
        [-1.999, 53.0],
        [-2, 53.0],
    ]
    result = run_core_async(
        "q.fetchLoopBackRoute(" + json.dumps(outward) + ", {"
        " fetchFn:()=>Promise.resolve({ok:true,json:()=>Promise.resolve({features:[{geometry:{coordinates:"
        + json.dumps(returned) + "}}]})}), maxTotalMs:2000"
        "}).then(loop => ({loopedBack:loop.loopedBack, points:loop.points.length, "
        " ways:loop.alignmentWays.length, evidencePoints:loop.alignmentWays[0].length}))"
    )
    assert result["loopedBack"] is True
    assert result["ways"] == 1
    assert result["evidencePoints"] == result["points"], \
        "activation needs evidence for the outward and router-added return legs"


def test_authoritative_evidence_never_answers_pending():
    # Whatever the route, a full-coverage query gives a verdict the UI can act
    # on. "pending" would put the retry loop straight back where it started.
    verdicts = run_core(
        f"(() => {{ const offers=q.parseOverpassTrails({json.dumps(OSM)},52.9998,-2.0002);"
        " const ways=offers[0].alignmentWays;"
        " const stray=q.buildQuestFromOffer({kind:'adventure',name:'Off-path',points:["
        "   {lat:53.05,lon:-2.05},{lat:53.055,lon:-2.05},{lat:53.06,lon:-2.048}]},{rand:()=>0.4,now:1});"
        " const partial=q.buildQuestFromOffer(offers[0],{rand:()=>0.4,now:1});"
        " return [q.repairQuestRouteAgainstWays(stray,ways,{authoritativeFullCoverage:true}).status,"
        "  q.repairQuestRouteAgainstWays(partial,ways,{authoritativeFullCoverage:true}).status]; })()"
    )
    assert verdicts[0] == "impossible", "a route off every mapped path is refused, not retried"
    assert verdicts[1] == "certified"


def test_chained_offers_are_never_joined_across_a_gap_they_cannot_certify():
    # A chain join looser than the way-graph's merge distance produces a quest
    # whose route reads as "disconnected" against ANY evidence — unalignable,
    # and so a permanent "still loading".
    gapped = run_core(
        "(() => { const a=[{lat:53,lon:-2},{lat:53.004,lon:-2}];"
        " const b=[{lat:53.004,lon:-1.99998},{lat:53.008,lon:-1.99998}];"  # ~1.3 m gap
        " const chains=q.clusterChains([a,b]);"
        " return chains.length; })()"
    )
    assert gapped == 2, "a mapped gap stays a gap"
    touching = run_core(
        "(() => { const a=[{lat:53,lon:-2},{lat:53.004,lon:-2}];"
        " const b=[{lat:53.004,lon:-2},{lat:53.008,lon:-2}];"
        " return q.clusterChains([a,b]).length; })()"
    )
    assert touching == 1, "a true shared node still chains"


def test_stored_route_stays_inside_the_certification_corridor():
    # A finely-wiggling path: shape-preserving simplification used to widen its
    # epsilon until the stored route sat further from the source path than the
    # 2 m certification corridor — a quest that could not be aligned against the
    # very footpath it was built from, on any evidence, for ever.
    dense = run_core(
        "(() => { const pts=[]; for (let i=0;i<1200;i++) pts.push("
        "  {lat:53+i*0.00002, lon:-2+Math.sin(i/0.7)*0.00004});"
        " const source=q.trimRouteToLength(pts,2800);"
        " const quest=q.buildQuestFromOffer({kind:'footpath',name:'Dense',points:pts},{rand:()=>0.4,now:1});"
        " const route=quest.route.map(p=>({lat:p[0],lon:p[1]}));"
        " let worst=0; q.densifyRoute(route,2,20000).forEach(p=>{"
        "  const d=q.nearestPointOnRoute(source,p.lat,p.lon,false).distanceM; if (d>worst) worst=d; });"
        " return {worst, uncapped:q.simplifyRoute(source,320).length, kept:route.length,"
        "  cert:q.repairQuestRouteAgainstWays(quest,[source],{authoritativeFullCoverage:true}).status}; })()"
    )
    assert dense["kept"] > dense["uncapped"], "extra vertices are kept rather than cutting corners"
    assert dense["worst"] < 2, "simplification may never push a route out of its own corridor"
    assert dense["cert"] == "certified"


def test_alignment_query_covers_the_whole_route_corridor():
    bounds = run_core("q.routeBounds([{lat:53,lon:-2},{lat:53.01,lon:-1.99}],150)")
    assert bounds["minLat"] < 53.0 and bounds["maxLat"] > 53.01
    assert bounds["minLon"] < -2.0 and bounds["maxLon"] > -1.99
    query = run_core(f"q.buildAlignmentOverpassQuery({json.dumps(bounds)})")
    assert "out:json" in query and "out geom" in query
    for cls in ("path", "footway", "bridleway", "track"):
        assert cls in query
    assert "[access!~" in query and "[foot!~" in query


def test_fetch_alignment_ways_falls_over_to_the_next_mirror():
    result = run_core_async(
        """(() => {
          const calls=[];
          const fetchFn=(url)=>{ calls.push(url);
            if (calls.length===1) return Promise.reject(new Error('down'));
            return Promise.resolve({ ok:true, json:()=>Promise.resolve({elements:[
              {type:'way',id:9,tags:{highway:'footway'},geometry:[{lat:53,lon:-2},{lat:53.001,lon:-2}]}]}) }); };
          return q.fetchAlignmentWays({minLat:52.9,minLon:-2.1,maxLat:53.1,maxLon:-1.9},
            {fetchFn, endpoints:['https://a/interpreter','https://b/interpreter']})
            .then(ways=>({ways:ways.length, calls:calls.length}));
        })()"""
    )
    assert result == {"ways": 1, "calls": 2}


ALIGNMENT_FUNCTIONS = [
    "ensureWalkingQuestState", "activeWalkingQuest", "setWalkQuestAlignmentStatus",
    "walkQuestAlignmentMessage", "walkQuestRoutePoints", "walkQuestAuthorityWays",
    "certifyQuestAgainstAuthority", "requestAuthoritativeQuestAlignment",
    "holdWalkQuestAlignmentPending", "alignActiveQuestRouteToMapPaths",
    "installWalkQuestAlignmentReadinessRetry", "giveUpOnWalkQuestAlignment",
    "uninstallWalkQuestAlignmentReadinessRetry", "startWalkingQuestFromOffer",
    "activateWalkingQuestFromOffer",
]

# Everything the alignment path touches that is not itself under test.
ALIGNMENT_SHIM = """
global.window = global;
require('./quest_core.js');
let now = 1000000;
const realNow = Date.now;
Date.now = () => now;
const timers = new Map();
let timerSeq = 0;
global.setTimeout = (fn, ms) => { timerSeq += 1; timers.set(timerSeq, { fn, at: now + (ms || 0) }); return timerSeq; };
global.clearTimeout = id => { timers.delete(id); };
const advance = ms => {
  now += ms;
  [...timers.entries()].filter(([, t]) => t.at <= now).forEach(([id, t]) => { timers.delete(id); t.fn(); });
};
const settle = () => new Promise(r => realNow && process.nextTick(() => process.nextTick(r)));

const toasts = [], statuses = [];
let saves = 0;
const showToast = m => toasts.push(m);
const saveState = () => { saves += 1; };
global.$ = () => null;
const listeners = {};
const liveMap = {
  on: (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); },
  off: (name, fn) => { listeners[name] = (listeners[name] || []).filter(f => f !== fn); },
  getZoom: () => 15,
};
const fireTileEvent = () => (listeners.sourcedata || []).slice().forEach(fn => fn({ sourceId: 'openmaptiles' }));
const listenerCount = () => Object.values(listeners).reduce((n, a) => n + a.length, 0);
const WALK_QUEST_RETRY_EVENTS = ['sourcedata', 'styledata'];

let gameState = { walkingQuests: { active: null, history: [] } };
let walkQuestPendingActivation = null;
let walkQuestActivationInFlight = false;
let walkQuestAlignState = { questId: null, lastAt: 0 };
let walkQuestRealignTimer = null;
let walkQuestLastSave = 0;
let visibleTileWays = [];
const visibleWalkablePathWays = () => visibleTileWays;
const drawWalkingQuestOnMap = () => {};
const updateWalkQuestHud = () => {};
const closeWalkQuestSheet = () => {};
const setQuestOverview = () => {};
const switchScreen = () => {};
const maybeChartLoopHome = () => {};
const showQuestNpcDialog = () => {};
const sideQuestActive = () => null;
const vibrate = () => {};
const SFX = { levelUp: () => {}, tap: () => {}, capture: () => {} };
const QUEST_BUZZ = { start: [] };
const likelyRowsToQuestBirds = rows => rows || [];
const attachStoryToNewWalkingQuest = () => null;
const fetchQuestLikelyBirds = () => Promise.resolve([]);
const ensureOfferLoopBack = () => Promise.resolve(null);
const mapDistanceMeters = () => 9999;
const questOnPositionFix = () => [];
let liveMapHasPrecisePosition = false;
let liveMapLastPosition = null;
"""


def run_alignment(script: str):
    src = html_source()
    consts = "\n".join(
        line.strip() for line in src.splitlines()
        if re.match(r"^const (WALK_QUEST_ALIGN_\w+|WALK_QUEST_RETRY_WINDOW_MS|WALK_QUEST_AUTHORITY_\w+) =",
                    line.strip())
    )
    assert "WALK_QUEST_RETRY_WINDOW_MS" in consts and "WALK_QUEST_ALIGN_STALLED_MSG" in consts
    state = "\n".join(
        line.strip() for line in src.splitlines()
        if re.match(r"^let (walkQuestAlignmentRetry|walkQuestAuthority\w+|walkQuestStalledNoticeAt) =",
                    line.strip())
    )
    bodies = "\n".join(extract(name, src) for name in ALIGNMENT_FUNCTIONS)
    program = ALIGNMENT_SHIM + consts + "\n" + state + "\n" + bodies + "\n" + script
    result = subprocess.run(["node", "-e", program], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def offer_js() -> str:
    return (
        "const offers = window.BurbzQuestCore.parseOverpassTrails(" + json.dumps(OSM) + ", 52.9998, -2.0002);"
        " const offer = offers[0]; offer._loop = null;"
    )


def test_a_quest_starts_even_when_no_tiles_can_prove_it():
    result = run_alignment(
        offer_js() +
        """
        (async () => {
          visibleTileWays = [];                       // map zoomed out: no path tiles at all
          await startWalkingQuestFromOffer(offer);
          await settle();
          const quest = gameState.walkingQuests.active;
          console.log(JSON.stringify({
            started: !!quest,
            certification: quest && quest.certification === undefined ? quest.routeCertification.status : null,
            stuck: toasts.filter(t => t.includes('still loading')).length,
            pendingActivation: walkQuestPendingActivation,
            listeners: listenerCount(),
          }));
        })();
        """
    )
    assert result["started"] is True, "the quest must actually start"
    assert result["certification"] == "certified"
    assert result["stuck"] == 0, "no 'still loading' banner when the archive can answer"
    assert result["pendingActivation"] is None
    assert result["listeners"] == 0, "nothing left to retry"


def test_a_router_loop_fetches_authority_for_the_complete_loop_before_starting():
    result = run_alignment(
        """
        const outward = Array.from({length: 31}, (_, i) => ({lat:53 + i * 0.0001, lon:-2}));
        const returned = Array.from({length: 31}, (_, i) => ({lat:53.003 - i * 0.0001, lon:-1.999}));
        const loop = outward.concat(returned).concat([{lat:53, lon:-2}]);
        const offer = {
          kind:'footpath', name:'Mapped Footpath V', ref:'way/5', points:outward,
          alignmentWays:[outward],
          _loop:{loopedBack:true, points:loop, alignmentWays:[loop], totalLenM:900}
        };
        let authorityCalls = 0;
        window.BurbzQuestCore.fetchAlignmentWays = () => {
          authorityCalls += 1;
          return Promise.resolve([loop]);
        };
        (async () => {
          visibleTileWays = [];
          await startWalkingQuestFromOffer(offer);
          await settle();
          const quest = gameState.walkingQuests.active;
          console.log(JSON.stringify({
            started: !!quest,
            certification: quest && quest.routeCertification.status,
            authorityCalls,
            last: toasts[toasts.length - 1] || null,
          }));
        })();
        """
    )
    assert result["started"] is True, "Begin This Quest must activate the routed loop"
    assert result["certification"] == "certified"
    assert result["authorityCalls"] == 0, \
        "the mapped hiking route already carries complete evidence and must not wait on another archive"
    assert not (result["last"] or "").startswith("This quest cannot be aligned safely here")


def test_an_unanswerable_quest_stops_retrying_and_says_so():
    result = run_alignment(
        offer_js() +
        """
        (async () => {
          delete offer.alignmentWays;                 // e.g. a basemap-discovered offer
          global.fetch = () => Promise.reject(new Error('offline'));
          visibleTileWays = [];
          await startWalkingQuestFromOffer(offer);
          await settle(); await settle();
          const pendingAfterStart = !!walkQuestPendingActivation;
          const installed = listenerCount();
          // Tiles keep streaming in for far longer than the retry window.
          for (let i = 0; i < 8; i++) { fireTileEvent(); advance(5000); await settle(); }
          console.log(JSON.stringify({
            pendingAfterStart, installed,
            listeners: listenerCount(),
            pendingActivation: walkQuestPendingActivation,
            last: toasts[toasts.length - 1],
            stuckBanners: toasts.filter(t => t.includes('still loading')).length,
          }));
        })();
        """
    )
    assert result["pendingAfterStart"] is True and result["installed"] > 0, \
        "with no answer at all it is right to wait for tiles — for a while"
    assert result["listeners"] == 0, "the retry loop must stop, not run for ever"
    assert result["pendingActivation"] is None
    assert result["last"].startswith("Could not check the mapped footpaths"), \
        "the player is told the truth instead of 'still loading'"
    assert result["stuckBanners"] <= 1, "the loading banner is raised once, not endlessly"


def test_a_route_off_every_mapped_path_is_refused_immediately():
    result = run_alignment(
        offer_js() +
        """
        (async () => {
          const stray = { kind:'footpath', name:'Off-path', ref:'x/1', _loop:null,
            alignmentWays: offer.alignmentWays,
            points: [{lat:53.05,lon:-2.05},{lat:53.0545,lon:-2.05},{lat:53.06,lon:-2.048}] };
          visibleTileWays = [];
          await startWalkingQuestFromOffer(stray);
          await settle();
          console.log(JSON.stringify({
            started: !!gameState.walkingQuests.active,
            listeners: listenerCount(),
            pendingActivation: walkQuestPendingActivation,
            last: toasts[toasts.length - 1],
          }));
        })();
        """
    )
    assert result["started"] is False
    assert result["listeners"] == 0, "a refused quest is not retried on every tile event"
    assert result["pendingActivation"] is None
    assert result["last"].startswith("This quest cannot be aligned safely here")


def test_index_asks_for_a_verdict_instead_of_waiting_on_tiles_for_ever():
    src = html_source()
    activate = extract("activateWalkingQuestFromOffer", src)
    assert "certifyQuestAgainstAuthority(quest, questOffer)" in activate, \
        "starting a quest the tiles cannot prove must consult complete evidence"
    assert "walkQuestPendingActivation = blocked ? null : offer" in activate, \
        "a blocked quest must not be retried for ever"

    authority = extract("certifyQuestAgainstAuthority", src)
    assert "authoritativeFullCoverage: true" in authority
    for verdict in ("'certified'", "'blocked'", "'unavailable'"):
        assert verdict in authority

    ways = extract("walkQuestAuthorityWays", src)
    assert "offer.alignmentWays" in ways, "reuse the network discovery already downloaded"
    assert "WALK_QUEST_AUTHORITY_BACKOFF_MS" in ways, "a failing archive is not hammered"

    # Saved/active quests get the same verdict, once.
    hold = extract("holdWalkQuestAlignmentPending", src)
    assert "requestAuthoritativeQuestAlignment(quest)" in hold
    assert "cert.status === 'blocked'" in hold, "a final verdict is not downgraded to 'loading'"


def test_the_retry_loop_has_an_end_and_says_so():
    src = html_source()
    install = extract("installWalkQuestAlignmentReadinessRetry", src)
    assert "WALK_QUEST_RETRY_WINDOW_MS" in install
    assert "Date.now() > walkQuestAlignmentRetry.deadline" in install, \
        "tile events must stop driving retries once the window has passed"
    assert "giveUpOnWalkQuestAlignment()" in install
    assert "walkQuestAlignmentRetry.subject !== key" in install, \
        "re-arming for the same route must not extend its window"

    give_up = extract("giveUpOnWalkQuestAlignment", src)
    assert "uninstallWalkQuestAlignmentReadinessRetry()" in give_up
    assert "walkQuestPendingActivation = null" in give_up
    assert "status:'stalled'" in give_up
    assert "WALK_QUEST_ALIGN_STALLED_MSG" in give_up

    # Each state says a different, true thing — and the stalled one is not
    # "still loading".
    assert "const WALK_QUEST_ALIGN_STALLED_MSG = 'Could not check the mapped footpaths" in src
    message = extract("walkQuestAlignmentMessage", src)
    assert "'blocked'" in message and "'stalled'" in message
    assert "setWalkQuestAlignmentStatus(walkQuestAlignmentMessage(quest.routeCertification))" in src
    assert re.search(r"WALK_QUEST_RETRY_WINDOW_MS = \d+", src)


def test_release_is_versioned_for_live_pwa_refresh():
    html = html_source()
    sw = SW.read_text(encoding="utf-8")
    marker = "quest_core.js?v=ordered-quest-markers-v224-20260804"
    assert marker in html
    assert "./" + marker in sw
    assert "const BURBZ_CACHE = 'burbz-" in sw
    assert "quest-alignment-authority-v146-20260727" in sw
