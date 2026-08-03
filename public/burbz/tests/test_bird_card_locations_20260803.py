import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
DEPLOY = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"
RELEASE = "uk-bird-alias-completion-v216-20260803"


def html_source():
    return HTML.read_text(encoding="utf-8")


def resolver_source():
    html = html_source()
    start = html.index("function resolveBirdCardLocation(")
    end = html.index("function birdCardLocationButtonHTML(", start)
    return html[start:end]


def node_locations():
    source = resolver_source()
    script = source + r"""
const rooms = {
  outdoors:{label:'AVIARY GARDENS',icon:'🌱'}, dorm:{label:'THE ROOST',icon:'🏠'},
  training:{label:'TRAINING HALL',icon:'🏋️'}, hospital:{label:'BIRD HOSPITAL',icon:'🏥'},
  kitchen:{label:'KITCHEN & PANTRY',icon:'🥣'}
};
const bird = {id:'b1', academy:{room:'outdoors'}, care:{sleeping:false}};
const base = {now:1000, rooms, expeditions:[], trainingSessions:[], post:null};
const cases = {
  questDone: resolveBirdCardLocation(bird, {...base, expeditions:[{birdId:'b1',status:'active',endMs:900,label:'Moonlit Scout'}]}),
  questActive: resolveBirdCardLocation(bird, {...base, expeditions:[{birdId:'b1',status:'active',endMs:2000,label:'Moonlit Scout'}]}),
  hospital: resolveBirdCardLocation({...bird,academy:{room:'hospital'}}, base),
  sleeping: resolveBirdCardLocation({...bird,care:{sleeping:true},academy:{room:'outdoors'}}, base),
  trainingDone: resolveBirdCardLocation(bird, {...base, trainingSessions:[{birdId:'b1',status:'active',endMs:900,label:'Wing drill',room:'training'}]}),
  academyPost: resolveBirdCardLocation(bird, {...base, post:{scope:'academy',key:'kitchen',icon:'🥣',title:'Head Chef',where:'KITCHEN & PANTRY'}}),
  villagePost: resolveBirdCardLocation(bird, {...base, post:{scope:'village',key:'55',icon:'🏘️',title:'Steward',where:'Mossmere'}}),
  regionPost: resolveBirdCardLocation(bird, {...base, post:{scope:'region',key:'north',icon:'🗺️',title:'Warden',where:'Northlands'}}),
  idle: resolveBirdCardLocation(bird, base),
  claimedIgnored: resolveBirdCardLocation({...bird,academy:{room:'hospital'}}, {...base, expeditions:[{birdId:'b1',status:'claimed',endMs:900,label:'Old quest'}]})
};
console.log(JSON.stringify(cases));
"""
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_effective_location_prioritises_finished_and_active_work_then_real_room():
    rows = node_locations()
    assert rows["questDone"] == {"kind":"quest-complete","icon":"✅","label":"Quest finished","detail":"Moonlit Scout","screen":"quests"}
    assert rows["questActive"]["kind"] == "quest-active"
    assert rows["questActive"]["label"] == "On quest"
    assert rows["questActive"]["screen"] == "quests"
    assert rows["hospital"]["label"] == "BIRD HOSPITAL"
    assert rows["hospital"]["room"] == "hospital"
    assert rows["hospital"]["screen"] == "academy-room"
    assert rows["sleeping"]["label"] == "THE ROOST"
    assert rows["sleeping"]["room"] == "dorm"
    assert rows["trainingDone"]["label"] == "Training finished"
    assert rows["trainingDone"]["room"] == "training"
    assert rows["idle"]["label"] == "AVIARY GARDENS"
    assert rows["claimedIgnored"]["label"] == "BIRD HOSPITAL"


def test_role_locations_keep_their_real_destination():
    rows = node_locations()
    assert rows["academyPost"]["screen"] == "academy-room"
    assert rows["academyPost"]["room"] == "kitchen"
    assert rows["villagePost"]["screen"] == "village"
    assert rows["villagePost"]["key"] == "55"
    assert rows["regionPost"]["screen"] == "region"
    assert rows["regionPost"]["key"] == "north"


def test_companion_card_has_small_accessible_location_button_and_real_router():
    html = html_source()
    card = html[html.index("function createBirdCardHTML"):html.index("function createKnownSpeciesCardHTML")]
    click = html[html.index("grid.querySelectorAll('.bird-card:not"):html.index("const loadMore", html.index("grid.querySelectorAll('.bird-card:not"))]
    router = html[html.index("function gotoBirdCardLocation("):html.index("function createBirdCardHTML")]
    assert "birdCardLocationButtonHTML(bird)" in card
    assert 'data-action="bird-location"' in html
    assert "gotoBirdCardLocation(locationBtn.dataset.birdId)" in click
    assert "openAcademyRoom(location.room)" in router
    assert "currentScreen === 'academy-room'" in router
    assert "classList.contains('active')" in router
    assert "switchScreen('quests')" in router
    assert "openEmpireVillage(location.key)" in router
    assert "openEmpireRegion(location.key)" in router
    assert 'aria-label="Find ${escapeHtml(birdDisplayName(bird))}: ${escapeHtml(location.label)}"' in html
    assert ".card-location-btn" in html
    assert "min-height:34px" in html


def test_release_is_cache_busted_and_deployable():
    html = html_source()
    sw = SW.read_text(encoding="utf-8")
    deploy = DEPLOY.read_text(encoding="utf-8")
    assert RELEASE in html
    assert RELEASE in sw
    assert "bird_location_core.js" not in html
    assert '"index.html"' in deploy and '"sw.js"' in deploy
