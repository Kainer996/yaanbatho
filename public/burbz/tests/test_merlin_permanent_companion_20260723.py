import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
CORE = ROOT / "merlin_companion_core.js"
SW = ROOT / "sw.js"


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=True,
    )
    return json.loads(result.stdout)


def test_merlin_replaces_selectable_pet_everywhere():
    html = INDEX.read_text(encoding="utf-8")
    forbidden = [
        'data-action="make-pet"',
        "Choose as Pet",
        "Make Pet",
        "Your Walking Pet",
        "function selectPet(",
    ]
    for text in forbidden:
        assert text not in html
    assert "delete gameState.activePetId" in html
    assert "const MERLIN_GUIDE" in html
    assert "merlin_burbz_manga_20260624_v2_cutout.png" in html


def test_merlin_tamagotchi_menu_is_accessible_and_actionable():
    html = INDEX.read_text(encoding="utf-8")
    for marker in [
        'id="merlinCareMenu"',
        'role="dialog"',
        'aria-labelledby="merlinCareTitle"',
        'id="merlinFoodFill"',
        'id="merlinHappyFill"',
        'id="merlinEnergyFill"',
        'id="merlinBondLevel"',
        'id="merlinFeedBtn"',
        'id="merlinPlayBtn"',
        'id="merlinRestBtn"',
        "function openMerlinCareMenu(",
        "function closeMerlinCareMenu(",
    ]:
        assert marker in html
    assert "merlin_companion_core.js?v=merlin-compact-speech-v2-20260724" in html
    sw = SW.read_text(encoding="utf-8")
    assert "burbz-toast-dedupe-quest-retry-v137-20260725" in sw
    assert "./merlin_companion_core.js?v=merlin-compact-speech-v2-20260724" in sw
    assert "./bird-art-cache/cutouts/merlin_burbz_manga_20260624_v2_cutout.png" in sw


def test_merlin_core_has_100_new_lines_and_every_fifth_utterance_is_a_tip():
    assert CORE.exists(), "Merlin companion core must be a separately testable module"
    out = run_node(
        """
const c=require('./merlin_companion_core.js');
let care=c.sanitizeMerlinCare({}, 1000000);
const spoken=[];
for(let i=0;i<10;i++){
  const next=c.nextMerlinUtterance(care, ()=>0);
  care=next.state;
  spoken.push({line:next.line,isTip:next.isTip,count:care.thingsSaid});
}
console.log(JSON.stringify({
 base:c.BASE_CHATTER_LINES.length,
 newChatter:c.NEW_CHATTER_LINES.length,
 tips:c.GAMEPLAY_TIPS.length,
 total:c.ALL_MERLIN_LINES.length,
 spoken
}));
"""
    )
    assert out["base"] == 30
    assert out["newChatter"] == 80
    assert out["tips"] == 20
    assert out["total"] == 130
    assert [row["isTip"] for row in out["spoken"]] == [False, False, False, False, True, False, False, False, False, True]
    assert all(row["line"].startswith("Tip:") for row in (out["spoken"][4], out["spoken"][9]))
    assert [row["count"] for row in out["spoken"]] == list(range(1, 11))


def test_merlin_care_actions_and_elapsed_decay_are_bounded_and_persistable():
    out = run_node(
        """
const c=require('./merlin_companion_core.js');
let care=c.sanitizeMerlinCare({hunger:70,happiness:50,energy:40,bondXp:95,bondLevel:1,lastCareAt:1000000},1000000);
let pantry={small_bird_prey_ration:1,insects:2};
const fed=c.applyMerlinCareAction(care,pantry,'feed',1060000); care=fed.state; pantry=fed.pantry;
const refused=c.applyMerlinCareAction(care,{insects:2},'feed',1090000);
const played=c.applyMerlinCareAction(care,pantry,'play',1120000); care=played.state;
const rested=c.applyMerlinCareAction(care,pantry,'rest',1180000); care=rested.state;
const ticked=c.tickMerlinCare(care,60,4780000);
const empty=c.applyMerlinCareAction(care,{insects:0},'feed',1240000);
const full=c.applyMerlinCareAction({hunger:0,happiness:80,energy:80,lastFedAt:null},{small_bird_prey_ration:1},'feed',1300000);
console.log(JSON.stringify({fed,refused,played,rested,ticked,empty,full}));
"""
    )
    assert out["fed"]["ok"] is True
    assert out["fed"]["pantry"]["small_bird_prey_ration"] == 0
    assert out["fed"]["pantry"]["insects"] == 2
    assert out["fed"]["state"]["hunger"] < 70
    assert out["refused"]["ok"] is False
    assert out["refused"]["pantry"]["insects"] == 2
    assert out["refused"]["state"]["hunger"] == out["fed"]["state"]["hunger"]
    assert out["played"]["state"]["happiness"] > out["fed"]["state"]["happiness"]
    assert out["rested"]["state"]["energy"] > out["played"]["state"]["energy"]
    assert 0 <= out["ticked"]["hunger"] <= 100
    assert 0 <= out["ticked"]["happiness"] <= 100
    assert 0 <= out["ticked"]["energy"] <= 100
    assert out["empty"]["ok"] is False
    assert out["full"]["ok"] is False
    assert out["full"]["pantry"]["small_bird_prey_ration"] == 1
    assert out["full"]["state"]["hunger"] == 0
    assert out["full"]["state"]["lastFedAt"] is None
    assert out["empty"]["pantry"]["insects"] == 0
