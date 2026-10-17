"""Profile setup is a normal Python form."""

import streamlit as st
from longevity.health import simulate


def render(db, user):
    profile = db.get(user["id"], "profile", "main", {})
    st.title("Your starting point")
    st.write("Tell the simulator about yourself. You can edit these values later.")
    with st.form("profile"):
        name = st.text_input(
            "Name or nickname", value=profile.get("name", user["name"])
        )
        age = st.number_input("Age (18+)", 18, 100, int(profile.get("age", 28)))
        height = st.number_input(
            "Height (cm)", 120.0, 230.0, float(profile.get("height", 172))
        )
        weight = st.number_input(
            "Weight (kg)", 30.0, 300.0, float(profile.get("weight", 70))
        )
        choices = ["unspecified", "female", "male"]
        sex = st.selectbox(
            "Published BMR coefficient",
            choices,
            index=choices.index(profile.get("sex", "unspecified")),
        )
        exercise = st.slider(
            "Exercise minutes per week", 0, 600, int(profile.get("exercise", 150))
        )
        sleep = st.slider(
            "Usual sleep hours", 3.0, 12.0, float(profile.get("sleep", 8)), 0.5
        )
        plants = st.slider(
            "Fruit and vegetable servings per day", 0, 10, int(profile.get("plants", 5))
        )
        submitted = st.form_submit_button("Save my profile", type="primary")
    if submitted:
        if not name.strip():
            st.error("Enter a name or nickname.")
            return
        updated = dict(
            name=name.strip(),
            age=age,
            height=height,
            weight=weight,
            sex=sex,
            exercise=exercise,
            sleep=sleep,
            plants=plants,
        )
        simulate(updated)  # Validate the same data used by the scenario screen.
        db.save(user["id"], "profile", "main", updated)
        st.session_state["notice"] = "Your Python profile is ready."
        st.rerun()
    st.caption(
        "Adult educational estimates. The BMR coefficient is optional; unspecified displays both published estimates."
    )
