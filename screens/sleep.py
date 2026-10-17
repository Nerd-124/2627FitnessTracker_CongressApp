"""Sleep first; EEG is an optional advanced section."""

from datetime import date
import uuid
import pandas as pd
import streamlit as st
from longevity.eeg import parse_eeg


def render(db, user, profile):
    st.title("Understand your sleep")
    st.write(
        "Start with bedtime, wake-up time, and how you felt. You do not need a special device."
    )
    records = [row["data"] for row in db.list(user["id"], "journal")]
    if records:
        frame = pd.DataFrame(
            [
                {"Date": row["date"], "Sleep (hours)": row["sleepHours"]}
                for row in records
            ]
        ).set_index("Date")
        st.line_chart(frame)
        st.dataframe(
            pd.DataFrame(
                [
                    {
                        "Date": row["date"],
                        "Bedtime": row["bed"],
                        "Wake-up": row["wake"],
                        "Hours": row["sleepHours"],
                        "Notes": row.get("notes", ""),
                    }
                    for row in records
                ]
            ),
            hide_index=True,
        )
    else:
        st.info("Record a night in your daily journal to start this graph.")
    st.caption("Use Daily journal in the sidebar to add or edit a night.")
    with st.expander("Optional: import brainwave data from an EEG device"):
        st.write(
            "EEG uses scalp sensors to measure electrical activity. A phone cannot measure it by itself. Skip this section if you do not own a compatible device."
        )
        night = st.date_input("Recording wake-up date", value=date.today())
        file = st.file_uploader("EEG CSV", type=["csv"])
        st.download_button(
            "Download CSV header",
            "time_s,delta,theta,alpha,beta,gamma\n",
            "eeg-template.csv",
        )
        st.caption(
            "Also supported: time_s,amplitude_uv for raw EEG. Band values use device-provided units."
        )
        if st.button("Import recording", disabled=file is None):
            try:
                result = parse_eeg(file.getvalue().decode("utf-8-sig"))
                db.save(
                    user["id"],
                    "eeg",
                    str(uuid.uuid4()),
                    {**result, "date": night.isoformat(), "name": file.name},
                )
                st.success("Recording imported.")
            except (ValueError, UnicodeDecodeError) as error:
                st.error(str(error))
        recordings = db.list(user["id"], "eeg")
        if recordings:
            selected = st.selectbox(
                "Recording",
                range(len(recordings)),
                format_func=lambda i: recordings[i]["data"]["date"]
                + " · "
                + recordings[i]["data"]["name"],
            )
            recording = recordings[selected]["data"]
            channel = st.selectbox("Signal", recording["channels"])
            frame = pd.DataFrame(recording["rows"])[["time_s", channel]].set_index(
                "time_s"
            )
            st.line_chart(frame)
            st.caption(
                "Imported measurements only. No sleep stages or diagnoses are inferred."
            )
            if st.button("Remove this recording"):
                db.delete(user["id"], "eeg", recordings[selected]["key"])
                st.rerun()
