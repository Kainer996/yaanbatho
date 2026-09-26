"""Real local HTTP deadlines plus the Flask/Unix response and identity boundary."""
import base64
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import io
import os
from pathlib import Path
import runpy
import sys
import tempfile
import threading
import time
import types

import pytest
from flask import Flask
from flask import jsonify, request
from werkzeug.datastructures import FileStorage

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT))
import photo_gemini
import photo_id


@pytest.mark.parametrize('delay', ['body-close', 'headers'])
def test_google_absolute_deadline_interrupts_trickled_transport(monkeypatch, delay):
    stopped = threading.Event()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def do_POST(self):
            self.rfile.read(int(self.headers['Content-Length']))
            try:
                if delay == 'headers':
                    stopped.wait(1.2)
                self.send_response(200)
                self.send_header('Connection', 'close')
                self.send_header('Content-Length', '17')
                self.end_headers()
                for byte in b'{"totalTokens":2}':
                    self.wfile.write(bytes([byte]))
                    self.wfile.flush()
                    if delay == 'body-close':
                        stopped.wait(.08)
            except (BrokenPipeError, ConnectionResetError):
                pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    server.daemon_threads = True
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    original = http.client.HTTPConnection
    monkeypatch.setattr(photo_gemini.http.client, 'HTTPSConnection',
                        lambda host, timeout: original('127.0.0.1', server.server_port, timeout=timeout))
    started = time.monotonic()
    try:
        with pytest.raises(photo_gemini.ProviderError, match='photo-provider-unavailable'):
            photo_gemini.Google('test-only').request('countTokens', {'contents': []}, .25)
        assert time.monotonic() - started < .8
    finally:
        stopped.set()
        server.shutdown()
        server.server_close()
        thread.join(2)


def test_google_never_posts_after_connection_deadline(monkeypatch):
    clock = [100.0]
    calls = []

    class Connection:
        def connect(self):
            clock[0] += 2

        def request(self, *args, **kwargs):
            calls.append((args, kwargs))

        def close(self):
            pass

    monkeypatch.setattr(photo_gemini.time, 'monotonic', lambda: clock[0])
    monkeypatch.setattr(photo_gemini.http.client, 'HTTPSConnection', lambda *args, **kwargs: Connection())
    with pytest.raises(photo_gemini.ProviderError):
        photo_gemini.Google('test-only').request('generateContent', {'contents': []}, 1)
    assert not calls



def reading(**updates):
    """A worker reading: the ranked facts the adapter decides on."""
    return dict(found=True, accepted=False, verified=False, policy='photo-gemini-v494',
                model='gemini-vision', modelName='gemini-3.8-flash', reason='ranked', liveBird=True,
                quality='clear', subjectClear=True, retryable=False, receiptId='a' * 64,
                fieldMarks=['Orange face and breast', 'Rounded olive-brown back'],
                candidates=[{'species': 'European Robin', 'scientificName': 'Erithacus rubecula', 'probability': .95},
                            {'species': 'Common Redstart', 'scientificName': 'Phoenicurus phoenicurus', 'probability': .03}],
                otherProbability=.02) | updates


def accepted():
    return photo_id.decide(photo_id._validate_reading(reading())[0])


FORM = {'photoOwner': 'owner_01234567890', 'photoRequestId': 'request_01234567890', 'photoContract': 'merlin-v494'}


@pytest.mark.parametrize('change', [
    {'receiptId': ''}, {'receiptId': 'a' * 63}, {'modelName': 'gemini-2.5-pro'}, {'policy': 'photo-gemini-v425'},
    {'candidates': [{'species': 'Robin', 'scientificName': 'not a binomial', 'probability': .9}]},
    {'candidates': [{'species': 'Robin', 'scientificName': 'Erithacus rubecula', 'probability': True}]},
    {'candidates': [{'species': 'Robin', 'scientificName': 'Erithacus rubecula', 'probability': float('nan')}]},
    {'candidates': [{'species': 'Robin', 'scientificName': 'Erithacus rubecula', 'probability': .8},
                    {'species': 'Wren', 'scientificName': 'Troglodytes troglodytes', 'probability': .8}]},
    {'retryable': True},
])
def test_adapter_rejects_malformed_or_unreceipted_worker_reading(change):
    clean_reading, problem = photo_id._validate_reading(reading(**change))
    assert clean_reading is None and problem['found'] is False
    assert 'species' not in problem and 'candidates' not in problem


