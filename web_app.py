"""Longevity Simulator: dependency-free, local educational Python web app."""
import json
import math
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).parent


def number(data, key, low, high, default):
    value = float(data.get(key, default))
    if not math.isfinite(value) or not low <= value <= high:
        raise ValueError(f'{key} must be between {low} and {high}.')
    return value


def simulate(data):
    age = number(data, 'age', 18, 100, 28)
    weight = number(data, 'weight', 30, 300, 70)
    height = number(data, 'height', 120, 230, 172)
    exercise = number(data, 'exercise', 0, 600, 150)
    sleep = number(data, 'sleep', 3, 12, 8)
    plants = number(data, 'plants', 0, 10, 5)
    sex = data.get('sex', 'unspecified')
    if sex not in ('female', 'male', 'unspecified'):
        raise ValueError('Unsupported BMR equation selection.')
    # Mifflin–St Jeor coefficients. A range avoids inferring a coefficient.
    base = 10 * weight + 6.25 * height - 5 * age
    bmr = [round(base - 161), round(base + 5)] if sex == 'unspecified' else [round(base + (5 if sex == 'male' else -161))] * 2
    # Explicitly a design heuristic, NOT a fitted clinical risk or lifespan model.
    movement = min(exercise / 150, 1) * 100
    rest = max(0, 100 - abs(sleep - 8) * 22)
    nutrition = min(plants / 5, 1) * 100
    score = round(.4 * movement + .35 * rest + .25 * nutrition)
    years = list(range(0, 31, 5))
    def trajectory(s):
        return [round(65 + (s - 65) * (1 - math.exp(-y / 10)), 1) for y in years]
    tips = []
    if exercise < 150:
        tips.append('Explore a gradual increase in activity toward the adult guideline of 150 minutes per week, as appropriate for your ability.')
    if sleep < 7 or sleep > 9:
        tips.append('Explore a consistent sleep schedule. Most adults aged 18–60 need at least 7 hours; individual needs vary.')
    if plants < 5:
        tips.append('Try adding a serving of fruit or vegetables to a meal. Variety matters more than a single score.')
    if not tips:
        tips.append('Your scenario meets these three simplified targets. Explore consistency and an activity you enjoy.')
    return dict(bmi=round(weight / (height / 100) ** 2, 1), bmr=bmr, score=score,
                years=years, ages=[age + y for y in years], baseline=trajectory(65), scenario=trajectory(score), tips=tips,
                model='Illustrative habit-support index; not biological age, disease probability, or years of life gained.')


def activity(data):
    weight = number(data, 'weight', 30, 300, 70)
    minutes = number(data, 'minutes', 1, 600, 45)
    distance = number(data, 'distance', .01, 100, 3)
    gain = number(data, 'gain', 0, 10000, 120)
    temp = number(data, 'temperature', -30, 55, 22)
    humidity = number(data, 'humidity', 0, 100, 60)
    mode = data.get('mode', 'walk')
    if mode not in ('walk', 'run'):
        raise ValueError('Choose walk or run.')
    horizontal, vertical = (.1, 1.8) if mode == 'walk' else (.2, .9)
    raw_segments = data.get('segments', [])
    if not isinstance(raw_segments, list) or len(raw_segments) > 10000:
        raise ValueError('Route must contain at most 10,000 segments.')
    segments = []
    unknown_elevation = 0
    if raw_segments:
        for s in raw_segments:
            if not isinstance(s, dict):
                raise ValueError('Invalid route segment.')
            meters = number(s, 'distance_m', .01, 100000, 1)
            if s.get('elevation_delta_m') is None:
                delta = 0
                unknown_elevation += 1
            else:
                delta = number(s, 'elevation_delta_m', -10000, 10000, 0)
            if abs(delta / meters) > .3:
                raise ValueError('A route segment exceeds 30% grade. Check GPS altitude noise or use manual distance and ascent.')
            segments.append((meters, delta))
        route_meters = sum(s[0] for s in segments)
        if not 10 <= route_meters <= 100000:
            raise ValueError('Route distance must be between 10 meters and 100 km.')
        distance = route_meters / 1000
        gain = sum(max(0, s[1]) for s in segments)
    else:
        if gain > distance * 1000 * .3:
            raise ValueError('Elevation gain exceeds this model’s supported average ascent grade of 30%.')
        segments = [(distance * 1000, gain)]
    speed = distance * 1000 / minutes
    # Segment durations are allocated by distance: a constant-speed approximation.
    flat = 0
    uphill = 0
    max_grade = 0
    for meters, delta in segments:
        segment_minutes = minutes * meters / (distance * 1000)
        grade = max(0, delta / meters)
        flat += (horizontal * speed + 3.5) * weight / 1000 * 5 * segment_minutes
        uphill += vertical * speed * grade * weight / 1000 * 5 * segment_minutes
        max_grade = max(max_grade, grade * 100)
    estimate = flat + uphill
    speed_kmh = distance / minutes * 60
    outside = not (3 <= speed_kmh <= 6) if mode == 'walk' else speed_kmh < 8
    # NOAA/Rothfusz heat-index regression where applicable, in Fahrenheit.
    f = temp * 9 / 5 + 32
    simple = .5 * (f + 61 + (f - 68) * 1.2 + humidity * .094)
    heat_index_c = None
    if (simple + f) / 2 >= 80:
        hi = (-42.379 + 2.04901523*f + 10.14333127*humidity - .22475541*f*humidity
              - .00683783*f*f - .05481717*humidity*humidity + .00122874*f*f*humidity
              + .00085282*f*humidity*humidity - .00000199*f*f*humidity*humidity)
        if humidity < 13 and 80 <= f <= 112:
            hi -= (13-humidity)/4 * math.sqrt((17-abs(f-95))/17)
        elif humidity > 85 and 80 <= f <= 87:
            hi += (humidity-85)/10 * (87-f)/5
        heat_index_c = round((hi-32)*5/9, 1)
    warm = temp >= 30 or (heat_index_c is not None and heat_index_c >= 32)
    return dict(calories=round(estimate), flat=round(flat), uphill=round(uphill),
                low=round(estimate * .75), high=round(estimate * 1.25), speed=round(speed_kmh, 2),
                distance=round(distance,3), gain=round(gain,1), max_grade=round(max_grade,1),
                segment_count=len(segments), unknown_elevation=unknown_elevation,
                heat_index_c=heat_index_c,
                heat='Hot conditions can increase heat strain. Consider reducing intensity and taking water breaks.' if warm else 'Temperature and humidity recorded with this estimate.',
                weather_model='Weather informs heat context, not a calorie multiplier. Heat index assumes shade and light wind; it is not WBGT or a safety guarantee.',
                caution='Speed is outside the usual equation range; interpret with extra caution.' if outside else 'Steady-state estimate. Route times use constant speed; downhill is treated as level ground.',
                model='ACSM-style research equation, not a trained AI model. ±25% bounds are illustrative, not calibrated confidence intervals.')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'static'), **kwargs)

    def do_POST(self):
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 100_000:
                raise ValueError('Invalid request size.')
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError('Expected a JSON object.')
            if self.path == '/api/simulate':
                result = simulate(data)
            elif self.path == '/api/activity':
                result = activity(data)
            else:
                self.send_error(404)
                return
            status = 200
        except (ValueError, TypeError, OverflowError) as exc:
            result, status = {'error': str(exc)}, 400
        body = json.dumps(result).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)


