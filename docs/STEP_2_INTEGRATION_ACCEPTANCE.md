# Step 2 — website integration and Identity Bridge

The user's five-step plan is: (1) application/ecosystem foundation, (2) website
integration and Identity Bridge, (3) historical website refinement, (4) showcase
preparation, (5) preview, review and approved publication. Step 2 is active.
Earlier footer, floating-button and market-widget work remains part of step 3.

## Accepted starting point

- Deployed application: `f689a4acd9bb34f49c6f06267fb22537b17495b0`, PR #125.
- Installed maintenance plugin: 0.3.19, `fdd1c8f4cba606c8807db6b34776c87f19c70646`.
- Saved recovery record: [2026-09-06 checkpoint](https://github.com/CalorieToken/CalorieApp/blob/8dd2d20fe1ed193a639824326eee571f3bb58936/docs/WORKING_LOGIN_CHECKPOINT_2026-09-06.md).
- The user confirmed joint login after Render sleep in Android Brave on
  2026-09-06 at 17:20–17:22 CEST. The account widget and existing food log loaded
  after completion. The visible Render startup page is an accepted limitation.

## Integration status

| Requirement | Evidence / remaining check |
|---|---|
| Canonical WordPress page embeds the current app | Confirmed in the accepted user screenshots and deployment record. |
| App sign-in stays in the initiating browser and connects both sessions | Accepted cold-start test with one Xaman signature. |
| Website account display updates after joint login | Accepted 0.3.19 refresh-after-success behavior and user screenshots. |
| Website-widget entry reaches the same joint login after backend sleep | 0.3.20 adds native startup plus a one-use, origin/locale-bound return intent; automated coverage passes; live acceptance pending. |
| App's own joint sign-out button reaches WordPress | A test reproduced the missing `logout:request` listener in 0.3.19; 0.3.20 restores that connection; live acceptance pending. |
| Joint sign-out is available on other website pages | 0.3.20 adds the existing two-session logout protocol, loading an app frame only after a click; live acceptance pending. |
| Untrusted frames/origins and stale intents are ignored | Automated negative tests cover origin, frame source, locale, expiry, future timestamps and replay. |
| Personal account options are collapsible | Already present in the deployed frontend's Account tools section. |

The 0.3.20 package is based on the maintenance plugin, not the newer layout
branch. Xaman verification, authorization-code issuance and exchange are not
rewritten. Frontend, backend, database, hosting and stored website content are
outside this patch. The new header startup URL uses the same existing backend
as the accepted application; a future hosting change must update both together.

## Final acceptance, once the reviewed plugin is installed

Use the current Android Brave tab and the existing application deployment.

1. Use the app's **Sign out everywhere** control. Confirm both the website widget
   and CalorieApp show signed out.
2. Use the website widget to sign in. After the service startup page, return
   automatically to CalorieApp, sign once in Xaman and return to the same browser.
   Confirm both account displays and the existing food log without manual refresh.
3. Visit another website page. Use **Sign out both** and confirm the website is
   signed out. Return to CalorieApp and confirm its session is also ended.

The website-widget check must include a naturally sleeping backend because its
entry wiring changed. Do not redeploy or manually wake the backend to make that
test pass. The already-proven main app login does not need another round of
speculative modifications.

Step 2 is not marked complete until the reviewed package is installed and this
remaining integration acceptance passes. Broader content, historical design,
XPMarket centering, floating icons and tokenomics work continues in step 3;
showcase production and publishing remain steps 4 and 5.
