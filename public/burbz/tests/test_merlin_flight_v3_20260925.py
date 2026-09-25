"""Merlin flight v3: the model tests and the delivered pixels."""
import re
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def test_flight_model_lifecycle_and_release_pins():
    result = subprocess.run(["node", "--test", str(ROOT / "tests/test_merlin_flight_v3_20260925.cjs")],
                            text=True, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stdout + result.stderr


def test_atlas_cells_hold_one_clean_transparent_merlin_each():
    config = (ROOT / "assets/merlin-flight/atlas-config.js").read_text()
    width, height = (int(n) for n in re.search(r'"width":(\d+),"height":(\d+)', config).groups())
    cw, ch = (int(n) for n in re.search(r'"cell":\[(\d+),(\d+)\]', config).groups())
    image = Image.open(ROOT / "assets/merlin-flight/merlin-flight-v3.webp").convert("RGBA")
    assert image.size == (width, height)
    frames = len(re.findall(r'"clip":', config))
    assert frames == 12
    for n in range(frames):
        x, y = (n % 4) * cw, (n // 4) * ch
        alpha = image.crop((x, y, x + cw, y + ch)).getchannel("A")
        box = alpha.getbbox()
        assert box and box[0] >= 1 and box[1] >= 1 and box[2] <= cw - 1 and box[3] <= ch - 1, (n, box)
        assert alpha.getextrema()[1] >= 250
        # No leftover magenta from the keyed background.
        pixels = image.crop((x, y, x + cw, y + ch)).getdata()
        pink = sum(1 for r, g, b, a in pixels if a > 128 and r > 200 and b > 200 and g < 90)
        assert pink < 20, (n, pink)
