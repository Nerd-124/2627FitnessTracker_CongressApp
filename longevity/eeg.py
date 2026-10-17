"""Optional EEG file import. No sleep stages or diagnoses are inferred."""

import csv
import io
from .routes import optional_number


def parse_eeg(text):
    if len(text.encode()) > 1_000_000:
        raise ValueError("Use a CSV smaller than 1 MB.")
    reader = csv.DictReader(io.StringIO(text.lstrip("\ufeff")))
    headers = reader.fieldnames or []
    raw = "amplitude_uv" in headers
    channels = ["amplitude_uv"] if raw else ["delta", "theta", "alpha", "beta", "gamma"]
    if (
        "time_s" not in headers
        or any(key not in headers for key in channels)
        or len(set(headers)) != len(headers)
    ):
        raise ValueError(
            "Use time_s,amplitude_uv or time_s,delta,theta,alpha,beta,gamma."
        )
    rows = []
    for original in reader:
        row = {key: optional_number(original.get(key)) for key in ["time_s", *channels]}
        if any(value is None for value in row.values()) or row["time_s"] < 0:
            raise ValueError("Every row needs finite numbers and nonnegative time.")
        if not raw and any(row[channel] < 0 for channel in channels):
            raise ValueError("Band power cannot be negative.")
        if rows and row["time_s"] <= rows[-1]["time_s"]:
            raise ValueError("time_s must increase in every row.")
        rows.append(row)
        if len(rows) > 5000:
            raise ValueError("Use at most 5,000 data rows.")
    if len(rows) < 2:
        raise ValueError("Include at least two data rows.")
    return {"rows": rows, "channels": channels, "raw": raw}
