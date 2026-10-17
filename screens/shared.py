"""Small display helpers reused by the Python screens."""

from datetime import date
import pandas as pd
import pydeck as pdk
import streamlit as st
from longevity.routes import clock


def show_route_map(points, marker=None):
    if not points:
        st.info(
            "Your route will appear here after the first usable GPS fix or GPX import."
        )
        return
    paths = [[]]
    for point in points:
        if point.get("breakBefore"):
            paths.append([])
        paths[-1].append([point["lon"], point["lat"]])
    current = marker or points[-1]
    layers = [
        pdk.Layer(
            "PathLayer",
            [{"path": path} for path in paths if len(path) > 1],
            get_path="path",
            get_color=[70, 115, 74],
            get_width=5,
            width_min_pixels=3,
        ),
        pdk.Layer(
            "ScatterplotLayer",
            [current],
            get_position="[lon, lat]",
            get_fill_color=[45, 95, 60],
            get_radius=5,
            radius_min_pixels=7,
        ),
    ]
    deck = pdk.Deck(
        layers=layers,
        initial_view_state=pdk.ViewState(
            latitude=current["lat"], longitude=current["lon"], zoom=14
        ),
        map_style="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    )
    st.pydeck_chart(deck, use_container_width=True)
    st.caption(
        "Map tiles: CARTO / OpenStreetMap. Internet is required for the basemap."
    )


def show_elevation(analysis):
    rows = [
        {"Distance (km)": p["meters"] / 1000, "Height (m)": p["height"]}
        for p in analysis["points"]
        if p["height"] is not None
    ]
    if rows:
        st.line_chart(pd.DataFrame(rows).set_index("Distance (km)"))
        st.caption(
            "Filtered GPS elevation. Unknown altitude is omitted, not changed into zero."
        )
    else:
        st.info(
            "This recording has no usable altitude. Elevation cannot be measured from a phone without sensor data."
        )


def format_optional(value, suffix=""):
    return "—" if value is None else f"{value:g}{suffix}"


def time_input_value(value, default):
    from datetime import datetime

    try:
        return datetime.strptime(value, "%H:%M").time()
    except (ValueError, TypeError):
        return datetime.strptime(default, "%H:%M").time()
