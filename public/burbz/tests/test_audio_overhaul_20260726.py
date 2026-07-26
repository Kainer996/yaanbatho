from pathlib import Path


BURBZ = Path(__file__).resolve().parents[1]
REPO = BURBZ.parents[1]

NEW_AUDIO = {
    "bgm-burbz-quest-v2.mp3",
    "ambience-empire-treetops.mp3",
    "sfx-ui-tap.mp3",
    "sfx-page-wing.mp3",
    "sfx-capture.mp3",
    "sfx-resource.mp3",
    "sfx-battle-hit.mp3",
    "sfx-battle-magic.mp3",
    "sfx-battle-defend.mp3",
    "sfx-build.mp3",
    "sfx-level-up.mp3",
    "sfx-quest-complete.mp3",
    "sfx-victory.mp3",
    "sfx-defeat-error.mp3",
}


def test_generated_audio_assets_are_present_and_nonempty():
    audio_dir = BURBZ / "assets" / "audio"
    for filename in NEW_AUDIO:
        asset = audio_dir / filename
        assert asset.is_file(), filename
        assert asset.stat().st_size > 20_000, filename


def test_audio_assets_ship_through_offline_and_live_deployment_paths():
    sw = (BURBZ / "sw.js").read_text(encoding="utf-8")
    sync = (REPO / "scripts" / "update-live-burbz.sh").read_text(encoding="utf-8")
    for filename in NEW_AUDIO:
        web_path = f"assets/audio/{filename}"
        assert web_path in sw, web_path
        assert web_path in sync, web_path

    version = "burbz-audio-overhaul-v1-20260726"
    assert f"audio_core.js?v={version}" in sw
    assert f"audio_core.js?v={version}" in (BURBZ / "index.html").read_text(encoding="utf-8")
    assert "burbz-one-tap-feeding-merlin-perch-v141-20260726" in sw


def test_empire_ambience_and_semantic_battle_sounds_are_wired():
    index = (BURBZ / "index.html").read_text(encoding="utf-8")
    assert "const EMPIRE_AMBIENCE" in index
    assert "name === 'village'" in index
    assert "EMPIRE_AMBIENCE.setSuppressed(reason, value)" in index
    assert "EMPIRE_AMBIENCE.setEnabled(musicEnabled)" in index
    assert "ev.magic && SFX.specialHit" in index
    assert "ev.type === 'barrier' && SFX.defend" in index
    assert "ev.type === 'faint' && !battleState.liberation && SFX.defeat" in index
