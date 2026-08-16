"""Quick dock at the bottom + Training Hub pop-up (academy-training-dock-v252-20260812).

The Kitchen / Quests / Stores icons leave the top-left corner and settle in a
row above the bottom nav, two each side of the raised Scan orb. A fourth
button — Training — joins them and opens a small sheet that shows every room
that trains birds: who is mid-drill, who is finished, which rooms sit empty
and which birds are free to send. The Academy screen title also drops the
"Burb" and reads plain ACADEMY.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")
OWN_RELEASE_PIN = "academy-training-dock-v252-20260812"
PREVIOUS_RELEASE_PIN = "hold-to-steer-v251-20260811"
CURRENT_BUILD = "mobile-fresh-update-v274-20260816"


def test_the_academy_title_is_just_academy():
    assert '<div class="screen-title">ACADEMY</div>' in HTML
    assert '<div class="screen-title">BURB ACADEMY</div>' not in HTML
    assert "BURB ACADEMY" not in HTML.split('academy-grad-kicker')[1].split('</div>')[0]


def test_the_quick_dock_sits_above_the_bottom_nav():
    dock = HTML.split(".game-side-actions {")[1].split("}")[0]
    assert "bottom:calc(var(--nav-height) + var(--safe-bottom) + 8px)" in dock
    assert "flex-direction:row" in dock
    assert "top:" not in dock
    # The centre spacer keeps the raised Scan orb's launch path clear.
    assert '<span class="game-side-actions-gap" aria-hidden="true"></span>' in HTML
    assert ".game-side-actions-gap { flex:0 0 auto; width:68px; }" in HTML


def test_two_buttons_flank_each_side_of_the_scan_orb():
    aside = HTML.split('id="gameSideActions"')[1].split("</aside>")[0]
    kitchen = aside.index('data-quick-destination="kitchen"')
    quests = aside.index('data-screen="quests"')
    gap = aside.index("game-side-actions-gap")
    stores = aside.index('data-screen="inventory"')
    training = aside.index('data-quick-destination="training"')
    assert kitchen < quests < gap < stores < training


def test_the_dock_steps_aside_for_the_battle_start_button():
    assert 'body[data-active-screen="battle"] .game-side-actions { display:none; }' in HTML
    assert "document.body.setAttribute('data-active-screen', name);" in HTML


def test_the_training_button_opens_the_training_hub_sheet():
    assert 'id="trainingHubModal"' in HTML
    assert 'id="trainingHubBody"' in HTML
    assert "function openTrainingHub()" in HTML
    assert "function renderTrainingHub()" in HTML
    assert "addEventListener('click', openTrainingHub)" in HTML


def test_the_hub_covers_every_room_that_trains_birds():
    rooms = HTML.split("const TRAINING_HUB_ROOMS = [")[1].split("]")[0]
    for room in ["training", "crowbar", "workshop", "observatory", "library", "kitchen"]:
        assert f"'{room}'" in rooms
    # Room cards fly the player straight to the room, built or not.
    assert "function trainingHubOpenRoom(roomId)" in HTML
    assert "openAcademyRoom(roomId)" in HTML


def test_the_hub_shows_training_finished_empty_and_free_birds():
    assert "trainingHubClaim" in HTML  # claim finished drills from the sheet
    assert "to claim</span>" in HTML
    assert "training-hub-room-state empty" in HTML
    assert "Needs training" in HTML
    # The dock button wears its own count of finished, unclaimed drills.
    assert "function updateTrainingDockBadge()" in HTML
    assert "updateTrainingDockBadge();" in HTML


def test_the_tutorial_pointer_follows_the_dock_down():
    assert "el.style.bottom = dockTarget ? (window.innerHeight - rect.top + 4) + 'px' : '';" in HTML
    assert ".tutorial-nav-pointer.side-target {" not in HTML


def test_release_is_versioned():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    cache_line = next(line for line in SW.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line  # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
