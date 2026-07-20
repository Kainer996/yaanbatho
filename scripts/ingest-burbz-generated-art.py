#!/usr/bin/env python3
"""Validate, optimise, and checkpoint one generated Burbz bird portrait."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "tmp" / "imagegen" / "burbz-placeholder-manifest.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--species")
    parser.add_argument("--target-relative-path")
    parser.add_argument("--input", type=Path)
    parser.add_argument(
        "--repair",
        action="store_true",
        help="Rebuild generated statuses from optimised files already present in the workspace.",
    )
    parser.add_argument(
        "--defer-manifest",
        action="store_true",
        help="Write and validate the WebP without updating the shared manifest.",
    )
    return parser.parse_args()


def output_metadata(output_path: Path) -> dict[str, object]:
    with Image.open(output_path) as check:
        check.load()
        if check.size != (896, 896) or check.format != "WEBP":
            raise SystemExit(f"Optimised output failed validation: {check.format} {check.size}")
    payload = output_path.read_bytes()
    return {
        "status": "generated",
        "generatedAt": datetime.fromtimestamp(
            output_path.stat().st_mtime, timezone.utc
        ).isoformat(),
        "outputWidth": 896,
        "outputHeight": 896,
        "outputBytes": len(payload),
        "outputSha256": hashlib.sha256(payload).hexdigest(),
    }


def main() -> None:
    args = parse_args()
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if args.repair:
        repaired = 0
        for item in manifest["birds"]:
            output_path = ROOT / item["targetRelativePath"]
            if not output_path.is_file():
                continue
            item.update(output_metadata(output_path))
            repaired += 1
        temporary = MANIFEST_PATH.with_suffix(".json.next")
        temporary.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        temporary.replace(MANIFEST_PATH)
        print(f"Repaired {repaired} generated manifest entries")
        return

    if (not args.species and not args.target_relative_path) or not args.input:
        raise SystemExit(
            "--input and either --species or --target-relative-path are required unless --repair is used"
        )
    bird = next(
        (
            item
            for item in manifest["birds"]
            if (
                args.target_relative_path
                and item["targetRelativePath"] == args.target_relative_path
            )
            or (not args.target_relative_path and item["species"] == args.species)
        ),
        None,
    )
    if bird is None:
        identity = args.target_relative_path or args.species
        raise SystemExit(f"Bird is not in the manifest: {identity}")
    species = bird["species"]

    input_path = args.input.resolve()
    if not input_path.is_file():
        raise SystemExit(f"Generated image does not exist: {input_path}")

    with Image.open(input_path) as source:
        source.load()
        if source.width < 768 or source.height < 768:
            raise SystemExit(f"Generated image is too small: {source.width}x{source.height}")
        if abs(source.width - source.height) > max(source.width, source.height) * 0.02:
            raise SystemExit(f"Generated image is not square: {source.width}x{source.height}")
        image = source.convert("RGB")
        if image.size != (896, 896):
            image = image.resize((896, 896), Image.Resampling.LANCZOS)

    output_path = ROOT / bird["targetRelativePath"]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, format="WEBP", quality=86, method=6)

    metadata = output_metadata(output_path)
    metadata["generatedSource"] = str(input_path).replace("\\", "/")
    metadata["generatedAt"] = datetime.now(timezone.utc).isoformat()
    if args.defer_manifest:
        print(
            f"Ingested {species} with deferred manifest update: "
            f"{output_path.relative_to(ROOT)} ({metadata['outputBytes']} bytes)"
        )
        return
    bird.update(metadata)
    temporary = MANIFEST_PATH.with_suffix(".json.next")
    temporary.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(MANIFEST_PATH)
    print(f"Ingested {species}: {output_path.relative_to(ROOT)} ({metadata['outputBytes']} bytes)")


if __name__ == "__main__":
    main()
