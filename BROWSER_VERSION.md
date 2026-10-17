# Hosted browser edition

Live app: https://longevity-simulator-lab.idealapple4.chatgpt.site

The complete editable hosted source is in `hosted/web/`. Its Python model is `hosted/web/model.py`, run in the browser with Pyodide. The authenticated Worker template is `hosted/worker/server-template.js`.

Build with `node hosted/scripts/build.mjs`. Generated output is `hosted/dist/server/index.js`; the script embeds all browser assets. Building locally does not publish or update the live app. Sites handles authentication and hosting. See `hosted/AUTHENTICATION.md` for the identity boundary and account-storage design.

For local development with VS Code, use the Python server at the repository root. See `README.md`.
