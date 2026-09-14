#!/usr/bin/env python3
"""Verify real HTTP photo outcomes; fixtures never enter client discovery state."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
import time

import requests

POLICY = 'photo-local-v393'
MODEL = 'bioclip25-birder-local'
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--origin', default='http://127.0.0.1:5055')
    parser.add_argument('--fixtures', required=True)
    parser.add_argument('--extra-fixtures')
    parser.add_argument('--output')
    args = parser.parse_args()
    rows = []
    for name, path, species in fixture_cases(args.fixtures, args.extra_fixtures):
        start = time.monotonic()
        try:
            with path.open('rb') as stream:
                response = requests.post(
                    args.origin.rstrip('/') + '/api/identify/image',
                    files={'image': ('photo.jpg', stream, 'image/jpeg')},
                    data={'captureSource': 'camera', 'lat': '51.5', 'lon': '-.1'}, timeout=50)
            result = response.json()
            row = {'fixture': name, 'status': response.status_code,
                   'passed': bool(passes_case(name, species, response.status_code, result)),
                   'result': result}
        except (requests.RequestException, ValueError) as exc:
            row = {'fixture': name, 'status': None, 'passed': False,
                   'error': type(exc).__name__}
        row['seconds'] = round(time.monotonic() - start, 2)
        rows.append(row)
        print(json.dumps(row), flush=True)
    if args.output:
        Path(args.output).write_text(json.dumps(rows, indent=2))
    return 0 if rows and all(row['passed'] for row in rows) else 1


if __name__ == '__main__':
    sys.exit(main())
