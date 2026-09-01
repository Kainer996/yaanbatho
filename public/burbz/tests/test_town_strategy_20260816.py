"""Town strategy, exact settlement grouping, and retired-village contracts.

These tests deliberately exercise the two pure CommonJS cores in Node.  The
browser assertions are narrow wiring contracts: once three liberated villages
found a town, their save records may remain as economic wards, but none of
their old UI routes may remain a player-facing destination.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
TOWN_CORE = ROOT / "town_strategy_core.js"
REALM_CORE = ROOT / "empire_realm_core.js"
HTML = ROOT / "index.html"


def run_node(source: str):
    """Run a small Node probe and decode its single JSON result as UTF-8."""
    result = subprocess.run(
        ["node", "-e", source],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def run_core(path: Path, expression: str):
    source = f"""
const core = require({json.dumps(str(path))});
const result = ({expression});
process.stdout.write(JSON.stringify(result));
"""
    return run_node(source)


def html_text() -> str:
    return HTML.read_text(encoding="utf-8")


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + len(name) + 10)
    assert end > start, f"could not isolate function {name}"
    return html[start:end]


def village(seed: int, lon: float, claimed: int, lat: float = 0.0):
    return {
        "seed": seed,
        "name": f"Village {seed}",
        "lat": lat,
        "lon": lon,
        "claimedAt": f"2026-08-{claimed:02d}T12:00:00Z",
    }


# ---------------------------------------------------------------------------
# Pure Town strategy economy
# ---------------------------------------------------------------------------


def test_town_hall_ladder_has_real_gates_costs_and_builder_progression():
    levels = run_core(
        TOWN_CORE,
        "core.TOWN_HALL_LEVELS.map(x => ({"
        "level:x.level, slots:x.builderSlots, development:x.minDevelopment, "
        "population:x.minPopulation, happiness:x.minHappiness, "
        "coins:x.cost.coins, branches:x.cost.branches, stone:x.cost.stone, materials:x.cost.materials, "
        "buildTimeMs:x.buildTimeMs}))",
    )
    assert [row["level"] for row in levels] == [1, 2, 3, 4, 5]
    assert [row["slots"] for row in levels] == [1, 1, 2, 2, 3]
    assert [row["development"] for row in levels] == sorted(
        row["development"] for row in levels
    )
    assert [row["population"] for row in levels] == sorted(
        row["population"] for row in levels
    )
    assert levels[0]["coins"] == levels[0]["branches"] == levels[0]["stone"] == 0
    assert all(row["coins"] > 0 and row["branches"] > 0 and row["stone"] > 0 for row in levels[1:])
    assert all(row["materials"] for row in levels[1:])
    assert levels[-1]["buildTimeMs"] > levels[1]["buildTimeMs"] > 0

    progress = run_core(
        TOWN_CORE,
        "({next:core.nextHallUpgrade({hallLevel:2}).level, "
        "maxed:core.nextHallUpgrade({hallLevel:5}), "
        "slots:core.builderSlots({hallLevel:3})})",
    )
    assert progress == {"next": 3, "maxed": None, "slots": 2}


def test_every_town_policy_has_a_benefit_and_a_material_tradeoff():
    policies = run_core(TOWN_CORE, "core.TOWN_POLICIES")
    assert set(policies) == {"balanced", "growth", "trade", "industry", "builders"}
    assert all(policies["balanced"][key] == 1 for key in ("coins", "branches", "stone", "materials", "larder"))

    for policy_id, policy in policies.items():
        if policy_id == "balanced":
            continue
        output_multipliers = [policy[key] for key in ("coins", "branches", "stone", "materials", "larder")]
        benefit = (
            any(value > 1 for value in output_multipliers)
            or policy["growthPerMember"] > 0
            or policy["buildTimeFactor"] < 1
        )
        assert benefit, f"{policy_id} offers no strategic benefit"
        assert any(value < 1 for value in output_multipliers), f"{policy_id} has no economic tradeoff"


@pytest.mark.parametrize(
    ("policy", "expected"),
    [
        ("balanced", {"coins": 101, "branches": 101, "stone": 101, "materials": {"iron": 7}, "larder": {"berries": 7}}),
        ("growth", {"coins": 80, "branches": 90, "stone": 90, "materials": {"iron": 6}, "larder": {"berries": 8}}),
        ("trade", {"coins": 121, "branches": 75, "stone": 85, "materials": {"iron": 5}, "larder": {"berries": 5}}),
        ("industry", {"coins": 80, "branches": 126, "stone": 121, "materials": {"iron": 8}, "larder": {"berries": 5}}),
        ("builders", {"coins": 90, "branches": 90, "stone": 90, "materials": {"iron": 6}, "larder": {"berries": 6}}),
    ],
)
def test_policy_bundle_scales_the_whole_town_once(policy: str, expected: dict):
    out = run_core(
        TOWN_CORE,
        "core.applyPolicyBundle("
        + json.dumps(
            {
                "coins": 101,
                "branches": 101,
                "stone": 101,
                "materials": {"iron": 7, "debt": -4},
                "larder": {"berries": 7},
            }
        )
        + f", {json.dumps(policy)})",
    )
    assert out == expected


def test_policy_rounding_happens_after_district_aggregation_and_does_not_mutate_input():
    out = run_core(
        TOWN_CORE,
        "(() => { const raw={coins:3,branches:3,stone:3,materials:{grain:3},larder:{seed:3}}; "
        "const before=JSON.stringify(raw); const scaled=core.applyPolicyBundle(raw,'growth'); "
        "return {scaled, unchanged:before===JSON.stringify(raw)}; })()",
    )
    # Three one-unit wards would round to zero if the 0.9 multiplier were
    # applied per ward. Aggregating first correctly retains two units.
    assert out["scaled"]["materials"]["grain"] == 2
    assert out["scaled"]["stone"] == 2
    assert out["scaled"]["larder"]["seed"] == 3
    assert out["unchanged"] is True


def test_policy_unlock_collection_gate_and_24_hour_lock_are_enforced():
    now = 1_000_000
    out = run_core(
        TOWN_CORE,
        f"""(() => {{
  const levelOne = core.setPolicy({{hallLevel:1,policy:'balanced'}}, 'trade', false, {now});
  const accrued = core.setPolicy({{hallLevel:2,policy:'balanced'}}, 'trade', true, {now});
  const adopted = core.setPolicy({{hallLevel:2,policy:'balanced',policyChangedAt:0}}, 'trade', false, {now});
  const same = core.setPolicy(adopted.state, 'trade', false, {now} + 1000);
  const early = core.setPolicy(adopted.state, 'industry', false, {now} + core.TOWN_POLICY_LOCK_MS - 1);
  const ready = core.setPolicy(adopted.state, 'industry', false, {now} + core.TOWN_POLICY_LOCK_MS);
  const unknown = core.setPolicy(adopted.state, 'free-money', false, {now} + core.TOWN_POLICY_LOCK_MS);
  return {{levelOne, accrued, adopted, same, early, ready, unknown}};
}})()""",
    )
    assert out["levelOne"]["ok"] is False and "level 2" in out["levelOne"]["reason"]
    assert out["accrued"]["ok"] is False and "strongbox" in out["accrued"]["reason"]
    assert out["adopted"]["ok"] is True
    assert out["adopted"]["state"]["policyChangedAt"] == now
    assert out["same"]["ok"] is True
    assert out["same"]["state"]["policyChangedAt"] == now
    assert out["early"]["ok"] is False
    assert out["ready"]["ok"] is True and out["ready"]["state"]["policy"] == "industry"
    assert out["unknown"]["ok"] is False


def test_town_state_sanitizer_heals_hostile_saves_without_losing_a_paid_timer():
    out = run_core(
        TOWN_CORE,
        """(() => {
  const now=500000;
  const healed=core.sanitizeTownState({
    hallLevel:2, policy:'TRADE', policyChangedAt:now + core.TOWN_POLICY_LOCK_MS * 9,
    memberSeeds:[7,'3',7,-1,'bad',4294967298], customName:'   The    Very Long Town Name That Cannot Overflow Any Card In The UI Ever   ',
    hallConstruction:{toLevel:3,fromLevel:2,startMs:100,endMs:200,id:'paid-hall',paidCost:{coins:180.9,branches:45.9,stone:20.9,materials:{oak_twig:4.8,bad:-5}}}
  }, now);
  const lockedAtOne=core.sanitizeTownState({hallLevel:1,policy:'builders'}, now);
  return {healed, lockedAtOne, signature:core.memberSignature([7,'3',7,2])};
})()""",
    )
    healed = out["healed"]
    assert healed["policy"] == "trade"
    assert healed["policyChangedAt"] == 500_000
    assert healed["memberSeeds"] == [2, 3, 7]
    assert len(healed["customName"]) <= 48
    assert healed["hallConstruction"]["id"] == "paid-hall"
    assert healed["hallConstruction"]["paidCost"] == {
        "coins": 180,
        "branches": 45,
        "stone": 20,
        "materials": {"oak_twig": 4},
    }
    assert out["lockedAtOne"]["policy"] == "balanced"
    assert out["signature"] == "2,3,7"


def test_prosperity_is_bounded_and_accepts_fraction_or_percentage_happiness():
    out = run_core(
        TOWN_CORE,
        "({empty:core.townProsperity({}), "
        "perfect:core.townProsperity({population:90,happiness:1,development:60,maxDevelopment:60}), "
        "fraction:core.townProsperity({population:45,happiness:.8,development:30,maxDevelopment:60}), "
        "percent:core.townProsperity({population:45,happiness:80,development:30,maxDevelopment:60}), "
        "hostile:core.townProsperity({population:-50,happiness:999,development:999,maxDevelopment:1})})",
    )
    assert out["empty"] == 0
    assert out["perfect"] == 100
    assert out["fraction"] == out["percent"]
    assert 0 <= out["hostile"] <= 100


# ---------------------------------------------------------------------------
# Deterministic exact trios in the realm core
# ---------------------------------------------------------------------------


def settlement_projection(result: dict):
    return {
        "towns": [
            {
                "id": town["id"],
                "members": [row["seed"] for row in town["villages"]],
                "cityId": town["cityId"],
            }
            for town in result["towns"]
        ],
        "cities": [
            {
                "id": city["id"],
                "towns": [town["id"] for town in city["towns"]],
            }
            for city in result["cities"]
        ],
        "unassigned": [row["seed"] for row in result["unassignedVillages"]],
    }


def test_four_nearby_villages_form_one_exact_trio_not_a_four_village_town():
    claims = [village(1, 0.00, 1), village(2, 0.01, 2), village(3, 0.02, 3), village(4, 0.03, 4)]
    result = run_core(REALM_CORE, f"core.deriveSettlements({json.dumps(claims)})")
    assert result["townCount"] == 1
    assert [row["seed"] for row in result["towns"][0]["villages"]] == [1, 2, 3]
    assert result["towns"][0]["villageCount"] == 3
    assert [row["seed"] for row in result["unassignedVillages"]] == [4]
    assert "4" not in result["tierBySeed"]


def test_exact_trio_result_is_independent_of_input_array_order():
    claims = [
        village(10, 0.00, 1),
        village(20, 0.01, 2),
        village(30, 0.02, 3),
        village(40, 0.03, 4),
        village(50, 1.00, 5),
    ]
    variants = [claims, list(reversed(claims)), [claims[i] for i in (2, 4, 0, 3, 1)]]
    results = [
        settlement_projection(run_core(REALM_CORE, f"core.deriveSettlements({json.dumps(rows)})"))
        for rows in variants
    ]
    assert results[0] == results[1] == results[2]


def test_later_bridge_claim_cannot_merge_or_rename_two_established_towns():
    first_town = [village(1, 0.00, 1), village(2, 0.01, 2), village(3, 0.02, 3)]
    second_town = [village(4, 0.08, 4), village(5, 0.09, 5), village(6, 0.10, 6)]
    bridge = village(7, 0.05, 7)
    before = run_core(REALM_CORE, f"core.deriveSettlements({json.dumps(first_town + second_town)})")
    after = run_core(REALM_CORE, f"core.deriveSettlements({json.dumps(first_town + second_town + [bridge])})")

    assert settlement_projection(before)["towns"] == settlement_projection(after)["towns"]
    assert [town["id"] for town in after["towns"]] == ["town-1", "town-4"]
    assert [row["seed"] for row in after["unassignedVillages"]] == [7]


def test_duplicate_claims_and_invalid_coordinates_cannot_fill_a_town_seat():
    only_two_unique = [
        village(1, 0.00, 1),
        {**village(1, 0.00, 1), "name": "Duplicate save row"},
        village(2, 0.01, 2),
        {**village(99, 0.02, 3), "lat": 999},
    ]
    no_town = run_core(REALM_CORE, f"core.deriveSettlements({json.dumps(only_two_unique)})")
    with_third = run_core(
        REALM_CORE,
        f"core.deriveSettlements({json.dumps(only_two_unique + [village(3, 0.02, 4)])})",
    )
    assert no_town["townCount"] == 0
    assert with_third["townCount"] == 1
    assert [row["seed"] for row in with_third["towns"][0]["villages"]] == [1, 2, 3]


def test_four_nearby_towns_make_one_exact_three_town_city():
    claims = []
    day = 1
    for town_number, start_lon in enumerate((0.00, 0.08, 0.16, 0.24), start=1):
        for offset in (0.00, 0.01, 0.02):
            claims.append(village(town_number * 100 + int(offset * 100), start_lon + offset, day))
            day += 1
    result = run_core(REALM_CORE, f"core.deriveSettlements({json.dumps(claims)})")
    assert result["townCount"] == 4
    assert result["cityCount"] == 1
    assert result["cities"][0]["townCount"] == 3
    assert [town["id"] for town in result["cities"][0]["towns"]] == ["town-100", "town-200", "town-300"]
    assert [town["id"] for town in result["standaloneTowns"]] == ["town-400"]


def test_regions_require_three_towns_not_merely_three_raw_villages():
    eight = [village(seed, (seed - 1) * 0.01, seed) for seed in range(1, 9)]
    nine = eight + [village(9, 0.08, 9)]
    before = run_core(REALM_CORE, f"core.deriveRegions({json.dumps(eight)})")
    after = run_core(REALM_CORE, f"core.deriveRegions({json.dumps(nine)})")
    assert before["regions"] == []
    assert after["regions"][0]["townCount"] == 3
    assert after["regions"][0]["villageCount"] == 9


# ---------------------------------------------------------------------------
# Browser wiring: Town Hall is the only destination for consumed villages
# ---------------------------------------------------------------------------


def test_town_screen_and_pure_core_are_loaded_and_dispatched():
    html = html_text()
    assert 'id="screen-town"' in html
    assert 'id="townHallPanel"' in html
    assert 'src="town_strategy_core.js?v=town-strategy-v273-20260816"' in html
    assert "if (name === 'town')" in html and "renderTownScreen();" in html
    assert "function openEmpireTown(" in html
    assert "function renderTownScreen(" in html


def test_town_screen_exposes_strategy_economy_not_just_a_renamed_village():
    screen = function_source(html_text(), "renderTownScreen")
    for contract in (
        "townEconomySnapshot(settle)",
        "townBuilderSlots(settle)",
        "townTributeBundle(settle, now)",
        "core.TOWN_POLICIES",
        'data-action="town-collect"',
        'data-action="town-hall-upgrade"',
        # step-inside-buildings-v341: yard tiles open building interiors.
        'data-action="town-enter"',
        'data-action="town-policy"',
    ):
        assert contract in screen
    assert "Collect whenever you like" in screen  # v310: continuous accrual
    assert "trade one advantage for another" in screen


def test_town_state_is_a_versioned_overlay_and_preserves_district_economies():
    html = html_text()
    ensure = function_source(html, "ensureEmpireState")
    strategy = function_source(html, "ensureTownSeatState")
    members = function_source(html, "townSeatMemberRecords")
    assert "gameState.empire.towns" in ensure
    assert "gameState.empire.townStrategyVersion = 1" in ensure
    assert "clean.memberSeeds = seeds" in strategy
    assert "townStateKey(seat)" in strategy
    assert "empire.villages[String(seed)]" in members
    assert "delete empire.villages" not in ensure + strategy


def test_city_keeps_every_constituent_town_state_and_paid_hall_timer_reachable():
    html = html_text()
    seats = function_source(html, "townAdministrativeSeats")
    state = function_source(html, "ensureTownSeatState")
    completion = function_source(html, "townCompleteHallConstructions")
    assert "settlement.towns.slice()" in seats
    assert "townStateKey(seat)" in state
    assert "clean.memberSeeds = seeds" in state
    assert "Object.assign(existing, clean)" in state
    assert "(info.towns || []).forEach" in completion
    assert "state.hallConstruction = null" in completion
    assert "delete empire.towns" not in seats + state + completion


def test_town_state_sanitization_preserves_identity_across_reentrant_mutations():
    """Reads during a mutation must not detach the object stored in the save.

    Town naming and Hall construction both call helpers that sanitize the same
    state again before the outer operation commits.  City completion also
    re-enters the sanitizer between boroughs.  Exercise the shared identity
    invariant dynamically so a future clean-object replacement cannot silently
    spend a Hall cost, lose a rename, or drop the later borough completions.
    """
    html = html_text()
    functions = "\n".join(
        function_source(html, name)
        for name in ("townMemberSeeds", "townStateKey", "ensureTownSeatState")
    )
    source = f"""
