"""Shared helpers for the bird-art suites.

The art rasters live in Git LFS. Where LFS cannot materialise them — no
git-lfs on the machine, or the repo's LFS budget is exhausted, as in fresh
session containers — the files on disk are ~130-byte pointer texts, not
images. Pixel-level checks cannot run there, so they skip with a clear
reason instead of failing seven tests on every run.

Integrity checks still run everywhere: an LFS pointer carries the sha256 of
the real file as its `oid`, so `art_sha256` returns the same value for the
pointer and for the painting it stands for. A corrupted or swapped raster
is caught either way.
"""
import hashlib
import re
from pathlib import Path

import pytest

LFS_MAGIC = b"version https://git-lfs"


def lfs_pointer_oid(path):
    """The sha256 the pointer promises, or None if this is a real file."""
    try:
        head = Path(path).read_bytes()
    except OSError:
        return None
    if not head.startswith(LFS_MAGIC):
        return None
    match = re.search(rb"oid sha256:([0-9a-f]{64})", head)
    return match.group(1).decode() if match else None


def art_sha256(path):
    """Content hash of the raster — from the bytes, or from the LFS pointer."""
    oid = lfs_pointer_oid(path)
    return oid if oid else hashlib.sha256(Path(path).read_bytes()).hexdigest()


def require_materialised_art(*paths):
    """Skip a pixel-level test when the rasters are only LFS pointers here."""
    pointers = sum(1 for path in paths if lfs_pointer_oid(path))
    if pointers:
        pytest.skip(
            f"{pointers} art file(s) are Git LFS pointers in this environment "
            "(git-lfs unavailable or the LFS budget is exhausted) — pixel "
            "checks need the real rasters; hash checks still ran"
        )
