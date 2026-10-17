"""The complete calendar, graph, and journal form are Python code."""

from datetime import date, timedelta
import altair as alt
import pandas as pd
import streamlit as st
from longevity.journal import (
    METRICS,
    metric_value,
    month_weeks,
    summarize,
    validate_entry,
)
from .shared import format_optional, time_input_value


def optional_input(label, key, low, high, previous):
    value = previous.get(key)
    return st.number_input(
        label,
        min_value=float(low),
        max_value=float(high),
        value=float(value) if value not in (None, "") else None,
        step=1.0,
    )


def render(db, user, profile):
    records = [row["data"] for row in db.list(user["id"], "journal")]
    by_date = {row["date"]: row for row in records}
    today = date.today()
    st.title("See your progress unfold")
    st.caption("Click a calendar day or chart point to review its entry.")
    if "journal_day" not in st.session_state:
        st.session_state.journal_day = today
    month = st.date_input(
        "Calendar month", value=today.replace(day=1), key="journal_month"
    )
    month_start = month.replace(day=1)
    next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    period = st.selectbox(
        "Graph time range",
        ["Calendar month", "Last 7 days", "Last 30 days", "Last 90 days"],
    )
    if period == "Calendar month":
        start, end = month_start, next_month - timedelta(days=1)
    else:
        days = int(period.split()[1])
        start, end = today - timedelta(days=days - 1), today
    filtered = [
        row for row in records if start.isoformat() <= row["date"] <= end.isoformat()
    ]
    summary = summarize(filtered)
    columns = st.columns(4)
    columns[0].metric("Days recorded", summary["days"])
    columns[1].metric("Average sleep", format_optional(summary["average_sleep"], " h"))
    columns[2].metric(
        "Journal exercise", format_optional(summary["exercise_minutes"], " min")
    )
    columns[3].metric("Days with meals", summary["meal_days"])
    calendar_column, chart_column = st.columns([1, 1.5])
    with calendar_column:
        st.subheader(month.strftime("%B %Y"))
        bubble_metric = st.selectbox(
            "Calendar bubbles",
            ["all", *METRICS],
            format_func=lambda key: (
                "Any journal entry" if key == "all" else METRICS[key][0]
            ),
        )
        for column, day_name in zip(
            st.columns(7), ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        ):
            column.caption(day_name)
        for week in month_weeks(month.year, month.month):
            for column, day in zip(st.columns(7), week):
                if not day:
                    column.write("")
                    continue
                chosen_date = date(month.year, month.month, day)
                row = by_date.get(chosen_date.isoformat())
                known = (
                    row is not None
                    if bubble_metric == "all"
                    else metric_value(row or {}, bubble_metric) is not None
                )
                label = f"{'●' if known else '○'} {day}"
                if column.button(
                    label,
                    key=f"day_{chosen_date}",
                    type=(
                        "primary"
                        if chosen_date == st.session_state.journal_day
                        else "secondary"
                    ),
                ):
                    st.session_state.journal_day = chosen_date
                    st.rerun()
        st.caption("● recorded value · ○ no value · green button = selected day")
    with chart_column:
        st.subheader("Follow a trend")
        metric = st.selectbox(
            "Measurement", list(METRICS), format_func=lambda key: METRICS[key][0]
        )
        style = st.radio("Chart style", ["Line", "Bars"], horizontal=True)
        values = [
            {"date": row["date"], "value": metric_value(row, metric)}
            for row in filtered
        ]
        values = [row for row in values if row["value"] is not None]
        if not values:
            st.info(
                "No values for this measurement in the selected range. Try sleep, another range, or record a day."
            )
        else:
            frame = pd.DataFrame(values).sort_values("date")
            frame["date"] = pd.to_datetime(frame["date"])
            frame["segment"] = frame["date"].diff().dt.days.ne(1).cumsum()
            st.metric(
                f"Average {METRICS[metric][0].lower()}",
                f"{frame['value'].mean():.1f} {METRICS[metric][1]}",
            )
            base = alt.Chart(frame).encode(
                x=alt.X("date:T", title="Date"),
                y=alt.Y("value:Q", title=METRICS[metric][1]),
                tooltip=["date:T", "value:Q"],
            )
            selection = alt.selection_point(
                name="day", fields=["date"], on="click", nearest=True
            )
            chart = (
                base.mark_line(color="#83a666", point=True)
                .encode(detail="segment:N")
                .add_params(selection)
                if style == "Line"
                else base.mark_bar(color="#83a666").add_params(selection)
            )
            event = st.altair_chart(
                chart, on_select="rerun", key="journal_plot", use_container_width=True
            )
            selected = event.selection.get("day", [])
            if selected:
                raw = selected[0]["date"]
                selected_date = (
                    pd.to_datetime(raw, unit="ms").date()
                    if isinstance(raw, (int, float))
                    else pd.to_datetime(raw).date()
                )
                if selected_date != st.session_state.journal_day:
                    st.session_state.journal_day = selected_date
                    st.rerun()
        st.caption(
            "Missing values stay blank. Lines only join consecutive recorded dates. Route sessions are not added to journal exercise totals."
        )
    selected_date = st.session_state.journal_day
    entry = by_date.get(selected_date.isoformat(), {})
    st.subheader(selected_date.strftime("%A, %B %d, %Y"))
    if entry:
        st.write(
            f"Bed {entry['bed']} → wake {entry['wake']} · {entry['sleepHours']} hours"
        )
        for meal in ("breakfast", "lunch", "dinner"):
            if entry.get(meal):
                st.write(f"**{meal.title()}:** {entry[meal]}")
        if entry.get("notes"):
            st.write(entry["notes"])
    else:
        st.info("No entry on this day yet. You can add one below.")
    with st.expander("Record or edit this day", expanded=not bool(entry)):
        with st.form(f"journal_form_{selected_date}"):
            st.caption("Sleep belongs to the wake-up date shown above.")
            bed = st.time_input(
                "Bedtime", value=time_input_value(entry.get("bed"), "23:00")
            )
            wake = st.time_input(
                "Wake-up", value=time_input_value(entry.get("wake"), "07:00")
            )
            exercise_types = [
                "Not recorded",
                "Walking",
                "Running",
                "Cycling",
                "Strength",
                "Other",
            ]
            kind = entry.get("exerciseType", "Not recorded")
            exercise_type = st.selectbox(
                "Exercise type",
                exercise_types,
                index=exercise_types.index(kind) if kind in exercise_types else 0,
            )
            updated = {
                "date": selected_date.isoformat(),
                "bed": bed.strftime("%H:%M"),
                "wake": wake.strftime("%H:%M"),
                "exerciseType": exercise_type,
            }
            for label, key, low, high in [
                ("Exercise minutes", "duration", 0, 600),
                ("Heart rate (bpm)", "heart", 20, 250),
                ("Glucose (mg/dL)", "glucose", 20, 600),
                ("Systolic (mmHg)", "systolic", 40, 300),
                ("Diastolic (mmHg)", "diastolic", 20, 200),
            ]:
                updated[key] = optional_input(label, key, low, high, entry)
            for meal in ("breakfast", "lunch", "dinner"):
                updated[meal] = st.text_input(meal.title(), value=entry.get(meal, ""))
                updated[meal + "Calories"] = optional_input(
                    meal.title() + " estimated kcal", meal + "Calories", 0, 10000, entry
                )
            updated["notes"] = st.text_area(
                "How did you feel? / notes", value=entry.get("notes", "")
            )
            if st.form_submit_button("Save day", type="primary"):
                try:
                    db.save(
                        user["id"],
                        "journal",
                        selected_date.isoformat(),
                        validate_entry(updated),
                    )
                    st.rerun()
                except ValueError as error:
                    st.error(str(error))
    if entry and st.checkbox("I want to remove this day's entry"):
        if st.button("Remove journal entry"):
            db.delete(user["id"], "journal", selected_date.isoformat())
            st.rerun()
