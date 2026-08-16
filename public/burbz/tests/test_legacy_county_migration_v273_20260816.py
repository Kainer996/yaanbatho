"""Save compatibility for Counties that existed before Town-first v273.

v272 founded a County from three nearby villages.  In v273 those same three
claims form one Town, so the County is temporarily absent until two more Towns
are established.  Anything the player already paid for must survive that gap:
caravan roads sleep without earning, and Wardens become available without
forgetting the post they may safely return to later.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
ROLES_CORE = ROOT / "bird_roles_core.js"


def html_text() -> str:
    return HTML.read_text(encoding="utf-8")


def function_source(html: str, name: str) -> str:
    """Return one top-level browser function, including nested blocks."""
    start = html.index(f"function {name}(")
    opening = html.index("{", start)
    depth = 0
    quote = None
    escaped = False
    line_comment = False
    block_comment = False
    index = opening
    while index < len(html):
        char = html[index]
        nxt = html[index + 1] if index + 1 < len(html) else ""
        if line_comment:
            if char == "\n":
                line_comment = False
        elif block_comment:
            if char == "*" and nxt == "/":
                block_comment = False
                index += 1
        elif quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
        elif char == "/" and nxt == "/":
            line_comment = True
            index += 1
        elif char == "/" and nxt == "*":
            block_comment = True
            index += 1
        elif char in ("'", '"', "`"):
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return html[start : index + 1]
        index += 1
    raise AssertionError(f"unterminated function: {name}")


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_paid_legacy_route_sleeps_then_resumes_and_only_prunes_when_internal():
    """A missing endpoint is dormancy, not evidence that a paid road is stale."""
    html = html_text()
    browser = "\n".join(
        function_source(html, name)
        for name in (
            "empireRegionForLegacyId",
            "empireTradeRouteRecords",
            "empireTradeRoutePeriods",
            "empireTradeDue",
        )
    )
    out = run_node(
        browser
        + r"""
const INTERVAL = 8 * 60 * 60 * 1000;
const now = 20 * INTERVAL;
// This road has been asleep far longer than the ordinary 24-hour accrual cap.
const legacyClock = now - 9 * INTERVAL;
const route = {a:11,b:22,openedAt:'2026-08-01T00:00:00Z',lastTradeAt:legacyClock,paidCost:{coins:140,branches:35}};
const empire = {tradeRoutes:{'11~22':route}};
let regions = [];
let saves = 0;
const EMPIRE_TRIBUTE_INTERVAL_MS = INTERVAL;
const EMPIRE_TRIBUTE_MAX_PERIODS = 3;
function ensureEmpireState() { return empire; }
function saveState() { saves += 1; }
function empireRegionById(id) { return regions.find(region => region.id === String(id)) || null; }
function empireRegionOfSeed(seed) {
  const wanted = String(Number(seed) >>> 0);
  return regions.find(region => region.villages.some(village => String(Number(village.seed) >>> 0) === wanted)) || null;
}
function realmCore() {
  return {
    tradeRouteKey(a,b) { return [String(a),String(b)].sort().join('~'); },
    tradeRouteGoods() { return ['iron','grain']; }
  };
}
function empireTradeRouteIncome() { return {coins:7,goodsQty:2}; }

// The three-village v272 Counties are absent under v273's three-Town rule.
const dormantRecords = empireTradeRouteRecords();
const dormantDue = empireTradeDue(now);
const dormantStored = empire.tradeRoutes['11~22'] === route;
const dormantClock = route.lastTradeAt;
const savesWhileDormant = saves;

// Later claims found two valid v273 Counties.  The old capital seeds are ward
// members rather than the new County ids, exercising legacy-seed resolution.
const countyA = {id:'county-a',capitalSeed:101,villages:[{seed:11},{seed:101}]};
const countyB = {id:'county-b',capitalSeed:202,villages:[{seed:22},{seed:202}]};
regions = [countyA, countyB];
const activeRecords = empireTradeRouteRecords();
const activeDue = empireTradeDue(now);
const activeStored = empire.tradeRoutes['11~22'] === route;
const activeClock = route.lastTradeAt;
const savesWhileActive = saves;

// If the realm later proves both legacy endpoints are inside one live County,
// the road is now an internal lane and may finally be pruned.
regions = [{id:'county-united',capitalSeed:101,villages:[{seed:11},{seed:22},{seed:101}]}];
const internalRecords = empireTradeRouteRecords();
process.stdout.write(JSON.stringify({
  dormantCount:dormantRecords.length,
  dormantDue,
  dormantStored,
  dormantClock,
  savesWhileDormant,
  activeCount:activeRecords.length,
  activeKey:activeRecords[0] && activeRecords[0].activeKey,
  activeDue,
  activeStored,
  activeClock,
  savesWhileActive,
  internalCount:internalRecords.length,
  storedAfterInternal:Object.prototype.hasOwnProperty.call(empire.tradeRoutes,'11~22'),
  finalSaves:saves
}));
"""
    )

    assert out["dormantCount"] == 0
    assert out["dormantDue"] == {"coins": 0, "materials": {}}
    assert out["dormantStored"] is True
    assert out["dormantClock"] > 0
    assert out["savesWhileDormant"] == 0

    assert out["activeCount"] == 1
    assert out["activeKey"] == "county-a~county-b"
    # The paid clock survives dormancy as fair compensation, but catch-up is
    # still bounded to the game's normal three eight-hour periods.
    assert out["activeDue"] == {
        "coins": 21,
        "materials": {"iron": 6, "grain": 6},
    }
    assert out["activeStored"] is True
    assert out["activeClock"] == out["dormantClock"]
    assert out["savesWhileActive"] == 0

    assert out["internalCount"] == 0
    assert out["storedAfterInternal"] is False
    assert out["finalSaves"] == 1


def test_ensure_empire_state_never_reconciles_or_deletes_paid_legacy_records():
    """Ordinary save reads must not make irreversible migration decisions."""
    html = html_text()
    ensure = function_source(html, "ensureEmpireState")
    out = run_node(
        ensure
        + r"""
