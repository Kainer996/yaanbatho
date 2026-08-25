from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
MANIFEST = ROOT / "bird_art_release_20260727.js"
UPDATER = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"

ICON_NAMES = (
    "coin",
    "timber",
    "profile",
    "settings",
    "camera",
    "sound",
    "inventory",
    "forge",
    "quests",
    "map",
    "empire",
    "birdex",
    "scan",
    "battle",
    "academy",
    "leaderboards",
    "hospital",
)


def generated_art_urls():
    text = MANIFEST.read_text(encoding="utf-8")
    return sorted(
        set(
            re.findall(
                r'"(/burbz/bird-art-cache/completion-20260726/[^\"]+\.webp)"',
                text,
            )
        )
    )


def test_all_generated_paintings_override_the_built_in_map():
    html = HTML.read_text(encoding="utf-8")
    assert '<script src="bird_art_release_20260727.js?v=builtin-imagegen-1026"></script>' in html
    assert "const GENERATED_ART_COMPLETION = window.BURBZ_GENERATED_ART_COMPLETION_20260726 || {};" in html
    assert "document.documentElement.dataset.burbzGeneratedArtCount" in html
    # The claim that matters is the ORDER: these paintings must be applied after
    # BUILT_IN_BIRD_ART is built, so they win wherever both name a species.
    # Retargeted by art-same-origin-v325-20260825 — this used to be phrased as
    # "after the legacy GitHub routing pass", and that pass no longer exists.
    definition = html.index("const BUILT_IN_BIRD_ART = {")
    override = html.index("Object.assign(BUILT_IN_BIRD_ART, GENERATED_ART_COMPLETION);")
    assert definition < override
    # Nothing may run after the override and rewrite these local paths away.
    assert "for (const [species, artUrl] of Object.entries(BUILT_IN_BIRD_ART))" not in html


def test_generated_painting_manifest_is_complete_and_every_file_is_real_webp():
    urls = generated_art_urls()
    assert len(urls) == 1026
    assert not any("placeholder" in url.lower() for url in urls)
    for url in urls:
        path = ROOT / url.removeprefix("/burbz/")
        assert path.is_file(), url
        header = path.read_bytes()[:12]
        assert header[:4] == b"RIFF" and header[8:12] == b"WEBP", url


def test_generated_ui_icons_replace_the_visible_emoji_controls_and_are_cached():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    expected_html = {
        "coin": 'src="assets/ui/burbz-icon-set/coin.webp"',
        "timber": 'src="assets/ui/burbz-icon-set/timber.webp"',
        "profile": 'src="assets/ui/burbz-icon-set/profile.webp"',
        "settings": 'src="assets/ui/burbz-icon-set/settings.webp"',
        "camera": 'src="assets/ui/burbz-icon-set/camera.webp"',
        "sound": 'src="assets/ui/burbz-icon-set/sound.webp"',
        "inventory": 'src="assets/ui/burbz-icon-set/inventory.webp"',
        "forge": 'src="assets/ui/burbz-icon-set/forge.webp"',
        "quests": 'src="assets/ui/burbz-icon-set/quests.webp"',
        "map": 'src="assets/ui/burbz-icon-set/map.webp"',
        "empire": 'src="assets/ui/burbz-icon-set/empire.webp"',
        "birdex": 'src="assets/ui/burbz-icon-set/birdex.webp"',
        "scan": 'src="assets/ui/burbz-icon-set/scan.webp"',
        "battle": 'src="assets/ui/burbz-icon-set/battle.webp"',
        "academy": 'src="assets/ui/burbz-icon-set/academy.webp"',
        "leaderboards": 'src="assets/ui/burbz-icon-set/leaderboards.webp"',
        "hospital": 'src="assets/ui/burbz-icon-set/hospital.webp"',
    }
    for name in ICON_NAMES:
        assert expected_html[name] in html, name
        assert f"./assets/ui/burbz-icon-set/{name}.webp" in sw, name
        path = ROOT / "assets" / "ui" / "burbz-icon-set" / f"{name}.webp"
        header = path.read_bytes()[:12]
        assert header[:4] == b"RIFF" and header[8:12] == b"WEBP", name
    assert "./bird_art_release_20260727.js?v=builtin-imagegen-1026" in sw


def test_repository_live_updater_keeps_generated_manifest_icons_and_all_paintings():
    updater = UPDATER.read_text(encoding="utf-8")
    assert '"bird_art_release_20260727.js"' in updater
    for name in ICON_NAMES:
        assert f'"assets/ui/burbz-icon-set/{name}.webp"' in updater, name
    assert "completion-20260726" in updater
    assert "bird_art_release_20260727.js" in updater
