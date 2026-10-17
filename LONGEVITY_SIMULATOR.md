# Longevity Simulator

A Python web app for exploring lifestyle choices through a virtual self. Uses only Python's standard library; no dependencies or API keys required.

## Run

1. Install Python 3.10 or newer.
2. Open a terminal in this folder.
3. Run `python app.py` (or `python3 app.py`).
4. Open **http://localhost:8000** in your browser.

Stop with Ctrl+C. To select another port, set the `PORT` environment variable before starting. The server binds to localhost for personal use. This development server is not a production hosting solution.

## Features

- Virtual self and selectable future age, with interactive movement, sleep, and nutrition scenarios.
- BMI and Mifflin–St Jeor resting energy estimates for adults, including a range when a sex-based coefficient is unspecified.
- Clearly labeled illustrative habit index and future curve, with transparent model explanation.
- Daily meals and calorie estimates; bedtime, wake-up, exercise, heart rate, blood pressure, glucose, and optional sleep/EEG notes.
- Local records, measurement trends, JSON export, and deletion.
- Walking/running energy estimates incorporating ascent, with speed-range cautions and contextual temperature/humidity messages.
- GPX import and optional phone/browser GPS recording; a local route outline and external OpenStreetMap location link.
- Responsive interface with no external fonts, scripts, or image dependencies.

## Try a three-minute demo

1. On Future self, reduce sleep and movement; see how the illustrative index changes. Restore sustainable habits and compare the curve.
2. Change height and weight in Your baseline and explain the BMI and resting energy equations.
3. Add two journal dates with different measurements; open the measurement selector to compare trends.
4. Import `sample-route.gpx` in Activity explorer. Set duration to 45 minutes and calculate. Repeat with elevation gain set to zero to demonstrate the energy contribution of hills.
5. Open Behind the science to explain the model's assumptions, sources, privacy, and limitations.

## Scientific boundaries

This prototype is educational, not medical advice. The index weights, reference score, and future curve are design heuristics, not a validated disease-risk, aging, or lifespan model. The virtual self is a generic illustration, not a prediction of appearance. BMR and BMI equations have individual limitations and are restricted to adults here. Nutrition entry records user estimates; it does not generate a calorie restriction target.

Activity energy follows ACSM-style walking/running oxygen-cost equations. Total ascent is an approximation rather than segment-by-segment terrain modeling. GPS noise may inflate elevation gain. The displayed ±25% range is illustrative, not calibrated uncertainty. Temperature and humidity do not modify calorie estimates without a validated model. Review the in-app science page for formula details and research links.

## Integration status

Working: Python JSON endpoints, browser-local storage, manual journal data, GPX parsing, and browser GPS where permitted.

Connected on request: Leaflet/OpenStreetMap street maps and Open-Meteo current weather. EEG files can be imported and visualized, and GPS/GPX supplies route altitude when available. Not connected: trained AI, clinical risk estimation, live wearable APIs, EEG hardware, or elevation lookup services. The coach is rule-based and labeled accordingly. GPS requires permission plus localhost or HTTPS; mobile access to a remote plain-HTTP host usually will not work. GPX import works without GPS permission. The external map link opens the first coordinate in OpenStreetMap. The optional embedded map uses Leaflet and OpenStreetMap tiles.

If you later add AI, keep provider keys on the server and restrict responses to cited educational explanations. A validated research model and expert review are necessary before making personal medical risk or longevity claims. EEG requires compatible hardware.

## Data and privacy

Baseline, habits, journal records, and routes stay in browser localStorage. Calculation inputs are sent to the local Python server, which does not persist them. Data is not encrypted; use fictional data in public demos. Browser profiles on a shared machine can expose stored records. Export downloads JSON; delete removes all app data in this browser. No import/restore of JSON exports is currently provided. No accounts or automatic cloud backup.

## Tests

Run `python -m unittest -v`. The tests check BMR/BMI calculations, altitude energy costs, weather handling, invalid inputs, and index limits.

## Congressional App Challenge preparation

The rules PDF was not attached in this conversation, so eligibility and rule compliance have not been verified. Check the official rules for your district and competition year, including eligibility, dates, team size, originality, third-party/AI disclosures, and required submission materials. Document your own design decisions, implementation contributions, sources, and any AI assistance accurately. This README is not a replacement for the official rules.

Suggested next steps: obtain feedback on the educational model, test on a phone, decide whether to add real wearable/AI integrations, and prepare a short demo video explaining which features work and which are planned.

