"""Daily habits and a seven-day progress display, all written in Python."""

from datetime import date, timedelta
import streamlit as st

GOALS = {
    "move": "Take a 10-minute walk",
    "rest": "Wind down for 15 minutes before bed",
    "food": "Add a fruit or vegetable to a meal",
}


def render(db, user, profile):
    today = date.today()
    st.title(f"One small step, {profile['name']}.")
    st.write("Choose one action, then check in when you have tried it.")
    saved = db.get(user["id"], "goal", today.isoformat(), {})
    keys = list(GOALS)
    choice = st.radio(
        "Your daily focus",
        keys,
        index=keys.index(saved.get("type", "move")),
        format_func=GOALS.get,
    )
    completed = st.checkbox("I did this today", value=saved.get("completed", False))
    if st.button("Save today's check-in", type="primary"):
        db.save(
            user["id"],
            "goal",
            today.isoformat(),
            {"type": choice, "completed": completed},
        )
        st.success("Your check-in was saved.")
    st.subheader("Your last seven days")
    columns = st.columns(7)
    count = 0
    for index, column in enumerate(columns):
        day = today - timedelta(days=6 - index)
        record = db.get(user["id"], "goal", day.isoformat(), {})
        done = record.get("completed", False)
        count += int(done)
        column.metric(day.strftime("%a"), "✓" if done else "·")
    st.caption(
        f"{count} days checked in. These are self-reported actions, not a health score."
    )
    st.info(
        "Use the sidebar to open the journal, sleep history, or GPS exercise recorder."
    )
