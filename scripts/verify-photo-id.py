#!/usr/bin/env python3
"""Verify real HTTP photo outcomes; fixtures never enter client discovery state."""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path
import sys
import time

import requests

POLICY = 'photo-gemini-v410'
MODEL = 'gemini-vision'
MODEL_NAME = 'gemini-2.5-flash'
VALIDATION_OWNER = 'deployment_v410_photos'
# Three attempts fit the shared caller rate limit. Every request has a stable
# owner/id, so another release proof replays the persistent result, never a new
# paid attempt. This smoke proof does not claim exhaustive model accuracy.
SMOKE_CASES = {'robin-clear', 'carrion-crow', 'empty-scene'}
ORIGINAL_CASES = {
    'robin-clear': 'Erithacus rubecula', 'great-tit-clear': 'Parus major',
    'raven-perched': 'Corvus corax', 'carrion-crow': 'Corvus corone',
    'raven-flight': 'Corvus corax', 'distant-blob': None,
    'blurred-bird': None, 'empty-scene': None, 'nonbird-shapes': None,
}
EXTRA_CASES = {
    'herring-european-adult': 'Larus argentatus',
    'herring-european-winter': 'Larus argentatus',
    'herring-american-maine': 'Larus smithsonianus',
    'herring-american-california': 'Larus smithsonianus',
    'illustrated-crow': None,
}
# A failed provider, malformed response or timeout is never a good negative.
PHOTO_REJECTIONS = {
    'no-clear-bird', 'multiple-birds', 'subject-too-small-or-indistinct',
    'views-disagree', 'unresolved-taxonomy', 'models-disagree',
    'uncertain-species', 'illustrated-bird',
    'insufficient-evidence', 'low-confidence', 'ambiguous-species',
    'unclear-subject', 'missing-diagnostic-details', 'verification-disagrees',
}


def fixture_cases(fixtures, extra_fixtures=None):
    fixtures = Path(fixtures)
    extra = Path(extra_fixtures) if extra_fixtures else fixtures.parent / 'photo-v407'
    cases = [(name, fixtures / (name + '.jpg'), species)
             for name, species in ORIGINAL_CASES.items()]
    records = json.loads((extra / 'manifest.json').read_text())
    if not isinstance(records, list):
        raise ValueError('Camera fixture manifest must be a list')
    manifest = {record['name']: record for record in records}
    if len(manifest) != len(records):
        raise ValueError('Duplicate camera fixture names')
    for name, species in EXTRA_CASES.items():
        record = manifest[name]
        path = extra / (name + '.jpg')
        if (record.get('file') != path.name or record.get('expected') != species
                or not all(record.get(key) for key in ('source', 'author', 'license', 'transformation'))):
            raise ValueError('Camera fixture identity/credit mismatch: ' + name)
        if hashlib.sha256(path.read_bytes()).hexdigest() != record.get('sha256'):
            raise ValueError('Camera fixture checksum mismatch: ' + name)
        cases.append((name, path, species))
    # Fail before making any requests if staging omitted even an original file.
    for _, path, _ in cases:
        if not path.is_file():
            raise ValueError('Camera fixture is missing: ' + str(path))
    return cases


def passes_case(name, species, status, result):
    if (not isinstance(result, dict) or result.get('policy') != POLICY
            or result.get('model') != MODEL):
        return False
    if species and not (name == 'raven-flight' and result.get('found') is False):
        score = result.get('confidence')
        return (status == 200 and result.get('accepted') is True
                and result.get('verified') is True and result.get('found') is True
                and result.get('scientificName') == species
                and isinstance(result.get('species'), str) and bool(result['species'].strip())
                and isinstance(score, (int, float)) and not isinstance(score, bool)
                and math.isfinite(score) and .90 <= score <= 1)
    return (status == 422 and result.get('found') is False
            and result.get('accepted') is False and result.get('verified') is False
            and result.get('reason') in PHOTO_REJECTIONS
            and not any(key in result for key in ('species', 'scientificName', 'allDetections'))
            and isinstance(result.get('message'), str)
            and result['message'].startswith(('Bird not found.', 'Species not confirmed.', 'Bird detected, but species not confirmed.')))


def passes_gemini_case(name, species, status, result):
    if not passes_case(name, species, status, result) or result.get('modelName') != MODEL_NAME:
        return False
    return (not result.get('accepted') or
            isinstance(result.get('receiptId'), str) and
            re.fullmatch(r'[a-f0-9]{64}', result['receiptId']) is not None)


def passes_authorized_release_case(name, species, status, result):
    if passes_gemini_case(name, species, status, result):
        return True
    # 2026-09-14: after disclosure, the user explicitly chose to install
    # Gemini despite its American/Carrion Crow mismatch. Only that accuracy
    # assertion is nonblocking. Keep expected identity and failed accuracy in
    # the evidence; provider, receipt, policy and confidence checks still apply.
    if name != 'carrion-crow' or not isinstance(result, dict):
        return False
    score = result.get('confidence')
    return (status == 200 and result.get('found') is True
            and result.get('accepted') is True and result.get('verified') is True
            and result.get('policy') == POLICY and result.get('model') == MODEL
            and result.get('modelName') == MODEL_NAME
            and isinstance(score, (int, float)) and not isinstance(score, bool)
            and math.isfinite(score) and .90 <= score <= 1
            and isinstance(result.get('species'), str) and bool(result['species'].strip())
            and result.get('scientificName') == 'Corvus brachyrhynchos'
            and isinstance(result.get('receiptId'), str)
            and re.fullmatch(r'[a-f0-9]{64}', result['receiptId']) is not None)


def request_identity(path):
    return 'v410_' + hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--origin', default='http://127.0.0.1:5055')
    parser.add_argument('--fixtures', required=True)
    parser.add_argument('--extra-fixtures')
    parser.add_argument('--output')
    args = parser.parse_args()
    rows = []
    for name, path, species in fixture_cases(args.fixtures, args.extra_fixtures):
        if name not in SMOKE_CASES:
            continue
        start = time.monotonic()
        try:
            with path.open('rb') as stream:
                response = requests.post(
                    args.origin.rstrip('/') + '/api/identify/image',
                    files={'image': ('photo.jpg', stream, 'image/jpeg')},
                    data={'captureSource': 'camera', 'photoOwner': VALIDATION_OWNER,
                          'photoRequestId': request_identity(path)}, timeout=50)
            result = response.json()
            row = {'fixture': name, 'status': response.status_code,
                   'passed': bool(passes_authorized_release_case(name, species, response.status_code, result)),
                   'accuracyPassed': bool(passes_gemini_case(name, species, response.status_code, result)),
                   'expectedScientificName': species,
                   'result': result}
            if row['passed'] and not row['accuracyPassed']:
                row['knownLimitation'] = 'User explicitly accepted the disclosed American/Carrion Crow accuracy mismatch for this release.'
        except (requests.RequestException, ValueError) as exc:
            row = {'fixture': name, 'status': None, 'passed': False,
                   'error': type(exc).__name__}
        row['seconds'] = round(time.monotonic() - start, 2)
        rows.append(row)
        print(json.dumps(row), flush=True)
        # Do not spend on further fixtures after a service/configuration error
        # or mismatch. Failed/unknown attempts keep the same stable identifier.
        if not row['passed']:
            break
    if args.output:
        Path(args.output).write_text(json.dumps(rows, indent=2))
    return 0 if rows and all(row['passed'] for row in rows) else 1


if __name__ == '__main__':
    sys.exit(main())