## Profile setup and personal dashboard

New users begin with a three-step setup: basic measurements, daily habits and optional meals, then optional biometrics. BMI and resting energy estimates update as measurements are entered. Finishing setup saves the profile in this browser and opens the dashboard; returning users continue straight to it. Existing demo storage is preserved, but users must complete their own profile before using the dashboard.

The dashboard shows the latest recorded sleep, meals, heart rate, blood pressure, and glucose. Scenario comparisons use the saved starting habits. “My starting habits” restores those values; “My profile” reopens setup for edits. Initial meals and measurements become a journal entry if that date does not already have one. Editing the profile preserves existing journal entries.

All data remains local to this browser. These are saved profiles, not authenticated user accounts or cloud synchronization.

## Action-first home

Today is now the default home page after setup. Choose a small daily action (movement, wind-down, or fruit/vegetables), check it off, or undo a check-in. One focus is saved per local calendar date; switching a completed focus asks before clearing that day's check-in. The last seven calendar days display actual self-reported completions, not a health score. These entries are included in the existing JSON export and deletion flow.

Journal and route actions are one click from home. The separate Try a habit page compares entered habits with the user's saved routine in plain language. Calculated BMI, resting energy, and the illustrative habit index and curve are collapsed under optional details. Future-age controls are hidden. A scenario can lead to choosing a related small daily action; this is a planning aid, not a personalized medical prescription.

Validation: DOM interaction checks cover daily action selection, completion, undo, persistence, seven-day display, navigation, scenario comparison, and collapsed model details, alongside the profile setup regression checks. Visual browser QA is unavailable in this environment.


## Sleep, brainwaves, and exercise sessions

The Sleep & brainwaves page shows journal bedtimes and wake-up times. Import a compatible EEG CSV with `time_s,amplitude_uv`, or `time_s,delta,theta,alpha,beta,gamma`. Time must increase; band power must be nonnegative. The app plots device data without inferring sleep stages. Keep one consistent unit for each band. Up to ten recordings of 5,000 data rows each can be retained; browser storage limits may be lower. The header-only downloadable template contains no fabricated user data.

Exercise & routes now saves multiple walking/running sessions with date, duration, average speed, distance, ascent, weight, weather, estimated calories, and a route snapshot. Saved sessions can be reopened. GPS requires browser permission and HTTPS/localhost; the elapsed recorder time fills duration while recording. Manual exercise types such as cycling and strength remain available in the daily journal; calorie equations here support only walking/running.

Loaded route segments use their horizontal GPS distance and positive elevation change. A constant-speed approximation allocates the entered duration across segments. Breaks between GPX segments are omitted; downhill is treated as flat. Missing altitude means ascent is omitted and is disclosed. GPS noise can inflate ascent; segment grades above 30% are rejected. Manual mode uses entered distance and total gain. The SVG outline and elevation profile work offline; the optional street map requires internet and loads Leaflet from jsDelivr and tiles from OpenStreetMap.

The current-weather button sends the route's last coordinate to Open-Meteo. It records current temperature and humidity, not historical route weather. Both contribute to a NOAA/Rothfusz-style shade heat index where applicable. Temperature and humidity do not become an unsupported calorie multiplier. The app labels its energy result as a research-equation estimate, not a trained AI estimate. A validated weather-energy model and AI/device service remain future integrations.

Validation: nine Python model tests and DOM interaction checks for EEG validation/charting, route-segment breaks, saved exercise sessions, and existing onboarding/habit features pass. Real GPS hardware, external map/weather calls, and visual browser QA were unavailable in this environment.


## Interactive daily journal

The journal now opens with range summaries, a month calendar of clickable date bubbles, and an interactive line/bar graph. Calendar filters show dates with the chosen measurement. Graph metrics include sleep, exercise duration, recorded meal calories, heart rate, both blood pressure values, and glucose. Time ranges include the displayed calendar month and the last 7, 30, or 90 days.

Selecting a calendar bubble or graph point shows that day's saved details. The selected-day button opens the editing form below the dashboard. Saving updates summaries, bubbles, chart, and day details together. Missing values are omitted rather than converted to zero; line segments only join consecutive recorded dates. A recorded zero remains visible. Summary exercise totals use journal entries only, to avoid double-counting separately saved route sessions.

Checks cover leap-year months, calendar filters, chart gaps, recorded zeros, keyboard graph navigation, edit/save updates, deletion, date ranges, empty states, and unsaved-edit protection. Browser visual QA remains unavailable.
