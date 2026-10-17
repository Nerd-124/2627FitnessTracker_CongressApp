"""Python owns recording state, metrics, saved runs, replay, and maps.

Only read_gps() talks to the tiny JavaScript sensor adapter.
"""

from datetime import date
import time
import uuid
import pandas as pd
import streamlit as st
from longevity.gps_bridge import read_gps
from longevity.health import estimate_calories
from longevity.recorder import Recorder
from longevity.routes import (
    MILE_METERS,
    analyze_route,
    clock,
    export_gpx,
    parse_gpx,
    playback_point,
    split_times,
)
from .shared import show_elevation, show_route_map


def gps_command(command):
    """A fresh token tells the browser to start/stop exactly once."""
    st.session_state.gps_command = {"command": command, "token": str(uuid.uuid4())}


def save_finished_run(db, user, recorder):
    recorder.pause()
    data = recorder.data
    analysis = analyze_route(data["points"], data["seconds"])
    if analysis["distance"] < 10:
        raise ValueError(
            "Record at least 10 meters, or discard this unfinished session."
        )
    result = {
        "date": date.today().isoformat(),
        "mode": data["mode"],
        "weight": data["weight"],
        "seconds": data["seconds"],
        "route": data["points"],
        "temperature": st.session_state.get("run_temperature"),
        "humidity": st.session_state.get("run_humidity"),
        "calories": estimate_calories(
            analysis["distance"],
            analysis["ascent"],
            data["seconds"],
            data["weight"],
            data["mode"],
        ),
    }
    db.save(user["id"], "run", data["id"], result)
    db.delete(user["id"], "draft", "main")
    st.session_state.recorder = None
    st.session_state.review_run = data["id"]


def live_recorder(db, user, profile, mode, unit):
    # A fragment updates this section once a second without redrawing the app.
    @st.fragment(run_every=1.0)
    def live_panel():
        recorder = st.session_state.recorder
        active = recorder is not None and recorder.data["phase"] in (
            "acquiring",
            "recording",
        )
        columns = st.columns(4)
        if columns[0].button(
            "Resume GPS" if recorder else "Start GPS", disabled=active, type="primary"
        ):
            if recorder is None:
                recorder = Recorder(mode, profile["weight"])
                st.session_state.recorder = recorder
            recorder.start()
            gps_command("start")
            st.rerun()
        if columns[1].button("Pause", disabled=not active):
            recorder.pause()
            db.save(user["id"], "draft", "main", recorder.draft())
            gps_command("stop")
            st.rerun()
        if columns[2].button("Finish & save", disabled=recorder is None):
            gps_command("stop")
            try:
                save_finished_run(db, user, recorder)
                st.rerun()
            except ValueError as error:
                st.error(str(error))
        if columns[3].button("Discard draft", disabled=recorder is None):
            gps_command("stop")
            db.delete(user["id"], "draft", "main")
            st.session_state.recorder = None
            st.rerun()
        command = st.session_state.gps_command
        event = read_gps(command["command"], command["token"], user["id"])
        if recorder and event and event.get("token") == command["token"]:
            signature = (event["token"], event.get("sequence"))
            if signature != st.session_state.get("last_gps_event"):
                st.session_state.last_gps_event = signature
                if event.get("status") == "fix":
                    for fix in event.get("points", []):
                        recorder.add_fix(fix)
                elif event.get("status") in ("hidden", "error"):
                    recorder.pause()
                    recorder.message = event.get("message", "GPS paused.")
                    gps_command("stop")
                db.save(user["id"], "draft", "main", recorder.draft())
        if recorder and recorder.check_timeout():
            gps_command("stop")
            db.save(user["id"], "draft", "main", recorder.draft())
        if not recorder:
            st.info("Ready to record. Allow precise location when your browser asks.")
            return
        seconds = recorder.seconds()
        analysis = analyze_route(recorder.data["points"], seconds)
        distance_unit = MILE_METERS if unit == "Miles" else 1000
        distance = analysis["distance"] / distance_unit
        values = st.columns(5)
        acquiring = recorder.data["phase"] == "acquiring"
        values[0].metric(
            "GPS wait" if acquiring else "Active time",
            clock(recorder.wait_seconds() if acquiring else seconds),
        )
        values[1].metric(unit, f"{distance:.2f}")
        values[2].metric(
            "Average pace", clock(seconds / distance) if distance > 0.01 else "—"
        )
        values[3].metric(
            "Estimated kcal",
            estimate_calories(
                analysis["distance"],
                analysis["ascent"],
                seconds,
                recorder.data["weight"],
                recorder.data["mode"],
            ),
        )
        values[4].metric(
            "Ascent (m)",
            f"{analysis['ascent']:.0f}" if analysis["altitude_points"] > 1 else "—",
        )
        st.caption(recorder.message)
        st.caption(
            "Phase: "
            + recorder.data["phase"]
            + ". Pauses and GPS gaps are not joined into distance."
        )
        show_route_map(analysis["points"])
        show_elevation(analysis)
        now = time.time()
        if now - st.session_state.get("draft_saved_at", 0) >= 5:
            db.save(user["id"], "draft", "main", recorder.draft())
            st.session_state.draft_saved_at = now

    live_panel()


