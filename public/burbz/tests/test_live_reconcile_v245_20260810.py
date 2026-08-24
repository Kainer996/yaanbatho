"""Live reconcile v245 — the drifted v240-v244 line is home, 2026-08-10.

The production server advanced through five releases that never reached
GitHub (birdex-direct-recruit-v240, companion-unlock-copy-v241,
remove-merlin-first-clue-v242, training-master-room-actor-v243,
distributed-game-hud-v244) while GitHub main advanced through four others
(early-game-easy-battles-v240 … real-sky-daylight-v243). The auto-deploy's
drift guard then — correctly — froze all updates. This release recovers the
live deltas byte-exact, three-way merges the two lines, and pins the
recovered behaviour so it can never silently vanish again.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

OWN_RELEASE_PIN = "live-reconcile-v245-20260810"
CURRENT_BUILD = "empire-village-declutter-v317-20260824"
LIVE_MARKERS = (
    "birdex-direct-recruit-v240-20260810",
    "companion-unlock-copy-v241-20260810",
    "remove-merlin-first-clue-v242-20260810",
    "training-master-room-actor-v243-20260810",
    "distributed-game-hud-v244-20260810",
)
GITHUB_MARKERS = (
    "early-game-easy-battles-v240-20260810",
    "battle-squad-board-v241-20260810",
    "town-county-screens-v242-20260810",
    "real-sky-daylight-v243-20260810",
)


def test_both_divergent_lineages_survive_in_the_cache_history():
    sw = SW.read_text(encoding="utf-8")
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    for marker in LIVE_MARKERS + GITHUB_MARKERS:
        assert marker in cache_line, marker
    # Own marker stays in the lineage; later releases move the newest tag on.
    assert OWN_RELEASE_PIN in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    html = HTML.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html


def test_distributed_hud_routes_every_control_through_one_helper():
    html = HTML.read_text(encoding="utf-8")
    # Header diary button and every routed destination survive; the former side
    # rail has since been folded into the unified image-led bottom navigation.
    assert 'id="headerDiaryBtn"' in html
    nav = html.split('id="bottomNav"')[1].split("</nav>")[0]
    assert 'id="gameSideActions"' not in html
    assert '<div class="nav-label">Stores</div>' in nav
    assert 'data-game-route data-screen="inventory"' in nav
    assert "function activateGameHudDestination(destination)" in html
    assert "activateGameHudDestination(control.dataset.screen)" in html
    # The action badge core follows the routed controls, not just nav items.
    core = (ROOT / "action_badge_core.js").read_text(encoding="utf-8")
    assert "[data-game-route][data-screen]" in core
    # The core changed again in v312 (dock badges), so its cache pin moved on —
    # the convention every changed core follows.
    assert "'./action_badge_core.js?v=nav-action-badges-v312-20260824'" in SW.read_text(encoding="utf-8")


def test_training_hall_drill_master_stands_in_the_scene():
    html = HTML.read_text(encoding="utf-8")
    assert "training-master-actor" in html
    assert "training-master-picker" in html
    # The Training Hall's role card lives in the picker sheet, other rooms
    # keep their inline panel.
    assert "const rolePanel = room === 'training' ? '' : rolePostCardHTML('academy', room);" in html
    assert "rolePostCardHTML('academy', 'training')" in html


def test_birdex_recruits_directly_once_the_barracks_stands():
    html = HTML.read_text(encoding="utf-8")
    assert "recruitAction = tavernBuilt ? 'recruit-birdex' : 'goto-tavern'" in html
    assert 'data-action="recruit-birdex"' in html
    assert "NEW COMPANION UNLOCKED!" in html


def test_the_merlin_first_clue_quest_stays_retired():
    html = HTML.read_text(encoding="utf-8")
    assert "pq_merlin_clue" not in html
