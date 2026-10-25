## Five-area habits and goals (website update)

The first optional popup now includes age, goals, a future life goal and access
preferences. The portrait illustrates entered age +25 years, rather than a fixed
2050 destination. Movement, strength, sleep and nutrition patterns have transparent
prototype A–E progress bands; recovery and well-being have supportive check-ins and
trends, never a mental-health grade. Independent expert review is pending.

One small daily challenge has an accessible alternative. Marking Done saves only
completion, not invented exercise or steps. An optional wearable CSV importer
previews personal daily records and requires ownership confirmation. It is not a
live watch connection. These website features need no new native build. Keep build
7 for camera capture and build 6+ for protected phone steps.

## Free selfie portrait — build 7

Home now shows your entered age plus 25 years. Take or upload a photo. In the free edition this is a local, lightly stylized selfie preview, not an AI-generated aged face or a face-health scan. There are no API calls or portrait-generation charges. Photos are resized to JPEG locally. They remain on the device unless the user explicitly checks Sync this portrait with my Google account. Account → Your portrait can change or remove it.

Install the full build 7 project for in-app camera capture: it includes the camera and photo usage descriptions. Existing older shells can still upload photos; the camera choice is hidden until build 7 is installed. Keep the same bundle identifier, sign both app and widget targets, and install over the app without deleting it. Real iPhone capture/permission testing and Xcode compilation remain necessary.

Tap the portrait for a compact routine report. A–E habit grades are app-defined summaries of recorded reference checks, not validated medical grades. The seven pavilion-style health areas stay Not measured. Body age is not calculated from a face or logs; an outside result may be entered and is labelled reported, with its source/date. Higher reported results prompt habit-based next steps without claiming those habits caused the difference. The horizon is always 25 years beyond your entered current age.

## Step-source protection — build 6

Install the full updated project over the existing app (same bundle identifier; sign both LongevityLive and RunActivityWidget). Website reloads alone cannot install the native device-source lock. Older native builds now have step importing disabled by the website until updated.

In Daily journal, tap Link my iPhone only on your own phone. Confirm ownership and allow Motion & Fitness. The native installation is then bound to that personal Google account; another account cannot claim its source by logging in or clearing browser storage. Earlier phone motion history is excluded. A saved enabled flag alone cannot enroll a new or borrowed phone. After importing is stopped or another account is used, the owner must confirm again before resuming; the paused interval is not imported. Existing synced account totals are retained as the baseline.

The phone measures its carrier’s movement, not their identity. Leave step importing off on borrowed/shared phones; a confirmation cannot verify who physically carries a device. Tests cover account/source filtering, cancellation and old-build blocking, but Xcode compilation and real-device account-switch tests remain necessary.

## Steps journal

Install build 6 to add the iPhone motion counter. Open Daily journal → Steps journal → Link my iPhone and allow Motion & Fitness. Daily totals come from Core Motion, including up to seven recent days after linking while the app was closed. Earlier phone history is excluded. Reopen the app to import them; recorded days remain saved and sync to the website with the same Google account. This counts the iPhone you carry, not a merged Apple Watch/Health total. Stop importing steps turns off access in the app; saved totals remain. Deleted day entries are not automatically recreated unless you explicitly enable importing again. No steps are estimated from GPS.

## Recorder build 7 — install this update on your iPhone

Website reloads cannot update native GPS or install the Live Activity extension. Download this ZIP, extract it, and open the included LongevityLive.xcodeproj. Keep the existing bundle identifier. Set your Team for BOTH LongevityLive and RunActivityWidget, select your real iPhone, then Command-R. Do not delete the installed app.

On iPhone, allow Precise Location while using the app, Live Activities, and notifications when requested. Open the app’s bottom-right options → Run recording status. It must say Recorder build 7 and Run widget: installed. Start a run outdoors, wait until Recording live, and check that Background session is active and Live Activity running. Lock the screen for two minutes while moving around a corner, then return and verify the actual turn, time and altitude. No native iPhone test has been run in the Linux workspace. Do not force-quit the app: iOS can stop recording if the app is terminated. Missing locations are shown as gaps, not reconstructed streets.

