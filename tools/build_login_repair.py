"""Build the guarded one-file repair, never the older complete Bridge."""

import argparse
import hashlib
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BASE = "d973d7e0ff04f90cd7592d34092ae25a3b7963b1"
REST_PATH = "wordpress-plugins/calorieapp-identity-bridge/includes/class-calorieapp-identity-bridge-rest.php"
PLUGIN = ROOT / "wordpress-plugins/calorieapp-login-repair"


def build(output: Path) -> None:
    installer = (PLUGIN / "calorieapp-login-repair.php").read_bytes()
    before = subprocess.check_output(["git", "show", f"{BASE}:{REST_PATH}"], cwd=ROOT)
    after = (ROOT / REST_PATH).read_bytes()
    for label, content in (("BEFORE", before), ("AFTER", after)):
        expected = re.search(rf"{label}_SHA256 = '([a-f0-9]{{64}})'", installer.decode()).group(1)
        if hashlib.sha256(content).hexdigest() != expected:
            raise SystemExit(f"{label} payload differs from the reviewed installer hash")
    entries = {
        "calorieapp-login-repair.php": installer,
        "README.md": (PLUGIN / "README.md").read_bytes(),
        "payload/before.php": before,
        "payload/after.php": after,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries.items():
            info = zipfile.ZipInfo("calorieapp-login-repair/" + name, (2026, 9, 13, 0, 0, 0))
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, content)
    print(f"{output}: {output.stat().st_size} bytes; SHA-256 {hashlib.sha256(output.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    build(parser.parse_args().output.resolve())
