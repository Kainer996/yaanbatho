"""Battles are now fought against squads of evil Burbz, never free birds.

The usurper's roster lives in index.html; each evil Burb wraps a real base
bird (which drives stats, wing class and signature) in a shadow identity and
a corrupted portrait cropped from the evil-Burbz key art.
"""
import json
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
PORTRAITS = [ROOT / "assets" / "evil-burbz" / f"evil-burb-{i}.png" for i in range(1, 5)]


def _extract_array(html: str, marker: str):
    start = html.index(marker)
    end = html.index("\n];", start) + 3
    return html[start:end]


def roster():
    html = HTML.read_text(encoding="utf-8")
    source = (
        _extract_array(html, "const EVIL_BURBZ_ROSTER = [")
        + "\nconsole.log(JSON.stringify(EVIL_BURBZ_ROSTER));"
    )
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_roster_covers_every_league_tier_with_distinct_shadow_identities():
    entries = roster()
    assert len(entries) >= 24
    names = [e["name"] for e in entries]
    assert len(names) == len(set(names))
    assert all(e.get("base") and e.get("rarity") and isinstance(e.get("portrait"), int) for e in entries)
    by_rarity = {}
    for e in entries:
        by_rarity.setdefault(e["rarity"], []).append(e)
    # Every rarity band a league tier can request has a full squad available.
    for rarity in ("common", "uncommon", "rare", "epic", "legendary"):
        assert len(by_rarity.get(rarity, [])) >= 4, rarity


def test_base_birds_span_the_wing_class_wheel_so_counterplay_survives():
    entries = roster()
    payload = subprocess.run(
        ["node", "-e",
         "const core = require('./battle_core.js');"
         f"const bases = {json.dumps([e['base'] for e in entries])};"
         "console.log(JSON.stringify(bases.map(b => core.classifySpecies(b))));"],
        cwd=ROOT, text=True, capture_output=True)
    assert payload.returncode == 0, payload.stderr
    classes = set(json.loads(payload.stdout))
    assert len(classes) >= 5, classes


def test_portraits_are_real_square_rasters():
    for path in PORTRAITS:
        assert path.exists(), path
        with Image.open(path) as img:
            assert img.size[0] == img.size[1] >= 256, (path, img.size)


def test_opponent_generation_draws_from_the_evil_roster_not_free_birds():
    html = HTML.read_text(encoding="utf-8")
    gen_start = html.index("function leagueRivalOpponents()")
    gen_end = html.index("\nfunction renderBattleSelect", gen_start)
    gen = html[gen_start:gen_end]
    assert "EVIL_BURBZ_ROSTER" in gen
    assert "BURBZ_SPECIES_PROFILES" not in gen
    assert "isEvilBurb: true" in gen
    assert "EVIL_BURB_PORTRAITS" in gen
    # The twisted base bird still drives stats and wing class.
    assert "generateBirdStats(e.base" in gen
    assert "classifySpecies(e.base)" in gen


def test_battle_copy_frames_every_fight_against_the_evil_burbz():
    html = HTML.read_text(encoding="utf-8")
    assert "a squad of evil Burbz descends on the perch!" in html
    assert "evil Burbz squad prowls this perch" in html
    assert "The occupying evil Burbz" in html
    assert "scatter the evil Burbz garrison" in html
    assert "<span>EVIL BURBZ</span>" in html
    assert "tap an evil Burb to strike" in html
    assert "Today's rival flock" not in html
    core = (ROOT / "battle_core.js").read_text(encoding="utf-8")
    assert "The evil Burbz squad breaks" in core
    assert "dark magic unravels" in core          # beaten shadows dissolve, nothing dies
    assert "The rival flock concedes" not in core
    tiers_start = core.index("const LEAGUE_TIERS = [")
    tiers = core[tiers_start:core.index("\n  ];", tiers_start)].lower()
    assert "evil burbz" in tiers and "shadow" in tiers


def test_story_canon_documents_the_evil_burbz_and_the_multiverse():
    story = (ROOT / "STORY.md").read_text(encoding="utf-8")
    for marker in (
        "evil Burbz",
        "another universe",
        "dominant species are birds",
        "squads of evil Burbz",
        "never against free, ordinary birds",
        "No town is destroyed",
    ):
        assert marker in story, marker
