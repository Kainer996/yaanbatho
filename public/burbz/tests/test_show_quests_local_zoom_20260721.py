"""Show Quests stays local: the camera frames the player's walking range
instead of zooming out to fit quest offers kilometres away."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")


def _fit_fn() -> str:
    start = HTML.index("function fitAllLocalQuestRoutes")
    return HTML[start:HTML.index("\nfunction ", start + 1)]


def test_show_quests_frames_only_walking_distance_offers():
    assert "const QUEST_SHOW_WALK_RADIUS_M = 1200;" in HTML
    fn = _fit_fn()
    assert "mapDistanceMeters(me, { lat, lon }) > QUEST_SHOW_WALK_RADIUS_M" in fn
    # the player's own position anchors the frame
    assert "bounds.extend([me.lon, me.lat]);" in fn
    # street-level cap instead of the old far-out framing
    assert "maxZoom:15.2" in fn
    assert "maxZoom:13.4" not in fn


def test_fallback_centres_on_the_player_at_walking_zoom():
    assert "const QUEST_WALKING_ZOOM = 14.6;" in HTML
    fn = _fit_fn()
    assert "const center = me ? [me.lon, me.lat] :" in fn
    assert "zoom:QUEST_WALKING_ZOOM" in fn
