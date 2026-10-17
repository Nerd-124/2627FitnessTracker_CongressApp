"""Sliders, comparisons, and a graph defined in Python."""

import pandas as pd
import streamlit as st
from longevity.health import simulate


def render(db, user, profile):
    st.title("What if you changed one habit?")
    st.write("Compare a possible routine with the habits saved in your profile.")
    exercise = st.slider("Weekly movement (minutes)", 0, 600, profile["exercise"])
    sleep = st.slider(
        "Sleep (hours per night)", 3.0, 12.0, float(profile["sleep"]), 0.5
    )
    plants = st.slider(
        "Fruit and vegetables (servings per day)", 0, 10, profile["plants"]
    )
    for label, old, new, unit in [
        ("Movement", profile["exercise"], exercise, "min/week"),
        ("Sleep", profile["sleep"], sleep, "h/night"),
        ("Fruit and vegetables", profile["plants"], plants, "servings/day"),
    ]:
        st.write(f"**{label}:** {old} → {new} {unit}")
    baseline = simulate(profile)
    scenario = simulate(
        {**profile, "exercise": exercise, "sleep": sleep, "plants": plants}
    )
    with st.expander("Optional calculated estimates and illustrative curve"):
        st.metric("BMI", baseline["bmi"])
        st.write(
            "Resting energy estimate:", "–".join(map(str, baseline["bmr"])), "kcal/day"
        )
        frame = pd.DataFrame(
            {
                "Years ahead": baseline["years"],
                "Starting habits": baseline["scenario"],
                "Changed habits": scenario["scenario"],
            }
        ).set_index("Years ahead")
        st.line_chart(frame)
        st.warning(
            "The habit score weights and future curve are design choices, not a validated health-risk or lifespan model."
        )
    st.caption(
        "Read or edit longevity/health.py to understand every calculation on this screen."
    )
