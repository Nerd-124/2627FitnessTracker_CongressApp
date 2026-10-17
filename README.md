# Longevity Simulator

A JavaScript web interface with a Python backend for the Congressional App Challenge.
The restored design includes the guided profile setup, daily journal calendar and
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
