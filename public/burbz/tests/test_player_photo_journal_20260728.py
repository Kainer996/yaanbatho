"""Player Photo Journal: the real photo behind a camera discovery.

When a player discovers a bird with the camera, the shot they actually took
is kept (compressed, in IndexedDB) and surfaces on the back of that bird's
card in the Birdex as a little camera chip — tap it to see your own photo.
The discovery record only carries a tiny photoAt flag so the localStorage
save and cloud sync never swallow image data.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")


def test_camera_discoveries_keep_the_players_shot():
    # The camera pipeline hands its blob to the journal; sound scans never do.
    # (On restore this moved onto `surfaced[0]`: main's handleBirdCandidates now
    # surfaces several sound birds per window, and `top` is only the raw winner.)
    assert "if (opts.source === 'photo' && opts.blob && surfaced[0]) rememberPlayerBirdPhoto(surfaced[0], opts.blob);" in HTML
    # First shot wins — later re-scans never overwrite the discovery photo.
    assert "if (!record || !record.key || record.photoAt) return;" in HTML
    # The record carries only the flag; the image goes to IndexedDB.
    assert "record.photoAt = takenAt;" in HTML
    assert "const PLAYER_PHOTO_DB_NAME = 'burbz-player-photos';" in HTML
    assert "const PLAYER_PHOTO_STORE = 'photos';" in HTML


def test_photos_are_compressed_before_storage():
    # Shots shrink to a bounded JPEG so hundreds of discoveries fit quotas.
    assert "const PLAYER_PHOTO_MAX_EDGE = 1024;" in HTML
    assert "canvas.toBlob(resolve, 'image/jpeg', 0.82)" in HTML
    assert "PLAYER_PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height)" in HTML


def test_camera_chip_sits_on_both_card_backs():
    # A shared helper renders the chip only once a photo exists.
    assert "function playerPhotoChipHTML(bird, extraClass)" in HTML
    assert "if (!record || !record.photoAt) return '';" in HTML
    assert 'data-action="view-photo"' in HTML
    # Companion card back (in the head row) and known-species learning back.
    assert "${playerPhotoChipHTML(bird)}" in HTML
    assert "${playerPhotoChipHTML(bird, 'floating')}" in HTML
    assert ".card-photo-btn {" in HTML
    assert ".card-photo-btn.floating { position:absolute;" in HTML


def test_tapping_the_chip_opens_the_photo_viewer():
    # The Birdex card click handler routes the chip before the flip.
    assert "const photoTarget = e.target.closest('[data-action=\"view-photo\"]');" in HTML
    assert "openPlayerBirdPhotoViewer(photoTarget.dataset.photoKey);" in HTML
    # Overlay shows the photo with the species name and snap date, and
    # degrades gracefully when the photo lives on another device.
    assert "function playerPhotoOverlayEl()" in HTML
    assert 'class="player-photo-img"' in HTML
    assert "That photo lives on the device that took it." in HTML
    assert ".player-photo-overlay {" in HTML
    # Object URLs are revoked so repeat viewing never leaks memory.
    assert "URL.revokeObjectURL(playerPhotoObjectUrl)" in HTML


def test_release_cache_is_bumped():
    # Shipped under the restore pin: the original v147 segment never reached main
    # because the commit was pushed after PR #121 had already merged the branch.
    assert "restored-lost-features-v200-20260802" in SW
