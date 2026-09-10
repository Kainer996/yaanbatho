"""Verify the delivered pixels, in addition to the animation model tests."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'assets/merlin-flight'

def test_v2_contains_164_distinct_transparent_sprites_without_cell_bleed():
    mapping = json.loads((ROOT / 'merlin-flight-v2.mapping.json').read_text())
    image = Image.open(ROOT / 'merlin-flight-v2.webp').convert('RGBA')
    assert image.size == (2304, 2688)
    fingerprints = set()
    for frame in mapping['frames']:
        x, y, w, h = frame['source']
        tile = image.crop((x, y, x+w, y+h))
        alpha = tile.getchannel('A')
        bounds = alpha.getbbox()
        assert bounds is not None
        assert min(bounds[:2]) >= 4 and max(bounds[2:]) <= 188, (frame['id'], bounds)
        # Generated alpha is retained, including interior values just below255.
        assert sum(alpha.histogram()[240:]) > 1000
        assert alpha.getextrema()[1] >= 250
        fingerprints.add(hashlib.sha256(tile.tobytes()).hexdigest())
    assert len(fingerprints) == 164
    assert sum(row['frames'] for row in mapping['qa']) == 164
    assert sum(row['alphaPreserved'] for row in mapping['qa']) == 7
