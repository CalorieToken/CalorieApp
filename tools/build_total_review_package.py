#!/usr/bin/env python3
"""Build the total step 1-5 review without changing or authorizing R3 content."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
import zipfile
from pathlib import Path
from typing import Any


PACKAGE_NAME = "CalorieToken_Totaalreview_2026-09-16"
FIXED_TIME = (2026, 9, 16, 0, 0, 0)
UPLOAD_FILE_LIMIT = 512 * 1024 * 1024
UPLOAD_PART_TARGET = 160 * 1024 * 1024
MEDIA_SUFFIXES = {".mp4", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".vtt", ".srt"}
SOURCE_EXCLUDED_PARTS = {
    "node_modules", ".next", "dist", "__pycache__", ".pytest_cache",
    ".venv", "ux-check-evidence", ".git",
}
SOURCE_EXCLUDED_NAMES = {"tsconfig.tsbuildinfo"}
SOURCE_EXCLUDED_SUFFIXES = {".pyc", ".db", ".sqlite", ".sqlite3"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def review_data(review_html: Path) -> dict[str, Any]:
    source = review_html.read_text(encoding="utf-8")
    match = re.search(
        r'<script id="review-data" type="application/json">(.*?)</script>',
        source,
        re.S,
    )
    if not match:
        raise ValueError("R3 review-data payload is missing")
    data = json.loads(match.group(1))
    if len(data.get("items", [])) != 97 or len(data.get("readiness", [])) != 97:
        raise ValueError("R3 proposal/readiness inventory is not exactly 97")
    return data


def referenced_files(data: Any) -> list[Path]:
    values: set[Path] = set()

    def visit(value: Any) -> None:
        if isinstance(value, str) and Path(value).suffix.lower() in MEDIA_SUFFIXES:
            candidate = Path(value)
            if candidate.is_absolute() or ".." in candidate.parts:
                raise ValueError(f"Unsafe review path: {value}")
            values.add(candidate)
        elif isinstance(value, dict):
            for nested in value.values():
                visit(nested)
        elif isinstance(value, list):
            for nested in value:
                visit(nested)

    visit(data)
    return sorted(values, key=lambda path: path.as_posix())


def copy_file(source: Path, target: Path) -> None:
    if not source.is_file() or source.is_symlink():
        raise ValueError(f"Required regular file is missing: {source}")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def source_inventory(source_root: Path) -> list[Path]:
    files = []
    for path in source_root.rglob("*"):
        relative = path.relative_to(source_root)
        if any(part in SOURCE_EXCLUDED_PARTS for part in relative.parts):
            continue
        if path.is_symlink():
            raise ValueError(f"Unexpected source symlink: {relative}")
        if (
            path.is_file()
            and path.name not in SOURCE_EXCLUDED_NAMES
            and path.suffix.lower() not in SOURCE_EXCLUDED_SUFFIXES
        ):
            files.append(relative)
    return sorted(files, key=lambda path: path.as_posix())


def write_zip(archive: Path, entries: list[tuple[Path, str]]) -> None:
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9, allowZip64=True) as target:
        for source, name in entries:
            info = zipfile.ZipInfo(name, FIXED_TIME)
            info.external_attr = 0o100644 << 16
            # PNG/GIF still compress materially inside this review set; MP4/JPEG/WebP/ZIP
            # are already compressed and are stored to keep the build fast and stable.
            info.compress_type = zipfile.ZIP_STORED if source.suffix.lower() in {
                ".mp4", ".jpg", ".jpeg", ".webp", ".zip"
            } else zipfile.ZIP_DEFLATED
            with source.open("rb") as stream, target.open(info, "w", force_zip64=True) as output:
                shutil.copyfileobj(stream, output, 1024 * 1024)
    with zipfile.ZipFile(archive) as result:
        if result.testzip() is not None or len(result.namelist()) != len(entries):
            raise ValueError(f"Invalid ZIP: {archive}")


def build_source_zip(source_root: Path, destination: Path) -> dict[str, Any]:
    inventory = source_inventory(source_root)
    entries = [(source_root / relative, f"CalorieApp-candidate/{relative.as_posix()}") for relative in inventory]
    write_zip(destination, entries)
    return {
        "archive": destination.name,
        "files": len(inventory),
        "bytes": destination.stat().st_size,
        "sha256": sha256(destination),
        "excluded": sorted(
            SOURCE_EXCLUDED_PARTS
            | SOURCE_EXCLUDED_NAMES
            | {f"*{suffix}" for suffix in SOURCE_EXCLUDED_SUFFIXES}
        ),
    }


def start_html(copy: dict[str, Any], source_report: dict[str, Any], plugin_hash: str) -> str:
    locale_options = [
        ("en", "English"), ("nl", "Nederlands"), ("zh-Hans", "简体中文"),
        ("hi", "हिन्दी"), ("es", "Español"), ("ar", "العربية"),
        ("fr", "Français"), ("bn", "বাংলা"), ("pt", "Português"),
        ("id", "Bahasa Indonesia"), ("ur", "اردو"),
    ]
    options = "".join(
        f'<option value="{html.escape(tag)}"{" selected" if tag == "nl" else ""}>{html.escape(label)}</option>'
        for tag, label in locale_options
    )
    translations = json.dumps(copy, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return f"""<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CalorieToken totaalreview 16 september 2026</title>
