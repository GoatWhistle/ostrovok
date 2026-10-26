import argparse
import hashlib
import json
import os
import shutil
from pathlib import Path

CHUNK = 16 * 1024 * 1024


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        while block := handle.read(CHUNK):
            value.update(block)
    return value.hexdigest()


def place(source: Path, target: Path) -> None:
    if target.exists():
        return
    try:
        os.link(source, target)
    except OSError:
        shutil.copy2(source, target)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("--region", required=True)
    parser.add_argument("--bbox", required=True)
    parser.add_argument("--max-zoom", type=int, required=True)
    parser.add_argument("--build", required=True)
    parser.add_argument("--assets", type=Path, required=True)
    args = parser.parse_args()
    sha = digest(args.archive)
    name = f"{args.region}-basemap-{sha[:12]}.pmtiles"
    args.out.mkdir(parents=True, exist_ok=True)
    place(args.archive, args.out / name)
    for folder in ("fonts", "sprites"):
        if not (args.out / folder).exists():
            shutil.copytree(args.assets / folder, args.out / folder)
    shutil.copy2(args.assets / "DATA-LICENSE.md", args.out / "DATA-LICENSE.md")
    fonts = {
        stack.name: sorted(item.name for item in stack.iterdir())
        for stack in sorted((args.out / "fonts").iterdir())
        if stack.is_dir()
    }
    manifest = {
        "region_id": args.region,
        "version": f"basemap-{sha[:12]}",
        "bbox": [float(item) for item in args.bbox.split(",")],
        "min_zoom": 0,
        "max_zoom": args.max_zoom,
        "archive": name,
        "sha256": sha,
        "bytes": (args.out / name).stat().st_size,
        "glyphs": "fonts/{fontstack}/{range}.pbf",
        "font_ranges": fonts,
        "sprite": "sprites/black",
        "source": {"name": "Protomaps Basemap", "build": args.build},
        "licenses": {
            "data": "© OpenStreetMap contributors, ODbL; see DATA-LICENSE.md",
            "glyphs": "Noto Sans, SIL OFL 1.1; see fonts/Noto-LICENSE",
            "sprites": "protomaps/basemaps-assets, BSD-3-Clause; see sprites/LICENSE",
        },
    }
    text = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    (args.out / "manifest.json").write_text(text, encoding="utf-8")
    print(manifest["version"], manifest["bytes"])


if __name__ == "__main__":
    main()
