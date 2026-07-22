"""Real-world day/night for the Empire screen, and the Kitchen food system.

The 3D villages and the Empire atlas were hardcoded to permanent night. They
now follow the player's actual clock (and their latitude's seasonal
sunrise/sunset once the map has a fix): a daylight helper drives the village
sky dome, sun/moon, stars, lit windows, torches and the Empire darkness veil,
rebuilding the scene when the real sky changes bucket.

The Kitchen & Pantry becomes the place meals are prepared: players plate up
to three pantry portions for a chosen bird, and serving teaches the bird's
real wild diet (loved / tolerated / refused with a factoid). Birds now come
back hungry from expeditions and walking quests; gathering quests (berry
harvest, bug hunt, pond dipping, hunting flights) drop food parcels that
unpack into pantry stock, as do new map food-scrap pickups.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def const_source(html: str, name: str) -> str:
    start = html.index(f"const {name} = {{")
    end = html.index("\n};", start)
    return html[start:end + 3]


def const_array_source(html: str, name: str) -> str:
    start = html.index(f"const {name} = [")
    end = html.index("\n];", start)
    return html[start:end + 3]


def daylight_source(html: str) -> str:
    return (
        function_source(html, "burbzSunTimes")
        + "\n" + function_source(html, "burbzDaylight")
        + "\n" + function_source(html, "burbzDaylightKey")
    )


def run_node(script: str):
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_daylight_tracks_the_device_clock_and_latitude_seasons():
    html = HTML_PATH.read_text(encoding="utf-8")
    src = daylight_source(html)
    out = run_node(
        src +
        "\nconst at=(m,d,h)=>burbzDaylight(new Date(2026,m,d,h,0,0));\n"
        "console.log(JSON.stringify({\n"
        "  midnight: at(5,21,0),\n"          # June, 00:00 → night
        "  noon: at(5,21,13),\n"             # June, 13:00 → day
        "  winterTeatime: at(11,21,17),\n"   # December, 17:00 → dark mid-winter
        "  juneTeatime: at(5,21,17),\n"      # June, 17:00 → still day
        "  key: burbzDaylightKey() }));"
    )
    assert out["midnight"]["phase"] == "night" and out["midnight"]["light"] == 0
    assert out["noon"]["phase"] == "day" and out["noon"]["light"] == 1
    # Seasonal daylight: 5pm is day in June but night (or dusk) in December.
    assert out["juneTeatime"]["light"] == 1
    assert out["winterTeatime"]["light"] < 0.5
    assert out["winterTeatime"]["sunset"] < out["juneTeatime"]["sunset"]
    assert ":" in out["key"]


def test_dawn_and_dusk_blend_between_night_and_day():
    html = HTML_PATH.read_text(encoding="utf-8")
    out = run_node(
        daylight_source(html) +
        "\nconst d=burbzDaylight(new Date(2026,5,21,4,50,0));\n"  # near June sunrise
        "console.log(JSON.stringify(d));"
    )
    assert out["phase"] in ("dawn", "night", "day")
    if out["phase"] == "dawn":
        assert 0 < out["light"] < 1
        assert out["warm"] > 0


def test_village_scene_and_empire_veil_consume_the_daylight():
    html = HTML_PATH.read_text(encoding="utf-8")
    build = function_source(html, "buildVillageScene")
    assert "villageDaylight = burbzDaylight()" in build
    assert "villageBuiltDayKey = burbzDaylightKey()" in build
    assert "const nightSky = dl.light < 0.45" in build
    # Key light blends moon → sun; torches bank down; exposure lifts by day.
    assert "villageLerpColor(0xbfd2ff, 0xfff3d0, dl.light)" in build
    assert "torchDim" in build
    assert "toneMappingExposure = 1.25 + dl.light * 0.3" in build
    # Windows keep their RNG rolls day and night so layouts never shift.
    assert "const litRoll = r() < 0.72" in html
    assert "litRoll && !candlesOut" in html
    # Live transition: the animate loop rebuilds when the real sky changes.
    frame = function_source(html, "villageAnimateFrame")
    assert "burbzDaylightKey()" in frame
    # The village render path rebuilds when the daylight bucket moved on.
    render = function_source(html, "renderVillage")
    assert "villageBuiltDayKey !== burbzDaylightKey()" in render
    # Empire veil: multiplied colour follows the daylight.
    veil = function_source(html, "empireVeilFill")
    assert "burbzDaylight()" in veil
    fog = function_source(html, "updateEmpireFogMask")
    assert "ctx.fillStyle = empireVeilFill();" in fog


def test_empire_veil_runs_moonlit_slate_to_parchment_day():
    html = HTML_PATH.read_text(encoding="utf-8")
    src = daylight_source(html) + "\n" + function_source(html, "empireVeilFill")
    out = run_node(
        "let fakeNow=null;\n" + src.replace("burbzDaylight()", "burbzDaylight(fakeNow)") +
        "\nfakeNow=new Date(2026,5,21,1,0,0); const night=empireVeilFill();\n"
        "fakeNow=new Date(2026,5,21,13,0,0); const day=empireVeilFill();\n"
        "console.log(JSON.stringify({night,day}));"
    )
    assert out["night"] == "rgb(57,67,79)"    # the original moonlit slate
    assert out["day"] == "rgb(244,238,220)"   # near-white parchment: no darkening


def test_food_parcels_unpack_into_pantry_respecting_caps():
    html = HTML_PATH.read_text(encoding="utf-8")
    src = (
        const_source(html, "FOOD_TOKENS")
        + "\nconst PANTRY_CAP = { seeds: 12, suet: 10, insects: 12, worms: 10, berries: 10, fruit: 10, fish: 8, flying: 8, meat: 6, carrion: 6, acorns: 10, aquatic: 10 };\n"
        + function_source(html, "foodToken")
        + "\n" + function_source(html, "unpackFoodToken")
    )
    out = run_node(
        "const gameState={pantry:{fish:7, aquatic:0, meat:0}};\n" + src +
        "\nconst g1=unpackFoodToken('pond_haul',1);\n"   # fish 7→8 capped (+1), aquatic +1
        "const g2=unpackFoodToken('pond_haul',1);\n"     # fish full now, aquatic +1
        "const g3=unpackFoodToken('prey_cache',2);\n"    # meat +4
        "console.log(JSON.stringify({g1,g2,g3,pantry:gameState.pantry}));"
    )
    assert {"food": "fish", "qty": 1} in out["g1"]
    assert all(g["food"] != "fish" for g in out["g2"])
    assert out["pantry"]["fish"] == 8
    assert out["pantry"]["aquatic"] == 2
    assert out["pantry"]["meat"] == 4


def test_gathering_quests_exist_and_drop_food_parcels():
    result = subprocess.run(["node", "-e", (
        "const core=require('./academy_treehouse_core.js');"
        "const t=core.getQuestTemplates();"
        "const ids=['berry_harvest','bug_hunt','pond_dip','hunt_prey'];"
        "const found=ids.map(id=>t.find(x=>x.id===id)).filter(Boolean);"
        "console.log(JSON.stringify({n:found.length,items:found.flatMap(f=>f.items)}));"
    )], cwd=ROOT, text=True, capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout)
    assert out["n"] == 4
    for parcel in ("berry_bundle", "bug_box", "pond_haul", "prey_cache", "carrion_find"):
        assert parcel in out["items"]
    # The quest board shows copy for each new gathering quest.
    html = HTML_PATH.read_text(encoding="utf-8")
    info = const_source(html, "QUEST_TEMPLATE_INFO")
    for qid in ("berry_harvest", "bug_hunt", "pond_dip", "hunt_prey"):
        assert qid in info


def test_expedition_claims_shelve_parcels_and_make_birds_hungry():
    html = HTML_PATH.read_text(encoding="utf-8")
    claim = function_source(html, "claimBirdExpedition")
    assert "unpackFoodToken(key, count)" in claim
    assert "Pantry stocked" in claim
    assert "bird.care.hunger" in claim
    walk = function_source(html, "completeWalkingQuest")
    assert "walkingPet.care.hunger" in walk
    # Starving birds must eat before setting out again.
    send = function_source(html, "startBirdExpedition")
    assert ">= 90" in send and "Kitchen" in send
    train = function_source(html, "startBirdTrainingSession")
    assert ">= 90" in train and "Kitchen" in train


def test_kitchen_meal_teaches_the_real_diet():
    html = HTML_PATH.read_text(encoding="utf-8")
    src = (
        const_source(html, "FOODS")
        + "\n" + const_array_source(html, "BIRD_DIET_RULES")
        + "\n" + function_source(html, "inferBirdDiet")
        + "\n" + function_source(html, "kitchenServeMeal")
    )
    script = (
        "const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));\n"
        "const bird={id:'b1',commonName:'Common Buzzard',species:'Common Buzzard',level:1,xp:0,maxHp:100,hp:80,"
        "care:{hunger:80,happiness:60},academy:{room:'kitchen'},training:{feedCount:0,trainCount:0}};\n"
        "const gameState={flock:[bird],pantry:{meat:2,seeds:3,carrion:1}};\n"
        "let kitchenMeal={birdId:'b1',plate:['meat','seeds']};\n"
        "const KITCHEN_PLATE_MAX=3;\n"
        "const toasts=[]; const showToast=m=>toasts.push(m);\n"
        "const grants=[]; const levelUpBird=(b,xp)=>grants.push(xp);\n"
        "const ensureBirdAcademy=()=>{}; const refillPantry=()=>{};\n"
        "const kitchenBirdAvailable=()=>true; const recalcBirdPower=()=>{};\n"
        "const updateQuestProgress=()=>{}; const saveState=()=>{};\n"
        "const SFX={tap:()=>{},levelUp:()=>{}};\n"
        "let lastResult=''; const renderKitchenSheet=h=>lastResult=h;\n"
        "const renderAcademy=()=>{}; const renderPetCompanion=()=>{};\n"
        "const birdDisplayName=b=>b.commonName; const escapeHtml=s=>String(s);\n"
        + src +
        "\nkitchenServeMeal();\n"
        "console.log(JSON.stringify({hunger:bird.care.hunger,dietKnown:bird.academy.dietKnown,"
        "grants,pantry:gameState.pantry,maxHp:bird.maxHp,result:lastResult}));"
    )
    out = run_node(script)
    # Meat is loved by a buzzard (-30 hunger); seeds are refused by a raptor.
    assert out["hunger"] == 50
    assert out["dietKnown"] is True
    assert out["grants"] == [4]
    assert out["pantry"]["meat"] == 1 and out["pantry"]["seeds"] == 2
    assert out["maxHp"] == 102
    assert "Devoured" in out["result"] and "Refused" in out["result"]
    assert "Diet discovered" in out["result"]


def test_kitchen_ui_is_reachable_from_the_room_and_the_bag_unpacks_parcels():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "openKitchenSheet" in function_source(html, "renderAcademyRoomInterior")
    assert "academySelectedRoom === 'kitchen'" in html
    bag = function_source(html, "renderInventory")
    assert "useFoodTokenFromBag" in bag
    # New map food-scrap pickups stock the pantry directly.
    for pickup in ("Suet scrap", "Windfall fruit", "Acorn cache", "Beetle log"):
        assert pickup in html
    # The general store now sells every pantry food type.
    shops = const_source(html, "VILLAGE_SHOPS")
    for pack in ("pack_fruit", "pack_flying", "pack_carrion", "pack_aquatic"):
        assert pack in shops
