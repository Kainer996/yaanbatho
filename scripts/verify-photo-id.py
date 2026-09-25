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

POLICY = 'photo-gemini-v487'
MODEL = 'gemini-vision'
MODEL_NAME = 'gemini-3.8-flash'
CONTRACT = 'merlin-v487'
VALIDATION_OWNER = 'deployment_v487_photos'
# Three attempts fit the shared caller rate limit. Every request has a stable
# owner/id and a fixed place and week, so another release proof replays the
# persistent result, never a new paid attempt. This smoke proof does not claim
# exhaustive model accuracy.
SMOKE_CASES = {'robin-clear', 'carrion-crow', 'empty-scene'}
# Both smoke birds are British. London in mid May keeps the geomodel context,
# and so the photo digest, identical on every run.
PROOF_PLACE = {'lat': '51.5', 'lon': '-0.1', 'photoWeek': '20'}
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
    'no-bird', 'no-species',
}
# v487 answers: a model reading with no live bird or no species.
NEGATIVE_REASONS = {'no-bird', 'no-species'}


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
                and math.isfinite(score) and .80 <= score <= 1)
    return (status == 422 and result.get('found') is False
            and result.get('accepted') is False and result.get('verified') is False
            and result.get('reason') in PHOTO_REJECTIONS
            and not any(key in result for key in ('species', 'scientificName', 'allDetections'))
            and isinstance(result.get('message'), str)
            and result['message'].startswith(('Bird not found.', 'Species not confirmed.', 'Bird detected, but species not confirmed.', 'No identifiable real bird')))


def _receipt(result):
    return isinstance(result.get('receiptId'), str) and re.fullmatch(r'[a-f0-9]{64}', result['receiptId']) is not None


def _candidates(result):
    rows = result.get('candidates')
    if not isinstance(rows, list) or not 1 <= len(rows) <= 5:
        return None
    for row in rows:
        score = row.get('score') if isinstance(row, dict) else None
        if (not isinstance(row, dict) or not isinstance(row.get('species'), str) or not row['species'].strip()
                or not isinstance(row.get('scientificName'), str)
                or not re.fullmatch(r'[A-Z][a-z]+ [a-z][a-z-]+', row['scientificName'])
                or not isinstance(score, (int, float)) or isinstance(score, bool)
                or not math.isfinite(score) or not 0 <= score <= 1):
            return None
    return rows


def passes_merlin_case(name, species, status, result):
    """v487: a ranked, receipted answer with the right bird where it must be.

    A clear robin must lead its ranking; a crow must be among the matches and
    never be confirmed as another species; an empty scene names no bird. A
    provider failure, a retryable answer or a malformed body never passes.
    """
    if (not isinstance(result, dict) or result.get('policy') != POLICY or result.get('model') != MODEL
            or result.get('modelName') != MODEL_NAME or result.get('retryable') is not False or not _receipt(result)):
        return False
    if species is None:
        return (status == 422 and result.get('found') is False and result.get('accepted') is False
                and result.get('verified') is False and result.get('reason') in NEGATIVE_REASONS
                and not result.get('candidates')
                and not any(key in result for key in ('species', 'scientificName', 'allDetections'))
                and isinstance(result.get('message'), str) and bool(result['message'].strip()))
    rows = _candidates(result)
    if rows is None:
        return False
    names = [row['scientificName'] for row in rows]
    lead = names[0] == species
    if status == 200:
        score = result.get('confidence')
        return (result.get('found') is True and result.get('accepted') is True and result.get('verified') is True
                and result.get('scientificName') == species and lead
                and isinstance(result.get('species'), str) and bool(result['species'].strip())
                and isinstance(score, (int, float)) and not isinstance(score, bool)
                and math.isfinite(score) and .80 <= score <= 1)
    return (status == 422 and result.get('found') is False and result.get('accepted') is False
            and result.get('verified') is False and result.get('reason') == 'pick-your-bird'
            and not any(key in result for key in ('species', 'scientificName'))
            and (lead if name == 'robin-clear' else species in names))


def request_identity(path):
    return 'v487_' + hashlib.sha256(Path(path).read_bytes()).hexdigest()


def post(origin, path, request_id):
    with path.open('rb') as stream:
        return requests.post(
            origin.rstrip('/') + '/api/identify/image',
            files={'image': ('photo.jpg', stream, 'image/jpeg')},
            data={'captureSource': 'camera', 'photoOwner': VALIDATION_OWNER,
                  'photoRequestId': request_id, 'photoContract': CONTRACT, **PROOF_PLACE}, timeout=50)


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
            request_id = request_identity(path)
            response = post(args.origin, path, request_id)
            result = response.json()
            # A stored transient failure would replay forever under this stable
            # id. Try once more under a second stable id, after the caller's
            # three-per-minute window has passed.
            if isinstance(result, dict) and result.get('retryable') is True:
                time.sleep(61)
                response = post(args.origin, path, request_id + '_r')
                result = response.json()
            row = {'fixture': name, 'status': response.status_code,
                   'passed': bool(passes_merlin_case(name, species, response.status_code, result)),
                   'expectedScientificName': species,
                   'placeUsed': result.get('placeUsed') if isinstance(result, dict) else None,
                   'result': result}
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
