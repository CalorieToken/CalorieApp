# Mobile Xaman test lane

Status: design and read-only preflight implemented; local Android host, Xaman
installation and XRPL Testnet identity deliberately not provisioned yet.

## Decision

Use a dedicated Android test environment and a disposable XRPL Testnet identity
to repeat the existing WordPress-owned Xaman sign-in flow. An emulator is a
feasibility lane, not assumed production-equivalent evidence. A dedicated
physical Android device becomes the primary lane when Xaman, device-integrity,
deep-link, backgrounding or browser-return behaviour is unsupported or flaky on
the emulator.

This lane does not change the Identity Bridge architecture. The WordPress page
still creates the Xaman SignIn payload without a mobile return URL, observes its
status and completes the WordPress and embedded CalorieApp sessions after the
user closes Xaman and returns to the original browser page. Android and iOS
cannot reliably reopen the exact originating browser tab, so the product does
not promise an automatic redirect. It instead preserves one page-owned flow and
finishes automatically when that page resumes.

The standalone Render entry links explicitly to the canonical WordPress page
in the same tab. An embedded frame cannot navigate to WordPress while its
trusted-parent handshake is pending, and the integrated page suppresses the
competing unsigned legacy XUMM Login card.

## Execution boundary

| Component | Responsibility | Prohibited material |
|---|---|---|
| Cloud repository/CI | Test logic, synthetic fixtures and secret-free reports | Wallet seed, secret numbers, Xaman passcode, Mainnet account |
| Local Android host | Android Studio/SDK, ADB and emulator or physical device | Production wallet material |
| Xaman test installation | Manual Testnet account import and SignIn approval | Any Mainnet or personally used wallet |
| Human test operator | Creates and stores the Testnet identity outside the repository | Pasting secrets into chat, source, screenshots or logs |

Cloud CI tests the preflight logic only. It does not start an Android emulator,
install Xaman or consume paid mobile-device runner minutes.

## Secret and identity boundary

- Network: XRPL Testnet only.
- Initial label: `calorieapp-e2e-xrpl-testnet-android-01`.
- Generate and fund the account locally outside Xaman using the official XRPL
  Testnet tooling only after the device lane passes its non-secret checks.
- Store the seed or secret numbers encrypted outside Git, GitHub Actions,
  ChatGPT, WordPress, Render and test evidence.
- The repository and automation may receive the public `r...` address only when
  a test genuinely needs it. Do not commit the address by default because it
  correlates the complete public test history.
- Import the account manually with a human present. Do not automate seed entry,
  copy it through ADB, or place it in an environment variable.
- Never reuse a Mainnet, treasury, issuer, team or personal account.
- Create a separate `ios-01` identity if an iOS lane is added later.

Testnet assets have no intended monetary value, but their signing material is
still a credential and receives the same handling boundary.

## Read-only preflight

The preflight uses only `adb devices`, Android property reads and package
presence queries. It cannot create an account, read wallet material, launch an
app or modify a device.

Before installing Xaman:

```powershell
python tools/mobile_xaman_preflight.py --target emulator
```

After installing Xaman from its Google Play listing (package ID
`com.xrpllabs.xumm`):

```powershell
python tools/mobile_xaman_preflight.py --target emulator --require-xaman
```

Use `--serial <adb-serial>` when multiple devices are connected. For the
physical-device fallback, replace `--target emulator` with
`--target physical`.

The host is ready only when one authorized target is selected, its Android API
level can be read, the Google Play package ID is present and—when required—the
Xaman package ID is present. Package presence does not verify the installer,
APK signature or publication source; confirming installation from the linked
Google Play listing remains a manual gate.

## Emulator go/no-go gate

Run every row without exposing secrets and repeat the complete approval flow
three times. One consistent failure in a device-integrity or security control is
an immediate no-go; intermittent browser/deep-link failures after a clean retry
make the emulator secondary evidence and move acceptance testing to a physical
device.

| Scenario | Required result |
|---|---|
| Official Xaman installation | Installs from Google Play and opens after a cold restart |
| Testnet mode | Clearly shows XRPL Testnet before account import or signing |
| Manual test identity import | Address matches the separately recorded public test address |
| WordPress `Open Xaman` | Opens Xaman from the originating mobile browser page |
| Approve SignIn | Original page completes WordPress and embedded CalorieApp sessions |
| Reject SignIn | Page reports rejection and creates no session |
| Expired request | Page fails closed and offers a fresh request |
| Close/Back return | Returns to the original page without depending on a new default-browser tab |
| Competing login surfaces | Only the integrated CalorieApp Xaman entry is actionable on the CalorieApp page |
| Iframe handshake delay | Sign-in stays disabled and cannot open WordPress inside the iframe |
| Background/cold-start delay | Pending status safely resumes without request storms |
| Dialog completion | “Signed in” state closes or resolves without manual refresh |
| Evidence capture | Contains no seed, secret numbers, passcode, email or authorization code |

## Automation progression

1. Read-only host/device preflight.
2. Human installs Xaman from the linked Google Play listing and manually
   provisions one Testnet identity.
3. Human performs the go/no-go matrix and records a sanitized result.
4. Automate only repeatable post-provisioning UI actions with a local mobile
   testing framework. Keep signing approval human-gated until the threat model
   and Xaman behaviour justify a narrower synthetic automation.
5. Add a separate iOS simulator or physical-device lane; do not treat Android
   emulator evidence as cross-platform proof.

## What this does not prove

- Xaman officially supports every emulator or device image.
- Emulator behaviour equals a physical Android phone.
- Android results establish iOS compatibility.
- Mainnet, financial, custodial or production readiness.
- A successful preflight establishes a successful Identity Bridge login.

## References

- [Xaman on Google Play](https://play.google.com/store/apps/details?id=com.xrpllabs.xumm)
- [Xaman Testnet guidance](https://help.xaman.app/app/learning-more-about-xaman/how-to-access-testnet-on-xrp-ledger)
- [XRPL JavaScript Testnet account tutorial](https://xrpl.org/docs/tutorials/get-started/get-started-javascript)
- [Xaman payload return URL guidance](https://docs.xaman.dev/concepts/payloads-sign-requests/payload-return-url)
- [Xaman WebSocket status guidance](https://docs.xaman.dev/concepts/payloads-sign-requests/status-updates/websocket)
