"""Run the meaningful saved field-story and real adapter transaction contracts."""
from pathlib import Path
import subprocess


def test_saved_fieldwork_and_atomic_rewards():
    result = subprocess.run(["node", str(Path(__file__).with_suffix(".cjs"))], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr


def test_painted_atlas_has_alpha_and_unclipped_isolated_uv_cells():
    """Check real artwork silhouettes, not merely constants matching each other."""
    import json
    import re
    from collections import deque
    from PIL import Image

    base = Path(__file__).resolve().parent.parent
    code = (base / "village_discoveries.js").read_text()
    cells = json.loads(re.search(r"const CELLS=(\[.*?\]);", code, re.S).group(1))
    with Image.open(base / "assets/discoveries-v385/alderwing-objects.webp") as image:
        assert image.mode == "RGBA", "A baked checkerboard is not transparency"
        width, height = image.size
        assert (width, height) == (1254, 1254)
        alpha = list(image.getchannel("A").getdata())
    assert alpha.count(0) > width * height * .4
    occupied = bytearray(value >= 128 for value in alpha)
    components = []
    for index in range(len(occupied)):
        if not occupied[index]:
            continue
        occupied[index] = 0
        queue = deque([index])
        count = 0
        left, top, right, bottom = width, height, 0, 0
        while queue:
            point = queue.popleft()
            x, y = point % width, point // width
            count += 1
            left, top, right, bottom = min(left, x), min(top, y), max(right, x + 1), max(bottom, y + 1)
            for adjacent in (point - 1 if x else -1, point + 1 if x + 1 < width else -1,
                             point - width if y else -1, point + width if y + 1 < height else -1):
                if adjacent >= 0 and occupied[adjacent]:
                    occupied[adjacent] = 0
                    queue.append(adjacent)
        if count > 150:
            components.append((left, top, right, bottom))
    assert len(components) == len(cells) == 16
    for x, y, w, h in cells:
        overlaps = [b for b in components if b[0] < x + w and b[2] > x and b[1] < y + h and b[3] > y]
        assert len(overlaps) == 1, "A UV cell includes a neighbouring painted object"
        left, top, right, bottom = overlaps[0]
        assert x <= left and y <= top and right <= x + w and bottom <= y + h, "A UV cell clips its painted silhouette"
