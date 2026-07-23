import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
CORE = (ROOT / "academy_treehouse_core.js").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")


def test_tavern_room_is_presented_as_barracks_not_a_pub():
    assert "label:'Barracks'" in CORE
    assert "role:'recruitment'" in CORE
    assert "label:'BARRACKS'" in HTML
    assert "THE THIRSTY OWL" not in HTML
    assert "The Thirsty Owl" not in HTML


def test_barracks_is_not_a_bird_housing_room():
    assert "tavern: { label:'BARRACKS'" in HTML
    assert "perches:[]" in HTML
    assert "if (bird.academy.room === 'tavern') bird.academy.room = 'outdoors';" in HTML
    assert "room !== 'tavern'" in HTML


def test_barracks_has_a_mobile_recruit_birds_overlay():
    assert 'id="barracksRecruitOverlay"' in HTML
    assert 'data-action="open-barracks-recruits"' in HTML
    assert "function openBarracksRecruitOverlay()" in HTML
    assert "function renderBarracksRecruitList()" in HTML
    assert "function openBarracksRecruitCard(" in HTML
    assert "function barracksRecruitBird(" in HTML
    assert "recruitDiscoveredBird" in HTML


def test_recruit_list_is_condensed_and_card_reveals_stats():
    assert "barracks-recruit-row" in HTML
    assert "barracks-recruit-detail" in HTML
    for marker in ["ATK", "DEF", "SPD", "INT", "STAM", "Recruit · "]:
        assert marker in HTML


def test_recruit_roster_has_rarity_value_and_power_sort_controls():
    assert 'id="barracksRecruitSort"' in HTML
    for mode in ["rarity", "value", "power"]:
        assert f'data-barracks-sort="{mode}"' in HTML
    assert "let barracksRecruitSort = 'rarity';" in HTML
    assert "function sortBarracksCandidates(" in HTML


def test_recruit_sort_orders_highest_rarity_value_and_power_first():
    assert "function sortBarracksCandidates(" in HTML
    power_fn = _function_source("barracksRecruitPower")
    sort_fn = _function_source("sortBarracksCandidates")
    output = _run_node(
        """
        function recruitCostForBird(b){ return b.cost; }
        const rows = [
          {key:'common-strong',bird:{commonName:'Common Strong',rarity:'common',cost:90,power:80}},
          {key:'legendary',bird:{commonName:'Legendary',rarity:'legendary',cost:300,power:70}},
          {key:'epic',bird:{commonName:'Epic',rarity:'epic',cost:220,power:95}},
          {key:'uncommon',bird:{commonName:'Uncommon',rarity:'uncommon',cost:120,power:40}},
          {key:'rare',bird:{commonName:'Rare',rarity:'rare',cost:180,power:60}}
        ];
        """ + power_fn + "\n" + sort_fn + "\n" +
        "console.log(JSON.stringify(['rarity','value','power'].map(m=>sortBarracksCandidates(rows,m).map(r=>r.key))));"
    )
    import json
    rarity, value, power = json.loads(output)
    assert rarity == ["legendary", "epic", "rare", "uncommon", "common-strong"]
    assert value == ["legendary", "epic", "rare", "uncommon", "common-strong"]
    assert power == ["epic", "common-strong", "legendary", "rare", "uncommon"]


def test_recruit_rows_keep_name_and_metadata_in_separate_mobile_lines():
    assert 'class="barracks-recruit-main"' in HTML
    assert ".barracks-recruit-main { min-width:0; display:block; }" in HTML
    assert ".barracks-recruit-name { display:block;" in HTML
    assert ".barracks-recruit-meta { display:block;" in HTML


def test_compact_sprites_prefer_transparent_cutouts_not_square_paintings():
    start = HTML.index("function birdOnlyImgHTML")
    end = HTML.index("// Bird image for FRAMED contexts", start)
    fn = HTML[start:end]
    assert "known || birdCutoutUrlFor(art)" in fn
    assert "const visual = known || art;" not in fn
    assert "data-fallback-emoji" in fn


def test_pwa_cache_is_versioned():
    assert "const BURBZ_CACHE = 'burbz-" in SW


