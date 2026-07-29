"""Atomically insert the small, versioned server-integration bootstrap.

The previous installer appended a large hook after end-of-file. When
``server.py`` was launched directly, its blocking ``app.run()`` came first and
the hook was unreachable. It also assumed an aggregation helper absent from
the versioned production server. This patcher inspects the actual Flask sound
handler, selects its contract, and inserts the v4 bootstrap before the main
guard.
"""

from __future__ import annotations

import argparse
import ast
import os
import re
import stat
import tempfile
from pathlib import Path
from typing import Iterable, Tuple

from .server_integration import INTEGRATION_VERSION

BEGIN = "# BURBZ-BIRDNET-V3-BEGIN"
END = "# BURBZ-BIRDNET-V3-END"


class ServerPatchError(RuntimeError):
    """The target server cannot be patched without guessing."""


def _decorator_path(decorator) -> str | None:
    if not isinstance(decorator, ast.Call) or not decorator.args:
        return None
    first = decorator.args[0]
    return first.value if isinstance(first, ast.Constant) and isinstance(first.value, str) else None


def _called_names(node: ast.AST) -> set[str]:
    names = set()
    for child in ast.walk(node):
        if not isinstance(child, ast.Call):
            continue
        func = child.func
        if isinstance(func, ast.Name):
            names.add(func.id)
        elif isinstance(func, ast.Attribute):
            names.add(func.attr)
    return names


def detect_mode(source: str, filename: str = "<server.py>") -> str:
    """Return ``direct`` or ``aggregate`` from the actual sound route body."""
    try:
        tree = ast.parse(source, filename=filename)
    except SyntaxError as exc:
        raise ServerPatchError(f"{filename} does not parse: {exc}") from exc

    handlers = []
    for node in tree.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        paths = [_decorator_path(item) for item in node.decorator_list]
        if any(path and path.rstrip("/").endswith("/identify/sound") for path in paths):
            handlers.append(node)
    if len(handlers) != 1:
        raise ServerPatchError(
            f"expected exactly one /identify/sound handler, found {len(handlers)}"
        )

    calls = _called_names(handlers[0])
    if "_analyse_recording" not in calls:
        raise ServerPatchError(
            "the /identify/sound handler does not call _analyse_recording"
        )
    return "aggregate" if "_aggregate_sound_detections" in calls else "direct"


def _is_main_guard(node: ast.AST) -> bool:
    if not isinstance(node, ast.If) or not isinstance(node.test, ast.Compare):
        return False
    compare = node.test
    return (
        isinstance(compare.left, ast.Name)
        and compare.left.id == "__name__"
        and len(compare.ops) == 1
        and isinstance(compare.ops[0], ast.Eq)
        and len(compare.comparators) == 1
        and isinstance(compare.comparators[0], ast.Constant)
        and compare.comparators[0].value == "__main__"
    )


def _is_top_level_app_run(node: ast.AST) -> bool:
    if not isinstance(node, ast.Expr) or not isinstance(node.value, ast.Call):
        return False
    func = node.value.func
    return (
        isinstance(func, ast.Attribute)
        and func.attr == "run"
        and isinstance(func.value, ast.Name)
        and func.value.id == "app"
    )


def _contains_app_run(node: ast.AST) -> bool:
    for child in ast.walk(node):
        if not isinstance(child, ast.Call):
            continue
        func = child.func
        if (
            isinstance(func, ast.Attribute)
            and func.attr == "run"
            and isinstance(func.value, ast.Name)
            and func.value.id == "app"
        ):
            return True
    return False


def _required_definition_end(tree: ast.Module, mode: str) -> int:
    """Last line that must execute before the bootstrap can safely run."""
    required = {"_analyse_recording"}
    if mode == "aggregate":
        required.add("_aggregate_sound_detections")

    ends = {}
    app_line = None
    route_end = None
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name in required:
                ends[node.name] = int(getattr(node, "end_lineno", node.lineno))
            paths = [_decorator_path(item) for item in node.decorator_list]
            if any(path and path.rstrip("/").endswith("/identify/sound") for path in paths):
                route_end = int(getattr(node, "end_lineno", node.lineno))
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            if any(isinstance(target, ast.Name) and target.id == "app" for target in targets):
                app_line = int(getattr(node, "end_lineno", node.lineno))

    missing = sorted(required - set(ends))
    if missing:
        raise ServerPatchError(f"missing required top-level definition(s): {missing}")
    if app_line is None:
        raise ServerPatchError("the server has no top-level Flask app binding")
    if route_end is None:
        raise ServerPatchError("the sound route is not a top-level definition")
    return max(app_line, route_end, *ends.values())


