# Longevity Simulator — Python first

The main app is now written in **Python**, including its screens. You no longer need to understand a large JavaScript/HTML application to change a page.

- **Python:** screens, accounts, SQLite storage, profile setup, journal calendars, charts, sleep/EEG imports, GPS filtering, timers, route calculations, calorie estimates, playback, and splits.
- **Small JavaScript adapter:** asks the browser for GPS fixes and forwards them to Python. Browsers require JavaScript for this sensor API. The adapter contains no health calculations.
- **Streamlit:** turns your Python widgets into a browser interface. You write Python rather than hand-writing the web interface.

**Start learning with [START_HERE.md](START_HERE.md).**

## Run in VS Code

Install Python 3.10 or newer, download this repository, and open the folder in VS Code. In its terminal:

```bash
python -m venv .venv
```

Activate the environment:

- **Windows:** `.venv\Scripts\activate`
- **Mac/Linux:** `source .venv/bin/activate`

Then:

```bash
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

On Mac, use `python3` for the first command if `python` is unavailable. Open **http://localhost:8501**. Create an account, save your profile, and choose a screen in the sidebar. Stop the server with **Ctrl+C**.

You can also select the `.venv` Python interpreter in VS Code and press **F5** with the included debugger configuration. Do not use `python app.py` directly: Streamlit supplies the interface runtime.

## A small, understandable project

| File or folder | What you change here |
| --- | --- |
| `app.py` | Sign-in, sidebar navigation, and which screen opens |
| `screens/home.py` | Daily habits and seven-day check-ins |
| `screens/profile.py` | Profile form |
| `screens/journal.py` | Calendar bubbles, journal form, graphs, and date ranges |
| `screens/sleep.py` | Sleep history and optional advanced EEG import |
| `screens/exercise.py` | GPS controls, run history, maps, playback, and splits |
| `screens/scenarios.py` | Lifestyle sliders and comparisons |
| `screens/account.py` | Export, import, and record deletion |
| `longevity/health.py` | BMI, BMR, sleep duration, and energy formulas |
| `longevity/routes.py` | Distance, elevation, gaps, splits, GPX, and playback math |
| `longevity/recorder.py` | Recording / waiting / paused state transitions |
| `longevity/storage.py` | Account passwords and user-owned SQLite records |
| `longevity/journal.py` | Journal validation, missing values, and summaries |
| `gps_component/` | The small browser-to-Python GPS adapter |
| `tests/` | Examples that check the Python behavior |

There is no Node.js or npm requirement for this version. The earlier web app is preserved on the [`web-version` branch](https://github.com/Nerd-124/2627FitnessTracker_CongressApp/tree/web-version).

## What happens to the current website?

https://longevity-simulator-lab.idealapple4.chatgpt.site continues running the previous web edition. This Python rewrite does **not** silently replace that site or its browser-stored records. Streamlit needs a Python-capable server; it cannot run as the previous Cloudflare Worker.

To bring your earlier records over, export JSON from the previous app, create a Python account/profile, then use **Account & backups → Import**. Profile and journal data can be imported, along with supported activity records. The two editions have separate login systems: the live site uses ChatGPT, while this local Python version has its own SQLite accounts. The interface is now Streamlit, so its appearance differs from the previous site.

## GPS and phone use

GPS needs browser permission and HTTPS or localhost. Keep the app visible with the screen on. The small adapter forwards raw sensor data; Python validates accuracy, computes distances, and controls the timer. It waits up to 45 seconds for a usable fix. Stationary users still accumulate active time after GPS connects. Pauses and GPS gaps are not joined into distance.

To record from a phone, deploy the Python server behind HTTPS and access that server from the phone. A plain HTTP LAN address normally cannot use geolocation. This edition requires a live browser connection to its Python server and is **not** an offline/native background tracker. Reliable locked-screen GPS needs native mobile support. Physical-phone GPS, wake-lock behavior, and external basemap loading still require device testing.

GPS and calorie values are estimates. Altitude may be missing or noisy. The route analyzer filters small height changes and implausible slopes. Calories use research equations, not a trained AI. Temperature/humidity can be saved as context and do not receive an invented calorie multiplier. Optional EEG import displays device data; it does not measure brainwaves or infer sleep stages.

## Data and accounts

Data is stored in `.data/longevity.sqlite3` on the computer running the server. The folder is ignored by Git. Passwords use salted PBKDF2 hashes; records are separated by account. The database itself is not encrypted. Back up the file privately or use JSON export. `LONGEVITY_DATA_DIR` can point to another persistent folder.

This is an educational application, not a production healthcare system. Email verification, password recovery, public hosting hardening, and production identity management are not implemented. Do not use sensitive real health data in public demos. Public deployment needs HTTPS, persistent database storage, and a proper hosting/security review.

## Test it

After installing requirements:

```bash
python -m unittest discover -s tests -v
```

The tests cover calculations, journal validation, calendar dates, EEG parsing, GPS filtering, pauses/gaps, route playback, accounts, data isolation, backups, and actual Streamlit screen interactions. Real phone hardware is not simulated as a claim of outdoor accuracy.

The app is still in development. Its illustrative habit score and future curve do not predict biological age, lifespan, or medical risk. The code was developed with AI assistance; review the official Congressional App Challenge rules and accurately document your contributions before submission.
