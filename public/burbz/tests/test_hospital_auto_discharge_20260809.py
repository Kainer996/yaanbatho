"""The Bird Hospital discharges healed patients (2026-08-09).

The ward used to keep birds forever: a companion stationed to heal stayed in
the Hospital until the player remembered to move them out. Yaan asked for
automatic discharge — the moment a patient is back to full HP they leave the
ward and walk back to the room they were admitted from (recorded on an
admission slip in `academy.hospitalReturnRoom`), falling back to the Aviary
Gardens if that room is gone or takes no lodgers. The Head Healer keeps their
post, and birds away questing or mid-training are never moved by the ward.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
RELEASE_PIN = "live-reconcile-v245-20260810"
# This release's own cache marker stays in the lineage; later releases move
# BURBZ_BUILD on.
OWN_RELEASE_PIN = "hospital-auto-discharge-v239-20260809"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start, name
    return html[start:end]


def run_discharge_cases() -> dict:
    html = HTML_PATH.read_text(encoding="utf-8")
    source = function_source(html, "dischargeBirdFromHospital")
    script = """
const ACADEMY_ROOMS = { outdoors:{label:'AVIARY GARDENS'}, dorm:{label:'THE ROOST'}, hospital:{label:'BIRD HOSPITAL'}, training:{label:'TRAINING HALL'}, tavern:{label:'BARRACKS'}, kitchen:{label:'KITCHEN & PANTRY'} };
let builtRooms = new Set(['outdoors','dorm','hospital','training']);
const isAcademyRoomBuilt = room => builtRooms.has(room);
let postedIds = new Set();
const birdAssignedPost = id => postedIds.has(id) ? { role:{ title:'Head Healer' } } : null;
let awayIds = new Set();
const birdHasActiveExpedition = id => awayIds.has(id);
const birdHasActiveTraining = () => false;
const toasts = [];
const showToast = msg => toasts.push(msg);
const birdDisplayName = bird => bird.commonName;
""" + source + """
const patient = (over = {}) => ({ id:'b1', commonName:'Buzzard', hp:80, maxHp:80, academy:{ room:'hospital', hospitalReturnRoom:'training' }, ...over });

const healed = patient();
const healedResult = dischargeBirdFromHospital(healed, 1000);

const hurt = patient({ hp: 40 });
const hurtResult = dischargeBirdFromHospital(hurt, 1000);

const noSlip = patient({ academy:{ room:'hospital', hospitalReturnRoom:null } });
const noSlipResult = dischargeBirdFromHospital(noSlip, 1000);

const demolished = patient();
builtRooms = new Set(['outdoors','dorm','hospital']);
const demolishedResult = dischargeBirdFromHospital(demolished, 1000);
builtRooms = new Set(['outdoors','dorm','hospital','training']);

const kitchenSlip = patient({ academy:{ room:'hospital', hospitalReturnRoom:'kitchen' } });
const kitchenResult = dischargeBirdFromHospital(kitchenSlip, 1000);

postedIds = new Set(['b1']);
const healer = patient();
const healerResult = dischargeBirdFromHospital(healer, 1000);
postedIds = new Set();

awayIds = new Set(['b1']);
const away = patient();
const awayResult = dischargeBirdFromHospital(away, 1000);
awayIds = new Set();

const elsewhere = patient({ academy:{ room:'dorm', hospitalReturnRoom:null } });
const elsewhereResult = dischargeBirdFromHospital(elsewhere, 1000);

console.log(JSON.stringify({
  healedResult, healedRoom: healed.academy.room, healedSlipCleared: healed.academy.hospitalReturnRoom === null,
  hurtResult, hurtRoom: hurt.academy.room,
  noSlipResult, noSlipRoom: noSlip.academy.room,
  demolishedResult, demolishedRoom: demolished.academy.room,
  kitchenResult, kitchenRoom: kitchenSlip.academy.room,
  healerResult, healerRoom: healer.academy.room,
  awayResult, awayRoom: away.academy.room,
  elsewhereResult, elsewhereRoom: elsewhere.academy.room,
  toastCount: toasts.length,
  toastNamesWard: toasts.every(t => t.includes('discharged'))
}));
"""
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, timeout=30
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout.strip().splitlines()[-1])


def test_full_hp_patients_walk_home_and_everyone_else_stays_put():
    out = run_discharge_cases()
    # The healed patient goes back to the room on their admission slip.
    assert out["healedResult"] is True and out["healedRoom"] == "training"
    assert out["healedSlipCleared"]
    # A hurt bird keeps its bed.
    assert out["hurtResult"] is False and out["hurtRoom"] == "hospital"
    # No slip, a demolished return room, or a no-lodgers room -> the Gardens.
    assert out["noSlipResult"] is True and out["noSlipRoom"] == "outdoors"
    assert out["demolishedResult"] is True and out["demolishedRoom"] == "outdoors"
    assert out["kitchenResult"] is True and out["kitchenRoom"] == "outdoors"
    # The Head Healer works here; a bird away on a quest moves on its own clock.
    assert out["healerResult"] is False and out["healerRoom"] == "hospital"
    assert out["awayResult"] is False and out["awayRoom"] == "hospital"
    # Birds outside the ward are never touched.
    assert out["elsewhereResult"] is False and out["elsewhereRoom"] == "dorm"
    # Exactly the successful discharges toast, and every toast says so.
    assert out["toastCount"] == 4 and out["toastNamesWard"]


def test_the_ward_round_and_the_admission_slip_are_wired_into_the_app():
    html = HTML_PATH.read_text(encoding="utf-8")
    # Every tick's hospital branch heals then sweeps for discharges, so birds
    # healed to full by any means (ward, meal, level-up) also leave.
    tick = function_source(html, "tickAcademy")
    assert "dischargeBirdFromHospital(b, now)" in tick
    # Moving into the ward records where the patient came from; moving anywhere
    # else clears the slip.
    move = function_source(html, "academyMoveBird")
    assert "hospitalReturnRoom" in move
    assert "room === 'hospital' && previousRoom !== 'hospital'" in move
    # The room card is honest about the new behaviour.
    assert "healed birds auto-discharge" in html


def test_release_is_versioned_for_service_worker_self_update():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{RELEASE_PIN}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert "sleep-retired-v238-20260809" in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line  # lineage kept
    assert cache_line.rstrip("';").endswith(RELEASE_PIN)
