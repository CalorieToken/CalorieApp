#!/usr/bin/env python3
"""Build and byte-verify the reversible Heading Repair companion ZIP."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SLUG = "calorietoken-heading-repair"
PLUGIN = ROOT / "wordpress-plugins" / SLUG
FILES = (
    "README.txt",
    "assets/app-focus.css",
    "assets/app-focus.js",
    "assets/heading-repair.css",
    "assets/help-label-bootstrap.js",
    "assets/help-link-labels.json",
    "assets/help-topic-additions.json",
    "assets/help.js",
    "assets/nutrition-summary.js",
    "assets/presentation.js",
    "calorietoken-heading-repair.php",
    "index.php",
)
FIXED_TIME = (2021, 9, 16, 0, 0, 0)


def release_version(plugin: Path) -> str:
    source = (plugin / f"{SLUG}.php").read_text(encoding="utf-8")
    header = re.search(r"^\s*\* Version: (\d+\.\d+\.\d+)\s*$", source, re.M)
    constant = re.search(r"const VERSION = '(\d+\.\d+\.\d+)';", source)
    if not header or not constant or header[1] != constant[1]:
        raise ValueError("Plugin header and runtime version must match")
    version = header[1]
    notes = (plugin / "README.txt").read_text(encoding="utf-8")
    if not notes.startswith(f"CalorieToken Heading and Language Repair {version}\n"):
        raise ValueError("README must name the current release")
    return version


def build(output_dir: Path, plugin: Path = PLUGIN) -> dict:
    paths = list(plugin.rglob("*"))
    if plugin.is_symlink() or any(path.is_symlink() for path in paths):
        raise ValueError("Release paths cannot be symlinks")
    actual = {path.relative_to(plugin).as_posix() for path in paths if path.is_file()}
    if actual != set(FILES):
        raise ValueError("Release inventory changed; review missing/unexpected paths before packaging")

    version = release_version(plugin)
    output_dir.mkdir(parents=True, exist_ok=True)
    archive = output_dir / f"{SLUG}-{version}.zip"
    source = {name: (plugin / name).read_bytes() for name in FILES}
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as target:
        for name, data in source.items():
            entry = zipfile.ZipInfo(f"{SLUG}/{name}", FIXED_TIME)
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            target.writestr(entry, data)

    with zipfile.ZipFile(archive) as packaged:
        expected = {f"{SLUG}/{name}" for name in source}
        if packaged.testzip() or set(packaged.namelist()) != expected:
            raise ValueError("Invalid release archive")
        for name, data in source.items():
            if packaged.read(f"{SLUG}/{name}") != data:
                raise ValueError(f"Packaged source mismatch: {name}")

    report = {
        "schema": "calorietoken.heading-repair-release.v1",
        "version": version,
        "archive": archive.name,
        "files": len(source),
        "bytes": archive.stat().st_size,
        "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "source_files": {
            name: hashlib.sha256(data).hexdigest() for name, data in source.items()
        },
    }
    manifest = output_dir / f"{SLUG}-{version}.manifest.json"
    manifest.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "dist")
    arguments = parser.parse_args()
    print(json.dumps(build(arguments.output_dir), indent=2))
