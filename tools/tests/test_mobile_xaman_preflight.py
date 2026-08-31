from __future__ import annotations

import subprocess
import unittest

from tools.mobile_xaman_preflight import assess


def _completed(
    command: tuple[str, ...],
    stdout: str = "",
    returncode: int = 0,
) -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(command, returncode, stdout=stdout, stderr="")


class FakeRunner:
    def __init__(self, *, xaman_installed: bool = True, multiple: bool = False) -> None:
        self.xaman_installed = xaman_installed
        self.multiple = multiple

    def __call__(self, command: tuple[str, ...]) -> subprocess.CompletedProcess[str]:
        if command == ("adb", "devices", "-l"):
            second = "emulator-5556 device product:sdk_gphone64\n" if self.multiple else ""
            return _completed(
                command,
                "List of devices attached\n"
                "emulator-5554 device product:sdk_gphone64\n"
                + second,
            )
        if command[-2:] == ("getprop", "ro.kernel.qemu"):
            return _completed(command, "1\n")
        if command[-2:] == ("getprop", "ro.build.version.sdk"):
            return _completed(command, "35\n")
        if command[-3:] == ("pm", "path", "com.android.vending"):
            return _completed(command, "package:/system/priv-app/Phonesky/Phonesky.apk\n")
        if command[-3:] == ("pm", "path", "com.xrpllabs.xumm"):
            output = (
                "package:/data/app/com.xrpllabs.xumm/base.apk\n"
                if self.xaman_installed
                else ""
            )
            return _completed(command, output, 0 if self.xaman_installed else 1)
        raise AssertionError(f"Unexpected command: {command}")


class MobileXamanPreflightTests(unittest.TestCase):
    @staticmethod
    def _tools(name: str) -> str:
        return f"/tools/{name}"

    def test_ready_emulator_requires_only_read_only_device_evidence(self) -> None:
        checks = assess(
            target="emulator",
            serial=None,
            require_xaman=True,
            tool_finder=self._tools,
            runner=FakeRunner(),
        )

        self.assertFalse([check for check in checks if check.status == "fail"])
        self.assertIn("wallet.secrets", {check.name for check in checks})
        self.assertNotIn("official", " ".join(check.detail for check in checks).lower())
        self.assertEqual(
            "pass",
            next(check.status for check in checks if check.name == "device.xaman"),
        )

    def test_missing_xaman_warns_before_install_phase(self) -> None:
        checks = assess(
            target="emulator",
            serial=None,
            require_xaman=False,
            tool_finder=self._tools,
            runner=FakeRunner(xaman_installed=False),
        )

        self.assertEqual(
            "warn",
            next(check.status for check in checks if check.name == "device.xaman"),
        )
        self.assertFalse([check for check in checks if check.status == "fail"])

    def test_missing_required_tool_blocks_without_calling_adb(self) -> None:
        checks = assess(
            target="emulator",
            serial=None,
            require_xaman=False,
            tool_finder=lambda name: None if name == "adb" else f"/tools/{name}",
            runner=lambda command: self.fail(f"ADB should not run: {command}"),
        )

        self.assertEqual("fail", next(check.status for check in checks if check.name == "tool.adb"))

    def test_multiple_emulators_fail_closed_until_serial_is_selected(self) -> None:
        checks = assess(
            target="emulator",
            serial=None,
            require_xaman=True,
            tool_finder=self._tools,
            runner=FakeRunner(multiple=True),
        )

        selection = next(check for check in checks if check.name == "device.selection")
        self.assertEqual("fail", selection.status)
        self.assertIn("--serial", selection.detail)


if __name__ == "__main__":
    unittest.main()
