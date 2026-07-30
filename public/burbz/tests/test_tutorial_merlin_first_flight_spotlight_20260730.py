"""Regression for the First Flight tutorial spotlight on mobile.

When the dispatch sheet opens, the original quest-board card remains behind the
sheet.  Tracking that stale rectangle paints a large gold box beside/above
Merlin.  The active target must switch to Merlin's actual rendered picture.
"""
from pathlib import Path

HTML = Path(__file__).resolve().parents[1] / "index.html"


def test_first_flight_step_names_merlins_live_picture_as_its_overlay_target():
    html = HTML.read_text(encoding="utf-8")
    step = html[html.index("title:'Send me out!'"):]
    step = step[:step.index("\n  {", 1)]
    assert "overlayTarget:'#questOverlay.open [data-quest-bird-id=\"merlin-guide\"] .quest-bird-chip-art'" in step


def test_dispatch_bird_markup_exposes_a_stable_id_for_merlin():
    html = HTML.read_text(encoding="utf-8")
    render = html[html.index("function renderQuestSendSheet()") : html.index("function selectQuestBird", html.index("function renderQuestSendSheet()"))]
    assert "data-quest-bird-id=\"' + escapeHtml(b.id) + '\"" in render


def test_tracking_re_resolves_the_live_target_each_animation_frame():
    html = HTML.read_text(encoding="utf-8")
    tracking = html[html.index("function merlinTutTrackTarget") : html.index("function merlinTutShowStep")]
    show_step = html[html.index("function merlinTutShowStep") : html.index("function merlinTutAdvance")]
    assert "merlinTutTargetSelector(step)" in tracking
    assert "merlinTutTrackTarget(step)" in show_step
