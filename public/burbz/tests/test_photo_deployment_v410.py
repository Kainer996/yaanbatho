"""Transactional Gemini promotion with fake services and a real Unix socket."""
import hashlib
import json
import os
from pathlib import Path
import pwd
import sys

import pytest

from test_photo_release_v407 import deployment, digest, proof
from test_photo_upload_lifecycle_v410 import ROUTE


@pytest.fixture
def gemini(deployment):
    d = deployment
    stage = d['stage']
    (d['root'] / 'server.py').write_text(ROUTE)
    d['original_server'] = ROUTE
    dropin = d['root'].parent / 'burbz.service.d/photo-uploads.conf'
    d['dropin'] = dropin
    (stage / 'photo_gemini.py').write_text("POLICY = 'photo-gemini-v486'\nMODEL = 'gemini-3.8-flash'\n")
    (stage / 'photo_budget.py').write_text('MONTH_LIMIT = 5000000000\n')
    state_dir = d['root'].parent / 'private-ledger'
    state_dir.mkdir(mode=0o700)
    ledger = state_dir / 'budget.sqlite'
    ledger.write_bytes(b'existing-paid-ledger-never-reset')
    ledger.chmod(0o600)
    env_file = state_dir / 'photo.env'
    env_file.write_text('GEMINI_API_KEY=fixture-not-a-real-key\n')
    env_file.chmod(0o600)
    systemctl = d['root'].parent / 'commands/systemctl'
    command = systemctl.read_text()
    command = command.replace("else 'root'", "else " + repr(pwd.getpwuid(os.getuid()).pw_name))
    command = command.replace("if args[0]=='show':", """if args[0]=='show' and 'RuntimeDirectoryMode' in args:
    print('0750');sys.exit(0)
if args[0]=='show' and 'RuntimeDirectory' in args:
    print('burbz-photo-uploads');sys.exit(0)
if args[0]=='show' and 'RuntimeDirectoryPreserve' in args:
    print('no');sys.exit(0)
if args[0]=='show' and 'PrivateNetwork' in args:
    print('yes' if os.environ.get('NETWORK_FAULT') else 'no');sys.exit(0)
if args[0]=='show' and 'RestrictAddressFamilies' in args:
    print('AF_UNIX AF_INET AF_INET6');sys.exit(0)
if args[0]=='show':""")
    command = command.replace("if '/releases/' in unit:", """if '/photo_gemini.py' in unit:
        worker=pathlib.Path(re.search(r'ExecStart=\\S+ (\\S+)',unit).group(1))
        state['loaded']={'ready':True,'policy':'photo-gemini-v486','model':'gemini-3.8-flash',
            'sourceHash':hashlib.sha256(worker.read_bytes()).hexdigest(),
            'budgetHash':hashlib.sha256((worker.parent/'photo_budget.py').read_bytes()).hexdigest()}
        fault=os.environ.get('READINESS_FAULT')
        if fault: state['loaded'][fault]='stale'
    elif '/releases/' in unit:""")
    systemctl.write_text(command)
    original_run = d['run']
    d.update(ledger=ledger, env_file=env_file)
    d['run'] = lambda **updates: original_run(BURBZ_PHOTO_LEDGER=str(ledger), BURBZ_PHOTO_ENV_FILE=str(env_file), BURBZ_PHOTO_UPLOAD_DROPIN=str(dropin), **updates)
    return d


@pytest.mark.parametrize('failure', ['proof', 'sound'])
def test_gemini_proof_failure_restores_exact_old_adapter_unit_and_paid_ledger(gemini, failure):
    d = gemini
    before = d['ledger'].read_bytes()
    result = d['run'](FAIL_PROOF=failure)
    assert result.returncode != 0, result.stdout + result.stderr
    assert 'prior module restored' in result.stderr
    assert d['ledger'].read_bytes() == before
    assert d['unit'].read_text() == d['old_unit']
    assert (d['root'] / 'photo_id.py').read_text() == '# old adapter\n'
    assert (d['root'] / 'server.py').read_text() == d['original_server']
    assert not d['dropin'].exists()
    assert (d['root'] / '.photo-deployed-sha256').read_text() == 'old marker\n'
    state = json.loads(d['state'].read_text())
    assert state['active'] and state['enabled'] and state['loaded']['bundle'] == 'photo-models-v393'