<style>
:root{{--blue:#505ba9;--green:#008d36;--gold:#f9b233;--ink:#303449;--paper:#fff;--soft:#f5f6fb;--edge:#dcdfea}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--soft);color:var(--ink);font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}}
a{{color:#333e8c;text-underline-offset:4px}}header{{background:#fff url('assets/wp-bron/achtergrondbannersitea1.png') center/cover;border-bottom:5px solid var(--gold)}}
.brand,.wrap{{width:min(1180px,calc(100% - 32px));margin:auto}}.brand{{display:flex;align-items:center;gap:22px;padding:28px 0}}.brand img{{width:86px}}h1{{margin:0;font-size:clamp(1.8rem,5vw,3.1rem);line-height:1.1}}h2{{line-height:1.25}}.tag{{margin:0;color:#384f41;font-weight:800;text-transform:uppercase;letter-spacing:.06em;font-size:.78rem}}
.wrap{{padding:24px 0 42px}}.notice,.card{{background:#fff;border:1px solid var(--edge);border-radius:18px;padding:20px;margin:0 0 18px;box-shadow:0 5px 18px #3034490b}}.notice{{border-inline-start:6px solid var(--gold)}}
.status{{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}}.pill{{border-radius:999px;padding:5px 11px;background:#edf6ee;color:#174323;font-size:.82rem;font-weight:800}}.pill.wait{{background:#fff4d8;color:#654300}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:16px}}.step{{border-top:5px solid var(--blue)}}.step strong{{color:var(--green)}}
.actions{{display:flex;flex-wrap:wrap;gap:10px}}.button{{display:inline-flex;align-items:center;min-height:46px;padding:10px 16px;border-radius:999px;background:var(--blue);color:#fff;font-weight:800;text-decoration:none}}.button.alt{{background:#fff;color:var(--blue);border:2px solid var(--blue)}}
label{{font-weight:800}}select{{min-height:44px;margin-inline-start:8px;border:1px solid #9ea8c4;border-radius:10px;padding:7px 11px;background:#fff;font:inherit}}.preview{{display:grid;grid-template-columns:minmax(0,1fr) minmax(250px,.8fr);gap:20px;align-items:start}}
.sources,.grades{{display:grid;gap:8px;margin:12px 0}}.sources{{grid-template-columns:repeat(3,minmax(0,1fr))}}.source,.grade{{min-width:0;border:1px solid var(--edge);border-radius:12px;padding:10px;background:#fff;text-align:center}}.source b,.grade b{{display:block;font-size:1.35rem}}.source span{{font-size:.78rem;overflow-wrap:anywhere}}.grades{{grid-template-columns:repeat(5,minmax(0,1fr))}}.grade{{padding:7px 4px;color:#14220f;font-weight:900}}.grade.a{{background:#038141;color:#fff}}.grade.b{{background:#85bb2f}}.grade.c{{background:#fecb02}}.grade.d{{background:#ee8100}}.grade.e{{background:#e63e11;color:#fff}}
.fallbacks{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}}figure{{margin:0;min-width:0}}figure img{{display:block;width:100%;aspect-ratio:1;object-fit:cover;border:1px solid var(--edge);border-radius:14px}}figcaption{{margin-top:6px;font-size:.78rem;text-align:center}}table{{width:100%;border-collapse:collapse}}th,td{{padding:9px;border-bottom:1px solid var(--edge);text-align:start;vertical-align:top}}code{{font-size:.84em;overflow-wrap:anywhere}}.muted{{color:#5c6477;font-size:.9rem}}.rtl{{direction:rtl}}
@media(max-width:720px){{.brand,.wrap{{width:min(100% - 20px,1180px)}}.brand{{padding:20px 0}}.brand img{{width:60px}}.preview{{grid-template-columns:1fr}}.sources{{grid-template-columns:1fr}}.source{{display:flex;justify-content:space-between;align-items:center;text-align:start}}.fallbacks{{grid-template-columns:repeat(3,minmax(0,1fr))}}.card,.notice{{padding:16px}}}}
</style></head><body>
<header><div class="brand"><img src="assets/wp-bron/C-Logotranspa.png" alt="CalorieToken-logo"><div><p class="tag">Totale werkreview · 16 september 2026</p><h1>Stap 1–5 bij elkaar</h1><p>Aiming to be the world's food token.</p></div></div></header>
<main class="wrap">
<section class="notice"><h2>Uitkomst</h2><p><strong>De lokale kandidaat en de complete review zijn afgerond; productie is bewust niet gewijzigd.</strong> Stap 1 en 2 bevatten alle eerdere wensen plus alternatief beeld en de correcte OFF/USDA-indeling. Stap 3–5 zijn daarop aangesloten. Externe upload, CI, deployment en publicatie blijven achter één totale GO.</p><div class="status"><span class="pill">303/303 Node</span><span class="pill">TypeScript + productie-build geslaagd</span><span class="pill">97 voorstellen behouden</span><span class="pill wait">Niet live · geen publicatie-goedkeuring</span></div><div class="actions"><a class="button" href="VOLLEDIGE_REVIEW_R3.html">Open de volledige 97-itemsreview</a><a class="button alt" href="candidate/TOTAL-CANDIDATE-STATUS-2026-09-16.md">Lees exacte kandidaatstatus</a><a class="button alt" href="candidate/calorietoken-heading-repair-1.3.0.zip">Plugin 1.3.0</a></div></section>

<section class="grid">
<article class="card step"><strong>Stap 1 · afgeronde kandidaat</strong><h2>App en dagboek</h2><p>OFF-producten, USDA-basisvoeding, porties, periodeoverzicht, logoutveiligheid, alternatief beeld en één correcte bron-/scoreweergave.</p></article>
<article class="card step"><strong>Stap 2 · afgeronde kandidaat</strong><h2>Xaman en WordPress</h2><p>Minimale geaggregeerde weergave in de bestaande kaart, buiten het iframe; geen individuele voedings- of accountgegevens.</p></article>
<article class="card step"><strong>Stap 3 · aangesloten</strong><h2>Website en Help</h2><p>Bestaande CalorieHelp en vormgeving blijven staan; elf talen krijgen dezelfde uitleg over bron, foto en score.</p></article>
<article class="card step"><strong>Stap 4 · compleet bewaard</strong><h2>Contentreview</h2><p>97 voorstellen en 214 gebruikte media-/ondertitelpaden. 38 zonder en 59 met open controles; niets automatisch ingehaald.</p></article>
<article class="card step"><strong>Stap 5 · gereed voor besluit</strong><h2>Release en rollback</h2><p>Bronkandidaat, deterministische plugin, tests, CI-poorten, uitrolvolgorde en rollback liggen vast. Eén totale GO ontbreekt nog.</p></article>
</section>

<section class="card preview" id="preview"><div><h2 data-key="sourcesTitle"></h2><p data-key="sourceScope"></p><label for="lang">Voorbeeldtaal</label><select id="lang">{options}</select><div class="sources"><div class="source"><span data-source="openFoodFacts"></span><b>5</b></div><div class="source"><span data-source="usda"></span><b>1</b></div><div class="source"><span data-source="other"></span><b>1</b></div></div><p class="muted" data-key="totalsNote"></p><h3 data-key="gradeHeading"></h3><p data-key="gradeScope"></p><div class="grades" dir="ltr"><div class="grade a">A<b>2</b></div><div class="grade b">B<b>1</b></div><div class="grade c">C<b>0</b></div><div class="grade d">D<b>0</b></div><div class="grade e">E<b>1</b></div></div><p class="muted">Voorbeeld: 5 OFF-producten, waarvan 4 met bronletter en 1 zonder; de USDA-registratie staat apart en is dus niet ‘ontbrekend’.</p></div><div><h2>Alternatief beeld</h2><div class="fallbacks"><figure><img src="candidate/images/food-placeholder-off.svg" alt="OFF-alternatief"><figcaption>OFF</figcaption></figure><figure><img src="candidate/images/food-placeholder-usda.svg" alt="USDA-alternatief"><figcaption>USDA</figcaption></figure><figure><img src="candidate/images/food-placeholder-other.svg" alt="Overig alternatief"><figcaption data-source="other"></figcaption></figure></div><p class="muted">Deze neutrale lokale illustraties verschijnen alleen als een echte bronfoto ontbreekt, wordt afgewezen of niet laadt.</p></div></section>

<section class="card"><h2>Bewijs en eerlijke open poorten</h2><table><tr><th>Lokaal gereed</th><td>303 Node-tests, TypeScript, Next-productiebouw, Python-syntaxis, 5 releasebuildertests en strikt WordPress-DOM-contract.</td></tr><tr><th>Na totale GO via CI</th><td>Backend pytest met vastgezette dependencies, native PHP-lint en beide Chromiumtests in 11 talen op 360/412/1440.</td></tr><tr><th>Na deployment</th><td>Echte Xaman login/logout, live WordPress-kaart, fysieke mobiele controle, build-ID en rollbackcontrole.</td></tr><tr><th>Niet gebeurd</th><td>Geen GitHub-update, branch/PR-mutatie, deployment, scheduling of publicatie.</td></tr></table></section>

<section class="card"><h2>Pakketidentiteit</h2><p>Appbasis <code>ac724aabf1534e51e819ef5d84df04f246eeea23</code> · tree <code>737afcaf25b6e0ccbb97e8687143122e3bea0dd8</code>.</p><p>Plugin SHA-256 <code>{plugin_hash}</code>.</p><p>Bronpakket: {source_report['files']} bestanden · SHA-256 <code>{source_report['sha256']}</code>.</p><p class="muted">Open controles en historische status uit R3 zijn ongewijzigd behouden. Dit scherm is een reviewkandidaat, geen live- of publicatieclaim.</p></section>
</main>
<script id="copy" type="application/json">{translations}</script><script>
(function(){{'use strict';var data=JSON.parse(document.getElementById('copy').textContent),select=document.getElementById('lang');function render(){{var tag=select.value,c=data[tag]||data.en,rtl=tag==='ar'||tag==='ur';document.getElementById('preview').lang=tag;document.getElementById('preview').dir=rtl?'rtl':'ltr';document.querySelectorAll('[data-key]').forEach(function(node){{node.textContent=c[node.dataset.key]||'';}});document.querySelectorAll('[data-source]').forEach(function(node){{node.textContent=c[node.dataset.source]||'';}});}}select.addEventListener('change',render);render();}})();
</script></body></html>"""


def content_manifest(root: Path) -> list[dict[str, Any]]:
    result = []
    for path in sorted((item for item in root.rglob("*") if item.is_file()), key=lambda item: item.relative_to(root).as_posix()):
        relative = path.relative_to(root).as_posix()
        if relative == "BESTANDSCONTROLE_R4.json":
            continue
        result.append({"path": relative, "bytes": path.stat().st_size, "sha256": sha256(path)})
    return result


def build(arguments: argparse.Namespace) -> dict[str, Any]:
    output_parent = arguments.output_dir.resolve()
    package = output_parent / PACKAGE_NAME
    archive = output_parent / f"{PACKAGE_NAME}.zip"
    core_archive = output_parent / f"{PACKAGE_NAME}_DEEL-A.zip"
    report_path = output_parent / f"{PACKAGE_NAME}.manifest.json"
    for target in (package, archive, core_archive, report_path):
        if target.exists():
            raise ValueError(f"Refusing to overwrite existing output: {target}")
    output_parent.mkdir(parents=True, exist_ok=True)
    package.mkdir()

    data = review_data(arguments.review_html)
    media = referenced_files(data)
    for relative in media:
        copy_file(arguments.review_media_root / relative, package / relative)

    copy_file(arguments.review_html, package / "VOLLEDIGE_REVIEW_R3.html")
    copy_file(arguments.r3_root / "CalorieToken_Nieuwe_Review_R3.html", package / "VOLLEDIGE_REVIEW_R3_STANDALONE.html")
    for name in [
        "HERVAT_HIER_R3.md", "feature-campaign-11-locales.json",
        "publication-readiness.json", "run-status-R3.json",
        "BESTANDSCONTROLE_REVIEW_R3.json", "BESTANDSCONTROLE_BRON_R3.json",
    ]:
        copy_file(arguments.r3_root / name, package / "r3-status" / name)

    candidate = package / "candidate"
    candidate.mkdir()
    copy_file(
        arguments.source_root / "docs/release-review/TOTAL-CANDIDATE-STATUS-2026-09-16.md",
        candidate / "TOTAL-CANDIDATE-STATUS-2026-09-16.md",
    )
    copy_file(
        arguments.source_root / "docs/release-review/total-candidate-status-2026-09-16.json",
        candidate / "total-candidate-status-2026-09-16.json",
    )
    copy_file(
        arguments.source_root / "docs/release-review/STEPS-1-5-UX-NUTRITION-2026-09-16.md",
        candidate / "STEPS-1-5-UX-NUTRITION-2026-09-16.md",
    )
    for name in ["food-placeholder-off.svg", "food-placeholder-usda.svg", "food-placeholder-other.svg"]:
        copy_file(arguments.source_root / "frontend/public/images" / name, candidate / "images" / name)
    copy_file(arguments.plugin_zip, candidate / arguments.plugin_zip.name)
    copy_file(arguments.plugin_manifest, candidate / arguments.plugin_manifest.name)

    source_archive = candidate / "calorietoken-source-candidate-2026-09-16.zip"
    source_report = build_source_zip(arguments.source_root, source_archive)
    (candidate / "source-candidate.manifest.json").write_text(
        json.dumps(source_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    copy = json.loads((arguments.source_root / "frontend/config/food-source-copy.json").read_text(encoding="utf-8"))
    plugin_hash = sha256(arguments.plugin_zip)
    if plugin_hash != "5c7736741570bafd1247ef4a42d855d682e9bcbe352ef13d9d668c0ccbe6f5e5":
        raise ValueError("Unexpected Heading Repair candidate hash")
    (package / "START_HIER.html").write_text(start_html(copy, source_report, plugin_hash), encoding="utf-8")
    (package / "LEES_EERST.md").write_text(
        "# CalorieToken totaalreview — 16 september 2026\n\n"
        "Open `START_HIER.html`. Van daaruit opent de volledige bewaarde R3-review "
        "met 97 voorstellen en alle gebruikte lokale media.\n\n"
        "Status: lokale kandidaat afgerond; niets gepubliceerd, gepland, gedeployed "
        "of extern geüpload. Eén expliciete totale GO blijft vereist.\n",
        encoding="utf-8",
    )
    (package / "PAKKETDELEN_LEES_EERST.md").write_text(
        "# Verliesvrije pakketdelen\n\n"
        "De volledige ZIP is groter dan de opslaglimiet per bestand. Pak daarom "
        "`DEEL-A` en `DEEL-B-LANGE-FILMS` uit in **dezelfde lege map**. Beide ZIPs "
        "gebruiken dezelfde hoofdmap en bevatten geen conflicterende inhoud; samen "
        "vormen ze exact de volledige totaalreview. Open daarna `START_HIER.html`.\n\n"
        "De SHA-256-hashes en bestandstelling staan in het release-manifest. Het "
        "opsplitsen wijzigt geen media, voorstel, status of toestemming.\n",
        encoding="utf-8",
    )

    manifest = content_manifest(package)
    inventory = {
        "schema": "calorietoken.total-review-package.v1",
        "date": "2026-09-16",
        "proposals": len(data["items"]),
        "readiness_records": len(data["readiness"]),
        "referenced_media_and_subtitle_paths": len(media),
        "referenced_bytes": sum((arguments.review_media_root / relative).stat().st_size for relative in media),
        "publication_authorized": bool(data.get("publication_authorized")),
        "scheduling_authorized": bool(data.get("scheduling_authorized")),
        "source_candidate": source_report,
        "heading_repair_sha256": plugin_hash,
        "files": manifest,
    }
    (package / "BESTANDSCONTROLE_R4.json").write_text(
        json.dumps(inventory, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    entries = [
        (path, f"{PACKAGE_NAME}/{path.relative_to(package).as_posix()}")
        for path in sorted((item for item in package.rglob("*") if item.is_file()), key=lambda item: item.relative_to(package).as_posix())
    ]
    write_zip(archive, entries)
    long_film_entries = [
        entry for entry in entries
        if entry[0].relative_to(package).parts[:2] == ("creatief6", "lange_films")
    ]
    part_note = package / "PAKKETDELEN_LEES_EERST.md"
    core_entries = [entry for entry in entries if entry not in long_film_entries]
    write_zip(core_archive, core_entries)

    # Keep an MP4 and its sidecar subtitles together while producing upload-sized
    # volumes. The alphabetical, sequential packing is deterministic.
    films_by_stem: dict[str, list[tuple[Path, str]]] = {}
    for entry in long_film_entries:
        films_by_stem.setdefault(entry[0].stem, []).append(entry)
    film_groups: list[list[tuple[Path, str]]] = []
    current_group: list[tuple[Path, str]] = []
    current_bytes = 0
    for stem in sorted(films_by_stem):
        stem_entries = films_by_stem[stem]
        stem_bytes = sum(entry[0].stat().st_size for entry in stem_entries)
        if current_group and current_bytes + stem_bytes > UPLOAD_PART_TARGET:
            film_groups.append(current_group)
            current_group = []
            current_bytes = 0
        current_group.extend(stem_entries)
        current_bytes += stem_bytes
    if current_group:
        film_groups.append(current_group)

    volume_sources: list[tuple[Path, list[tuple[Path, str]]]] = [(core_archive, core_entries)]
    for index, film_group in enumerate(film_groups, start=1):
        film_archive = output_parent / f"{PACKAGE_NAME}_DEEL-B{index}-LANGE-FILMS.zip"
        if film_archive.exists():
            raise ValueError(f"Refusing to overwrite existing output: {film_archive}")
        film_entries = [
            (part_note, f"{PACKAGE_NAME}/PAKKETDELEN_LEES_EERST.md"),
            *film_group,
        ]
        write_zip(film_archive, film_entries)
        volume_sources.append((film_archive, film_entries))
    volumes = [
        {
            "archive": path.name,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "files": len(volume_entries),
        }
        for path, volume_entries in volume_sources
    ]
    if any(volume["bytes"] > UPLOAD_FILE_LIMIT for volume in volumes):
        raise ValueError("A persistent-storage package part exceeds the 512 MiB limit")
    report = {
        "schema": "calorietoken.total-review-release.v1",
        "archive": archive.name,
        "bytes": archive.stat().st_size,
        "sha256": sha256(archive),
        "files": len(entries),
        "proposals": 97,
        "referenced_media_and_subtitle_paths": len(media),
        "persistent_storage_parts": volumes,
        "production_mutated": False,
        "total_go_required": True,
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--review-html", type=Path, required=True)
    parser.add_argument("--review-media-root", type=Path, required=True)
    parser.add_argument("--r3-root", type=Path, required=True)
    parser.add_argument("--plugin-zip", type=Path, required=True)
    parser.add_argument("--plugin-manifest", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    print(json.dumps(build(parser.parse_args()), indent=2))
