"""Contract tests use injected responses; real model results are recorded separately."""
import importlib.util
import io
import json
from pathlib import Path
import sys

import pytest
from PIL import Image, ImageDraw

ROOT = Path(__file__).parents[1]

def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT/(name+'.py'))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

photo = module('photo_id')
worker = module('photo_local')

def accepted(**overrides):
    return dict(found=True, accepted=True, verified=True, policy=photo.PHOTO_POLICY,
                model='bioclip2-birder-local', species='Common Raven',
                scientificName='Corvus corax', confidence=.96) | overrides

@pytest.mark.parametrize('overrides', [
    {'confidence': n} for n in [True, '0.99', None, .899, float('nan'), float('inf'), 1.01]
] + [{'accepted': False}, {'verified': False}, {'found': False},
     {'policy': 'photo-evidence-v393'}, {'model': 'gemini-vision'},
     {'scientificName': 'raven'}, {'species': ''}])
def test_bad_results_never_carry_species(overrides):
    result = photo._validate_result(accepted(**overrides))
    assert not result['found'] and not result['accepted']
    assert 'species' not in result

def test_valid_result_preserves_identity_and_score():
    assert photo._validate_result(accepted()) == accepted()

def test_errors_cannot_smuggle_candidates():
    result = photo._validate_result(accepted(found=False, message='Try again', allDetections=[accepted()]))
    assert result['message'] == 'Try again'
    assert 'species' not in result and 'allDetections' not in result

class Connection:
    status = 200
    result = accepted()
    closed = False
    def request(self, method, path, body, headers):
        assert method == 'POST' and path == '/identify'
        assert body == b'camera-fixture'
    def getresponse(self):
        return self
    def read(self, limit):
        return json.dumps(self.result).encode()[:limit]
    def close(self):
        self.closed = True

def test_old_google_configuration_cannot_make_network_calls(tmp_path, monkeypatch):
    path = tmp_path/'photo.jpg'; path.write_bytes(b'camera-fixture')
    connection = Connection()
    monkeypatch.setattr(photo, '_LocalConnection', lambda: connection)
    monkeypatch.setenv('GEMINI_API_KEY', 'test-not-a-key')
    monkeypatch.setenv('BURBZ_PHOTO_MODEL', 'gemini')
    assert photo.identify_bird_from_image(str(path), -33, 151) == accepted()
    assert connection.closed

@pytest.mark.parametrize('status', [422, 500, 503])
def test_failed_http_never_accepts_even_valid_body(tmp_path, monkeypatch, status):
    path = tmp_path/'photo.jpg'; path.write_bytes(b'camera-fixture')
    connection = Connection(); connection.status = status
    monkeypatch.setattr(photo, '_LocalConnection', lambda: connection)
    result = photo.identify_bird_from_image(str(path))
    assert not result['accepted'] and 'species' not in result
    assert connection.closed

def test_worker_missing_is_service_error_not_bad_photo(tmp_path, monkeypatch):
    path = tmp_path/'photo.jpg'; path.write_bytes(b'camera-fixture')
    class Missing(Connection):
        def request(self, *args, **kwargs):
            raise FileNotFoundError('socket not running')
    connection = Missing(); monkeypatch.setattr(photo, '_LocalConnection', lambda: connection)
    result = photo.identify_bird_from_image(str(path))
    assert result['reason'] == 'photo-unavailable'
    assert 'not been rejected' in result['message'] and connection.closed

def test_normalisation_strips_metadata_and_bounds_pixels(tmp_path):
    src=tmp_path/'source.png'; dest=tmp_path/'normal.jpg'
    Image.new('RGB', (3000,1200), 'grey').save(src)
    photo.normalise_image_file(str(src), str(dest))
    with Image.open(dest) as image:
        assert image.format == 'JPEG' and max(image.size) == 2560 and not image.getexif()

def test_original_pixel_guard_cannot_be_bypassed_with_confidence():
    image = Image.new('RGB', (500,500), 'white')
    assert not worker.clear_pixels(image, [0,0,500,500])
    draw = ImageDraw.Draw(image)
    for i in range(0, 500, 10): draw.line((i,0,i,500), fill='black', width=3)
    assert worker.clear_pixels(image, [0,0,500,500])
    assert not worker.clear_pixels(image, [200,200,220,220])
    assert not worker.clear_pixels(image, [0,0,501,500])

def test_checksum_failure_stops_model_loading(tmp_path):
    (tmp_path/'manifest.json').write_text(json.dumps({'sha256': {'model': 'wrong'}}))
    (tmp_path/'model').write_bytes(b'broken')
    with pytest.raises(ValueError, match='checksum'): worker.check_manifest(tmp_path)

def test_two_models_must_agree_and_one_must_be_strong_on_both_views():
    a = [('Corvus corax', .95, .8), ('Corvus corax', .94, .8)]
    b = [('Corvus corax', .71, .4), ('Corvus corax', .72, .4)]
    assert worker.accept_consensus(a, b) == .94
    assert worker.accept_consensus(b, a) == .94
    assert worker.accept_consensus(b) is None
    assert worker.accept_consensus(a, [('Corvus corone', .99, .9)]*2) is None
    assert worker.accept_consensus(a, [('Corvus corax', .95, .10)]*2) is None
    assert worker.accept_consensus(a, [('Corvus corax', .59, .4)]*2) is None
    assert worker.accept_consensus([a[0], b[0]], [b[0], a[0]]) is None
    assert worker.accept_consensus(a, [('Corvus corax', float('nan'), .9)]*2) is None

def test_installer_accepts_existing_five_argument_sync_protocol(tmp_path):
    import subprocess
    root=tmp_path/'game'; root.mkdir(); (root/'server.py').touch()
    (root/'venv/bin').mkdir(parents=True)
    python=root/'venv/bin/python3'; python.write_text('#!/bin/sh\nexit 0\n'); python.chmod(0o755)
    stage=tmp_path/'staged'; stage.mkdir()
    for name in ['photo_id.py','photo_local.py','proof.py','sound.py']: (stage/name).touch()
    import os
    env=dict(os.environ,BURBZ_LOCAL_PHOTO_RUNTIME=str(tmp_path/'not-provisioned'))
    result=subprocess.run(['bash',str(ROOT.parents[1]/'scripts/install-photo-id.sh'),str(root),str(stage/'photo_id.py'),str(stage),str(stage/'proof.py'),str(stage/'sound.py')],env=env,capture_output=True,text=True)
    assert result.returncode != 0
    assert 'Provision the isolated free photo runtime first' in result.stderr
