"""Presentation-only woodland finish: assets, cache and protected render paths."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text()
CSS = (ROOT / "woodland_ui.css").read_text()
SW = (ROOT / "sw.js").read_text()
RELEASE = "woodland-finish-v360-20260907"
CURRENT_BUILD = "walking-quests-v361-20260907"
ASSETS = [
    f"woodland_ui.css?v={RELEASE}",
    "assets/comic-ui/battlefield-v359.webp",
    "assets/comic-ui/fonts/inter-latin.woff2",
    "assets/comic-ui/fonts/rajdhani-bold.woff2",
    "assets/comic-ui/fonts/russo-one.woff2",
]


def test_page_and_cache_advance_together():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    assert f'<link rel="stylesheet" href="{ASSETS[0]}">' in HTML
    assert '<body class="woodland-ui">' in HTML
    assert re.search(r"const BURBZ_CACHE = '([^']+)'", SW)[1].endswith(CURRENT_BUILD)


def test_every_runtime_asset_is_required_offline_and_in_legacy_updater():
    updater = (ROOT.parents[1] / "scripts/update-live-burbz.sh").read_text()
    for name in ["BURBZ_ASSETS", "BURBZ_CORE", "BURBZ_INSTALL_REQUIRED"]:
        block = re.search(rf"const {name}\s*=\s*\[([\s\S]+?)\];", SW)[1]
        for asset in ASSETS:
            assert f"'./{asset}'" in block
    for asset in ASSETS:
        assert f'"{asset.split("?")[0]}"' in updater
    downloads = re.search(r"\nFILES=\(([\s\S]+?)\n\)", updater)[1]
    local_art = re.search(r"\nLFS_FILES=\(([\s\S]+?)\n\)", updater)[1]
    for asset in ASSETS:
        if asset.endswith(".webp"):
            assert f'"{asset}"' not in downloads, "art must never enter the GitHub download loop"
            assert f'"{asset}"' in local_art


def test_generated_images_and_licensed_fonts_are_real_and_bounded():
    total = 0
    for asset in ASSETS:
        p = ROOT / asset.split("?")[0]
        data = p.read_bytes()
        total += len(data)
        if p.suffix == ".webp":
            assert data[:4] == b"RIFF" and data[8:12] == b"WEBP"
        if p.suffix == ".woff2":
            assert data[:4] == b"wOF2"
    assert total < 500_000
    for family in ["Inter", "Rajdhani", "RussoOne"]:
        license_path = ROOT / f"assets/comic-ui/fonts/{family}-OFL.txt"
        assert "SIL OPEN FONT LICENSE" in license_path.read_text()


def test_battle_background_never_replaces_existing_bird_art_or_input_handlers():
    assert "battlefield-v359.webp" in CSS
    assert "fighterArtHTML(f, 'au')" in HTML
    assert "function battleTargetPick(side, index)" in HTML
    assert "function battleCancelAim()" in HTML
    assert "window.__testEval" not in HTML
    # Decoration belongs to HTML panels; no full-screen shader/filter stripes.
    assert not re.search(r"(?:canvas|\.au-art|\.card-art)\s*\{[^}]*filter\s*:", CSS)


def test_compact_controls_and_reduced_motion_have_explicit_rules():
    assert "min-height:44px" in CSS
    assert "prefers-reduced-motion:reduce" in CSS
    assert ".arena-actions:empty { display:none; }" in CSS
    assert "max-height:500px" in CSS
    assert ".battle-aim-panel:not([hidden])" in CSS
