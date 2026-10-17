"""Read Python backups or the previous web app's JSON export."""

import json
from datetime import date
from .eeg import parse_eeg
from .health import simulate
from .journal import validate_entry
from .routes import analyze_route


def prepare_import(text):
    if len(text.encode()) > 8_000_000:
        raise ValueError("Use a backup smaller than 8 MB.")
    value = json.loads(text)
    if not isinstance(value, dict):
        raise ValueError("Expected a JSON object.")
    documents = []
    if value.get("version") == 2 and isinstance(value.get("records"), dict):
        for kind, rows in value["records"].items():
            if kind == "draft":
                continue
            if not isinstance(rows, list) or any(
                not isinstance(row, dict) or "key" not in row or "data" not in row
                for row in rows
            ):
                raise ValueError("A backup section has invalid records.")
            for row in rows:
                documents.append((kind, row["key"], row["data"]))
    elif isinstance(value.get("profile"), dict) and isinstance(
        value.get("records"), list
    ):
        profile = dict(value["profile"])
        profile.update(value.get("baselineHabits") or value.get("habits") or {})
        documents.append(("profile", "main", profile))
        documents.extend(("journal", row["date"], row) for row in value["records"])
        for index, row in enumerate(value.get("activities", [])):
            documents.append(
                (
                    "run",
                    row.get("id", str(index)),
                    {
                        "date": row["date"],
                        "mode": row["mode"],
                        "weight": float(row.get("weight", profile.get("weight", 70))),
                        "seconds": float(row["minutes"]) * 60,
                        "route": row.get("route", []),
                        "calories": row["result"]["calories"],
                    },
                )
            )
    else:
        raise ValueError("This is not a recognized Longevity Simulator backup.")
    validated = []
    for kind, key, row in documents:
        if not isinstance(row, dict):
            raise ValueError("Every imported record must be an object.")
        if kind == "profile":
            simulate(row)
            row.setdefault("name", "My profile")
            row.setdefault("exercise", 150)
            row.setdefault("sleep", 8)
            row.setdefault("plants", 5)
        elif kind == "journal":
            row = validate_entry(row)
            key = row["date"]
        elif kind == "run":
            row = dict(row)
            row["seconds"] = float(row["seconds"])
            row["weight"] = float(row.get("weight", 70))
            row["calories"] = float(row["calories"])
            date.fromisoformat(row["date"])
            if row["mode"] not in ("walk", "run") or float(row["seconds"]) <= 0:
                raise ValueError("An imported run has an invalid mode or duration.")
            analyze_route(row["route"], row["seconds"])
        elif kind == "eeg":
            headers = ["time_s", *row["channels"]]
            csv = (
                ",".join(headers)
                + "\n"
                + "\n".join(
                    ",".join(str(sample[k]) for k in headers) for sample in row["rows"]
                )
            )
            parsed = parse_eeg(csv)
            row = {**row, **parsed}
        elif kind == "goal":
            date.fromisoformat(str(key))
            if row.get("type") not in ("move", "rest", "food") or not isinstance(
                row.get("completed"), bool
            ):
                raise ValueError("An imported goal is invalid.")
        else:
            raise ValueError("Unknown record type in backup.")
        validated.append((kind, key, row))
    return validated
