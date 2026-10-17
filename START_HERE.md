# Open the latest app in VS Code

1. Download the ZIP from GitHub (Code → Download ZIP).
2. In Finder, double-click the ZIP to extract it.
3. In VS Code, use File → Open Folder to open the extracted folder containing app.py.
4. Open Terminal → New Terminal and run:

```bash
python3 app.py
```

5. Visit http://127.0.0.1:8000 and create a local account.

No Python package installation is needed for this edition. Keep the terminal
running. Stop with Control+C. If port 8000 is already in use, stop your earlier
local app first or run `PORT=8001 python3 app.py` and open that port instead.

The live site is https://longevity-simulator-lab.idealapple4.chatgpt.site/.
Its browser records and ChatGPT sign-in are separate from local accounts.
Use Export my data on the live site to keep a backup before clearing browser data.
Downloading source does not transfer health records to this local edition.

Edit static/ for your local interface and app.py/web_app.py for the Python server.
The hosted/ folder preserves the latest live-site source, including its ChatGPT
sign-in integration. Local edits do not automatically update the live site.
