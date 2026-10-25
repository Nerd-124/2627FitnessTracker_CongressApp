# Exercise, mental well-being and sleep

This app is an educational routine/well-being snapshot, not a medical diagnosis,
biological-age calculation, disease-risk estimate or lifespan forecast. The
illustrative character's age is the entered age plus 25 years. Its appearance and
accessibility features are chosen by the user, never inferred from a grade.

## The three primary tracks

1. Exercise: existing age-specific WHO activity comparisons are retained. Adults
   use 150 moderate-equivalent minutes weekly; adult vigorous minutes count twice.
   Ages 13–17 use 420 moderate-to-vigorous minutes across the week. Logged intensity
   is required; GPS speed and steps cannot supply it. Partial/unknown records are
   not silently treated as zero. A usual routine can supply labelled context while
   a logged week is incomplete. There is no separate gym/strength grade.
2. Mental health: the WHO-5 Well-Being Index measures self-reported mental
   well-being over the past two weeks. Five unchanged items use the original 0–5
   response options. Raw score 0–25 multiplied by 4 gives the official 0–100 score.
   All five answers are required. The latest complete assessment within the latest
   14 local dates is used; absent/expired results remain unknown. This is not a
   comprehensive assessment of mental health or immediate safety. Higher scores
   cannot rule out difficulties; lower results prompt supportive guidance, not a
   diagnosis. Optional daily energy/stress check-ins do not change the WHO-5 score.
3. Sleep: recorded duration/time in bed or a labelled usual routine is compared
   with CDC age references: ages 13–17, 8–10 hours; 18–60, at least 7; 61–64, 7–9;
   65+, 7–8. Duration alone cannot establish restorative sleep or sleep quality.

## App-defined A–E display

The official WHO-5 result is always shown as a number out of 100. It supplies a
ratio of score/100 for this app only. Each primary ratio is capped at 1 before
averaging; at least two of the three must have sufficient data. Missing answers
are excluded, not assigned E. The existing bands are A >=1, B >=.75, C >=.5,
D above 0 below .5, E exactly 0. Thus the mental track's app band is A=100,
B=75–99, C=50–74, D above 0 below 50, E=0. WHO-5 scores occur in increments of four.

These letters and the combined snapshot are NOT standardized WHO categories,
medical severity, a validated health ranking, or a measure of personal worth.
WHO-5 contains items related to rest/energy, so the combined app score should not
be interpreted as three independent clinical measurements. Independent expert
review of the combined presentation is pending.

BPM is retained in saved readings and an internal physiological-context field.
It is not displayed as a principal report card or secretly weighted in a score.
There is no validated universal conversion from a single pulse or a before/after
pair to mental health, routine quality or biological age. Other clinical readings
remain contextual. Legacy stored fields from retired features are ignored, not
used to influence grades or automatically erased from historical account records.
The optional photo feature and face-image rendering/upload controls are removed.

## Sources and instrument rights

- WHO physical activity guidance: https://www.who.int/publications/i/item/9789240015128
- CDC sleep guidance: https://www.cdc.gov/sleep/about/index.html
- World Health Organization. The World Health Organization-Five Well-Being Index
  (WHO-5). Geneva: WHO; 2024. https://www.who.int/publications/m/item/WHO-UCN-MSD-MHE-2024.01

WHO-5 questionnaire © WHO 2024, CC BY-NC-SA 3.0 IGO. The items, answer choices and
sum-times-four calculation are reproduced without alteration for this
non-commercial educational application. Instrument content is available under
https://creativecommons.org/licenses/by-nc-sa/3.0/igo/. No WHO logo is used and WHO
does not endorse the app, its custom bands or combined score.

## XP and history

XP rewards recording, never symptom scores or physiological values. Sleep,
exercise/rest-day logging and a mental well-being check-in each earn 3 XP, with
optional steps/notes/completed-boost groups capped at 2 additional XP per date.
Daily check-ins can be recorded with energy/stress; users need not repeat the
WHO-5 daily. Five complete days in a calendar week add 5 XP once. Re-saving does
not duplicate points. No reward requires a high WHO-5 score. Historical journal
fields and run sessions remain account-scoped; guest records stay on-device.

## California demonstrations

Three continuous route extracts use real coordinates, timestamps and elevation
readings from the recorded 2016 Santa Rosa Marathon GPX distributed with
leaflet-gpx, revision 90582f1543552cda13335dfe3534c8b5e4caf108. These are clearly
labelled read-only demos, not personal workouts; they never enter account data,
WHO-5 history, totals, grades or XP. Original source heights may contain noise.
Distances/ascent are calculated by the existing run-analysis module; demo calorie
estimates use illustrative body mass of 70 kg and are labelled estimates.

The source GPX has no temperature measurements. The viewer requests a historical
hourly modeled air-temperature estimate from Open-Meteo at the recorded route
start/date. Nearest-hour selection and Celsius units are checked. Failure shows
unavailable, never a fabricated value. No live weather value is presented as a
historical measurement. See web/demo-route-license.html and
references/CALIFORNIA_GPX_LICENSE.txt for source attribution and redistribution terms.
