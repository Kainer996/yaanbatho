"""Transactional Gemini promotion with fake services and a real Unix socket."""
import hashlib
import json
import os
from pathlib import Path
import pwd

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
    (stage / 'photo_gemini.py').write_text("POLICY = 'photo-gemini-v410'\nMODEL = 'gemini-2.5-flash'\n")
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
        state['loaded']={'ready':True,'policy':'photo-gemini-v410','model':'gemini-2.5-flash',
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


def test_http_proof_requires_gemini_model_and_persistent_receipt():
    result = dict(policy=proof.POLICY, model=proof.MODEL, modelName=proof.MODEL_NAME,
                  found=True, accepted=True, verified=True, confidence=.99,
                  species='Robin', scientificName='Erithacus rubecula', receiptId='a' * 64)
    assert proof.passes_gemini_case('robin-clear', 'Erithacus rubecula', 200, result)
    for update in ({'modelName':'other'}, {'receiptId':''}, {'receiptId':'A' * 64}, {'policy':'photo-local-v393'}):
        assert not proof.passes_gemini_case('robin-clear', 'Erithacus rubecula', 200, result | update)


def test_http_validation_owner_and_request_are_stable(tmp_path):
    path = tmp_path / 'bird.jpg'; path.write_bytes(b'fixture pixels')
    identity = proof.request_identity(path)
    assert identity == proof.request_identity(path)
    assert identity == 'v410_' + hashlib.sha256(path.read_bytes()).hexdigest()
    assert proof.VALIDATION_OWNER == 'deployment_v410_photos'
    assert len(proof.SMOKE_CASES) == 3
