"""Regression: Birdex mode must not squash owned or discovered bird names."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def test_birdex_owned_cards_have_full_companion_height_and_rigid_identity_rows():
    html = HTML.read_text(encoding="utf-8")
    assert ".bird-grid.codex-grid .bird-card:not(.known-species):not(.locked-card),\n.bird-grid.codex-grid .bird-card:not(.known-species):not(.locked-card) .bird-card-inner { min-height:540px; }" in html
    assert ".bird-grid.codex-grid .card-name,\n.bird-grid.codex-grid .card-species { flex:0 0 auto; line-height:1.2; }" in html
    assert ".bird-grid.codex-grid .card-art { flex:0 0 auto; }" in html


def test_birdex_discovered_only_cards_have_room_for_name_species_and_actions():
    html = HTML.read_text(encoding="utf-8")
    assert ".bird-grid.codex-grid .bird-card.known-species,\n.bird-grid.codex-grid .bird-card.known-species .bird-card-inner { min-height:430px; }" in html


def test_birdex_name_fix_remains_in_the_service_worker_cache_history():
    marker = "birdex-card-names-v163-20260729"
    sw = SW.read_text(encoding="utf-8")
    assert marker in sw
