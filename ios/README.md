# Longevity Simulator for iPhone — editable native source

This is a native SwiftUI starter app, separate from the JavaScript web app. No Capacitor, Python server, API key, or subscription is needed to run it. Minimum iOS: 17.0. Selecting an iPhone simulator does not limit support to that model.

## Open it

1. Download the repository ZIP from GitHub and extract it in Finder.
2. Keep the entire extracted folder somewhere permanent, such as Documents/Projects.
3. Inside `ios`, double-click `LongevitySimulator.xcodeproj`.
4. Choose an iPhone simulator at the top of Xcode, then press Command-R.
5. Enter your name and goal. Explore the tabs.

This opens a separate project. Keep your earlier Xcode project as a backup. Its name and goal will not automatically migrate to this project's app identifier. The web app's browser records also do not transfer automatically.

## Put it on your physical iPhone

1. In Xcode → Settings → Accounts, add your Apple Account.
2. Connect the unlocked iPhone to the Mac and accept Trust prompts.
3. Select the blue project icon, then the LongevitySimulator target → Signing & Capabilities.
4. Choose your Personal Team. Change `com.example.LongevitySimulator` to a unique identifier, for example `com.yourname.longevitysimulator`. Keep that identifier stable after you start saving real records.
5. Enable Developer Mode on the iPhone if Xcode requests it (Settings → Privacy & Security → Developer Mode).
6. Select your connected iPhone as the run destination and press Command-R.
7. Start a run outdoors and allow location access with Precise Location enabled.

A free Personal Team supports testing your own app. Free provisioning generally expires after seven days, requiring another build/install from Xcode. App Store distribution is a separate process and normally needs paid Apple Developer Program membership. Nothing here enrolls or charges you.

## Edit later

All Swift source is included. Edit in Xcode or VS Code, save, then rebuild in Xcode. Keep a Git repository/backups. Updating the same installed app normally preserves data; deleting the app erases its local data. Changing bundle identifiers creates a separate app/data container.

- `ContentView.swift`: onboarding, tab navigation, Today, editable scheduled tasks/profile.
- `AppStore.swift`: Codable models and atomic JSON storage in the app Documents directory.
- `RunTracker.swift`: Core Location permissions, elapsed timer, accuracy and jump filters.
- `ExerciseView.swift`: map, run controls, typed activity logging, history/delete.
- `SleepView.swift`: manually entered nights, edit/delete, recent sleep chart.
- `SimulationView.swift`: educational habit sliders/curve ported from `longevity/health.py`.
- `CoachView.swift`: free deterministic chat templates, three weekly options, explicit adoption to Today.
- `LongevitySimulatorApp.swift`: app entry point.

For a new screen: create a SwiftUI View file inside LongevitySimulator, ensure target membership, then add it to ContentView's TabView. Keep data models in AppStore. Add migrations before changing persisted Codable fields: otherwise existing records may fail to decode. The app refuses to overwrite unreadable files and shows a storage error.

## Included and current limits

Included: saved profile, Today tasks with editable dates, completion tracking, manual activities, foreground GPS run recording, saved route coordinates, sleep records/charts, habit simulation, free rule-based chat plans.

Not yet ported from the web edition: EEG CSV import/viewer, GPX import/export, route replay, full journal/calendar, local account authentication and full manual week/month/year planner. Coach offers weekly templates; you can schedule/edit individual tasks on any date. It is not an AI language model and does not understand unrestricted instructions, exclusions, or medical needs. Native data is local to this installation; there is no cloud synchronization or backup/export UI yet.

GPS filters favor avoiding false distance, so short movements or poor reception may be undercounted. It cannot improve the phone's physical GPS accuracy. The timer starts immediately even without GPS, uses monotonic elapsed time, and excludes explicit pauses. Leaving the foreground or Exercise tab pauses tracking; there is no background/locked-screen run support yet. Sleep is manual, not sensor-based. The illustrative habit score does not forecast lifespan or disease.

## Validation before relying on it

Source and project structure were checked in a Linux workspace. Xcode/Apple SDKs are unavailable there: this version has NOT been compiled or tested on an iPhone yet.

In Xcode verify:
- Command-B completes without errors; report the first red error if it fails.
- Profile survives relaunch; editing it works.
- Choose one Coach plan: Today shows the first task; upcoming tasks can be edited/deleted; completion survives relaunch.
- Save a typed activity and a sleep night; relaunch; verify both remain. Same wake-up day replaces its sleep entry.
- On a physical iPhone outdoors: timer advances while stationary, pause freezes it, resume excludes paused time, permission denial gives a message, rough GPS doesn't invent distance, finish saves once.
- Switching tabs/locking the screen pauses a run; return and explicitly resume.
- Compare distance against a known route. Simulator mock GPS does not validate real accuracy.

The project intentionally starts without an app icon or distribution signing setup. Add an asset catalog/app icon before distribution.