def test_adapter_never_leaks_species_on_failure():
    raw = reading(found=False, reason='photo-budget-exhausted', retryable=True, retryAt=1234)
    clean_reading, problem = photo_id._validate_reading(raw)
    assert clean_reading is None and problem['retryAt'] == 1234 and problem['retryable'] is True
    assert not {'species', 'candidates', 'receiptId'} & problem.keys()


def test_strong_clear_reading_is_found_and_keeps_ranked_matches():
    result = accepted()
    assert result['found'] and result['accepted'] and result['verified']
    assert result['scientificName'] == 'Erithacus rubecula' and result['confidence'] == .95
    assert [c['scientificName'] for c in result['candidates']] == ['Erithacus rubecula', 'Phoenicurus phoenicurus']
    assert result['receiptId'] == 'a' * 64 and result['retryable'] is False and result['placeUsed'] is False


@pytest.mark.parametrize('change', [
    {'subjectClear': False}, {'fieldMarks': ['Orange face and breast']},
    {'candidates': [{'species': 'European Robin', 'scientificName': 'Erithacus rubecula', 'probability': .6},
                    {'species': 'Common Redstart', 'scientificName': 'Phoenicurus phoenicurus', 'probability': .3}]},
    {'candidates': [{'species': 'European Robin', 'scientificName': 'Erithacus rubecula', 'probability': .79}],
     'otherProbability': .21},
])
def test_weaker_readings_ask_the_player_to_pick(change):
    result = photo_id.decide(photo_id._validate_reading(reading(**change))[0])
    assert result['found'] is False and result['reason'] == 'pick-your-bird'
    assert result['candidates'][0]['scientificName'] == 'Erithacus rubecula'
    assert 'species' not in result and result['receiptId'] == 'a' * 64


def test_no_bird_reading_names_nothing():
    raw = reading(found=False, reason='no-bird', message='No identifiable real bird in this photo.')
    for key in ('candidates', 'fieldMarks', 'liveBird', 'quality', 'subjectClear'):
        raw.pop(key)
    result = photo_id.decide(photo_id._validate_reading(raw)[0])
    assert result['found'] is False and result['reason'] == 'no-bird' and 'candidates' not in result


@pytest.mark.parametrize('peer,header,expected', [
    ('127.0.0.1', '203.0.113.3', '203.0.113.3'),
    ('::1', '2001:db8::2', '2001:db8::2'),
    ('127.0.0.1', 'not-an-ip', '127.0.0.1'),
    ('203.0.113.5', '198.51.100.1', '203.0.113.5'),
])
def test_adapter_trusts_replaced_real_ip_only_from_loopback(peer, header, expected):
    app = Flask(__name__)
    with app.test_request_context('/burbz/api/identify/image', method='POST', data=FORM,
                                 headers={'X-Real-IP': header}, environ_base={'REMOTE_ADDR': peer}):
        assert photo_id._request_identity()[:3] == ('owner_01234567890', 'request_01234567890', expected)


@pytest.mark.parametrize('data', [{}, {k: v for k, v in FORM.items() if k != 'photoContract'},
                                  FORM | {'photoContract': 'merlin-v485'}])
def test_adapter_missing_identity_or_old_app_never_reaches_worker(monkeypatch, tmp_path, data):
    monkeypatch.setattr(photo_id, '_LocalConnection', lambda: pytest.fail('No worker request permitted'))
    app = Flask(__name__)
    with app.test_request_context('/burbz/api/identify/image', method='POST', data=data):
        result = photo_id.identify_bird_from_image(str(tmp_path / 'absent.jpg'))
    assert result['reason'] == 'photo-update-required'


