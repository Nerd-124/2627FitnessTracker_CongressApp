# Hosted authentication

The hosted app uses Sites-owned ChatGPT sign-in. `/` shows the welcome/sign-in screen; `/app` requires visitor identity, and all application scripts/data-model assets are protected server-side. `/api/account` returns the authenticated display identity and a stable account-specific browser-storage namespace. Missing identity gets a 401 or a top-level sign-in redirect.

The platform owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, and `/callback`; no passwords, separate OAuth flow, or session cookies are implemented by the app. Do not deploy this Worker outside Sites without adding an identity-verifying gateway: the `oai-authenticated-user-*` headers are trusted only behind Sites dispatch.

Sign-in is not an invitation. The Site's owner-private audience remains unchanged. Additional visitors require an explicit sharing/invitation change. New invited users sign in through ChatGPT and then create their app profile.

Health records remain in localStorage on this browser, with a distinct namespace derived from the authenticated site-scoped user ID. This is separation, not encryption or cloud storage. Signing out ends the hosted session and hides the app, but does not delete browser records. Use the existing delete/export controls on a private device. The app locks for session verification on tab visibility changes and requires reload if records change in another tab.

Older unscoped records are not automatically assigned to any account. The account panel offers an import requiring confirmation that the records belong to the signed-in user. The legacy copy is preserved. Account-specific deletion removes only that account's namespace.

The local Python prototype is still a local-only development edition without authentication. This change protects the hosted app. Python calculations in the hosted edition continue to run with Pyodide inside the authenticated browser.

## Source and build

Edit `web/` for the browser app and `worker/server-template.js` for the authenticated request handler. `node scripts/build.mjs` embeds the web assets into `worker/index.js`, validates the ES-module fetch export, and packages `dist/server/index.js` with `.openai/hosting.json`. No D1 or R2 bindings are used.

Checks cover unsigned access, protected assets, distinct/stable account IDs, inline bootstrap escaping, cache policy, account-scoped saving, explicit legacy-import confirmation, and wrong-session locking. Existing onboarding and feature checks pass. Browser OAuth/sign-out end-to-end testing was unavailable in the execution environment.