def test_gemini_promotion_is_lightweight_immutable_and_replay_safe(gemini):
    d = gemini
    result = d['run']()
    assert result.returncode == 0, result.stdout + result.stderr
    unit = d['unit'].read_text()
    assert 'photo_gemini.py --ledger ' + str(d['ledger']) in unit
    assert '--models' not in unit and 'PrivateNetwork=false' in unit
    assert 'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6' in unit
    assert 'EnvironmentFile=' + str(d['env_file']) in unit
    assert 'fixture-not-a-real-key' not in unit
    assert (d['root'] / '.photo-deployed-sha256').read_text().strip().endswith(':gemini:' + digest(d['stage'] / 'photo_budget.py'))
    assert d['ledger'].read_bytes() == b'existing-paid-ledger-never-reset'
    assert 'proof\n' in d['calls'].read_text() and 'sound\n' in d['calls'].read_text()
    assert (d['root'] / 'server.py').read_text().count("dir='/run/burbz-photo-uploads'") == 2
    assert 'RuntimeDirectoryPreserve=no' in d['dropin'].read_text()
    d['calls'].write_text('')
    assert d['run']().returncode == 0
    assert 'restart' not in d['calls'].read_text() and 'proof\n' not in d['calls'].read_text()
    (d['stage'] / 'photo_budget.py').write_text('MONTH_LIMIT = 5000000000\n# reviewed guard revision\n')
    assert d['run']().returncode == 0
    assert len(list((d['runtime'] / 'releases').glob('gemini-*'))) == 2
    assert 'proof\n' in d['calls'].read_text()


def test_existing_upload_dropin_restored_exactly_on_failed_proof(gemini):
    d = gemini
    d['dropin'].parent.mkdir()
    old = '[Service]\nRuntimeDirectory=prior-photo-uploads\nRuntimeDirectoryMode=0700\n'
    d['dropin'].write_text(old)
    result = d['run'](FAIL_PROOF='sound')
    assert result.returncode != 0
    assert d['dropin'].read_text() == old
    assert (d['root'] / 'server.py').read_text() == d['original_server']


@pytest.mark.parametrize('fault', ['sourceHash', 'budgetHash'])
def test_gemini_mismatched_loaded_code_rolls_back_before_http_proof(gemini, fault):
    d = gemini
    result = d['run'](READINESS_FAULT=fault)
    assert result.returncode != 0 and 'failed readiness' in result.stderr
    assert d['unit'].read_text() == d['old_unit']
    assert 'proof\n' not in d['calls'].read_text()


def test_gemini_effective_private_network_override_fails_before_paid_proof(gemini):
    d = gemini
    result = d['run'](NETWORK_FAULT='1')
    assert result.returncode != 0 and 'private-network sandbox' in result.stderr
    assert d['unit'].read_text() == d['old_unit']
    assert 'proof\n' not in d['calls'].read_text()


def test_gemini_missing_or_public_ledger_fails_before_service_mutation(gemini):
    d = gemini
    d['ledger'].chmod(0o644)
    assert d['run']().returncode != 0
    assert 'restart' not in d['calls'].read_text()
    d['ledger'].unlink()
    assert d['run']().returncode != 0
    assert not d['ledger'].exists() and 'restart' not in d['calls'].read_text()


def ranked(**updates):
    return dict(policy=proof.POLICY, model=proof.MODEL, modelName=proof.MODEL_NAME, retryable=False,
                found=True, accepted=True, verified=True, confidence=.97, placeUsed=True,
                species='European Robin', scientificName='Erithacus rubecula', receiptId='a' * 64,
                candidates=[{'species': 'European Robin', 'scientificName': 'Erithacus rubecula', 'score': .97,
                             'local': 'likely'},
                            {'species': 'Common Redstart', 'scientificName': 'Phoenicurus phoenicurus', 'score': .02}]) | updates


def pick(**updates):
    result = ranked(found=False, accepted=False, verified=False, reason='pick-your-bird',
                    message='Bird detected. Pick your bird from the matches.')
    for key in ('species', 'scientificName', 'confidence'):
        result.pop(key)
    return result | updates


def test_http_proof_requires_gemini_model_and_persistent_receipt():
    assert proof.passes_merlin_case('robin-clear', 'Erithacus rubecula', 200, ranked())
    for update in ({'modelName': 'other'}, {'receiptId': ''}, {'receiptId': 'A' * 64}, {'policy': 'photo-gemini-v425'},
                   {'retryable': True}, {'confidence': .79}, {'candidates': []},
                   {'candidates': [{'species': 'Robin', 'scientificName': 'bad name', 'score': .9}]}):
        assert not proof.passes_merlin_case('robin-clear', 'Erithacus rubecula', 200, ranked(**update))


