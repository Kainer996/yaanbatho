"""The manual VPS updater must ship the complete current PWA, including LFS art."""
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")
UPDATER = (REPO / "scripts" / "update-live-burbz.sh").read_text(encoding="utf-8")
AUTODEPLOY = (REPO / "scripts" / "install-burbz-autodeploy.sh").read_text(encoding="utf-8")
ART_RELEASE = (ROOT / "bird_art_release_20260803.js").read_text(encoding="utf-8")


def test_every_direct_service_worker_and_script_dependency_is_in_the_updater():
    service_worker_paths = {
        match.split("?", 1)[0]
        for match in re.findall(r"['\"]\./([^'\"]+)['\"]", SW)
    }
    script_paths = {
        match.split("?", 1)[0]
        for match in re.findall(r'<script\s+src="([^"]+)"', INDEX)
        if not re.match(r"^[a-z]+://", match)
    }
    missing = sorted(
        path
        for path in service_worker_paths | script_paths
        if not path.startswith(("bird-art-cache/", "http:", "https:")) and f'"{path}"' not in UPDATER
    )
    assert missing == []
    assert "grep -hoE '/burbz/bird-art-cache/" in UPDATER

    literal_art = {
        path
        for path in re.findall(r"/burbz/(bird-art-cache/[a-zA-Z0-9_./-]+\.(?:png|webp))", INDEX + SW)
    }
    assert literal_art
    assert all((ROOT / path).exists() for path in literal_art)


def test_every_install_icon_is_in_the_updater():
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    paths = {str(icon["src"]).lstrip("./") for icon in manifest["icons"]}
    assert paths
    assert all(f'"{path}"' in UPDATER for path in paths)


def test_manga_portraits_cutouts_and_habitats_use_the_lfs_endpoint():
    match = re.search(r"const warriorSlugs = new Set\(`(.*?)`\.trim", ART_RELEASE, re.S)
    assert match
    slugs = match.group(1).split()
    assert len(slugs) == 143 and len(set(slugs)) == 143
    for slug in slugs:
        assert (ROOT / "bird-art-cache" / f"{slug}_burbz_manga_warrior_20260802.png").exists()
        assert (ROOT / "bird-art-cache" / "cutouts" / f"{slug}_burbz_manga_warrior_20260802_cutout.png").exists()
    assert "bird-art-cache/${slug}_burbz_manga_warrior_20260802.png" in UPDATER
    assert "bird-art-cache/cutouts/${slug}_burbz_manga_warrior_20260802_cutout.png" in UPDATER
    assert "habitat-backgrounds" in UPDATER
    assert 'curl -fsSL "$LFS_BASE/$f"' in UPDATER
    assert UPDATER.index('for managed_file in "${FILES[@]}"') < UPDATER.index("download_lfs_art()")

    habitat_paths = set(re.findall(r"/burbz/(bird-art-cache/habitat-backgrounds/[a-z0-9_./-]+)", ART_RELEASE))
    assert len(habitat_paths) == 8
    assert all((ROOT / path).exists() for path in habitat_paths)


def test_autodeploy_is_commit_pinned_fail_closed_and_reuses_only_verified_lfs():
    assert 'tar.gz/$SHA' in AUTODEPLOY
    assert '$REPO/$SHA/public/burbz/$rel' in AUTODEPLOY
    assert "pointer_oid=$(sed -n 's/^oid sha256://p'" in AUTODEPLOY
    assert "pointer_size=$(sed -n 's/^size //p'" in AUTODEPLOY
    assert 'existing="$ROOT/$rel"' in AUTODEPLOY
    assert 'existing_oid=$(sha256sum "$existing"' in AUTODEPLOY
    assert 'hydrated_oid=$(sha256sum "$hydrated"' in AUTODEPLOY
    assert 'hydrated_size == "$pointer_size"' in AUTODEPLOY
    assert 'hydrated_oid == "$pointer_oid"' in AUTODEPLOY
    assert "sha256sum --quiet -c \"$MANAGED_HASHES\"" in AUTODEPLOY
    assert AUTODEPLOY.index(".burbz-managed-hashes.sha256.new") < AUTODEPLOY.index(
        'mv -f "$ROOT/.burbz-deployed-sha.new"'
    )
    assert "TimeoutStartSec=30min" in AUTODEPLOY
