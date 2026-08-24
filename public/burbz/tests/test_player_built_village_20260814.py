"""A liberated village shows only what its governor builds — v267, 2026-08-14.

Yaan's ask: after liberating a village, the square showed every trade already
open, with a well in the middle nobody had built. Build one building and the
whole village popped up around it. Now the scene keeps faith with the player:

1. While a village is wrecked or rebuilding, only the ruins and the player's
   own constructions stand. The trades reopen when the province flourishes
   (5+ built levels) — the same stage that brings back homes, landmarks,
   stalls and the dovecote.
2. No pre-built centrepiece. The square's centre stays bare until the
   governor builds the Stone Well — and then it is THEIR well standing there.
3. The Town Square mirrors the same rule for its districts.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

CURRENT_BUILD = "village-work-huts-v311-20260824"
PREVIOUS_RELEASE_PIN = "night-veil-removed-v266-20260813"


def function_source(html, name):
    start = html.index("function " + name + "(")
    return html[start:html.index("\nfunction ", start)]


def test_trades_stay_shut_until_the_village_flourishes():
    html = HTML.read_text(encoding="utf-8")
    scene = function_source(html, "buildVillageScene")
    # Shopfronts only rise at ruin stage 2 — never after the first build.
    assert "if (ruinStage >= 2) shopKeys.forEach((k, i) => {" in scene
    assert "if (ruinStage >= 1) shopKeys" not in scene
    # The dovecote waits for the flourish too — nothing pre-built before it.
    assert "if (ruinStage >= 2 && r() < 0.6) {" in scene


def test_no_prebuilt_centrepiece_the_well_is_the_players():
    html = HTML.read_text(encoding="utf-8")
    scene = function_source(html, "buildVillageScene")
    # The decorative centrepiece is gone from the village scene entirely.
    assert "villageMakeCentrepiece" not in scene
    # The Stone Well the governor builds takes the centre of the square...
    assert "} else if (b.id === 'well') {" in scene
    assert "well.position.set(0, 0, 0);" in scene
    # ...and it only renders through the built-level gate like every yard.
    assert "if (!level && !rising) return;" in scene


def test_town_districts_follow_the_same_rule():
    html = HTML.read_text(encoding="utf-8")
    scene = function_source(html, "buildTownScene")
    # A district's trade shopfront waits for its village to flourish.
    assert "if (dRuin >= 2) {" in scene


def test_release_is_versioned_and_cache_lineage_kept():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)  # this fix reaches players
