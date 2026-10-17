# Longevity Simulator

A work-in-progress Congressional App Challenge project about aging, lifestyle habits, sleep, and exercise. The project includes a Python local web app and the complete source of the private hosted app.

**Live app:** https://longevity-simulator-lab.idealapple4.chatgpt.site

## Open it in VS Code

1. On GitHub, choose **Code → Download ZIP**, extract the ZIP, and open the extracted folder in VS Code. Or clone the repository:

   ```bash
   git clone https://github.com/Nerd-124/2627FitnessTracker_CongressApp.git
   cd 2627FitnessTracker_CongressApp
   code .
   ```

2. Install **Python 3.10 or newer**. No additional Python packages are needed.
3. Open the VS Code terminal and run:

   ```bash
   python app.py
   ```

   On a Mac where `python` is unavailable, use `python3 app.py`.

4. Open **http://localhost:8000** in a browser. Stop the app with **Ctrl+C**.

You can also install the recommended VS Code Python extension and select **Run Longevity Simulator** in Run and Debug. The server binds to localhost for local development; the hosted HTTPS app is the appropriate place to try GPS on a phone.

## Which files do I edit?

| Location | Purpose |
| --- | --- |
| `app.py` | Python server and research-equation calculations for the local app |
| `static/` | Local app pages, styles, browser logic, GPS recorder, and assets |
| `hosted/web/` | Complete browser source used by the live app |
| `hosted/web/model.py` | Python model used in the hosted browser through Pyodide |
| `hosted/worker/server-template.js` | Protected page serving and Sites identity handling |
| `hosted/scripts/build.mjs` | Builds the hosted Worker with embedded browser assets |
| `test_app.py` and `tests/` | Python, calculation, authentication, and UI interaction checks |
| `.vscode/` | VS Code debugger configuration and extension recommendation |

The local and hosted browser files are separate editions. Changes to `static/` affect your local Python app; changes to `hosted/web/` affect the hosted source when it is built and published. Neither a Git commit nor running the local app automatically deploys the live site.

## Current features

- Profile setup, a virtual self, and educational habit comparisons.
- Daily habit check-ins and seven-day progress.
- An interactive journal with calendar bubbles, line/bar graphs, date ranges, and editable day details.
- Sleep records and optional imported EEG charts.
- GPS walking/running with live distance, pace, estimated calories, pause/resume, automatic session saving, and recoverable drafts.
- Route playback, mile/km splits, elevation profiles, optional terrain-elevation lookup, and GPX export/import.
- Phone home-screen installation assets and optional screen wake lock.
- Hosted ChatGPT sign-in, sign-out, account-separated browser records, and an explicit legacy-data import.

## Important implementation boundaries

**Health and models:** this is an educational prototype, not a medical assessment or lifespan predictor. The habit index and future curve are illustrative. Energy estimates use research equations; no trained AI service is connected. Temperature/humidity provide weather and heat context, not an invented calorie bonus. EEG requires imported device data; a phone does not measure brainwaves or infer sleep stages here.

**GPS:** the app requires HTTPS or localhost and location permission. Keep it visible with the phone screen on. It auto-pauses when it leaves the foreground. Reliable locked-screen/background location tracking needs a native app. Permission and hardware limitations cannot be overridden by the app. Physical-phone outdoor testing is still needed.

**Accounts:** the hosted edition uses the Sites authenticated gateway. The local Python development server has no login protection. Do not expose the local server publicly or deploy the Worker outside Sites while trusting unverified identity headers. The existing hosted site is private; signing in does not grant an uninvited person access.

**Data:** health records and run drafts are stored in this browser's localStorage, not in a cloud database. Hosted storage is separated by account but is not encrypted. It does not sync across devices. Export before clearing browser data. Credentials, personal health records, and browser profiles are not included in this repository.

## Run checks

Python checks need only Python:

```bash
python -m unittest -v
```

The optional UI/build checks need **Node.js 20 or newer**:

```bash
npm install
npm test
```

On systems using `python3`, run `python3 -m unittest -v` and `npm run test:js` separately.

`npm run build:hosted` generates the hosted Worker. The output is ignored by Git because it can be rebuilt from source. The automated checks use simulated GPS and DOM interactions; they do not replace outdoor phone or browser sign-in testing.

## Further documentation

- [Feature and model notes](LONGEVITY_SIMULATOR.md)
- [GPS recorder and limitations](RUN_RECORDER.md)
- [Hosted build](BROWSER_VERSION.md)
- [Hosted authentication](hosted/AUTHENTICATION.md)

This project was developed with AI assistance. Review the code, document your contributions, and check your district's official Congressional App Challenge rules before submitting. The rules PDF was not available in this conversation, so competition compliance has not been verified.