This update adds an explicit native background-location session, acknowledges delivery of GPS batches before removing them, restores timestamped points even when WebKit missed the background event, and offers notifications when Live Activities cannot be shown. It cannot recover locations missing from earlier runs.

## Continuity and journal playback update

Normal background/foreground transitions now retain one WebKit view and refresh sign-in silently. They must not reset the page, scroll, saved-run viewer or active recorder. Rebuild this updated native project for that retention change; the website update also removes the full-screen routine sign-in check.

Saved-run maps, elevation and time-lapse are now together in Exercise → Past log → Map & time-lapse. They use an independent map so reviewing an old run does not replace the current run’s GPS route. If street tiles fail, a recorded-route preview still supports playback. Older sessions with no recorded duration cannot be animated; the app does not invent missing GPS.

After rebuilding on your actual iPhone, start a new outdoor run, switch to the Home Screen for at least two minutes, reopen, and check elapsed time, page position, live route, Lock Screen card and Dynamic Island. Then finish and open the journal map. Xcode compilation and physical-device verification are still required; normal app switching is supported, while force-quitting or iOS process termination can stop recording.

## Live Activity and run syncing

Rebuild this complete updated project on your iPhone for the Lock Screen run card and Dynamic Island. A website reload cannot install the widget extension.

1. In Xcode, choose your Personal Team for **both** targets: LongevityLive and RunActivityWidget. Keep the main app bundle identifier the same as the app already on your phone. The widget identifier must start with that identifier and end in `.RunActivity`.
2. Build the LongevityLive scheme on your actual iPhone. The scheme embeds the RunActivityWidget extension automatically. Do not delete the existing installed app if you want to keep device-only records.
3. Allow location and enable Live Activities for Longevity Simulator in iPhone Settings. Start a run outdoors and wait for GPS. Lock the screen or switch apps: the Lock Screen card and Dynamic Island should show the timer, distance and recorded estimates. If Live Activities are disabled, a normal notification is an optional fallback when notifications are allowed.
4. Finish and save. With Google sign-in and internet, wait for “Finished runs are synced to your Google account.” Sign in to the website with the same Google account, then open Exercise → Past log → View route & time-lapse. Guest runs stay on their device.
5. Finished runs, routes, run temperature/pulse readings and elevation are now stored privately on the site's database for account syncing. Profiles, routines, journal entries, workouts and imported EEG also sync with the same Google account. Open Account → Sync now to check progress. Guest records remain device-only. Deleted runs propagate between signed-in devices. Conflicting edits ask which version to keep.

The widget/ActivityKit Swift code and background GPS still need an Xcode build and a real iPhone test. Force-quitting or iOS terminating the app stops GPS; a stale Live Activity asks you to open the app rather than claiming fresh GPS.

## Background-running update

Website changes update the journal, clear button, and elapsed timer. For continuous locked-screen GPS, download this updated project and rebuild it on your iPhone; the older shell stops GPS in the background. Keep the same bundle identifier and Google configuration. In Xcode → Signing & Capabilities, confirm Background Modes → Location updates is enabled (the included Info.plist declares it). Build on your device and test a short outdoor run before relying on it.

# Longevity Simulator — your live website as an iPhone app

This is a **new, separate Xcode project**. Keep the earlier SwiftUI starter project as a backup. Do not drag this whole folder into an existing project.

## First run — five steps

1. Extract **LongevitySimulator-Xcode.zip** in Finder.
2. Move the extracted **LongevitySimulator-Xcode** folder somewhere permanent, such as Documents/Projects.
3. Inside it, double-click **LongevityLive.xcodeproj**.
4. At the top of Xcode, choose an iPhone simulator, then press **Command-R**.
5. Wait for the live website, tap Continue with Google and choose your Google account, and try the simulator.

