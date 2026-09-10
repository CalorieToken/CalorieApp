#!/usr/bin/env python3
"""Build a repeatable Site Style ZIP and verify every packaged source byte."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SLUG = "calorietoken-site-style"
PLUGIN = ROOT / "wordpress-plugins" / SLUG
FILES = (
    'LEESMIJ.md',
    'LICENSE',
    'assets/app-information.css',
    'assets/app-information.js',
    'assets/app-integration.js',
    'assets/blog-timeline.js',
    'assets/calorieapp-logo.svg',
    'assets/content-data.json',
    'assets/content-language.js',
    'assets/discovery-data.json',
    'assets/discovery.css',
    'assets/discovery.js',
    'assets/display-language-runtime.js',
    'assets/fonts/OFL.txt',
    'assets/fonts/knewave-latin-400-normal.woff2',
    'assets/fonts/knewave-latin-ext-400-normal.woff2',
    'assets/help-data.json',
    'assets/help.js',
    'assets/menu-data.json',
    'assets/menu-pages.css',
    'assets/menu-pages.js',
    'assets/navigation.js',
    'assets/ready-languages.js',
    'assets/refinements.css',
    'assets/refinements.js',
    'assets/style.css',
    'assets/style.js',
    'assets/testnet-data.json',
    'assets/testnet.js',
    'assets/tokenomics.js',
    'calorietoken-site-style.php',
    'content/community.html',
    'content/privacy.html',
    'content/terms.html',
    'public-pages.php',
    'public-template.php',
    'review.php',
    'templates.php',
)
FIXED_TIME = (2021, 9, 16, 0, 0, 0)


def release_version(plugin: Path) -> str:
    source = (plugin / (SLUG + ".php")).read_text(encoding="utf-8")
    header = re.search(r"^\s*\* Version: (\d+\.\d+\.\d+)\s*$", source, re.M)
    constant = re.search(r"const VERSION = '(\d+\.\d+\.\d+)';", source)
    if not header or not constant or header[1] != constant[1]:
        raise ValueError("Plugin header and runtime version must match")
    version = header[1]
    notes = (plugin / "LEESMIJ.md").read_text(encoding="utf-8")
    if not notes.startswith("# CalorieToken Site Style " + version + "\n") or SLUG + "-" + version + ".zip" not in notes:
        raise ValueError("Installation notes must name the current release")
    return version


def build(output_dir: Path, plugin: Path = PLUGIN) -> dict:
    paths = list(plugin.rglob("*"))
    if plugin.is_symlink() or any(p.is_symlink() for p in paths):
        raise ValueError("Release paths cannot be symlinks")
    actual = {p.relative_to(plugin).as_posix() for p in paths if p.is_file()}
    if actual != set(FILES):
        raise ValueError("Release inventory changed; review missing/unexpected paths before packaging")
    version = release_version(plugin)
    output_dir.mkdir(parents=True, exist_ok=True)
    archive = output_dir / f"{SLUG}-{version}.zip"
    source = {name: (plugin / name).read_bytes() for name in FILES}
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name, data in source.items():
            entry = zipfile.ZipInfo(f"{SLUG}/{name}", FIXED_TIME)
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            z.writestr(entry, data)
    with zipfile.ZipFile(archive) as z:
        if z.testzip() or set(z.namelist()) != {f"{SLUG}/{name}" for name in source}:
            raise ValueError("Invalid release archive")
        for name, data in source.items():
            if z.read(f"{SLUG}/{name}") != data:
                raise ValueError("Packaged source mismatch: " + name)
    report = {"schema": "calorietoken.site-style-release.v1", "version": version,
        "archive": archive.name, "files": len(source), "bytes": archive.stat().st_size,
        "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "source_files": {name: hashlib.sha256(data).hexdigest() for name, data in source.items()}}
    (output_dir / f"{SLUG}-{version}.manifest.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    print(json.dumps(build(args.output_dir), indent=2))
