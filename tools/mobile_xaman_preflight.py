"""Read-only readiness check for a dedicated Android Xaman test device.

This tool never creates an XRPL account, reads wallet material, starts Xaman,
or mutates the connected Android device. It only inspects the local Android
toolchain and package presence through read-only ADB commands.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from dataclasses import asdict, dataclass
from typing import Callable, Sequence


XAMAN_PACKAGE = "com.xrpllabs.xumm"
PLAY_STORE_PACKAGE = "com.android.vending"
CommandRunner = Callable[[Sequence[str]], subprocess.CompletedProcess[str]]
ToolFinder = Callable[[str], str | None]


@dataclass(frozen=True)
class Check:
    name: str
    status: str
    detail: str


def _run(command: Sequence[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        list(command),
        capture_output=True,
        check=False,
        text=True,
        timeout=10,
    )


def _adb(runner: CommandRunner, serial: str, *args: str) -> subprocess.CompletedProcess[str]:
    return runner(("adb", "-s", serial, *args))


def _devices(output: str) -> list[tuple[str, str]]:
    devices: list[tuple[str, str]] = []
    for line in output.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("List of devices attached"):
            continue
        fields = stripped.split()
        if len(fields) >= 2:
            devices.append((fields[0], fields[1]))
    return devices


def _property(runner: CommandRunner, serial: str, name: str) -> str:
    result = _adb(runner, serial, "shell", "getprop", name)
    return result.stdout.strip() if result.returncode == 0 else ""


def _package_present(runner: CommandRunner, serial: str, package: str) -> bool:
    result = _adb(runner, serial, "shell", "pm", "path", package)
    return result.returncode == 0 and result.stdout.strip().startswith("package:")


def assess(
    *,
    target: str,
    serial: str | None,
    require_xaman: bool,
    tool_finder: ToolFinder = shutil.which,
    runner: CommandRunner = _run,
) -> list[Check]:
    checks: list[Check] = []
    required_tools = ["adb"]
    if target == "emulator":
        required_tools.append("emulator")

    missing = [tool for tool in required_tools if tool_finder(tool) is None]
    for tool in required_tools:
        checks.append(
            Check(
                f"tool.{tool}",
                "fail" if tool in missing else "pass",
                "not found on PATH" if tool in missing else "available on PATH",
            )
        )
    if missing:
        return checks

    try:
        result = runner(("adb", "devices", "-l"))
    except (OSError, subprocess.SubprocessError) as error:
        checks.append(
            Check(
                "adb.devices",
                "fail",
                f"ADB inspection failed: {type(error).__name__}",
            )
        )
        return checks
    if result.returncode != 0:
        checks.append(Check("adb.devices", "fail", "ADB could not list devices"))
        return checks

    connected = _devices(result.stdout)
    unauthorized = [device_serial for device_serial, state in connected if state != "device"]
    if unauthorized:
        checks.append(
            Check(
                "adb.authorization",
                "fail",
                f"{len(unauthorized)} device(s) are not ready or authorized",
            )
        )

    ready = [device_serial for device_serial, state in connected if state == "device"]
    candidates: list[tuple[str, bool]] = []
    for device_serial in ready:
        qemu = _property(runner, device_serial, "ro.kernel.qemu") == "1"
        is_emulator = qemu or device_serial.startswith("emulator-")
        target_matches = (
            target == "any"
            or (target == "emulator" and is_emulator)
            or (target == "physical" and not is_emulator)
        )
        if target_matches:
            candidates.append((device_serial, is_emulator))

    if serial is not None:
        candidates = [candidate for candidate in candidates if candidate[0] == serial]

    if len(candidates) != 1:
        detail = (
            "no matching ready device"
            if not candidates
            else "multiple matching devices; select one with --serial"
        )
        checks.append(Check("device.selection", "fail", detail))
        return checks

    selected, is_emulator = candidates[0]
    checks.append(
        Check(
            "device.selection",
            "pass",
            f"selected {selected} ({'emulator' if is_emulator else 'physical'})",
        )
    )

    api_level = _property(runner, selected, "ro.build.version.sdk")
    checks.append(
        Check(
            "device.android_api",
            "pass" if api_level.isdigit() else "fail",
            f"API {api_level}" if api_level.isdigit() else "Android API level unavailable",
        )
    )

    has_play_store = _package_present(runner, selected, PLAY_STORE_PACKAGE)
    checks.append(
        Check(
            "device.play_store",
            "pass" if has_play_store else "fail",
            "official Play Store package present"
            if has_play_store
            else "Google Play-enabled device required",
        )
    )

    has_xaman = _package_present(runner, selected, XAMAN_PACKAGE)
    checks.append(
        Check(
            "device.xaman",
            "pass" if has_xaman else ("fail" if require_xaman else "warn"),
            "official Xaman package present"
            if has_xaman
            else "official Xaman package not installed yet",
        )
    )

    checks.append(
        Check(
            "wallet.secrets",
            "pass",
            "preflight accepts and reads no XRPL seed, secret numbers, or account material",
        )
    )
    return checks


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--target",
        choices=("emulator", "physical", "any"),
        default="emulator",
        help="Android device type to validate (default: emulator)",
    )
    parser.add_argument("--serial", help="Exact ADB serial when more than one device is connected")
    parser.add_argument(
        "--require-xaman",
        action="store_true",
        help="Fail instead of warn when the official Xaman package is absent",
    )
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    checks = assess(
        target=args.target,
        serial=args.serial,
        require_xaman=args.require_xaman,
    )
    ready = all(check.status != "fail" for check in checks)
    if args.json:
        print(
            json.dumps(
                {
                    "schema_version": "calorieapp.mobile-xaman-preflight.v1",
                    "ready": ready,
                    "checks": [asdict(check) for check in checks],
                },
                indent=2,
                sort_keys=True,
            )
        )
    else:
        for check in checks:
            print(f"[{check.status.upper():4}] {check.name}: {check.detail}")
        print("READY" if ready else "BLOCKED")
    return 0 if ready else 2


if __name__ == "__main__":
    raise SystemExit(main())
