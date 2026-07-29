"""Regression: newly discovered bird names stay visible in the recruit overlay."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def test_recruit_overlay_cards_reserve_enough_height_for_art_name_and_actions():
    html = HTML.read_text(encoding="utf-8")
    assert ".recruit-list .bird-card,\n.recruit-list .bird-card-inner { min-height:420px; }" in html
    assert ".recruit-list .card-art { flex:0 0 auto; }" in html


def test_recruit_overlay_bird_name_and_species_cannot_be_flex_squashed_hidden():
    html = HTML.read_text(encoding="utf-8")
    assert ".recruit-list .card-name,\n.recruit-list .card-species { flex:0 0 auto; line-height:1.2; }" in html


def test_recruit_name_visibility_fix_remains_in_the_service_worker_cache_history():
    marker = "recruit-card-name-v161-20260729"
    assert marker in SW.read_text(encoding="utf-8")
