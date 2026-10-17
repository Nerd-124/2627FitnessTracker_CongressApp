# Longevity Simulator

A JavaScript web interface with a Python backend for the Congressional App Challenge.
The latest live design includes typed workout logging, compact map/timer views, and the guided profile setup, daily journal calendar and
charts, sleep/EEG imports, live GPS controls, elevation charts and route playback.

## Start on your Mac

```bash
python3 app.py
```

Open http://127.0.0.1:8000. No third-party Python packages or Node installation
are required to run the web edition. See [START_HERE.md](START_HERE.md).

## Code guide

- `app.py`: Python sign-in, sessions, protected app page, local server.
- `web_app.py`: Python health and exercise equations, JSON endpoints.
- `longevity/storage.py`: SQLite accounts with hashed passwords and sign-in throttling.
- `static/index.html` and `static/style.css`: page structure and visual styling.
- `static/*.js`: interactive journal, GPS, charts and playback.
- `hosted/`: latest live-site source, preserved with its Sites authentication and build script.
- `streamlit_app.py` and `screens/`: preserved Python-only interface.

## Accounts and records

The web and Streamlit editions share local SQLite accounts. The web edition stores
health records in browser storage scoped to the account, while Streamlit records
remain in SQLite. Entries do not automatically sync between editions or devices.
Sign-out ends the server session; browser records remain on the device.
This is a local development server bound to localhost, not production hosting.
Restarting the server requires signing in again. The existing hosted site is unchanged.

## GPS and health estimates

GPS requires location permission and HTTPS or localhost. Keep the app visible and
the phone screen on; reliable locked-screen recording needs a native app.
Map tiles and optional external weather/elevation services need internet.
Outdoor phone tracking has not been physically verified here.
Energy estimates use research equations, not a trained AI service. Habit curves
are illustrative and do not predict lifespan or disease. EEG requires device imports.

## Optional Streamlit version

```bash
python -m pip install -r requirements.txt
python -m streamlit run streamlit_app.py
```

Do not commit .data/, passwords or personal health exports.

See [START_HERE.md](START_HERE.md) for download and VS Code steps. The hosted source snapshot matches live commit 6ef255b89926303b37b296cb037d64f0717ae572. Local calculations use the Python server; the hosted edition uses Python in the browser. Maps require internet and real phone GPS still needs HTTPS.

My plan now supports explainable suggestions from recent records and baseline habits, editable weekly/monthly/yearly/custom schedules, and per-date check-ins. See hosted/PLANNER.md for rules and limitations.

My plan now supports explainable suggestions from recent records and baseline habits, editable weekly/monthly/yearly/custom schedules, and per-date check-ins. See hosted/PLANNER.md for rules and limitations.

The Today page now includes a free chat-based coach using built-in browser rules, not a paid AI model. No API key is needed. It offers plan choices from supported goals and preferences and saves a chosen plan to Today/My plan. See hosted/FREE_COACH.md.
