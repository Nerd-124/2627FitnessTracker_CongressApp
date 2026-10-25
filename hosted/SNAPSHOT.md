# Current live app snapshot

Source commit: `2ba0e772b23f9a947b9147d470e4810186beda8d`

Published app: https://longevity-simulator-lab.idealapple4.chatgpt.site/app

This snapshot includes the WHO-5 check-in, Exercise / Mental health / Sleep report, guest1 fictional data, calendar day pop-up with navigation arrows, Orbit iPhone icon, and requested text cleanup.

- Website source: `web/`
- Native iPhone project: `ios-live/LongevityLive.xcodeproj`
- Downloadable iPhone source: `web/LongevitySimulator-Xcode.zip`
- Worker source and build: `worker/server-template.js`, `scripts/build.mjs`
- Checks: `tests/` (some JavaScript checks require jsdom; Worker checks require Miniflare)

This is a source backup. Runtime secrets and private user database records are not included. The Firebase client configuration is public app configuration, not a server credential. A native Xcode build and device verification still require a Mac/iPhone.
