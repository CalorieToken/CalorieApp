# CalorieApp Login Repair 1.0.0

This companion installer changes exactly one existing Identity Bridge PHP file.
It requires the active **0.3.29** plugin and an exact SHA-256 match of the original
REST controller. That controller is identical in the reviewed 0.3.18 and 0.3.22
sources; the installer verifies the actual live copy before any change. The
complete 0.3.29 source has not been recovered, so compatibility is conditional
on that runtime check. A mismatch stops activation without changing the Bridge.

It preserves the installed Bridge version, all other plugin files, settings,
session controls and Site Style. It does not change hosting protections or
contain credentials. The replacement is written and checked in a temporary file
in the same directory, then renamed over the checked original. PHP opcode cache
is invalidated after replacement.

## Installation

1. Deploy the tested backend code from the same repair release.
2. In WordPress, choose **Plugins → Nieuwe plugin → Plugin uploaden**.
3. Upload `calorieapp-login-repair-1.0.0.zip`, install and activate it.
4. Confirm the green notice, then complete Xaman sign-in in the original browser
   and verify both the website and CalorieApp are signed in. Verify joint logout.

If activation says the existing code differs, upload a backup of the currently
installed Identity Bridge for review. Do not replace it with source version
0.3.18. An older backend is supported by the patched controller, but the new
transport only starts when the backend advertises `backend_v1`.

## Rollback

Deactivate **CalorieApp Login Repair** before rolling back the backend. When the
controller still exactly matches this repair, deactivation atomically restores
the original controller. It never overwrites a subsequently changed controller.
Wait at least 60 seconds before reverting the backend so in-flight codes expire.
Do not delete this repair plugin before deactivating it. A future full Identity
Bridge update may replace the correction; verify its release notes and login.

## Build and verification

Run `python tools/build_login_repair.py --output dist/calorieapp-login-repair-1.0.0.zip`.
The builder obtains the original controller from the pinned, reviewed Git commit
and rejects source or payload hashes that differ from the installer constants.
The ZIP contains only this installer, its two verified controller payloads and
this README. It does not install the repository's older complete Identity Bridge.

Backend integration tests cover signed claims, replay, expiry, the original
browser proof, joint logout and bounded cleanup. Standalone real-PHP tests cover
WordPress transport boundaries and installer activation, rollback and refusal
to overwrite unexpected code. A real live login remains required after install.