const strategy = require({json.dumps(str(TOWN_CORE))});
const empire = {{towns: {{}}}};
function ensureEmpireState() {{ return empire; }}
function townStrategyCore() {{ return strategy; }}
{functions}

const seat = (heart) => ({{
  id:'town-' + heart,
  heartSeed:heart,
  villages:[{{seed:heart}},{{seed:heart + 1}},{{seed:heart + 2}}]
}});
const firstSeat = seat(10);
const captured = ensureTownSeatState(firstSeat);
const reentered = ensureTownSeatState(firstSeat);
captured.customName = 'Rookford';
captured.hallConstruction = {{
  id:'paid-hall', fromLevel:1, toLevel:2, startMs:100, endMs:200,
  paidCost:{{coins:180,branches:45,stone:20,materials:{{oak_twig:4}}}}
}};
const afterPaidMutation = ensureTownSeatState(firstSeat);

const citySeats = [seat(100), seat(200), seat(300)];
citySeats.forEach((row, index) => {{
  const state = ensureTownSeatState(row);
  state.hallConstruction = {{
    id:'borough-' + index, fromLevel:1, toLevel:2, startMs:100, endMs:200,
    paidCost:{{coins:180,branches:45,stone:20,materials:{{oak_twig:4}}}}
  }};
}});
const queued = citySeats.map(row => ensureTownSeatState(row));
queued.forEach(state => {{
  state.hallLevel = 2;
  state.hallConstruction = null;
  citySeats.forEach(ensureTownSeatState); // townDisplayName(city) re-entry
}});

