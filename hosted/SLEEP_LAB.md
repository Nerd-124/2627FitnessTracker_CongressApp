# Sleep lab

The default sleep page needs no wearable. Add a wake-up date, bedtime, wake-up
time, optional rested rating and notes. Saved nights update the same daily
journal record and preserve meals, exercise, biometrics and journal notes.

Review 7, 30 or 90 days through date bubbles and accessible graph points. Empty
nights are not joined by lines. Edit a night or remove just its sleep information.
Time in bed is a schedule-based estimate within 24 hours, not measured sleep;
night waking, naps, dates spanning more than 24 hours, and DST transitions are
not modeled. Sleep quality is self-reported, not inferred from EEG.

Optional EEG imports support the downloadable raw microvolt or band-power CSV
formats. The parser checks increasing time, numeric values, nonnegative band
powers, row counts and file size. Imported recordings support channel selection,
windowing, sample inspection, export, and confirmed deletion. Device-specific
CSV headers may need conversion to this documented format. There is no live
EEG device connection or sleep-stage classification. The sample is synthetic,
clearly labeled, and never saved to health records.

All sleep records and EEG imports remain in account-scoped browser storage.
A quota failure rolls back the attempted save. There is no cross-device sync.

Run `node tests/sleep.cjs` with jsdom 26 installed in your development environment.
The test covers journal preservation, edits, calendar/graph behavior, storage
failures, CSV validation/import, sample controls, persistence and deletion.