def test_every_mapped_bird_has_a_real_transparent_cutout():
    import ast
    import re
    from PIL import Image

    block = HTML[HTML.index("const BUILT_IN_BIRD_ART = {"):HTML.index("// Bird art is stored through")]
    final_paths = {}
    for line in block.splitlines():
        match = re.search(r'^\s*(["\'])(.*?)\1\s*:\s*(["\'])(.*?)\3\s*,?\s*$', line)
        if not match:
            continue
        try:
            key = ast.literal_eval(match.group(1) + match.group(2) + match.group(1))
            value = ast.literal_eval(match.group(3) + match.group(4) + match.group(3))
        except Exception:
            continue
        final_paths[key] = value
    expected = {
        Path(value).stem + "_cutout.png"
        for value in final_paths.values()
        if value.startswith("/burbz/bird-art-cache/") and "/cutouts/" not in value and value.lower().endswith(".png")
    }
    expansions = subprocess.run(
        ["node", "-e", "const mods=['uk_bird_expansion_50.js','uk_bird_expansion_2.js','au_bird_expansion.js','uk_bird_expansion_3.js','au_bird_expansion_2.js']; console.log(JSON.stringify(mods.flatMap(m=>Object.values(require('./'+m).art))))"],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    assert expansions.returncode == 0, expansions.stderr
    expected.update(Path(value).stem + "_cutout.png" for value in json.loads(expansions.stdout))
    cutout_dir = ROOT / "bird-art-cache" / "cutouts"
    actual = {path.name for path in cutout_dir.glob("*_cutout.png")}
    # The legacy Lapwing and Magpie variants were retired; every remaining
    # cutout must now correspond to an actively mapped bird-art entry.
    assert expected <= actual
    assert not (actual - expected)
    assert len(actual) == 559
    for path in cutout_dir.glob("*_cutout.png"):
        with Image.open(path) as image:
            assert image.mode == "RGBA", path.name
            assert image.getchannel("A").getextrema() == (0, 255), path.name


def _function_source(name: str) -> str:
    start = HTML.index(f"function {name}(")
    next_fn = HTML.find("\nfunction ", start + 10)
    assert next_fn > start
    return HTML[start:next_fn]


def _run_node(source: str) -> str:
    import subprocess
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def test_barracks_candidates_merge_birdex_and_trail_without_duplicates():
    fn = _function_source("barracksRecruitCandidates")
    output = _run_node(
        """
        const records = [{key:'robin',commonName:'European Robin',species:'European Robin',rarity:'common'}];
        function recruitableBirdexRecords(){ return records; }
        function createBirdFromDiscovery(r){ return {...r, atk:2}; }
        function canonicalSpeciesName(n){ return n; }
        function speciesKey(n){ return n.toLowerCase().replace(/[^a-z]+/g,'-'); }
        function ensureTavernPatrons(){ return [
          {key:'robin',species:'European Robin',rarity:'common',questName:'Ribble Way'},
          {key:'blue-tit',species:'Blue Tit',rarity:'common',questName:'Canal Loop'}
        ]; }
        function companionForSpecies(){ return null; }
        function createBirdEntry(name){ return {commonName:name,species:name,rarity:'common'}; }
        """ + fn + "\nconst rows=barracksRecruitCandidates(); console.log(JSON.stringify(rows.map(r=>[r.key,r.source])));"
    )
    import json
    rows = json.loads(output)
    assert len(rows) == 2
    assert any(row[0] == "robin" and "Ribble Way" in row[1] for row in rows)
    assert any(row[0] == "blue-tit" for row in rows)


def test_barracks_recruitment_moves_new_companion_to_gardens_and_saves():
    fn = _function_source("barracksRecruitBird")
    output = _run_node(
        """
        let saved=0, removed='', rendered=0;
        const gameState={player:{coins:100},flock:[]};
        const candidate={key:'blue-tit',bird:{commonName:'Blue Tit',species:'Blue Tit',rarity:'common'}};
        function barracksCandidateForKey(k){ return k==='blue-tit' ? candidate : null; }
        function canonicalSpeciesName(n){ return n; }
        function getDiscoveredRecordForSpecies(){ return {key:'blue-tit'}; }
        function rememberDiscoveredBird(){}
        function recruitDiscoveredBird(k){ gameState.flock.push({id:'b1',commonName:'Blue Tit',species:'Blue Tit',academy:{room:'tavern'}}); return k==='blue-tit'; }
        function removeTavernPatronForSpecies(n){ removed=n; }
        function companionForSpecies(n){ return gameState.flock.find(b=>b.species===n); }
        function ensureBirdAcademy(b){ b.academy ||= {room:'outdoors'}; return b; }
        function saveState(){ saved++; }
        function showToast(){}
        function renderBarracksRecruitList(){ rendered++; }
        function renderAcademy(){ rendered++; }
        """ + fn + "\nconst ok=barracksRecruitBird('blue-tit'); console.log(JSON.stringify({ok,room:gameState.flock[0].academy.room,saved,removed,rendered}));"
    )
    import json
    result = json.loads(output)
    assert result == {"ok": True, "room": "outdoors", "saved": 1, "removed": "Blue Tit", "rendered": 2}
