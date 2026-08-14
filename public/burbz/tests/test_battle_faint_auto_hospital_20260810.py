"""A bird knocked out in battle is carried straight to the Bird Hospital.

The player never files the paperwork: `endPerchBattle` admits every fainted
fighter via `admitFaintedBirdToHospital`, the admission slip remembers the
bird's old room, and the existing discharge sweep (hospital auto-discharge
v239) sends them home the moment they are fully healed.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
OWN_RELEASE_PIN = "battle-faint-auto-hospital-v247-20260811"
# This release's own cache marker; later releases move BURBZ_BUILD on.
PREVIOUS_RELEASE_PIN = "early-game-easy-battles-v240-20260810"
CURRENT_BUILD = "empire-zoom-levels-v268-20260814"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start, name
    return html[start:end]


def test_admission_helper_guards_the_ward_like_discharge_does():
    html = HTML_PATH.read_text(encoding="utf-8")
    admit = function_source(html, "admitFaintedBirdToHospital")
    # No ward, no admission.
    assert "isAcademyRoomBuilt('hospital')" in admit
    # A bird healed to full on the way home (level-up) has nothing to treat.
    assert "(bird.hp || 0) >= (bird.maxHp || 100)" in admit
    # Working, questing and mid-drill birds keep their own schedule.
    assert "birdAssignedPost(bird.id)" in admit
    assert "birdHasActiveExpedition(bird.id)" in admit
    assert "birdHasActiveTraining(bird.id)" in admit
    # The admission slip sends the patient home again at discharge.
    assert "bird.academy.hospitalReturnRoom = previousRoom" in admit
    assert "bird.academy.room = 'hospital'" in admit
    # Stationing a patient counts for the hospital quest, same as a manual move.
    assert "updateQuestProgress('station_hospital', 1)" in admit


def test_battle_end_admits_every_fainted_fighter_automatically():
    html = HTML_PATH.read_text(encoding="utf-8")
    end = function_source(html, "endPerchBattle")
    assert "(f.fainted || f.hp <= 0) && admitFaintedBirdToHospital(bird)" in end
    assert "hospitalAdmissions.push" in end
    # The result screen says who was carried to the ward.
    assert "carried to the Bird Hospital" in end


def test_release_is_versioned_for_service_worker_self_update():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert OWN_RELEASE_PIN in cache_line  # this release's own segment
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