The first sign-in and Python startup can take a moment. Choosing a particular simulator does not limit which iPhones the app supports. The project targets iPhones running iOS 17 or later.

## Put it on your iPhone

1. Xcode → Settings → Accounts: add your Apple Account if it is not there.
2. Connect your unlocked iPhone to the Mac and accept Trust prompts.
3. Click the blue project icon → **LongevityLive** target → **Signing & Capabilities**.
4. Select your **Personal Team**. Keep **Bundle Identifier** set to `com.longevitysimulator.iosapp`—it must match the included Firebase configuration. If you must change it, register that exact new identifier in Firebase and download a matching configuration first.
5. Enable Developer Mode on your iPhone if Xcode asks.
6. Choose your connected iPhone at the top of Xcode and press **Command-R**.
7. For a GPS test, go outdoors. Press Start run and allow location access with **Precise Location** enabled.

Keep your bundle identifier stable to retain the same app's local records. A free Personal Team supports testing your own app, normally with seven-day provisioning that you renew by rebuilding. This project does not buy or enroll you in anything. App Store distribution is a separate process.

## What updates automatically?

The app loads:

https://longevity-simulator-lab.idealapple4.chatgpt.site/app

It uses the **same HTML, JavaScript, CSS, Python model, and services as the live website**. Changes published to that website appear on the app's next fresh launch or reload. While the app is open, use the small **…** button → **Reload latest website**. Finish or pause a run first.

Internet is required to open the live website and load its calculation runtime. Maps, weather, route checking, and terrain also depend on their external services. This export does not include an offline edition.

## Return to the app after Google sign-in

Tap Continue with Google inside the app. Complete Google’s account selection, password or verification prompts. Google then dismisses the authentication sheet and returns automatically to the simulator after its session is verified. Entering an email alone is not enough to authenticate. Normal launches restore your signed-in session without opening Google again.

For this native update, download this ZIP again, extract it into a new folder, open that folder’s LongevityLive.xcodeproj, select your existing signing team and run with Command-R. Keep the bundle identifier unchanged, and do not delete the installed app, to preserve its local records.

## Sign-in and records

This edition uses **Google sign-in with Firebase Authentication**. It does not ask users to create ChatGPT accounts. The included `GoogleService-Info.plist` matches `com.longevitysimulator.iosapp` and contains public Firebase app configuration, not a service-account private key.

Xcode automatically resolves **FirebaseCore**, **FirebaseAuth**, and **GoogleSignIn** through Swift Package Manager. Allow the package download to finish before pressing Run. There is no npm/CocoaPods setup. Google's sign-in sheet opens using the native SDK/system browser, not the embedded web view. Firebase verifies the Google credential; the website verifies the Firebase ID token using the official Firebase Authentication service, then returns a short-lived Secure/HttpOnly session cookie to the app. Native tokens are not injected into web JavaScript.

The iPhone app has its own persistent WebKit cookie and local-storage container. Finished runs now sync between this app and the website when signed in with the same Google account and online. Other journal entries and guest records remain device-only. Keep device-only records before changing devices or deleting apps.

Normal updates using the same app identifier preserve its local data. Deleting the app removes that container. The default project identifier is different from the old native starter, so installing this app does not replace that starter's data.

## iPhone support included

- The full live website interface, including future-self avatar, coach, planner, journal, EEG/GPX tools, and route planning.
- Core Location bridge for the website's existing GPS recorder. The existing web accuracy filters, timer, pause/resume, and save rules remain the source of truth.
- An explicitly started run can continue native GPS while the screen is locked or you switch apps. iOS shows its location indicator. Pause/finish stops location. The web timer preserves elapsed time; native fixes collected while WebKit sleeps are delivered on return. Browser-only use marks missing sections as gaps. Force-quitting the app or iOS terminating it stops location; no route is invented. Background points are buffered in memory, so force-quit can lose undelivered points.
- File uploads use the iPhone document picker. Downloads use WebKit download support and the iOS share sheet, where you can choose **Save to Files**.
- JavaScript confirmations (for deleting records or routes) use native confirmation dialogs.
- External research links open outside the app. Google authentication uses the system browser; a verified web session is saved in the app’s persistent cookie store.
- A reload/retry view if the live website cannot load.

