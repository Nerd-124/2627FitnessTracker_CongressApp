# Editable habit planner

My plan supports one week, one calendar month, one calendar year, or a custom
inclusive period of 1–366 days. Up to 20 plans and 15 actions per plan are stored
in the signed-in account's browser data. JSON export and Delete all app data
include plans. There is no cross-device sync or external calendar connection.

The user supplies a written goal, focus areas, movement availability, a daily
movement time budget, an optional weekly target, and preferences. Free-text goals
and notes remain user context; they are not interpreted by a model. No AI service
or clinical risk model is connected.

Suggestions use saved baseline habits rather than hypothetical scenario sliders.
Sleep averages use at least three recorded bedtime/wake-up schedules in the last
14 days; otherwise the baseline is described without inventing a trend. This is
time in bed, not measured sleep. Movement uses recorded totals when at least five
of the last seven dates have records; otherwise it uses the saved baseline. Each
date uses the larger of journal minutes or saved session minutes to reduce double
counting. Missing dates remain unknown and may make recorded totals incomplete.

Movement starts within the user's time budget and does not automatically increase
through a long plan. Sleep suggestions concern a wind-down routine; meal actions
concern variety. Blood pressure, glucose, heart rate, BMI, weight-loss goals and
EEG are not interpreted to prescribe treatment. Adapt all actions to individual
needs and ability. Suggestions are transparent starting points, not guarantees.

Draft actions are editable before saving. Users can add their own actions, change
weekday repetition, choose a one-time date, and update goals while retaining
actions. Editing action titles keeps check-ins; removing/replacing actions or
scheduling dates that invalidate check-ins asks for confirmation before save.
Saved reasons retain the original recommendation snapshot.

The plan opens seven days at a time, with previous/next/today navigation. Future
actions cannot be checked off early. Check-ins are self-reported and do not create
exercise sessions or overwrite the daily journal. Completion totals only count
actions scheduled through today. Storage failures roll back attempted writes.

Run node tests/planner.cjs with jsdom 26 available for development. Tests cover
period boundaries, baseline/recent-data logic, editing, custom actions, check-ins,
reload persistence, storage rollback and deletion without touching other records.
