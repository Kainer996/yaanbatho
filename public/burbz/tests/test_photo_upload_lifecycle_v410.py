"""Narrow route migration preserves all unrelated server source."""
import importlib.util
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('photo_upload_patch', REPO / 'scripts/patch-photo-upload-lifecycle.py')
patch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patch)

ROUTE = '''def identify_image():
    raw_tmp_path = None
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix='.upload', delete=False) as raw_tmp:
            image.save(raw_tmp.name)
            raw_tmp_path = raw_tmp.name
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            tmp_path = tmp.name
        normalise_image_file(raw_tmp_path, tmp_path)
        return identify_bird_from_image(tmp_path)
    finally:
        for path in (raw_tmp_path, tmp_path):
            if path and os.path.exists(path):
                os.unlink(path)
'''


def test_route_migration_is_narrow_and_idempotent():
    before = "# untouched imports\nimport tempfile\n\n@app.route('/api/identify/image')\n"
    after = "\n# untouched sound\ndef identify_sound():\n    return 'BirdNET unchanged'\n"
    result = patch.transform(before + ROUTE + after)
    assert result.startswith(before) and result.endswith(after)
    assert result.count("dir='/run/burbz-photo-uploads', prefix='capture-'") == 2
    assert result.index('raw_tmp_path = raw_tmp.name') < result.index('image.save(raw_tmp.name)')
    assert patch.transform(result) == result


@pytest.mark.parametrize('source', [
    'def unrelated():\n    pass\n',
    ROUTE + '\n' + ROUTE,
    ROUTE.replace("suffix='.upload'", "suffix='.other'"),
    ROUTE.replace('os.unlink(path)', 'retain(path)'),
])
def test_unrecognized_route_fails_closed(source):
    with pytest.raises(ValueError):
        patch.transform(source)
