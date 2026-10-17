# Free chat coach

The coach is a deterministic, browser-only conversation engine, not an AI model.
It has no API key requirement and makes zero requests to an AI provider. The
former paid endpoint returns 410 even if a server key exists. No key was created
or paid model request made for this implementation.

Start with a goal such as feeling fitter, energy, strength, stamina or consistency.
The coach asks about frequency, then offers three one-week alternatives. Messages
such as "10 minutes", "three days", "only weekends", "easier", or "no running"
refine the options. Recognized activity preferences include walking, running,
swimming, basketball, cycling, dancing, yoga and familiar bodyweight movement.
Unrecognized goals get a clarifying question instead of a fabricated AI answer.
Natural-language interpretation is limited; review every generated action.

Optional activity/sleep context stays local. Low or unknown starting movement
uses shorter starting durations. Selected days, minutes, exclusions and available
weekdays affect scheduling. Quiet recovery or planning actions are added where
appropriate. This is not medical, injury-specific, or weight-loss treatment.
Current symptom or injury concerns stop exercise suggestions and remain in the
conversation context. Clear conversation starts fresh, not a clinical clearance.

Nothing is saved just by chatting. Choosing a plan adds it to the existing
planner and displays its scheduled actions on Today. Users can edit it in My
plan and check off progress in either location. Conversations stay in tab memory;
chosen goals, actions and check-ins are stored in account-scoped browser data.
Other existing app services (sign-in, map tiles) still need their usual connections;
this does not claim that the entire app works offline or that hosting is forever
free. The coach has no per-message API fee.

Tests: build with node scripts/build.mjs; run node tests/coach-server.mjs and
node tests/coach-ui.cjs with jsdom 26 available. They verify follow-ups, exclusions,
time and weekday limits, symptom boundaries, adoption, Today check-ins, and zero
provider calls. Planner, exercise and sleep regression tests remain included.