process.stdout.write(JSON.stringify({{
  sameIdentity:captured === reentered && captured === afterPaidMutation,
  customName:empire.towns['seat-10'].customName,
  paidHallId:empire.towns['seat-10'].hallConstruction?.id,
  boroughs:citySeats.map(row => empire.towns['seat-' + row.heartSeed]).map(state => ({{
    hallLevel:state.hallLevel,
    hallConstruction:state.hallConstruction
  }}))
}}));
"""
    out = run_node(source)
    assert out["sameIdentity"] is True
    assert out["customName"] == "Rookford"
    assert out["paidHallId"] == "paid-hall"
    assert out["boroughs"] == [
        {"hallLevel": 2, "hallConstruction": None},
        {"hallLevel": 2, "hallConstruction": None},
        {"hallLevel": 2, "hallConstruction": None},
    ]


def test_first_ledger_or_collection_read_migrates_legacy_ward_stewards_before_math():
    """A v272 Steward must work immediately, without opening Town Hall first.

    Older saves can have a different Steward on each of the three source
    villages.  The first public-holding read chooses one canonical Steward,
    frees the losing birds, persists the migration, and only then snapshots
    ward yield.  The direct collection path has the same ordering guarantee.
    """
    html = html_text()
    browser = "\n".join(
        function_source(html, name)
        for name in (
            "townMemberSeeds",
            "ensureTownSteward",
            "townEconomySnapshot",
            "townTributeBundle",
        )
    )
    out = run_node(
        browser
        + r"""
