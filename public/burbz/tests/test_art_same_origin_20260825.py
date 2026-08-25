# -*- coding: utf-8 -*-
"""Every bird painting is served same-origin (art-same-origin-v325-20260825).

The problem this release fixes, in Yaan's words: the repo keeps ~1.6 GB of bird
art in Git LFS, GitHub's free allowance is 1 GB of storage and 1 GB of download
a month, and once it is spent GitHub BLOCKS further LFS downloads — which is why
the Pages deploy failed repeatedly from 2026-08-20. Nothing was being paid for;
there is no billing on the account. The quota was being burned twice over:

  1. Players. At boot index.html rewrote most art paths onto
     github.com/Kainer996/yaanbatho/raw/..., and sw.js precached ~292 of those
     GitHub URLs on every service-worker install — for every player, on every
     update. An Android TWA launch is imminent, so this had to go first.
  2. Deploys. scripts/update-live-burbz.sh curl'd EVERY art file from the
     GitHub LFS endpoint on EVERY deploy, several times a day, with no player
     involved at all.

The stale comment that justified the rerouting claimed the VPS serves "LFS
pointer text". It does not, and had not for a long time: yaanbatho.com serves
real image bytes, byte-identical to GitHub, verified across paintings, RPG
paintings, warrior art, cutouts and habitat backgrounds — and the updater's own
pointer-detection guard re-proves it on every run.

So, pinned here:

- no BIRD_ART_GITHUB_RAW_BASE anywhere, and none of the five index.html rewrite
  sites or the two sw.js ones,
- every art path the page and the service worker hold is same-origin /burbz/…,
- birdCutoutUrlFor returns the local cutouts path for EVERY bird, not just the
  placeholders,
- the service worker's precache list is entirely same-origin,
- the deploy script sources art locally and never downloads it, keeping its
  LFS-pointer guard so a pointer can never reach the live site,
- the one deliberate survivor: the fetch handler still CACHES github.com art
  for one release, so a client mid-update is not broken. That allowance is
  scoped and commented; it is not a fetch of its own.

Old saves need no migration: syncFlockArtUrls re-resolves bird.artUrl from the
maps on boot, so a stored GitHub URL heals itself the first time the game runs.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
UPDATER_PATH = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"
CHECKER_PATH = ROOT.parents[1] / "scripts" / "check-burbz-art-on-vps.sh"

HTML = HTML_PATH.read_text(encoding="utf-8")
SW = SW_PATH.read_text(encoding="utf-8")
UPDATER = UPDATER_PATH.read_text(encoding="utf-8")

OWN_RELEASE_PIN = "art-same-origin-v325-20260825"
CURRENT_BUILD = "iron-ingot-errand-v326-20260825"
PREVIOUS_RELEASE_PIN = "manager-builds-the-village-v324-20260825"

GITHUB_HOSTS = ("github.com/Kainer996", "raw.githubusercontent.com")


def strip_comments(js: str) -> str:
    """Drop // line comments and /* */ blocks so prose can name a host freely."""
    js = re.sub(r"/\*.*?\*/", "", js, flags=re.S)
    return "\n".join(re.sub(r"(?<!:)//.*$", "", line) for line in js.splitlines())


# --- the constant and its five rewrite sites are gone ----------------------

def test_the_github_raw_base_constant_is_gone_from_the_page():
    assert "BIRD_ART_GITHUB_RAW_BASE" not in HTML


def test_the_github_raw_base_constant_is_gone_from_the_service_worker():
    assert "BIRD_ART_GITHUB_RAW_BASE" not in SW


def test_no_art_map_is_rewritten_onto_a_remote_host():
    # The five rewrite sites all shared this shape: take a /burbz/… path and
    # re-root it at /public/burbz/… on a remote base. Nothing may do that.
    assert "'/public/burbz/" not in HTML
    assert '"/public/burbz/' not in HTML
    assert "/public/burbz/" not in strip_comments(SW)


def test_the_page_never_names_the_github_art_host_in_code():
    code = strip_comments(HTML)
    for host in GITHUB_HOSTS:
        assert host not in code, f"{host} is still reachable from index.html code"


# --- cutouts are local for every bird, not just placeholders ---------------

def test_bird_cutout_url_is_local_for_every_bird():
    start = HTML.index("function birdCutoutUrlFor(")
    body = HTML[start:HTML.index("\nfunction ", start + 1)]
    assert "/burbz/bird-art-cache/cutouts/" in body
    assert "http" not in body, "birdCutoutUrlFor must not build an absolute URL"
    # The old code took the local path ONLY for the 20260715 placeholders and
    # sent every real painting to GitHub. There is one path now, for everyone.
    assert "placeholder_20260715" not in body


def test_the_fallback_wiring_is_untouched():
    # Behaviour that must NOT have changed: a failed cutout still retries the
    # full painting, then degrades to an emoji glyph.
    assert "function wireBirdArtFallbacks()" in HTML
    assert "data-fallback-art" in HTML
    assert "data-fallback-emoji" in HTML


