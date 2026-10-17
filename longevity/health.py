"""Readable health calculations, with units included in function names.

These are educational estimates, not predictions of lifespan or disease.
"""

import math
from datetime import datetime, timedelta


def number(data, key, low, high, default):
    """Read one finite number and reject values outside a supported range."""
    value = float(data.get(key, default))
    if not math.isfinite(value) or not low <= value <= high:
        raise ValueError(f"{key} must be between {low} and {high}.")
    return value


def calculate_bmi(weight_kg, height_cm):
    height_m = height_cm / 100
    return round(weight_kg / height_m**2, 1)


def calculate_bmr(age, weight_kg, height_cm, coefficient="unspecified"):
    """Mifflin–St Jeor resting energy in kcal/day, not a food intake target."""
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    if coefficient == "female":
        return [round(base - 161), round(base - 161)]
    if coefficient == "male":
        return [round(base + 5), round(base + 5)]
    if coefficient != "unspecified":
        raise ValueError("Choose female, male, or unspecified for the BMR equation.")
    return [round(base - 161), round(base + 5)]


def sleep_hours(bedtime, wake_up):
    """Overnight duration, assigned to the wake-up date. Equal times are invalid."""
    bed = datetime.strptime(str(bedtime), "%H:%M")
    wake = datetime.strptime(str(wake_up), "%H:%M")
    if wake < bed:
        wake += timedelta(days=1)
    hours = (wake - bed).total_seconds() / 3600
    if hours == 0:
        raise ValueError("Use different bedtime and wake-up times.")
    return round(hours, 2)


def simulate(data):
    """Calculate baseline estimates and an explicitly illustrative habit score."""
    age = number(data, "age", 18, 100, 28)
    weight = number(data, "weight", 30, 300, 70)
    height = number(data, "height", 120, 230, 172)
    exercise = number(data, "exercise", 0, 600, 150)
    sleep = number(data, "sleep", 3, 12, 8)
    plants = number(data, "plants", 0, 10, 5)
    movement_score = min(exercise / 150, 1) * 100
    sleep_score = max(0, 100 - abs(sleep - 8) * 22)
    food_score = min(plants / 5, 1) * 100
    score = round(0.40 * movement_score + 0.35 * sleep_score + 0.25 * food_score)
    years = list(range(0, 31, 5))
    curve = [round(65 + (score - 65) * (1 - math.exp(-year / 10)), 1) for year in years]
    return {
        "bmi": calculate_bmi(weight, height),
        "bmr": calculate_bmr(age, weight, height, data.get("sex", "unspecified")),
        "score": score,
        "years": years,
        "scenario": curve,
        "model": "The weights, score, and curve are illustrations, not clinical predictions.",
    }


def estimate_calories(distance_m, ascent_m, active_seconds, weight_kg, mode):
    """ACSM-style total kcal, including resting cost during active time.

    Uphill adds energy. Downhill is treated as level ground. Weather does not
    receive an invented calorie multiplier.
    """
    if mode not in ("walk", "run"):
        raise ValueError("Choose walk or run.")
    values = [distance_m, ascent_m, active_seconds, weight_kg]
    if not all(math.isfinite(float(value)) for value in values):
        raise ValueError("Calorie inputs must be finite numbers.")
    if min(distance_m, ascent_m, active_seconds) < 0 or weight_kg <= 0:
        raise ValueError(
            "Distance, ascent and time cannot be negative; weight must be positive."
        )
    horizontal_cost = 0.1 if mode == "walk" else 0.2
    uphill_cost = 1.8 if mode == "walk" else 0.9
    minutes = active_seconds / 60
    oxygen_cost = horizontal_cost * distance_m + uphill_cost * ascent_m + 3.5 * minutes
    return round(oxygen_cost * weight_kg / 1000 * 5)
