"""Account controls and portable JSON backups."""

import json
import streamlit as st
from longevity.backups import prepare_import


def render(db, user, profile):
    st.title("Your account and data")
    st.write(f"Signed in as **{user['name']}** ({user['email']}).")
    st.caption(
        "This Python edition stores data in a SQLite file on the computer running the server. It is not the previous hosted app's browser storage."
    )
    exported = {
        "app": "Longevity Simulator",
        "version": 2,
        "records": db.export(user["id"]),
    }
    st.download_button(
        "Download my JSON backup",
        json.dumps(exported, indent=2),
        "longevity-backup.json",
        "application/json",
    )
    file = st.file_uploader(
        "Import a backup (Python or earlier web version)", type=["json"]
    )
    confirmed = st.checkbox(
        "These are my records, and matching dates or keys may be replaced."
    )
    if st.button("Import my records", disabled=file is None or not confirmed):
        try:
            documents = prepare_import(file.getvalue().decode("utf-8-sig"))
            db.import_documents(user["id"], documents)
            st.success(f"Imported {len(documents)} records.")
        except (ValueError, KeyError, TypeError, UnicodeDecodeError) as error:
            st.error(f"Import cancelled: {error}")
    with st.expander("Delete my app records"):
        st.warning(
            "This deletes your profile, journals, runs, EEG imports, and goals. Your login account remains."
        )
        if st.checkbox("I understand and have exported anything I want to keep."):
            if st.button("Delete my records"):
                db.delete_records(user["id"])
                user_copy = dict(user)
                st.session_state.clear()
                st.session_state.user = user_copy
                st.rerun()
    st.info(
        "Sign out with the sidebar button. This educational app does not yet provide email verification, password reset, or production account recovery."
    )