const settlement = {
  id:'town-10', tier:'town', heartSeed:10,
  villages:[{seed:10},{seed:11},{seed:12}]
};
const gameState = {
  flock:[{id:'weak',int:10},{id:'wise',int:90}],
  birdRoles:{academy:{},villages:{'11':'weak','12':'wise'},regions:{}}
};
let saves = 0;
let snapshotRoleKeys = [];
function canonicalEmpireSettlement(value) { return value; }
function birdRolesCore() {
  return {
    villageRole() { return {id:'steward'}; },
    roleAptitude(bird) { return Number(bird && bird.int) || 0; }
  };
}
function ensureRolesState() { return gameState.birdRoles; }
function saveState() { saves += 1; }
function townMemberRecords(value) { return value.villages; }
function townAdministrativeSeats(value) { return [value]; }
function townSeatMemberRecords(value) { return value.villages; }
const EMPIRE_NEEDS = [];
function mergeResourceTotals(target, source, periods) {
  const count = Number(periods) || 1;
  Object.entries(source || {}).forEach(([id, qty]) => { target[id] = (target[id] || 0) + qty * count; });
}
function townApplySeatPolicyBundle(_seat, bundle) { return bundle; }
function townEffectivePolicy() { return {id:'balanced'}; }
function stewardMultiplier() {
  const holder = gameState.birdRoles.villages['10'];
  return holder === 'wise' ? 1.5 : holder === 'weak' ? 1.2 : 1;
}
function villageEconomySnapshot() {
  snapshotRoleKeys.push(Object.keys(gameState.birdRoles.villages).sort().join(','));
  const multiplier = stewardMultiplier();
  return {
    pop:1, housingCap:1, taxes:10 * multiplier, branches:2 * multiplier,
    happiness:1, needs:[],
    workforce:{available:1,required:0,working:0},
    provisions:{
      food:{rate:1,store:1,cap:2,eats:1},
      water:{rate:1,store:1,cap:2,eats:1}
    },
    production:{stone:2 * multiplier,materials:{oak:2 * multiplier},larder:{seed:2 * multiplier}}
  };
}
function empireVillageTributePeriods() { return 1; }
function villageTributeTake(rec, periods, snap) {
  return { coins: Math.floor(periods * snap.taxes), branches: Math.floor(periods * snap.branches),
           stone: Math.floor(periods * snap.production.stone),
           materials: snap.production.materials, larder: snap.production.larder };
}

