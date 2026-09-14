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


def accepted():
    return dict(found=True, accepted=True, verified=True, policy='photo-gemini-v410',
                model='gemini-vision', modelName='gemini-2.5-flash', confidence=.98,
                species='European Robin', scientificName='Erithacus rubecula', receiptId='a' * 64)


@pytest.mark.parametrize('change', [
    {'receiptId': ''}, {'receiptId': 'a' * 63}, {'confidence': True},
    {'confidence': float('nan')}, {'confidence': .899}, {'verified': False},
    {'accepted': False}, {'modelName': 'gemini-2.5-pro'}, {'policy': 'photo-local-v393'},
    {'scientificName': 'not a binomial'},
])
def test_adapter_rejects_weak_or_unreceipted_worker_result(change):
    result = accepted()
    result.update(change)
    clean = photo_id._validate_result(result)
    assert clean['found'] is False
    assert 'species' not in clean and 'receiptId' not in clean


def test_adapter_never_leaks_species_on_failure():
    raw = accepted()
    raw.update(found=False, reason='photo-budget-exhausted', retryable=True, retryAt=1234)
    clean = photo_id._validate_result(raw)
    assert clean['found'] is False and clean['retryAt'] == 1234
    assert 'species' not in clean and clean['receiptId'] == raw['receiptId']


@pytest.mark.parametrize('receipt', ['', 'a'*63, 'g'*64, None, 10**63])
def test_adapter_drops_invalid_failure_receipt_without_species_smuggling(receipt):
    raw = accepted()
    raw.update(found=False, reason='photo-provider-unavailable', retryable=True, receiptId=receipt,
               allDetections=[accepted()])
    clean = photo_id._validate_result(raw)
    assert clean['found'] is False and clean['accepted'] is False
    assert not {'receiptId', 'species', 'scientificName', 'allDetections'} & clean.keys()


@pytest.mark.parametrize('peer,header,expected', [
    ('127.0.0.1', '203.0.113.3', '203.0.113.3'),
    ('::1', '2001:db8::2', '2001:db8::2'),
    ('127.0.0.1', 'not-an-ip', '127.0.0.1'),
    ('203.0.113.5', '198.51.100.1', '203.0.113.5'),
])
def test_adapter_trusts_replaced_real_ip_only_from_loopback(peer, header, expected):
    app = Flask(__name__)
    with app.test_request_context('/burbz/api/identify/image', method='POST',
                                 data={'photoOwner': 'owner_01234567890', 'photoRequestId': 'request_01234567890'},
                                 headers={'X-Real-IP': header}, environ_base={'REMOTE_ADDR': peer}):
        assert photo_id._request_identity() == ('owner_01234567890', 'request_01234567890', expected)


def test_adapter_missing_identity_never_reaches_worker(monkeypatch, tmp_path):
    monkeypatch.setattr(photo_id, '_LocalConnection', lambda: pytest.fail('No worker request permitted'))
    app = Flask(__name__)
    with app.test_request_context('/burbz/api/identify/image', method='POST'):
        result = photo_id.identify_bird_from_image(str(tmp_path / 'absent.jpg'))
    assert result['reason'] == 'photo-update-required'


def test_adapter_passes_only_image_and_internal_identity(monkeypatch, tmp_path):
    calls = []

    class Response:
        status = 200

        def read(self, _):
            return json.dumps({**accepted(), 'privateWorkerField': 'must not escape'}).encode()

    class Connection:
        def request(self, *args, **kwargs):
            calls.append((args, kwargs))

        def getresponse(self):
            return Response()

        def close(self):
            pass

    path = tmp_path / 'photo.jpg'
    path.write_bytes(b'validated-image-bytes')
    monkeypatch.setattr(photo_id, '_LocalConnection', Connection)
    app = Flask(__name__)
    with app.test_request_context('/burbz/api/identify/image', method='POST',
                                 data={'photoOwner': 'owner_01234567890', 'photoRequestId': 'request_01234567890'},
                                 environ_base={'REMOTE_ADDR': '203.0.113.5'}):
        result = photo_id.identify_bird_from_image(str(path), lat=51.5, lon=-.1)
    sent = json.loads(calls[0][1]['body'])
    assert set(sent) == {'image', 'owner', 'requestId', 'caller'}
    assert base64.b64decode(sent['image']) == path.read_bytes()
    assert result == accepted()


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