def worker_connection(calls, body):
    class Response:
        status = 200

        def read(self, _):
            return json.dumps(body).encode()

    class Connection:
        def request(self, *args, **kwargs):
            calls.append((args, kwargs))

        def getresponse(self):
            return Response()

        def close(self):
            pass
    return Connection


def test_adapter_without_place_sends_only_image_and_internal_identity(monkeypatch, tmp_path):
    calls = []
    path = tmp_path / 'photo.jpg'
    path.write_bytes(b'validated-image-bytes')
    monkeypatch.setattr(photo_id, '_LocalConnection', worker_connection(calls, {**reading(), 'privateWorkerField': 'x'}))
    monkeypatch.setattr(photo_id, '_taxonomy_or_none', lambda: None)
    app = Flask(__name__)
    with app.test_request_context('/burbz/api/identify/image', method='POST', data=FORM,
                                 environ_base={'REMOTE_ADDR': '203.0.113.5'}):
        result = photo_id.identify_bird_from_image(str(path), lat=51.5, lon=-.1)
    sent = json.loads(calls[0][1]['body'])
    assert set(sent) == {'image', 'owner', 'requestId', 'caller'}
    assert base64.b64decode(sent['image']) == path.read_bytes()
    assert result == accepted() and 'privateWorkerField' not in result


@pytest.mark.parametrize('outcome', ['success', 'normalise-error', 'worker-error', 'timeout', 'upload-save-error'])
def test_patched_live_route_deletes_photo_files_on_every_exit(monkeypatch, tmp_path, outcome):
    # server.py is intentionally untracked: the release check snapshots only
    # its exact live image route into work/, without server secrets or imports.
    source_path = ROOT.parents[1] / 'work' / 'live_image_route_snapshot.py'
    if not source_path.exists():
        pytest.skip('Needs the read-only live image route snapshot in work/')
    app = Flask(__name__)
    paths = []
    patcher = runpy.run_path(str(ROOT.parents[1] / 'scripts' / 'patch-photo-upload-lifecycle.py'))
    source = patcher['transform'](source_path.read_text())

    def temporary_file(**kwargs):
        assert kwargs.pop('dir') == '/run/burbz-photo-uploads'
        assert kwargs['prefix'] == 'capture-'
        handle = tempfile.NamedTemporaryFile(dir=tmp_path, **kwargs)
        paths.append(Path(handle.name))
        return handle

    def normalise(raw, target):
        assert Path(raw).exists()
        if outcome == 'normalise-error':
            raise ValueError('invalid image')
        Path(target).write_bytes(b'normalised-image')

    def identify(path, **kwargs):
        assert Path(path).read_bytes() == b'normalised-image'
        if outcome == 'worker-error':
            raise RuntimeError('worker unavailable')
        if outcome == 'timeout':
            raise TimeoutError('worker deadline')
        return accepted()

    if outcome == 'upload-save-error':
        def fail_upload(self, target, *args, **kwargs):
            Path(target).write_bytes(b'partial-upload')
            raise OSError('injected upload write failure')
        monkeypatch.setattr(FileStorage, 'save', fail_upload)

    scope = {'app': app, 'request': request, 'jsonify': jsonify, 'os': os,
             'tempfile': types.SimpleNamespace(NamedTemporaryFile=temporary_file),
             'normalise_image_file': normalise, 'identify_bird_from_image': identify,
             '_catalog_lookup': lambda *args: {'species': 'European Robin'},
             '_record_unmatched_recognition_report': lambda *args, **kwargs: None}
    exec(compile(source, str(source_path), 'exec'), scope)
    app.add_url_rule('/identify', view_func=scope['identify_image'], methods=['POST'])
    with app.test_client() as client:
        response = client.post('/identify', data={'captureSource': 'camera', 'image': (io.BytesIO(b'uploaded-image'), 'photo.jpg')})
    assert response.status_code == (200 if outcome == 'success' else 422)
    assert paths
    assert not any(path.exists() for path in paths), 'Uploaded photo file escaped route cleanup'


