# Google authentication

The application uses Firebase Authentication for Google sign-in. Its entry/login pages are public; `/app`, `/api/account`, and coach status require a verified Google Firebase session. ChatGPT identity headers do not authenticate application users.

Browser: Firebase's official browser SDK opens a Google popup, receives a Firebase ID token, and posts it as JSON to `/api/auth/session`. Native iOS: the official Google Sign-In SDK opens the system authentication session, signs in through FirebaseAuth, and exchanges the Firebase ID token with the same server endpoint. The session cookie is installed in WKWebView's cookie store without injecting tokens into page JavaScript.

The Worker uses Firebase Authentication's official `accounts:lookup` REST endpoint to verify the token. It also checks issuer, audience/project, algorithm, expiry, authentication time, verified email, Google provider, user ID, disabled status, and `validSince` revocation time. Decoding a JWT is never sufficient. Successful verifications are cached by token hash for at most 60 seconds and never beyond expiration. An unavailable verifier fails closed with 503. The public Firebase app/API configuration is not an admin credential; no service account is embedded.

Sessions use a host-only `__Host-longevity-google` cookie with Secure, HttpOnly, SameSite=Lax, Path=/, and at most one-hour lifetime. The native SDK refreshes it on foregrounding and periodically. Browser Firebase can re-establish a session on returning to login. JSON-only/same-origin checks protect session changes. Logout clears the cookie; the browser/native SDK also signs out. Session tokens are not logged or included in HTML or response bodies.

Google UID namespaces local storage; health records stay in the device/browser, not Firebase. This does not add health-record cloud synchronization. Old ChatGPT storage namespaces remain untouched and are not automatically reassigned. Account changes and cross-tab record edits pause the app and require reload.

Hosting access must permit the public Google login page; app-level verification still protects simulator entry. This change was requested to replace ChatGPT login with Google for app users. No connected-app permissions or member invitation emails are involved.

Dependencies/verification: web Firebase JS 11.10.0; native Swift Package Manager Firebase SDK 12.x and GoogleSignIn 9.x. Native client bundle identifier and URL scheme must match the Firebase plist. Tests use a mocked Firebase verifier to test trust boundaries; they do not claim a real Google login or Xcode build was exercised in Linux.
