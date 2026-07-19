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
    parser.add_argument("--input", type=Path)
    parser.add_argument(
        "--repair",
        action="store_true",
        help="Rebuild generated statuses from optimised files already present in the workspace.",
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

    if not args.species or not args.input:
        raise SystemExit("--species and --input are required unless --repair is used")
    bird = next((item for item in manifest["birds"] if item["species"] == args.species), None)
    if bird is None:
        raise SystemExit(f"Species is not in the manifest: {args.species}")

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
    bird.update(metadata)
    temporary = MANIFEST_PATH.with_suffix(".json.next")
    temporary.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(MANIFEST_PATH)
    print(f"Ingested {args.species}: {output_path.relative_to(ROOT)} ({metadata['outputBytes']} bytes)")


if __name__ == "__main__":
    main()
