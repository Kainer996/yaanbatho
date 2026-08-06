"""Individual birds level up: quest XP for the walking pet, and XP scrolls.

The flock always carried level/xp fields, but walking quests paid XP only to
the trainer, and the sole "Wisdom scroll" was an instant shop purchase aimed
at the active pet. This release makes bird levelling a real system:

- levelUpBird recomputes the XP threshold per level (a big XP dump used to
  re-spend the old, cheaper threshold on every level) and announces level-ups.
- Completing a walking quest pays the active walking pet half the headline XP;
  chest finds with XP teach the pet too.
- Bag-stored XP scrolls (BIRD_XP_ITEMS): any-bird Feather Scrolls and Wisdom
  Tomes, plus wing-class scrolls (raptor, songbird, waterbird, skydancer,
  trickster, groundbird) that only fit birds of that class and pay more.
  They drop from walking-quest chests, map pickups and Academy expeditions,
  and the village potion shop sells them into the bag.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
QUEST_CORE_PATH = ROOT / "quest_core.js"
QUEST_CORE_PIN = "ordered-quest-markers-v224-20260804"
ACADEMY_CORE_PIN = "nocturnal-night-bonus-v229-20260805"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def const_source(html: str, name: str) -> str:
    start = html.index(f"const {name} = {{")
    end = html.index("\n};", start)
    return html[start:end + 3]


def test_level_up_bird_recomputes_threshold_per_level_and_caps_at_50():
    html = HTML_PATH.read_text(encoding="utf-8")
    src = function_source(html, "levelUpBird")
    script = (
        "const XP_PER_LEVEL=(lv)=>Math.floor(80+lv*40+Math.pow(lv,1.5)*10);\n"
        "const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));\n"
        "const generateBirdStats=()=>({hp:80,atk:60,def:60,spd:60,int:50,stamina:50});\n"
        "const toasts=[]; const showToast=m=>toasts.push(m);\n"
        "const SFX={levelUp:()=>{}};\n"
        "const birdDisplayName=b=>b.commonName;\n"
        + src +
        "\nconst bird={commonName:'Buzzard',species:'Buzzard',level:1,xp:0,rarity:'common',training:{}};\n"
        "const none=levelUpBird(bird,10);\n"
        "const lowLevel=bird.level, lowXp=bird.xp;\n"
        "// 130 finishes LV.1, 188 finishes LV.2 (recomputed!), 50 left over\n"
        "const gained=levelUpBird(bird,120+188+50);\n"
        "const capBird={commonName:'Elder',species:'Buzzard',level:50,xp:0,rarity:'common',training:{}};\n"
        "const capGained=levelUpBird(capBird,99999);\n"
        "console.log(JSON.stringify({none,lowLevel,lowXp,gained,level:bird.level,xp:bird.xp,"
        "hp:bird.hp,maxHp:bird.maxHp,capGained,capLevel:capBird.level,toasts}));"
    )
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout)
    assert out["none"] == 0 and out["lowLevel"] == 1 and out["lowXp"] == 10
    # The old bug spent the LV.1 threshold (130) twice; the fixed curve spends
    # 130 then 188 and leaves exactly 50 XP at LV.3.
    assert out["gained"] == 2
    assert out["level"] == 3
    assert out["xp"] == 50
    assert out["hp"] == out["maxHp"]  # level-ups heal to full
    assert out["capGained"] == 0 and out["capLevel"] == 50
    assert any("reached LV.3" in t for t in out["toasts"])


def test_xp_scrolls_respect_wing_class_and_consume_from_the_bag():
    html = HTML_PATH.read_text(encoding="utf-8")
    src = (
        const_source(html, "BIRD_XP_ITEMS")
        + "\n" + function_source(html, "birdXpItem")
        + "\n" + function_source(html, "birdWingClass")
        + "\n" + function_source(html, "useXpScroll")
    )
    script = (
        "const window={BurbzBattleCore:require('./battle_core.js')};\n"
        "const buzzard={id:'b1',commonName:'Common Buzzard',species:'Common Buzzard',level:1,xp:0};\n"
        "const robin={id:'b2',commonName:'European Robin',species:'European Robin',level:1,xp:0};\n"
        "const gameState={flock:[buzzard,robin],inventory:{items:{xp_scroll_raptor:1,xp_scroll_minor:2}}};\n"
        "const grants=[]; const levelUpBird=(b,xp)=>grants.push([b.id,xp]);\n"
        "const toasts=[]; const showToast=m=>toasts.push(m);\n"
        "const birdDisplayName=b=>b.commonName;\n"
        "const SFX={capture:()=>{}};\n"
        "const saveState=()=>{}; const renderInventory=()=>{};\n"
        "const closeXpScrollSheet=()=>{}; const openXpScrollPicker=()=>{};\n"
        + src +
        "\nuseXpScroll('xp_scroll_raptor','b2');\n"  # robin is no raptor
        "const afterMismatch=[grants.length,gameState.inventory.items.xp_scroll_raptor];\n"
        "useXpScroll('xp_scroll_raptor','b1');\n"
        "useXpScroll('xp_scroll_minor','b2');\n"
        "useXpScroll('xp_scroll_minor','b2');\n"
        "useXpScroll('xp_scroll_minor','b2');\n"  # bag is empty now — no grant
        "console.log(JSON.stringify({afterMismatch,grants,bag:gameState.inventory.items}));"
    )
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout)
    assert out["afterMismatch"] == [0, 1]
    assert out["grants"] == [["b1", 150], ["b2", 40], ["b2", 40]]
    assert out["bag"]["xp_scroll_raptor"] == 0
    assert out["bag"]["xp_scroll_minor"] == 0


def test_every_wing_class_has_a_scroll_and_random_drops_stay_in_catalogue():
    html = HTML_PATH.read_text(encoding="utf-8")
    catalogue = const_source(html, "BIRD_XP_ITEMS")
    for wing in ["raptor", "trickster", "songbird", "skydancer", "waterbird", "groundbird"]:
        assert f"type: '{wing}'" in catalogue
    src = (
        catalogue
        + "\n" + function_source(html, "birdXpItem")
        + "\n" + function_source(html, "randomXpScrollKey")
    )
    script = (
        src +
        "\nlet i=0; const seq=()=>((i++*0.137)%1);\n"
        "const keys=new Set();\n"
        "for(let n=0;n<200;n++) keys.add(randomXpScrollKey(seq));\n"
        "console.log(JSON.stringify({allKnown:[...keys].every(k=>!!birdXpItem(k)),variety:keys.size}));"
    )
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout)
    assert out["allKnown"] is True
    assert out["variety"] >= 3  # minor scrolls, tomes and wing-class scrolls all roll


def test_walking_quest_completion_deepens_permanent_merlin_bond():
    html = HTML_PATH.read_text(encoding="utf-8")
    src = function_source(html, "completeWalkingQuest")
    assert "getActivePet()" not in src
    assert "summary.merlinBondXp" in src
    assert "MERLIN_CORE.grantMerlinBondXp" in src
    # The summary sheet shows Merlin's bond gain next to the trainer's XP.
    sheet = function_source(html, "showWalkQuestSummarySheet")
    assert "summary.merlinBondXp" in sheet
    assert "Merlin bond XP" in sheet


def test_quest_chests_can_hold_scrolls_and_deepen_merlin_bond():
    quest_core = QUEST_CORE_PATH.read_text(encoding="utf-8")
    assert "item: 'xp_scroll_minor'" in quest_core
    assert "item: 'xp_scroll_greater'" in quest_core
    html = HTML_PATH.read_text(encoding="utf-8")
    fix = function_source(html, "questOnPositionFix")
    assert "addBirdXpItemToBag(loot.item, 1)" in fix
    assert "MERLIN_CORE.grantMerlinBondXp" in fix


def test_scrolls_drop_from_expeditions_map_pickups_and_the_potion_shop():
    academy = (ROOT / "academy_treehouse_core.js").read_text(encoding="utf-8")
    assert "'xp_scroll_minor'" in academy
    assert "'xp_scroll_greater'" in academy
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "randomXpScrollKey(r)" in html  # map pickup entry
    assert "grantItem: 'xp_scroll_minor'" in html  # potion shop bag scroll
    assert "grantItem: 'xp_scroll_greater'" in html
    buy = function_source(html, "villageBuy")
    assert "item.grantItem" in buy
    assert "addBirdXpItemToBag(item.grantItem, 1)" in buy


def test_bag_renders_usable_scroll_cards_and_companion_cards_show_xp():
    html = HTML_PATH.read_text(encoding="utf-8")
    # The Royal Stores overhaul split the old single grid into tabbed
    # stockrooms; study scrolls now live on the Curios shelf, still one tap
    # from being spent on a bird.
    curios = function_source(html, "renderStoresCurios")
    assert "openXpScrollPicker" in curios
    assert "stores-res-card usable" in curios
    card = function_source(html, "createBirdCardHTML")
    assert "card-xp-bar" in card
    assert ".card-xp-bar" in html and ".card-xp-fill" in html
    assert ".xp-picker-row" in html  # scroll-use bird picker styles ship too


def test_release_ships_with_a_fresh_offline_cache_version():
    sw = SW_PATH.read_text(encoding="utf-8")
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "const BURBZ_CACHE = 'burbz-" in sw
    for marker in (
        f"quest_core.js?v={QUEST_CORE_PIN}",
        f"academy_treehouse_core.js?v={ACADEMY_CORE_PIN}",
    ):
        assert marker in html
        assert f"./{marker}" in sw