def test_old_saves_heal_themselves_without_a_migration():
    # syncFlockArtUrls re-resolves every bird's artUrl from the maps on boot, so
    # a save holding an old GitHub URL is corrected with no migration code.
    assert "function syncFlockArtUrls()" in HTML
    assert "function syncBirdArtUrl(" in HTML
    assert "bird.artUrl = mappedArt;" in HTML


# --- the service worker precaches same-origin only -------------------------

def test_the_expansion_art_lists_are_local_and_named_so():
    assert "UK50_REMOTE_ART" not in SW
    assert "UK50_REMOTE_CUTOUTS" not in SW
    assert "const UK50_LOCAL_ART = Object.values(ALL_EXPANSION_ART);" in SW
    assert "const UK50_LOCAL_CUTOUTS =" in SW
    assert (
        "BURBZ_ASSETS.push(...UK50_LOCAL_ART, ...UK50_LOCAL_CUTOUTS, "
        "...NEW_LOCAL_ART, ...NEW_LOCAL_CUTOUTS);"
    ) in SW


def test_every_precached_asset_is_same_origin():
    # Each entry is a './…' bundle path or a '/burbz/…' art path. An absolute
    # URL in this list is exactly the ~292-file-per-install leak coming back.
    for entry in re.findall(r"'(\./[^']*|/burbz/[^']*)'", SW):
        assert not entry.startswith("http")
    assert "https://github.com" not in strip_comments(SW)


def test_the_fetch_handler_keeps_the_one_release_grace_allowance():
    # Deliberate survivor: a client still on the previous build has old remote
    # URLs in flight, so the handler may still CACHE what they fetch. It is an
    # allowance to cache, never a fetch this build originates.
    assert "const cacheableArtHost = url.hostname === 'github.com'" in SW
    assert "Remove it in the release after art-same-origin-v325-20260825." in SW


# --- the deploy pipeline stops downloading art -----------------------------

def test_the_updater_has_no_lfs_download_endpoint():
    assert "LFS_BASE" not in UPDATER
    assert "download_lfs_art" not in UPDATER
    assert "github.com/Kainer996/yaanbatho/raw" not in UPDATER


def test_the_updater_sources_art_locally():
    assert "stage_art_file()" in UPDATER
    # Both local sources, in preference order: the checkout, then the live dir.
    assert 'if [[ -n "$REPO_SRC" && -f "$REPO_SRC/$f" ]]; then' in UPDATER
    assert 'if [[ -f "$ROOT/$f" ]]; then' in UPDATER
    # And it still enumerates the same complete art set it always did.
    for marker in (
        "completion-20260726",
        "_burbz_manga_warrior_20260802.png",
        "habitat-backgrounds",
    ):
        assert marker in UPDATER


def test_the_updater_still_refuses_to_ship_an_lfs_pointer():
    # The guard is the whole reason a local source is safe. It must survive, and
    # it must say where to restore from rather than deploying pointer text.
    assert "version https://git-lfs.github.com/spec/v1" in UPDATER
    assert "is_lfs_pointer()" in UPDATER
    assert "/var/backups/burbz-art/" in UPDATER
    assert "pointer_die" in UPDATER


def test_the_vps_art_checker_ships_with_the_repo():
    assert CHECKER_PATH.exists(), "scripts/check-burbz-art-on-vps.sh must be re-runnable"
    checker = CHECKER_PATH.read_text(encoding="utf-8")
    # It must enumerate from the real sources, not a frozen list.
    for source in ("bird_art_release_20260727.js", "bird_art_release_20260803.js",
                   "uk_bird_expansion_50.js", "national_bird_completion_20260715.js"):
        assert source in checker
    assert "warriorSlugs" in checker          # derived warrior art
    assert "_cutout.png" in checker           # derived cutouts
    assert "300" in checker                   # a pointer can never pass as an image


# --- release plumbing ------------------------------------------------------

def test_release_is_versioned_and_the_lineage_is_append_only():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    cache_line = next(line for line in SW.splitlines() if line.startswith("const BURBZ_CACHE = "))
    # The newest marker is the CURRENT head, not this release's own — the
    # lineage keeps growing after v325, and every later marker must land after
    # it without dropping anything already in the chain.
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD), "the newest marker goes last"
    assert OWN_RELEASE_PIN in cache_line, "the lineage is append-only"
    assert PREVIOUS_RELEASE_PIN in cache_line, "the lineage is append-only"
    assert "forge-opens-on-the-anvil-v323-20260825" in cache_line, "the lineage is append-only"


def test_no_core_was_edited_so_no_version_buster_moved():
    # This release changed index.html, sw.js and two scripts only. If a core's
    # ?v= had moved without the core changing, installed PWAs would be served a
    # cache-miss for no reason.
    assert f'src="village_manager_core.js?v={PREVIOUS_RELEASE_PIN}"' in HTML
    assert f'src="bird_roles_core.js?v={PREVIOUS_RELEASE_PIN}"' in HTML
