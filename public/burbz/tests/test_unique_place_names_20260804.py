"""Global Burbz place-name uniqueness and explicit hierarchy contracts.

Every geographic entity must have its own deterministic proper name.  Towns,
cities and feudal regions may never inherit the name of their heart/capital
village, and legacy saves must be renamed without losing progress or identity.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "empire_realm_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
CURRENT_BUILD = "accurate-diets-full-catalogue-v226-20260805"
KINDS = ["village", "town", "city", "county", "duchy", "kingdom"]


def run_core(expression: str):
    script = f"const core=require({json.dumps(str(CORE))}); console.log(JSON.stringify({expression}));"
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_names_are_deterministic_and_globally_unique_across_ranks_and_seeds():
    # 6,000 entities is far beyond one player's visible realm and catches both
    # same-rank and cross-rank collisions. The generator itself is injective.
    script = """
      const core=require(%s); const kinds=%s; const names=[];
      for (const kind of kinds) for (let seed=0; seed<1000; seed++) names.push(core.placeName(kind, seed));
      console.log(JSON.stringify({count:names.length, unique:new Set(names).size, stable:core.placeName('village',42)===core.placeName('village',42), names:names.slice(0,6)}));
    """ % (json.dumps(str(CORE)), json.dumps(KINDS))
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True)
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout)
    assert out["unique"] == out["count"] == 6000
    assert out["stable"] is True
    assert all(name and len(name) <= 24 for name in out["names"])


def test_world_cells_use_injective_identity_even_when_the_legacy_hash_collides():
    # These are two real supported cells that collide under the old FNV-32 id.
    result = run_core("(()=>{const a=core.villageCellSeed(-321,299), b=core.villageCellSeed(-272,232); return {a,b,names:[core.placeName('village',a),core.placeName('village',b)], ordinaryMax:core.villageCellSeed(4504,9004), waysteadMin:core.waysteadBlockSeed(-1502,-3002)};})()")
    assert result["a"] != result["b"]
    assert len(set(result["names"])) == 2
    assert result["ordinaryMax"] < 0x80000000 <= result["waysteadMin"]


def test_each_rank_has_a_distinct_proper_name_and_plain_label():
    names = run_core("Object.fromEntries(['village','town','city','county','duchy','kingdom'].map(k=>[k,{name:core.placeName(k,1234),label:core.placeLabel(k,1234)}]))")
    assert len({row["name"] for row in names.values()}) == 6
    assert names["village"]["label"].endswith(" Village")
    assert names["town"]["label"].startswith("Town of ")
    assert names["city"]["label"].startswith("City of ")
    assert names["county"]["label"].startswith("County of ")
    assert names["duchy"]["label"].startswith("Duchy of ")
    assert names["kingdom"]["label"].startswith("Kingdom of ")


def test_derived_town_city_and_county_do_not_reuse_member_village_names():
    villages = []
    # Three tight towns in one city and one county.
    for group, (lat, lon) in enumerate([(53.20, -2.70), (53.20, -2.58), (53.28, -2.64)]):
        for i in range(3):
            seed = 100 + group * 10 + i
            villages.append({"seed": seed, "name": f"LegacySame{group}", "lat": lat + i * 0.018, "lon": lon, "claimedAt": f"2026-07-{1+group*3+i:02d}T00:00:00Z"})
    result = run_core(f"(()=>{{const v={json.dumps(villages)}.map(x=>({{...x,name:core.placeName('village',x.seed)}})); const s=core.deriveSettlements(v); const r=core.deriveRealm(v); return {{villages:v.map(x=>x.name),towns:s.towns.map(x=>x.name),cities:s.cities.map(x=>x.name),counties:r.regions.map(x=>x.properName)}};}})()")
    all_names = result["villages"] + result["towns"] + result["cities"] + result["counties"]
    assert result["towns"] and result["cities"] and result["counties"]
    assert len(all_names) == len(set(all_names))


def test_legacy_save_migration_is_safe_idempotent_and_preserves_progress():
    state = {
        "placeNameVersion": 0,
        "lastVillage": {"seed": 11, "name": "Crakestead", "lat": 53.8, "lon": -2.4},
        "empire": {
            "villages": {
                "11": {"seed": 11, "name": "Crakestead", "lat": 53.8, "lon": -2.4, "claimedAt": "2026-07-31T00:00:00Z", "economy": {"buildings": {"quarry": 2}}, "lastTributeAt": 123},
                "12": {"seed": 12, "name": "Crakestead", "lat": 53.81, "lon": -2.4, "claimedAt": "2026-08-01T00:00:00Z"},
            },
            "pendingLiberation": {"seed": 13, "name": "Crakestead", "lat": 53.82, "lon": -2.4},
            "liberationVictories": {"11": {"seed": 11, "name": "Crakestead", "wonAt": "2026-07-31T00:00:00Z"}},
            "tradeRoutes": {"11~99": {"openedAt": 456}},
        },
    }
    out = run_core(f"(()=>{{const s={json.dumps(state)}; const once=core.migratePlaceNames(s); const snapshot=JSON.stringify(once); const twice=core.migratePlaceNames(once); return {{state:twice,idempotent:snapshot===JSON.stringify(twice)}};}})()")
    migrated = out["state"]
    assert out["idempotent"] is True
    assert migrated["placeNameVersion"] >= 1
    assert migrated["empire"]["villages"]["11"]["name"] != "Crakestead"
    assert migrated["empire"]["villages"]["11"]["name"] != migrated["empire"]["villages"]["12"]["name"]
    assert migrated["lastVillage"]["name"] == migrated["empire"]["villages"]["11"]["name"]
    assert migrated["empire"]["pendingLiberation"]["name"] == run_core("core.placeName('village',13)")
    assert migrated["empire"]["villages"]["11"]["economy"]["buildings"]["quarry"] == 2
    assert migrated["empire"]["villages"]["11"]["lastTributeAt"] == 123
    assert migrated["empire"]["tradeRoutes"]["11~99"]["openedAt"] == 456


def test_v1_coordinate_hash_identity_migrates_every_seed_key_without_losing_progress():
    old_seed = 4276340128  # legacy collision hash for cell (-321, 299)
    lat, lon = (-321 + 0.5) * 0.02, (299 + 0.5) * 0.02
    state = {
        "placeNameVersion": 1,
        "lastVillage": {"seed": old_seed, "name": "Crakestead", "lat": lat, "lon": lon},
        "knowledgeQuiz": {"lastVillageKey": str(old_seed)},
        "birdRoles": {"villages": {str(old_seed): "bird-v"}, "regions": {str(old_seed): "bird-r"}},
        "empire": {
            "villages": {str(old_seed): {"seed": old_seed, "name": "Crakestead", "lat": lat, "lon": lon, "economy": {"buildings": {"quarry": 2}}}},
            "pendingLiberation": {"seed": old_seed, "name": "Crakestead", "lat": lat, "lon": lon},
            "liberationVictories": {str(old_seed): {"seed": old_seed, "name": "Crakestead", "wonAt": "kept"}},
            "tradeRoutes": {f"123~{old_seed}": {"a": "123", "b": str(old_seed), "openedAt": 456}},
        },
    }
    out = run_core(f"(()=>{{const s={json.dumps(state)}; const once=core.migratePlaceNames(s); const snapshot=JSON.stringify(once); const twice=core.migratePlaceNames(once); return {{state:twice,idempotent:snapshot===JSON.stringify(twice),expected:core.villageCellSeed(-321,299),routeKey:core.tradeRouteKey(123,core.villageCellSeed(-321,299))}};}})()")
    migrated, new_seed = out["state"], str(out["expected"])
    assert out["idempotent"] is True
    assert new_seed in migrated["empire"]["villages"] and str(old_seed) not in migrated["empire"]["villages"]
    assert migrated["empire"]["villages"][new_seed]["economy"]["buildings"]["quarry"] == 2
    assert new_seed in migrated["empire"]["liberationVictories"]
    assert migrated["empire"]["pendingLiberation"]["seed"] == out["expected"]
    assert migrated["lastVillage"]["seed"] == out["expected"]
    assert migrated["birdRoles"]["villages"][new_seed] == "bird-v"
    assert migrated["birdRoles"]["regions"][new_seed] == "bird-r"
    assert migrated["knowledgeQuiz"]["lastVillageKey"] == new_seed
    assert migrated["empire"]["tradeRoutes"][out["routeKey"]]["openedAt"] == 456


def test_colliding_legacy_references_use_their_own_coordinates_during_migration():
    old_seed = 4276340128
    a = {"seed": old_seed, "name": "Crakestead", "lat": (-321 + 0.5) * 0.02, "lon": (299 + 0.5) * 0.02}
    b = {"seed": old_seed, "name": "Crakestead", "lat": (-272 + 0.5) * 0.02, "lon": (232 + 0.5) * 0.02}
    state = {"placeNameVersion": 1, "lastVillage": dict(b), "empire": {"villages": {str(old_seed): dict(a)}, "pendingLiberation": dict(b), "liberationVictories": {str(old_seed): {"seed": old_seed, "name": "Crakestead"}}}}
    out = run_core(f"(()=>{{const s=core.migratePlaceNames({json.dumps(state)}); return {{s,a:core.villageCellSeed(-321,299),b:core.villageCellSeed(-272,232)}};}})()")
    migrated = out["s"]
    assert str(out["a"]) in migrated["empire"]["villages"]
    assert str(out["a"]) in migrated["empire"]["liberationVictories"]
    assert migrated["empire"]["pendingLiberation"]["seed"] == out["b"]
    assert migrated["lastVillage"]["seed"] == out["b"]


def test_hostile_place_save_shapes_do_not_crash_or_create_duplicate_fallbacks():
    result = run_core("[null,[],{}, {empire:{villages:[]}}, {empire:{villages:{x:{seed:'bad',name:7},'7':{seed:7,name:''}}}}].map(s=>{try{return {ok:true,state:core.migratePlaceNames(s)}}catch(e){return {ok:false,error:String(e)}}})")
    assert all(row["ok"] for row in result)
    healed = result[-1]["state"]["empire"]["villages"]["7"]
    assert healed["name"] == run_core("core.placeName('village',7)")


def test_malformed_seed_rows_are_excluded_from_hierarchy_derivation():
    result = run_core("(()=>{const rows=[{lat:53,lon:-2},{seed:'bad',lat:53.01,lon:-2},{seed:7,lat:53.02,lon:-2}]; return {valid:rows.map(core.validVillageIdentity),regions:core.deriveRegions(rows).regions.length,towns:core.deriveSettlements(rows).towns.length};})()")
    assert result == {"valid": [False, False, True], "regions": 0, "towns": 0}


def test_game_boot_applies_place_migration_and_village_generation_uses_core():
    html = HTML.read_text()
    assert "migrateGamePlaceNames(gameState)" in html
    assert "placeName('village'," in html
    assert "placeNameVersion" in html
    assert "core.villageCellSeed(i, j)" in html
    assert "core.waysteadBlockSeed(bi, bj)" in html


def test_cloud_imports_and_live_caches_use_the_same_place_migration():
    html = HTML.read_text()
    cloud = html[html.index("function mergeCloudState("):html.index("async function loadCloudProgress(")]
    migration = html[html.index("function migrateGamePlaceNames("):html.index("function empireSettlementsInfo(")]
    assert "migrateGamePlaceNames(hungerMigrated)" in cloud
    assert "empireRegionsCache = null" in migration
    assert "empireSettlementsCache = null" in migration
    assert "villageActive.name = migrated.lastVillage.name" in migration


def test_mobile_ui_explicitly_names_village_town_county_and_player_title():
    html = HTML.read_text()
    assert "MANAGE VILLAGE" in html
    assert "HOME VILLAGE" in html
    assert "YOUR TOWN" in html
    assert "YOUR COUNTY" in html
    assert "YOUR TITLE" in html
    assert "· VILLAGE" in html
    assert "Village centre of " in html
    assert "Village district of " in html


def test_mobile_hierarchy_chips_wrap_long_generated_names_instead_of_hiding_them():
    html = HTML.read_text()
    css = html[html.index(".empire-locator-value"):html.index(".empire-locator-chip.is-empty")]
    assert "white-space:normal" in css
    assert "overflow-wrap:anywhere" in css
    assert "text-overflow:ellipsis" not in css


def test_map_labels_put_the_place_type_before_any_clipped_name():
    html = HTML.read_text()
    start = html.index("function refreshEmpireMap(")
    marker_code = html[start:start + 16000]
    assert "VILLAGE · " in marker_code
    assert "settlement.tier.toUpperCase() + ' · '" in marker_code
    assert "COUNTY · " in marker_code


def test_diary_calls_a_liberated_village_a_village_not_a_town():
    diary = (ROOT / "diary_core.js").read_text()
    assert "another village freed from the evil Burbz" in diary
    assert "village now stands" in diary and "villages now stand" in diary


def test_release_marker_advances_for_offline_clients():
    sw = SW.read_text()
    assert CURRENT_BUILD in sw
    assert "empire_realm_core.js" in sw