While recording, GPS fixes stay on your device and in a temporary native buffer. Finished Google-account runs sync privately to the site database. Existing weather, pedestrian routing and terrain lookups can send relevant coordinates to their providers. Guest runs remain local.

## Edit later

- **Website design/features:** keep updating and publishing the live website as before. The iPhone app follows those updates.
- **Website address:** edit `LongevityLive/AppConfiguration.swift`, then rebuild.
- **Native GPS:** edit `NativeLocationBridge.swift` and `NativeBridge.js`, then rebuild.
- **App shell/file sharing:** edit `ContentView.swift` or `LiveWebView.swift`, then rebuild.
- **Editable web snapshot:** `WebSourceSnapshot/` contains the current web source for reference/backup. It is intentionally not copied into the app bundle. Editing that snapshot does not publish the website; publish changes through your web project to update the running app.

There are no Capacitor, Node, CocoaPods, or paid AI dependencies. Xcode downloads the official Firebase and Google Sign-In packages automatically. Native changes need a rebuild; website changes need publication. Add an app-icon asset and review distribution requirements before an App Store release.

## Important first-device checks

This package was prepared in Linux. **Xcode and an actual iPhone were not available, so it has not been compiled or device-tested here.** Bridge behavior and project structure were checked separately. Do not assume those checks prove an iPhone build or real GPS accuracy.

After Command-R:

1. On the login screen, tap Continue with Google. Complete the system sign-in sheet and confirm you return to the simulator. Cancel sign-in and retry once. If there is an error, send its exact message. Firebase/Google project configuration and an actual device sign-in cannot be validated in this Linux environment.
2. Open Account → Your routine. Save or choose Do later, then check the avatar on Home.
3. Relaunch and confirm your scenario and journal entries remain.
4. On a physical iPhone outdoors, test location permission, the timer while stationary, pause/resume, finishing one saved run, locking the screen for several minutes, reopening, finishing two runs on one date, checking journal totals, and Clear saved run. Verify GPS actually records background locations on your device.
5. Sketch a route, check elevation hover/touch, then test a GPX/CSV import and **Export my data → Save to Files**. Live service availability still matters.

If Xcode shows a red error, send the **first red error message** and its filename. A simulated GPS route is useful for UI testing but does not validate actual location accuracy.

## Google sign-in troubleshooting

- Open this newly downloaded project in a **newly extracted folder**, not an older copy that still shows Continue with ChatGPT.
- Wait for Xcode's package resolution to complete. If needed: File → Packages → Resolve Package Versions.
- Verify the target's Bundle Identifier is `com.longevitysimulator.iosapp` and choose your Personal Team.
- The Firebase plist is already included in Copy Bundle Resources. Do not add a duplicate.
- The reversed-client-ID URL scheme is already in Info.plist and `.onOpenURL` forwards the callback to Google Sign-In.
- Google provider must be enabled in Firebase Authentication; the website hostname must be in Authorized domains. Both were configured during setup.
- The website entry page is reachable without ChatGPT. The simulator and account API still require a verified Google session. Sign-out clears that session and the native Firebase sign-in.
- Firebase Authentication stays on your chosen Spark plan; this work adds no paid AI or health-record database. Normal project quotas still apply.

The old ChatGPT-based browser records are not deleted or automatically assigned to a Google account. A Google account uses a new local namespace. Keep exports of any earlier records you need.

## iPhone app icon
The Orbit leaf-and-path icon is included in Assets.xcassets → AppIcon and configured for both Debug and Release. Open this updated project, retain your existing bundle identifier and signing Team, then run it on your iPhone to update the installed icon. A website reload alone cannot update a native app icon. For a Safari Home Screen shortcut, add the website again to pick up the new Apple touch icon.
