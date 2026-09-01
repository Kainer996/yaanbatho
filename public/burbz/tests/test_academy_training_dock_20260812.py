"""Training Hub behaviour carried forward from academy-training-dock-v252.

The original release put Kitchen / Quests / Stores / Training in a separate
quick dock above the primary navigation. generated-ui-art-v298 folds those
destinations into the one image-led bottom bar, while preserving the Training
sheet: who is mid-drill, who is finished, which rooms sit empty and which
birds are free to send. The Academy screen title remains plain ACADEMY.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")
OWN_RELEASE_PIN = "academy-training-dock-v252-20260812"
PREVIOUS_RELEASE_PIN = "hold-to-steer-v251-20260811"
CURRENT_BUILD = "empire-three-pages-v343-20260901"


def test_the_academy_title_is_just_academy():
    assert '<div class="screen-title">ACADEMY</div>' in HTML
    assert '<div class="screen-title">BURB ACADEMY</div>' not in HTML
    assert "BURB ACADEMY" not in HTML.split('academy-grad-kicker')[1].split('</div>')[0]


def test_the_quick_dock_is_now_the_single_fixed_bottom_nav():
    # fixed-dock-v303: nothing scrolls — two fixed decks hold every button.
    dock = HTML.split(".bottom-nav {")[1].split("}")[0]
    assert "overflow" not in dock
    assert "flex-direction: column" in dock
    assert 'id="gameSideActions"' not in HTML
    assert ".game-side-actions" not in HTML


def test_kitchen_quests_scan_stores_and_training_share_the_nav():
    # fixed-dock-v303 re-dealt the decks: management up top, adventure below.
    nav = HTML.split('id="bottomNav"')[1].split("</nav>")[0]
    for marker in ('data-quick-destination="kitchen"', 'data-screen="quests"',
                   'data-screen="inventory"', 'data-quick-destination="training"'):
        assert marker in nav, marker
    # Scan left the strip for the anchored island (2026-08-20) — it stands
    # solid at the dock's centre with Empire and Academy.
    island = HTML.rsplit('id="bottomDockAnchor"', 1)[1]
    assert 'data-screen="scan"' in island


def test_battle_and_forge_are_destinations_in_the_same_bottom_nav():
    nav = HTML.split('id="bottomNav"')[1].split("</nav>")[0]
    assert 'data-screen="battle"' in nav
    assert '<div class="nav-label">Battle</div>' in nav
    assert 'data-screen="forge"' in nav
    assert '<div class="nav-label">Forge</div>' in nav
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
    # The dock button wears its count of finished, unclaimed drills. Since
    # v312 that badge comes off the shared nav walker, which now reaches
    # pop-up buttons by their destination — no hand-rolled badge of its own.
    assert "training: trainingCount" in HTML
    assert "trainingHubSessions().filter(session => session.status === 'complete').length" in HTML
    assert "function updateTrainingDockBadge()" not in HTML
    core = (ROOT / "action_badge_core.js").read_text(encoding="utf-8")
    assert "'training'" in core
    assert "data-quick-destination" in core


def test_the_tutorial_pointer_tracks_the_destination_inside_the_unified_nav():
    assert "document.querySelector('[data-game-route][data-screen=\"' + target + '\"]')" in HTML
    assert "navItem.scrollIntoView({ block:'nearest', inline:'center' })" in HTML
    assert "Math.max(54, Math.min(window.innerWidth - 54" in HTML
    assert "el.style.left = pointerX + 'px';" in HTML
    assert "el.style.bottom = '';" in HTML
    assert ".tutorial-nav-pointer.side-target {" not in HTML


def test_release_is_versioned():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    cache_line = next(line for line in SW.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line  # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
