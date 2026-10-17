"""Journal validation and progress calculations, separate from the interface."""

import calendar
from datetime import date
from .health import sleep_hours
from .routes import optional_number

METRICS = {
    "sleepHours": ("Sleep", "hours"),
    "duration": ("Exercise", "minutes"),
    "calories": ("Recorded meal calories", "kcal"),
    "heart": ("Heart rate", "bpm"),
    "systolic": ("Systolic pressure", "mmHg"),
    "diastolic": ("Diastolic pressure", "mmHg"),
    "glucose": ("Glucose", "mg/dL"),
}


def metric_value(record, metric):
    if metric == "calories":
        values = [
            optional_number(record.get(meal + "Calories"))
            for meal in ("breakfast", "lunch", "dinner")
        ]
        known = [value for value in values if value is not None]
        return sum(known) if known else None
    return optional_number(record.get(metric))


def validate_entry(entry):
    entry = dict(entry)
    date.fromisoformat(entry["date"])
    entry["sleepHours"] = sleep_hours(entry["bed"], entry["wake"])
    bounds = {
        "duration": (0, 600),
        "heart": (20, 250),
        "glucose": (20, 600),
        "systolic": (40, 300),
        "diastolic": (20, 200),
        "breakfastCalories": (0, 10000),
        "lunchCalories": (0, 10000),
        "dinnerCalories": (0, 10000),
    }
    for key, (low, high) in bounds.items():
        raw = entry.get(key)
        if raw in (None, ""):
            entry[key] = None
            continue
        value = optional_number(raw)
        if value is None or not low <= value <= high:
            raise ValueError(f"{key} must be between {low} and {high}.")
        entry[key] = value
    if (
        entry.get("systolic") is not None
        and entry.get("diastolic") is not None
        and entry["diastolic"] >= entry["systolic"]
    ):
        raise ValueError("Diastolic pressure must be lower than systolic pressure.")
    return entry


def month_weeks(year, month):
    """Rows of seven dates. None means the cell belongs to a neighboring month."""
    return calendar.Calendar(firstweekday=6).monthdayscalendar(year, month)


def summarize(records):
    sleeps = [metric_value(row, "sleepHours") for row in records]
    sleeps = [value for value in sleeps if value is not None]
    exercise = [metric_value(row, "duration") for row in records]
    exercise = [value for value in exercise if value is not None]
    return {
        "days": len(records),
        "average_sleep": sum(sleeps) / len(sleeps) if sleeps else None,
        "exercise_minutes": sum(exercise) if exercise else None,
        "meal_days": sum(
            any(
                row.get(meal) or optional_number(row.get(meal + "Calories")) is not None
                for meal in ("breakfast", "lunch", "dinner")
            )
            for row in records
        ),
    }