const route = {a:11,b:22,openedAt:'2026-08-01T00:00:00Z',lastTradeAt:123,paidCost:{coins:140,branches:35}};
const dormant = {'11':'rook'};
let saves = 0;
const gameState = {
  empire:{villages:{},liberationVictories:{},tradeRoutes:{'11~22':route},dormantRegionWardens:dormant}
};
function validPendingLiberation() { return true; }
function saveState() { saves += 1; }
const first = ensureEmpireState();
const second = ensureEmpireState();
process.stdout.write(JSON.stringify({
  sameEmpire:first === second,
  sameRoute:first.tradeRoutes['11~22'] === route,
  sameDormant:first.dormantRegionWardens === dormant,
  routeKeys:Object.keys(first.tradeRoutes),
  dormantKeys:Object.keys(first.dormantRegionWardens || {}),
  saves
}));
"""
    )
    assert out == {
        "sameEmpire": True,
        "sameRoute": True,
        "sameDormant": True,
        "routeKeys": ["11~22"],
        "dormantKeys": ["11"],
        "saves": 0,
    }


def test_missing_county_parks_warden_frees_bird_and_restores_post_safely():
    """A ghost post cannot reserve a bird, but its save intent is recoverable."""
    html = html_text()
    browser = "\n".join(
        function_source(html, name)
        for name in (
            "empireRegionForLegacyId",
            "ensureRolesState",
            "roleDefFor",
            "birdAssignedPost",
        )
    )
    out = run_node(
        browser
        + f"""
const rolesCore = require({json.dumps(str(ROLES_CORE))});
const empire = {{dormantRegionWardens:{{}}}};
const gameState = {{
  flock:[{{id:'rook'}},{{id:'tern'}}],
  birdRoles:{{academy:{{}},villages:{{}},regions:{{'11':'rook'}}}}
}};
let regions = [];
function birdRolesCore() {{ return rolesCore; }}
function ensureEmpireState() {{ return empire; }}
function pauseHeadChefCareer() {{}}
function empireRegionById(id) {{ return regions.find(region => region.id === String(id)) || null; }}
function empireRegionOfSeed(seed) {{
  const wanted = String(Number(seed) >>> 0);
  return regions.find(region => region.villages.some(village => String(Number(village.seed) >>> 0) === wanted)) || null;
}}

// The old three-village County is gone: move its Warden out of active roles.
const parkedRoles = ensureRolesState();
const parkedPost = birdAssignedPost('rook');
const parkedSnapshot = {{
  activeRegions:{{...parkedRoles.regions}},
  dormant:{{...empire.dormantRegionWardens}},
  post:parkedPost
}};

// When the legacy seed belongs to a valid v273 County again, restore the same
// Warden against the County's current canonical id.
regions = [{{id:'county-returned',villages:[{{seed:11}},{{seed:101}}]}}];
const restoredRoles = ensureRolesState();
const restoredPost = birdAssignedPost('rook');
const restoredSnapshot = {{
  activeRegions:{{...restoredRoles.regions}},
  dormant:{{...empire.dormantRegionWardens}},
  post:restoredPost && {{scope:restoredPost.scope,key:restoredPost.key}}
}};

// A later post wins.  Never pull a bird out of a job it accepted while the old
// County was missing; leave the dormant Warden intent available for a future
// safe read instead.
gameState.birdRoles = {{academy:{{library:'tern'}},villages:{{}},regions:{{}}}};
empire.dormantRegionWardens = {{'22':'tern'}};
regions = [{{id:'county-conflict',villages:[{{seed:22}},{{seed:202}}]}}];
const conflictRoles = ensureRolesState();
const conflictPost = birdAssignedPost('tern');
const conflictSnapshot = {{
  academy:{{...conflictRoles.academy}},
  activeRegions:{{...conflictRoles.regions}},
  dormant:{{...empire.dormantRegionWardens}},
  post:conflictPost && {{scope:conflictPost.scope,key:conflictPost.key}}
}};

process.stdout.write(JSON.stringify({{parkedSnapshot,restoredSnapshot,conflictSnapshot}}));
"""
    )

    assert out["parkedSnapshot"] == {
        "activeRegions": {},
        "dormant": {"11": "rook"},
        "post": None,
    }
    assert out["restoredSnapshot"] == {
        "activeRegions": {"county-returned": "rook"},
        "dormant": {},
        "post": {"scope": "region", "key": "county-returned"},
    }
    assert out["conflictSnapshot"] == {
        "academy": {"library": "tern"},
        "activeRegions": {},
        "dormant": {"22": "tern"},
        "post": {"scope": "academy", "key": "library"},
    }


def test_resumed_legacy_route_cannot_be_offered_or_bought_a_second_time():
    """The canonical live key must drive both the row filter and buy guard."""
    html = html_text()
    panel = function_source(html, "renderEmpirePanel")
    opener = function_source(html, "empireOpenTradeRoute")
    collect = function_source(html, "collectEmpireTribute")
    assert "new Set(open.map(o => o.activeKey))" in panel
    assert "some(route => route.activeKey === candidate.key)" in opener
    assert "tradeRouteCost(empireTradeRouteInvestmentCount())" in panel
    assert "tradeRouteCost(empireTradeRouteInvestmentCount())" in opener
    assert "if (empireTradeRoutePeriods(rec, now) > 0)" in collect