def test_http_validation_owner_request_and_place_are_stable(tmp_path):
    path = tmp_path / 'bird.jpg'; path.write_bytes(b'fixture pixels')
    identity = proof.request_identity(path)
    assert identity == proof.request_identity(path)
    assert identity == 'v486_' + hashlib.sha256(path.read_bytes()).hexdigest()
    assert proof.VALIDATION_OWNER == 'deployment_v486_photos'
    assert proof.CONTRACT == 'merlin-v486'
    assert proof.PROOF_PLACE == {'lat': '51.5', 'lon': '-0.1', 'photoWeek': '20'}
    assert len(proof.SMOKE_CASES) == 3


def test_robin_must_lead_even_when_the_player_is_asked_to_pick():
    assert proof.passes_merlin_case('robin-clear', 'Erithacus rubecula', 422, pick())
    swapped = pick(candidates=list(reversed(pick()['candidates'])))
    assert not proof.passes_merlin_case('robin-clear', 'Erithacus rubecula', 422, swapped)
    assert not proof.passes_merlin_case('robin-clear', 'Erithacus rubecula', 422, pick(reason='no-species'))


def test_crow_may_be_a_match_but_never_a_wrong_confirmed_species():
    wrong = ranked(species='American Crow', scientificName='Corvus brachyrhynchos',
                   candidates=[{'species': 'American Crow', 'scientificName': 'Corvus brachyrhynchos', 'score': .95}])
    assert not proof.passes_merlin_case('carrion-crow', 'Corvus corone', 200, wrong)
    uncertain = pick(candidates=[{'species': 'Rook', 'scientificName': 'Corvus frugilegus', 'score': .5},
                                 {'species': 'Carrion Crow', 'scientificName': 'Corvus corone', 'score': .45}])
    assert proof.passes_merlin_case('carrion-crow', 'Corvus corone', 422, uncertain)
    for change in ({'modelName': 'other'}, {'receiptId': ''}, {'retryable': True},
                   {'candidates': [{'species': 'Rook', 'scientificName': 'Corvus frugilegus', 'score': .9}]},
                   {'reason': 'photo-provider-unavailable'}, {'species': 'Carrion Crow'}):
        assert not proof.passes_merlin_case('carrion-crow', 'Corvus corone', 422, uncertain | change)


def test_empty_scene_must_name_no_bird():
    empty = dict(policy=proof.POLICY, model=proof.MODEL, modelName=proof.MODEL_NAME, retryable=False,
                 found=False, accepted=False, verified=False, reason='no-bird', receiptId='e' * 64,
                 placeUsed=True, message='No identifiable real bird in this photo.')
    assert proof.passes_merlin_case('empty-scene', None, 422, empty)
    for change in ({'reason': 'pick-your-bird'}, {'candidates': [{'species': 'Wren'}]}, {'retryable': True},
                   {'reason': 'photo-provider-unavailable'}, {'receiptId': 'x'}):
        assert not proof.passes_merlin_case('empty-scene', None, 422, empty | change)
    assert not proof.passes_merlin_case('empty-scene', None, 200, empty)


def test_proof_posts_contract_and_fixed_place_and_retries_one_stored_failure(tmp_path, monkeypatch):
    image = tmp_path / 'robin.jpg'; image.write_bytes(b'fixture')
    posts = []

    class Response:
        def __init__(self, status, body):
            self.status_code, self.body = status, body

        def json(self):
            return self.body

    answers = [Response(200, dict(pick(), retryable=True, reason='photo-provider-unavailable')), Response(200, ranked())]

    def post(url, files, data, timeout):
        posts.append(dict(data))
        return answers.pop(0)
    monkeypatch.setattr(proof.requests, 'post', post)
    monkeypatch.setattr(proof.time, 'sleep', lambda seconds: posts.append({'slept': seconds}))
    monkeypatch.setattr(proof, 'fixture_cases', lambda *_: [('robin-clear', image, 'Erithacus rubecula')])
    monkeypatch.setattr(sys, 'argv', ['verify-photo-id', '--fixtures', str(tmp_path)])
    assert proof.main() == 0
    first, slept, second = posts
    assert first['photoContract'] == 'merlin-v486' and first['lat'] == '51.5' and first['photoWeek'] == '20'
    assert slept == {'slept': 61} and second['photoRequestId'] == first['photoRequestId'] + '_r'
