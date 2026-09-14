#!/usr/bin/env python3
"""Narrow, idempotent migration of the existing untracked camera route only."""
import argparse
import ast
from pathlib import Path

UPLOAD_DIRECTORY = '/run/burbz-photo-uploads'


def transform(source):
    tree = ast.parse(source)
    functions = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'identify_image']
    if len(functions) != 1:
        raise ValueError('Expected exactly one existing identify_image route')
    node = functions[0]
    lines = source.splitlines(keepends=True)
    route = ''.join(lines[node.lineno - 1:node.end_lineno])
    if route.count('tempfile.NamedTemporaryFile(') != 2:
        raise ValueError('Unexpected camera temporary-file lifecycle; manual review required')
    for suffix in ('.upload', '.jpg'):
        old = "tempfile.NamedTemporaryFile(suffix=" + repr(suffix) + ", delete=False)"
        new = "tempfile.NamedTemporaryFile(suffix=" + repr(suffix) + ", delete=False, dir=" + repr(UPLOAD_DIRECTORY) + ", prefix='capture-')"
        if route.count(old) == 1:
            route = route.replace(old, new, 1)
        elif route.count(new) != 1:
            raise ValueError('Unexpected camera temporary-file declaration')
    old = '            image.save(raw_tmp.name)\n            raw_tmp_path = raw_tmp.name'
    new = '            raw_tmp_path = raw_tmp.name\n            image.save(raw_tmp.name)'
    if route.count(old) == 1:
        route = route.replace(old, new, 1)
    elif route.count(new) != 1:
        raise ValueError('Unexpected camera upload ownership ordering')
    if 'for path in (raw_tmp_path, tmp_path):' not in route or 'os.unlink(path)' not in route:
        raise ValueError('Existing camera cleanup is missing')
    patched = ''.join(lines[:node.lineno - 1]) + route + ''.join(lines[node.end_lineno:])
    compile(patched, '<patched-camera-server>', 'exec')
    return patched


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source')
    parser.add_argument('output', nargs='?')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    source = Path(args.source).read_text()
    patched = transform(source)
    if args.check:
        return 0 if patched == source else 1
    if not args.output:
        parser.error('an output candidate is required unless --check is used')
    if Path(args.output).resolve() == Path(args.source).resolve():
        parser.error('write a candidate; never modify the live server in place')
    Path(args.output).write_text(patched)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
