# Live GPS recorder

Open Exercise & routes on the hosted app in a phone browser. Use Add to phone for installation instructions (or the browser's install prompt). Sign in, allow precise location, then press Start outdoors. The timer begins with the first usable GPS fix. Pause excludes paused time and does not connect the movement between pause and resume. Finish stops the location watch and automatically saves the session to this account's browser storage.

The live dashboard shows active time, miles/km, average pace, estimated total energy (including resting energy during the active timer), and filtered ascent in feet/meters. It rejects stale fixes, fixes worse than 35 m accuracy, and implausible speed jumps; stationary jitter is reduced with a distance threshold. Long gaps and resumed sections are marked rather than bridged. Browser sensor accuracy still limits actual performance. Up to 10,000 accepted points are supported per session.

A draft is persisted with GPS fixes and periodically while recording. Reloaded drafts recover paused; they never silently restart location recording. Leaving the foreground auto-pauses. Screen Wake Lock is requested where supported. The web app cannot guarantee recording with the phone locked, in the background, or after the OS suspends it. Reliable background tracking requires a native mobile app with background-location permissions and lifecycle support.

## Review and playback

Open a saved session for a route overview, mile/km splits, partial last split, elevation profile, and time-based playback with a moving marker, play/pause/restart, a timeline slider, and speed selection. Playback displays distance, approximate cumulative calories, and altitude at the selected point. It holds the previous position during GPS gaps. Routes without timestamps use distance-based playback and are labeled. Export GPX preserves timestamps and segment breaks; JSON export preserves app-specific fields.

## Elevation and energy

Raw GPS altitude is accepted when supplied and sufficiently accurate; missing altitude is not replaced with zero. Height is smoothed with a local three-point median. Changes under 3 m accumulate before contributing to ascent. Implausible grades above 30% are omitted from ascent and disclosed. A run with no altitude can optionally use ground-elevation lookup from Open-Meteo. This sends up to 100 sampled coordinates, interpolates within continuous sections, and labels the result as terrain rather than GPS height. Terrain is not the height of bridges or elevated paths. The original GPS height is retained in JSON when replaced.

The recorder computes the ACSM-style equation on-device for immediate offline-capable statistics; the existing Python research model remains in the manual calculator. Calories are estimates, not measurements or a trained AI result. Weather is not automatically assumed for GPS sessions. Additional terrain and GPS uncertainty remains even with filtering.

## Installation and connectivity

The manifest, 192/512 px icons, and service worker support a standalone home-screen experience. The service worker never caches authenticated pages, identity, or health records. Sign-in, page reloads, map tiles, and elevation lookup need internet. GPS and on-device statistics can continue without network while an already loaded app stays visible. Maps use Leaflet and OpenStreetMap; the fallback route outline and playback marker remain available if tiles fail. Records remain browser-local, not cloud-synced.

## Verification

Simulated GPS/controller checks cover permissions, accuracy rejection, recording, pause/resume gaps, finish/automatic saving, units, playback controls, elevation cursor, draft recovery, and foreground interruption. Pure math checks cover distance, filtered ascent, uphill energy, splits, timing, gap playback, and GPX export. Existing authentication, journal, and app checks pass. Actual outdoor GPS, Wake Lock, browser installation, and external tile/elevation service behavior have not been verified on physical phones.

## GPS readiness and location errors

Before the first accepted fix, the recorder explicitly displays Getting GPS and a GPS WAIT TIME counter. It does not claim to be recording active time. After a usable fix, the display switches to ACTIVE TIME and advances while stationary. The acquisition wait is bounded at 45 seconds; timeout pauses the search and offers retry/cancel while preserving an existing route.

Permission denial, unavailable device location, and timeouts have persistent explanations and device/browser settings guidance, even if the browser supplies no error message. Poor fixes show the actual reported accuracy. Find my location is a map-only lookup: it tries precise location, then one network-based fallback after a non-permission failure. A rough location is labeled and never contributes distance or starts a run. Each attempt has an independent timeout, so browsers that fail to call back cannot leave the UI waiting indefinitely.

A GPS-equipped phone outdoors may resolve device limitations, but code cannot enable OS Location Services, override blocked permissions, or make a desktop's rough network position suitable for run recording. Added interaction checks verify the wait clock, timeout/retry/cancel, stationary active timing, empty-message errors, coarse-map fallback, and blocked permission behavior.