const ledger = townEconomySnapshot(settlement);
const ledgerResult = {
  roles:{...gameState.birdRoles.villages},
  weakFreed:!Object.values(gameState.birdRoles.villages).includes('weak'),
  taxes:ledger.taxes,
  firstSnapshotRoles:snapshotRoleKeys[0],
  saves
};

gameState.birdRoles.villages = {'11':'weak'};
saves = 0;
snapshotRoleKeys = [];
const tribute = townTributeBundle(settlement, 1000);
const tributeResult = {
  roles:{...gameState.birdRoles.villages},
  taxes:tribute.coins,
  firstSnapshotRoles:snapshotRoleKeys[0],
  saves
};
process.stdout.write(JSON.stringify({ledgerResult,tributeResult}));
"""
    )

    assert out["ledgerResult"] == {
        "roles": {"10": "wise"},
        "weakFreed": True,
        "taxes": 45,
        "firstSnapshotRoles": "10",
        "saves": 1,
    }
    assert out["tributeResult"] == {
        "roles": {"10": "weak"},
        "taxes": 36,
        "firstSnapshotRoles": "10",
        "saves": 1,
    }


@pytest.mark.parametrize("name", ["enterVillage", "openEmpireVillage"])
def test_direct_member_village_routes_redirect_before_opening_old_ui(name: str):
    route = function_source(html_text(), name)
    assert "empireSettlementOfSeed" in route
    assert "openEmpireTown(" in route
    assert "return;" in route
    assert route.index("openEmpireTown(") < route.index("villageActive =")


def test_stale_saved_village_and_third_claim_cannot_leave_player_in_retired_ui():
    html = html_text()
    render = function_source(html, "renderVillage")
    claim = function_source(html, "claimCurrentVillage")
    # Old local/cloud saves can still have lastVillage pointing to a consumed
    # member. The render guard is the final defence against reopening it.
    assert "empireSettlementOfSeed" in render
    assert "openEmpireTown(" in render
    assert render.index("openEmpireTown(") < render.index("renderVillageManagePanel()")
    # v290: a claim never forms a town — the player's own Merge does, and
    # that action navigates straight into the new Town Hall.
    assert "foundedSettlement" not in claim
    merge = function_source(html, "empireMergeVillages")
    assert "openEmpireTown(town.id)" in merge


def test_all_player_facing_lists_use_standalone_villages_and_visible_towns():
    html = html_text()
    walking = function_source(html, "drawVillageMarkers")
    ledger = function_source(html, "renderEmpirePanel")
    atlas = function_source(html, "refreshEmpireMap")
    region = function_source(html, "renderRegionScreen")

    # The local walking-map query contains both claimed and frontier villages,
    # so it coalesces member results by canonical settlement id in-place.
    assert "renderedSettlements = new Set()" in walking
    assert "renderedSettlements.has(settlement.id)" in walking
    assert "openEmpireTown(settlement.id)" in walking
    assert "empireStandaloneVillages" in ledger
    assert "empireVisibleSettlements" in ledger
    assert "openEmpireTown(" in ledger
    assert "empireStandaloneVillages" in atlas
    assert "empireVisibleSettlements" in atlas
    assert "empireRegionHoldings(region)" in region
    assert 'data-action="region-town"' in region
    assert "openEmpireTown(" in region


def test_ledger_town_action_opens_management_instead_of_only_framing_atlas():
    panel = function_source(html_text(), "renderEmpirePanel")
    assert 'data-action="empire-settlement"' in panel
    assert "openEmpireTown(btn.dataset.settlement)" in panel
    assert "frameEmpireSettlement(btn.dataset.settlement)" not in panel


def test_each_town_policy_is_applied_once_after_its_wards_are_aggregated():
    snapshot = function_source(html_text(), "townEconomySnapshot")
    tribute = function_source(html_text(), "townTributeBundle")
    assert "rows.forEach" in snapshot
    assert "townAdministrativeSeats(s).forEach" in snapshot
    assert "townSeatMemberRecords(seat)" in snapshot
    assert snapshot.count("townApplySeatPolicyBundle") == 1
    assert "townAdministrativeSeats(s).forEach" in tribute
    assert "townSeatMemberRecords(seat).forEach" in tribute
    assert tribute.count("townApplySeatPolicyBundle") == 1


def test_city_votes_unify_borough_policies_and_every_borough_hall_can_advance():
    html = html_text()
    policy = function_source(html, "setTownPolicy")
    policy_gate = function_source(html, "townCanChangePolicy")
    upgrade_choice = function_source(html, "townNextHallUpgradeRow")
    upgrade = function_source(html, "beginTownHallUpgrade")
    assert "townSeatStateRows(settlement)" in policy
    assert "townCanChangePolicy(settlement, now)" in policy
    assert "row.state.policy = targetPolicy" in policy
    assert "rows.some(row => (row.state.hallLevel || 1) < 2)" in policy_gate
    assert "Raise every Borough Hall to level 2" in html
    assert "!row.state.hallConstruction" in upgrade_choice
    assert "(row.state.hallLevel || 1) < 5" in upgrade_choice
    assert "townNextHallUpgradeRow(settlement)" in upgrade


def test_collection_scope_does_not_change_bonus_loot_or_stores_policy_math():
    html = html_text()
    realm_collect = function_source(html, "collectEmpireTribute")
    county_collect = function_source(html, "collectRegionTribute")
    town_collect = function_source(html, "collectTownTribute")
    stores = function_source(html, "empireBuildingOutputForLedger")
    assert "i < tributeChests" in realm_collect
    assert "Math.min(3, tributeChests)" not in realm_collect
    assert "i < (due.wholeCycleHoldings || 0)" in county_collect
    assert "rollLoot('tribute'" in town_collect
    assert "townAdministrativeSeats(settlement).forEach" in stores
    assert "townApplySeatPolicyBundle(seat, raw)" in stores