def review_saved_run(db, user, unit):
    runs = db.list(user["id"], "run")
    if not runs:
        st.info("Finish a recording or import a GPX route to start your run history.")
        return
    keys = [row["key"] for row in runs]
    default_key = st.session_state.get("review_run", keys[-1])
    index = keys.index(default_key) if default_key in keys else len(keys) - 1
    selected = st.selectbox(
        "Saved session",
        range(len(runs)),
        index=index,
        format_func=lambda i: runs[i]["data"]["date"]
        + " · "
        + runs[i]["data"]["mode"]
        + " · "
        + runs[i]["key"][:6],
    )
    record = runs[selected]["data"]
    analysis = analyze_route(record["route"], record["seconds"])
    factor = MILE_METERS if unit == "Miles" else 1000
    st.write(
        f"**{clock(record['seconds'])}** active time · **{analysis['distance'] / factor:.2f}** {unit.lower()} · **{record['calories']}** estimated kcal"
    )

    @st.fragment(run_every=0.5)
    def playback():
        # Both playback timing and the moving map marker are controlled by Python.
        key = runs[selected]["key"]
        seek = st.slider("Seek along the route (%)", 0, 100, 0, key=f"seek_{key}")
        playing = st.checkbox("Play route", key=f"playing_{key}")
        speed = st.select_slider(
            "Playback speed", options=[1, 10, 30, 60], value=30, key=f"speed_{key}"
        )
        state_key = f"playback_{key}"
        now = time.monotonic()
        previous = st.session_state.get(
            state_key, {"fraction": seek / 100, "seek": seek, "tick": now}
        )
        fraction = previous["fraction"]
        if seek != previous["seek"]:
            fraction = seek / 100
        elif playing and analysis["points"]:
            duration = analysis["points"][-1]["elapsed"] or record["seconds"]
            fraction = min(
                1, fraction + (now - previous["tick"]) * speed / max(1, duration)
            )
        st.session_state[state_key] = {"fraction": fraction, "seek": seek, "tick": now}
        st.progress(fraction)
        point = playback_point(analysis, fraction)
        show_route_map(analysis["points"], point)
        if point:
            st.caption(
                f"Replay time {clock(point['elapsed'])} · {point['meters'] / factor:.2f} {unit.lower()} · "
                + (
                    f"height {point['height']:.0f} m"
                    if point["height"] is not None
                    else "altitude unavailable"
                )
                + (
                    " · GPS gap: holding previous position"
                    if point.get("in_gap")
                    else ""
                )
            )
        if fraction >= 1:
            st.caption(
                "Playback complete. Move the seek slider back to replay another section."
            )

    playback()
    show_elevation(analysis)
    rows = [
        {
            "Split": str(index + 1) + (" (partial)" if row["partial"] else ""),
            "Distance": round(row["distance"] / factor, 2),
            "Time": clock(row["seconds"]),
            "Pace": clock(row["seconds"] / (row["distance"] / factor)),
        }
        for index, row in enumerate(split_times(analysis, factor))
    ]
    st.dataframe(pd.DataFrame(rows), hide_index=True)
    st.download_button(
        "Export route as GPX",
        export_gpx(record["route"]),
        f"run-{record['date']}.gpx",
        mime="application/gpx+xml",
    )
    if st.checkbox(
        "Remove this saved session", key=f"remove_run_{runs[selected]['key']}"
    ):
        if st.button("Confirm removal"):
            db.delete(user["id"], "run", runs[selected]["key"])
            st.rerun()