def _strip_marked_blocks(lines: list[str]) -> list[str]:
    """Remove v4 blocks and known append-only v1-v3 blocks."""
    while True:
        start = next((i for i, line in enumerate(lines) if line.startswith(BEGIN)), None)
        if start is None:
            break
        end = next(
            (i for i in range(start + 1, len(lines)) if lines[i].startswith(END)),
            None,
        )
        if end is None:
            # Old blocks were documented as marker-to-EOF and were appended
            # after the main guard. If a hand-edited copy put one before the
            # guard, preserve the guard instead of truncating the real server.
            guard = next(
                (
                    i for i in range(start + 1, len(lines))
                    if re.match(r"^\s*if\s+__name__\s*==\s*['\"]__main__['\"]\s*:", lines[i])
                ),
                None,
            )
            end = (guard - 1) if guard is not None else (len(lines) - 1)
        del lines[start:end + 1]
        while start < len(lines) and not lines[start].strip():
            del lines[start]
        while start and not lines[start - 1].strip():
            del lines[start - 1]
            start -= 1
    return lines


def _strip_unmarked_legacy_block(lines: list[str]) -> list[str]:
    anchor = next(
        (i for i, line in enumerate(lines) if "import sound_id as _burbz_sound_id" in line),
        None,
    )
    if anchor is None:
        return lines
    banner_window = lines[max(0, anchor - 20):anchor]
    has_known_banner = any(
        "BirdNET V3" in line and "install-birdnet-v3.sh" in line
        for line in banner_window
    )
    has_earlier_main_guard = any(
        re.match(r"^\s*if\s+__name__\s*==\s*['\"]__main__['\"]\s*:", line)
        for line in lines[:anchor]
    )
    if not has_known_banner or not has_earlier_main_guard:
        raise ServerPatchError(
            "found _burbz_sound_id outside the known historical append-only "
            "installer block; refusing to delete unrelated server code"
        )
    start = anchor
    if start and lines[start - 1].strip() == "try:":
        start -= 1
    while start and lines[start - 1].lstrip().startswith("#"):
        start -= 1
    while start and not lines[start - 1].strip():
        start -= 1
    del lines[start:]
    return lines


def clean_source(source: str) -> str:
    lines = source.splitlines(keepends=True)
    lines = _strip_marked_blocks(lines)
    lines = _strip_unmarked_legacy_block(lines)
    cleaned = "".join(lines).rstrip() + "\n"
    return cleaned


def bootstrap(mode: str) -> str:
    return (
        f"\n\n{BEGIN} v{INTEGRATION_VERSION} mode={mode}\n"
        "# Inserted atomically by scripts/install-birdnet-v3.sh.\n"
        "# Failure is intentionally fatal: a server configured for V3 must not\n"
        "# boot while silently serving the legacy recogniser.\n"
        "from sound_id.server_integration import install as _burbz_install_sound_id\n"
        f"_burbz_install_sound_id(globals(), mode={mode!r})\n"
        f"{END} v{INTEGRATION_VERSION}\n"
    )


def patched_source(source: str, filename: str = "<server.py>") -> Tuple[str, str]:
    cleaned = clean_source(source)
    mode = detect_mode(cleaned, filename)
    tree = ast.parse(cleaned, filename=filename)

    required_end = _required_definition_end(tree, mode)
    insertion_line = len(cleaned.splitlines())
    selected = None
    for node in tree.body:
        if (
            (_is_main_guard(node) or _is_top_level_app_run(node))
            and node.lineno > required_end
        ):
            insertion_line = node.lineno - 1
            selected = node
            break

    # An app.run hidden in a nonstandard/incorrect guard before the insertion
    # point would block import or direct execution before V3 is installed.
    for node in tree.body:
        if node is selected:
            break
        if node.lineno - 1 >= insertion_line:
            break
        if _contains_app_run(node):
            raise ServerPatchError(
                f"app.run() at line {node.lineno} would execute before the "
                "BirdNET integration bootstrap"
            )

    lines = cleaned.splitlines(keepends=True)
    rendered = "".join(lines[:insertion_line]).rstrip()
    rendered += bootstrap(mode)
    tail = "".join(lines[insertion_line:]).lstrip("\r\n")
    if tail:
        rendered += "\n" + tail
    if not rendered.endswith("\n"):
        rendered += "\n"
    compile(rendered, filename, "exec")
    return rendered, mode


def patch_file(path: str | os.PathLike[str]) -> str:
    target = Path(path)
    if not target.is_file():
        raise ServerPatchError(f"{target} is not a file")
    original = target.read_text(encoding="utf-8")
    rendered, mode = patched_source(original, str(target))

    info = target.stat()
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            newline="",
            delete=False,
            dir=str(target.parent),
            prefix=f".{target.name}.birdnet-v3-",
            suffix=".tmp",
        ) as handle:
            handle.write(rendered)
            temporary = Path(handle.name)
        os.chmod(temporary, stat.S_IMODE(info.st_mode))
        if hasattr(os, "chown"):
            try:
                os.chown(temporary, info.st_uid, info.st_gid)
            except PermissionError:
                pass
        os.replace(temporary, target)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return mode


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("server_py")
    args = parser.parse_args(list(argv) if argv is not None else None)
    mode = patch_file(args.server_py)
    print(f"BirdNET V3 server integration v{INTEGRATION_VERSION}: {mode}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
