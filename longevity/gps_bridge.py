"""Connect the browser GPS adapter to Python without putting app logic in JS."""

from pathlib import Path
import streamlit.components.v1 as components

_component = components.declare_component(
    "phone_gps", path=str(Path(__file__).resolve().parents[1] / "gps_component")
)


def read_gps(command, token, user_id):
    """Returns raw fixes and browser errors; Python decides what to do with them."""
    return _component(command=command, token=token, key=f"gps_{user_id}", default=None)