def render(db, user, profile):
    st.title("Record a walk or run")
    st.write(
        "Python calculates distance, timing, calories, elevation, and splits. The browser only supplies GPS fixes."
    )
    st.info(
        "Keep the app visible and the phone screen on. GPS needs HTTPS or localhost and precise-location permission. "
        "This Python version also needs a live connection to its Python server; it cannot guarantee offline or locked-screen tracking."
    )
    if "recorder" not in st.session_state:
        draft = db.get(user["id"], "draft", "main")
        st.session_state.recorder = Recorder(draft=draft) if draft else None
        gps_command("stop")
    mode = st.selectbox(
        "Activity", ["run", "walk"], disabled=st.session_state.recorder is not None
    )
    unit = st.radio("Distance units", ["Miles", "Kilometers"], horizontal=True)
    with st.expander("Optional conditions during this session"):
        st.number_input(
            "Temperature (°C)",
            min_value=-30.0,
            max_value=55.0,
            value=None,
            key="run_temperature",
        )
        st.number_input(
            "Humidity (%)",
            min_value=0.0,
            max_value=100.0,
            value=None,
            key="run_humidity",
        )
        st.caption(
            "Conditions are saved as context. They do not apply an unvalidated calorie bonus."
        )
    live_recorder(db, user, profile, mode, unit)
    st.divider()
    st.subheader("Your saved sessions")
    if st.session_state.recorder is None:
        review_saved_run(db, user, unit)
    else:
        st.caption(
            "Finish or discard the unfinished recording before reviewing another session."
        )
    with st.expander("Import a GPX route or calculate manually"):
        file = st.file_uploader("GPX route", type=["gpx"])
        minutes = st.number_input(
            "Duration if GPX timestamps are absent (minutes)", 1.0, 600.0, 30.0
        )
        if st.button("Save imported route", disabled=file is None):
            try:
                points = parse_gpx(file.getvalue().decode("utf-8-sig"))
                analysis = analyze_route(points)
                seconds = analysis["seconds"] if analysis["timed"] else minutes * 60
                if analysis["distance"] < 10 or seconds <= 0:
                    raise ValueError(
                        "Use a route at least 10 meters long with a positive duration."
                    )
                key = str(uuid.uuid4())
                db.save(
                    user["id"],
                    "run",
                    key,
                    {
                        "date": date.today().isoformat(),
                        "mode": mode,
                        "weight": profile["weight"],
                        "seconds": seconds,
                        "route": points,
                        "calories": estimate_calories(
                            analysis["distance"],
                            analysis["ascent"],
                            seconds,
                            profile["weight"],
                            mode,
                        ),
                    },
                )
                st.session_state.review_run = key
                st.rerun()
            except (ValueError, UnicodeDecodeError) as error:
                st.error(str(error))
        distance = st.number_input("Manual distance (km)", 0.01, 100.0, 3.0)
        ascent = st.number_input("Manual ascent (m)", 0.0, 10000.0, 0.0)
        if st.button("Estimate manual calories"):
            if ascent / (distance * 1000) > 0.3:
                st.error("This average ascent exceeds the model's 30% grade limit.")
            else:
                kcal = estimate_calories(
                    distance * 1000, ascent, minutes * 60, profile["weight"], mode
                )
                st.success(
                    f"Approximately {kcal} total kcal, including resting energy during this time."
                )
    st.caption(
        "Calorie equations and filtered GPS ascent are educational estimates, not measurements or trained AI predictions."
    )
