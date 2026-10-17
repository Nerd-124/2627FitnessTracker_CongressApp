"""START HERE: the Python entry point for Longevity Simulator.

Run: python -m streamlit run app.py
This file chooses the screen; each screen and calculation is also Python.
"""

import os
from pathlib import Path
import streamlit as st
from longevity.storage import Database
from screens import account, exercise, home, journal, profile, scenarios, science, sleep

ROOT = Path(__file__).resolve().parent
DATA_FOLDER = Path(os.environ.get("LONGEVITY_DATA_DIR", ROOT / ".data"))


def login_screen(db):
    st.title("Longevity Simulator")
    st.write("Your habits, sleep, and exercise — with Python at the center.")
    sign_in, sign_up = st.tabs(["Sign in", "Create account"])
    with sign_in:
        with st.form("sign_in"):
            email = st.text_input("Email", key="login_email")
            password = st.text_input("Password", type="password", key="login_password")
            submitted = st.form_submit_button("Sign in", type="primary")
        if submitted:
            try:
                user = db.sign_in(email, password)
                st.session_state.clear()  # Remove the password widget state.
                st.session_state.user = user
                st.rerun()
            except ValueError as error:
                st.error(str(error))
    with sign_up:
        with st.form("sign_up"):
            name = st.text_input("Name or nickname")
            email = st.text_input("Email address")
            password = st.text_input(
                "Choose a password (10+ characters)", type="password"
            )
            repeated = st.text_input("Repeat password", type="password")
            submitted = st.form_submit_button("Create account")
        if submitted:
            if password != repeated:
                st.error("The passwords do not match.")
            else:
                try:
                    user = db.register(name, email, password)
                    st.session_state.clear()
                    st.session_state.user = user
                    st.rerun()
                except ValueError as error:
                    st.error(str(error))
    st.caption(
        "Accounts and records are stored on this Python server. Use HTTPS if hosting beyond your own computer."
    )


def main():
    st.set_page_config(page_title="Longevity Simulator", page_icon="🌱", layout="wide")
    db = Database(DATA_FOLDER / "longevity.sqlite3")
    user = st.session_state.get("user")
    if user is None:
        login_screen(db)
        return
    st.sidebar.title("🌱 Longevity")
    st.sidebar.caption(f"Signed in as {user['name']}")
    if st.sidebar.button("Sign out"):
        recorder = st.session_state.get("recorder")
        if recorder:
            recorder.pause()
            db.save(user["id"], "draft", "main", recorder.draft())
        st.session_state.clear()
        st.rerun()
    current_profile = db.get(user["id"], "profile", "main")
    if not current_profile:
        profile.render(db, user)
        st.caption(
            "Already used the web app? You can import its JSON export after creating this profile."
        )
        return
    screens = {
        "Today": home,
        "Daily journal": journal,
        "Sleep": sleep,
        "Exercise & routes": exercise,
        "Try a habit": scenarios,
        "My profile": profile,
        "Account & backups": account,
        "The science": science,
    }
    chosen = st.sidebar.radio("Open a screen", list(screens))
    recorder = st.session_state.get("recorder")
    if (
        chosen != "Exercise & routes"
        and recorder
        and recorder.data["phase"] in ("recording", "acquiring")
    ):
        recorder.pause()
        db.save(user["id"], "draft", "main", recorder.draft())
        st.session_state.gps_command = {"command": "stop", "token": "screen_changed"}
    if "notice" in st.session_state:
        st.success(st.session_state.pop("notice"))
    (
        screens[chosen].render(db, user, current_profile)
        if chosen != "My profile"
        else profile.render(db, user)
    )
    st.sidebar.caption(
        "Educational prototype. Read app.py first, then the screen you want to change."
    )


if __name__ == "__main__":
    main()
