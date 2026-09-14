"""Exercise release/rollback with isolated services, never production systemd."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import socketserver
import subprocess
import sys
import threading

import pytest

REPO = Path(__file__).resolve().parents[3]
INSTALLER = REPO / 'scripts/install-photo-id.sh'
spec = importlib.util.spec_from_file_location('photo_proof_v407', REPO / 'scripts/verify-photo-id.py')
proof = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proof)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def executable(path, source):
    path.write_text(source)
    path.chmod(0o755)


@pytest.fixture
def deployment(tmp_path):
    root = tmp_path / 'game'
    stage = tmp_path / 'stage'
    runtime = tmp_path / 'runtime'
    commands = tmp_path / 'commands'
    for path in (root / 'venv/bin', stage, runtime / 'venv/bin', commands):
        path.mkdir(parents=True)
    (root / 'venv/bin/python3').symlink_to(sys.executable)
    (runtime / 'venv/bin/python').symlink_to(sys.executable)
    (root / 'server.py').write_text('# old backend\n')
    (root / 'photo_id.py').write_text('# old adapter\n')
    (root / '.photo-deployed-sha256').write_text('old marker\n')
    (stage / 'photo_id.py').write_text('# new adapter\n')
    (stage / 'photo_local.py').write_text(
        "POLICY = 'photo-local-v393'\nMODEL = 'bioclip25-birder-local'\nBUNDLE = 'photo-models-v407'\n")
    for name in ('proof', 'sound'):
        (stage / (name + '.py')).write_text(
            "import os,pathlib,sys\n"
            f"pathlib.Path(os.environ['CALLS']).open('a').write('{name}\\n')\n"
            "pathlib.Path(sys.argv[sys.argv.index('--output')+1]).write_text('{}')\n"
            f"sys.exit(1 if os.environ.get('FAIL_PROOF') == '{name}' else 0)\n")
    for name, identity in (('models', 'photo-models-v393'), ('models-v407', 'photo-models-v407')):
        bundle = runtime / name
        bundle.mkdir()
        (bundle / 'weights').write_bytes(name.encode())
        (bundle / 'manifest.json').write_text(json.dumps({'id': identity, 'sha256': {'weights': digest(bundle / 'weights')}}))
    unit = tmp_path / 'burbz-photo.service'
    old_unit = f'[Service]\nExecStart={runtime}/old_worker.py --models {runtime}/models\n'
    unit.write_text(old_unit)
    state = tmp_path / 'state.json'
    state.write_text(json.dumps({'active': True, 'enabled': True, 'loaded': {}}))
    calls = tmp_path / 'calls'
    calls.touch()
    env = dict(os.environ, PATH=str(commands) + os.pathsep + os.environ['PATH'],
               BURBZ_LOCAL_PHOTO_RUNTIME=str(runtime), BURBZ_PHOTO_UNIT_PATH=str(unit),
               BURBZ_PHOTO_SOCKET=str(tmp_path / 'worker.sock'),
               GAME=str(root), UNIT=str(unit), STATE=str(state), CALLS=str(calls))
    executable(commands / 'systemctl', f'#!{sys.executable}\n' + r'''
import hashlib,json,os,pathlib,re,sys
path=pathlib.Path(os.environ['STATE']); state=json.loads(path.read_text())
args=sys.argv[1:]
with pathlib.Path(os.environ['CALLS']).open('a') as stream: stream.write('systemctl '+' '.join(args)+'\n')
if args[0]=='show':
    print(os.environ['GAME'] if 'WorkingDirectory' in args else 'root');sys.exit(0)
if args[0]=='is-active': sys.exit(0 if state['active'] else 1)
if args[0]=='is-enabled': sys.exit(0 if state['enabled'] else 1)
if args[0] in ('restart','start') and args[1]=='burbz-photo':
    state['active']=True
    unit=pathlib.Path(os.environ['UNIT']).read_text()
    if '/releases/' in unit:
        worker=pathlib.Path(re.search(r'ExecStart=\S+ (\S+)',unit).group(1))
        bundle=pathlib.Path(re.search(r'--models (\S+)',unit).group(1))
        manifest=(bundle/'manifest.json').read_bytes()
        state['loaded']={'ready':True,'policy':'photo-local-v393','model':'bioclip25-birder-local',
            'sourceHash':hashlib.sha256(worker.read_bytes()).hexdigest(),
            'bundle':json.loads(manifest)['id'],'bundleHash':hashlib.sha256(manifest).hexdigest()}
        fault=os.environ.get('READINESS_FAULT')
        if fault: state['loaded'][fault]='stale'
    else: state['loaded']={'bundle':'photo-models-v393'}
if args[0]=='stop': state['active']=False
if args[0]=='disable': state['enabled']=False
if args[0]=='enable': state['enabled']=True
path.write_text(json.dumps(state))
''')
    executable(commands / 'curl', '#!/bin/sh\nprintf \'{"found":false,"message":"No camera image received."}\\n400\'\n')
    executable(commands / 'seq', '#!/bin/sh\necho 1\n')
    executable(commands / 'sleep', '#!/bin/sh\nexit 0\n')

    class Handler(socketserver.StreamRequestHandler):
        def handle(self):
            while self.rfile.readline().strip():
                pass
            body = json.dumps(json.loads(state.read_text())['loaded']).encode()
            self.wfile.write(b'HTTP/1.1 200 OK\r\nContent-Length: ' + str(len(body)).encode() + b'\r\n\r\n' + body)

    server = socketserver.UnixStreamServer(env['BURBZ_PHOTO_SOCKET'], Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    def run(**updates):
        return subprocess.run(
            ['bash', str(INSTALLER), str(root), str(stage / 'photo_id.py'), str(stage),
             str(stage / 'proof.py'), str(stage / 'sound.py')],
            env=env | updates, text=True, capture_output=True, timeout=20)

    yield dict(root=root, stage=stage, runtime=runtime, unit=unit, old_unit=old_unit,
               state=state, calls=calls, run=run)
    server.shutdown()
    server.server_close()
    thread.join(timeout=2)


@pytest.mark.parametrize('failure', ['proof', 'sound'])
def test_failed_http_proof_restores_prior_unit_adapter_and_bundle(deployment, failure):
    d = deployment
    before = {str(path): path.read_bytes() for path in d['runtime'].glob('models*/*')}
    result = d['run'](FAIL_PROOF=failure)
    assert result.returncode != 0, result.stdout + result.stderr
    assert 'prior module restored' in result.stderr
    assert d['unit'].read_text() == d['old_unit']
    assert (d['root'] / 'photo_id.py').read_text() == '# old adapter\n'
    assert (d['root'] / '.photo-deployed-sha256').read_text() == 'old marker\n'
    state = json.loads(d['state'].read_text())
    assert state['active'] and state['enabled'] and state['loaded']['bundle'] == 'photo-models-v393'
    assert before == {str(path): path.read_bytes() for path in d['runtime'].glob('models*/*')}
    assert 'proof\n' in d['calls'].read_text()
    assert ('sound\n' in d['calls'].read_text()) == (failure == 'sound')


def test_success_selects_immutable_bundle_and_skips_only_verified_loaded_identity(deployment):
    d = deployment
    result = d['run']()
    assert result.returncode == 0, result.stdout + result.stderr
    assert f"--models {d['runtime']}/models-v407" in d['unit'].read_text()
    assert (d['root'] / 'photo_id.py').read_bytes() == (d['stage'] / 'photo_id.py').read_bytes()
    marker = (d['root'] / '.photo-deployed-sha256').read_text().strip()
    assert marker.endswith(':photo-models-v407:' + digest(d['runtime'] / 'models-v407/manifest.json'))
    d['calls'].write_text('')
    assert d['run']().returncode == 0
    assert 'restart' not in d['calls'].read_text() and 'proof\n' not in d['calls'].read_text()


@pytest.mark.parametrize('active,enabled', [(False, False), (False, True), (True, False)])
def test_rollback_preserves_previous_worker_activity_and_enablement(deployment, active, enabled):
    d = deployment
    state = json.loads(d['state'].read_text())
    state.update(active=active, enabled=enabled)
    d['state'].write_text(json.dumps(state))
    result = d['run'](FAIL_PROOF='proof')
    assert result.returncode != 0
    restored = json.loads(d['state'].read_text())
    assert restored['active'] is active and restored['enabled'] is enabled
    assert d['unit'].read_text() == d['old_unit']


def test_first_install_failure_keeps_failed_files_for_review_and_worker_disabled(deployment):
    d = deployment
    d['unit'].rename(d['unit'].with_suffix('.original'))
    (d['root'] / 'photo_id.py').rename(d['root'] / 'photo_id.original')
    state = json.loads(d['state'].read_text())
    state.update(active=False, enabled=False)
    d['state'].write_text(json.dumps(state))
    result = d['run'](FAIL_PROOF='proof')
    assert result.returncode != 0
    assert not d['unit'].exists() and not (d['root'] / 'photo_id.py').exists()
    backups = list((d['root'] / '.photo-deploy-backups').iterdir())
    assert len(backups) == 1
    assert (backups[0] / 'failed-burbz-photo.service').is_file()
    assert (backups[0] / 'failed-photo_id.py').is_file()
    restored = json.loads(d['state'].read_text())
    assert not restored['active'] and not restored['enabled']


@pytest.mark.parametrize('key', ['sourceHash', 'model', 'bundle', 'bundleHash'])
def test_stale_loaded_worker_cannot_pass_noop_shortcut(deployment, key):
    d = deployment
    first = d['run']()
    assert first.returncode == 0, first.stdout + first.stderr
    state = json.loads(d['state'].read_text())
    state['loaded'][key] = 'old-value'
    d['state'].write_text(json.dumps(state))
    d['calls'].write_text('')
    result = d['run']()
    assert result.returncode == 0, result.stdout + result.stderr
    assert 'systemctl restart burbz-photo\n' in d['calls'].read_text()
    assert 'proof\n' in d['calls'].read_text() and 'sound\n' in d['calls'].read_text()


@pytest.mark.parametrize('key', ['bundle', 'bundleHash'])
def test_wrong_bundle_after_restart_rolls_back_before_adapter_copy(deployment, key):
    d = deployment
    result = d['run'](READINESS_FAULT=key)
    assert result.returncode != 0 and 'failed readiness' in result.stderr
    assert d['unit'].read_text() == d['old_unit']
    assert (d['root'] / 'photo_id.py').read_text() == '# old adapter\n'
    assert 'proof\n' not in d['calls'].read_text()


def test_mislabeled_bundle_fails_before_service_mutation(deployment):
    d = deployment
    manifest = d['runtime'] / 'models-v407/manifest.json'
    manifest.write_text(json.dumps({'id': 'photo-models-v393', 'sha256': {'weights': 'old'}}))
    result = d['run']()
    assert result.returncode != 0 and 'identity/checksums' in result.stderr
    assert d['unit'].read_text() == d['old_unit']
    assert 'restart' not in d['calls'].read_text()


def rejected(**updates):
    return dict(policy=proof.POLICY, model=proof.MODEL, found=False, accepted=False,
                verified=False, reason='uncertain-species',
                message='Species not confirmed. Try another view.') | updates


@pytest.mark.parametrize('reason', ['photo-unavailable', 'photo-timeout', 'photo-busy', 'invalid-worker-result', 'invalid-photo-evidence'])
def test_provider_failure_never_counts_as_negative_even_with_rejection_http_status(reason):
    assert not proof.passes_case('empty-scene', None, 422, rejected(reason=reason))
    assert not proof.passes_case('raven-flight', 'Corvus corax', 422, rejected(reason=reason))


@pytest.mark.parametrize('updates', [{'scientificName': 'Corvus corax'}, {'species': 'Raven'},
    {'allDetections': []}, {'verified': True}, {'model': 'bioclip2-birder-local'}])
def test_invalid_negative_body_never_passes(updates):
    assert not proof.passes_case('empty-scene', None, 422, rejected(**updates))


def test_only_flight_raven_may_abstain():
    assert proof.passes_case('raven-flight', 'Corvus corax', 422, rejected())
    for name, species in (proof.ORIGINAL_CASES | proof.EXTRA_CASES).items():
        if species and name != 'raven-flight':
            assert not proof.passes_case(name, species, 422, rejected())


@pytest.mark.parametrize('score', [True, .899, float('nan'), float('inf'), 1.01, '0.99'])
def test_invalid_positive_confidence_does_not_pass(score):
    accepted = dict(policy=proof.POLICY, model=proof.MODEL, found=True, accepted=True,
                    verified=True, scientificName='Larus argentatus', species='European herring gull', confidence=score)
    assert not proof.passes_case('herring-european-adult', 'Larus argentatus', 200, accepted)


def test_fixture_proof_requires_all_fourteen_and_credited_matching_pixels(tmp_path):
    original = tmp_path / 'photo-v350'
    extra = tmp_path / 'photo-v407'
    original.mkdir(); extra.mkdir()
    for name in proof.ORIGINAL_CASES:
        (original / (name + '.jpg')).write_bytes(b'original fixture')
    manifest = []
    for name, species in proof.EXTRA_CASES.items():
        path = extra / (name + '.jpg')
        path.write_bytes(b'new fixture')
        manifest.append(dict(name=name, expected=species, file=path.name, sha256=digest(path),
                             source='https://example.test/fixture', author='Test photographer',
                             license='CC0', transformation='RGB JPEG'))
    (extra / 'manifest.json').write_text(json.dumps(manifest))
    assert len(proof.fixture_cases(original)) == 14
    (extra / 'herring-european-adult.jpg').write_bytes(b'changed')
    with pytest.raises(ValueError, match='checksum mismatch'):
        proof.fixture_cases(original)


def test_http_transport_failure_is_recorded_as_failure(tmp_path, monkeypatch):
    image = tmp_path / 'empty.jpg'; image.write_bytes(b'fixture')
    output = tmp_path / 'proof.json'
    monkeypatch.setattr(proof, 'fixture_cases', lambda *_: [('empty-scene', image, None)])
    monkeypatch.setattr(sys, 'argv', ['verify-photo-id', '--fixtures', str(tmp_path), '--output', str(output)])
    def unavailable(*_args, **_kwargs):
        raise proof.requests.Timeout()
    monkeypatch.setattr(proof.requests, 'post', unavailable)
    assert proof.main() == 1
    rows = json.loads(output.read_text())
    assert rows[0]['passed'] is False and rows[0]['error'] == 'Timeout'
