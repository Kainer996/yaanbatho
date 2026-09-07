"""Actual flight geometry/lifecycle and the consuming transparent atlas."""
import json
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def test_flight_paths_talon_contact_and_lifecycle():
    result = subprocess.run(
        ["node", str(ROOT / "tests/test_merlin_flight_20260907.cjs")],
        text=True, capture_output=True, timeout=40,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_consuming_atlas_has_64_opaque_birds_in_clear_transparent_cells():
    image = Image.open(ROOT / "assets/merlin-flight/merlin-flight-v1.webp").convert("RGBA")
    assert image.size == (2048, 2048)
    for row in range(8):
        for column in range(8):
            alpha = image.crop((column * 256, row * 256, (column + 1) * 256, (row + 1) * 256)).getchannel("A")
            bounds = alpha.getbbox()
            assert bounds is not None, (row, column)
            assert bounds[0] >= 8 and bounds[1] >= 8 and bounds[2] <= 248 and bounds[3] <= 248, (row, column, bounds)
            assert alpha.getextrema()[1] >= 250
    mapping = json.loads((ROOT / "assets/merlin-flight/merlin-flight-v1.mapping.json").read_text())
    assert len(mapping["frames"]) == 64
    assert mapping["pivot"] == [128, 160]
