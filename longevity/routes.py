"""GPS math in Python: distance, elevation, splits, playback, and GPX files."""

import math
from datetime import datetime, timezone
from statistics import median
from xml.etree import ElementTree

MILE_METERS = 1609.344


def distance_meters(first, second):
    """Haversine distance between two latitude/longitude points."""
    lat1, lat2 = math.radians(first["lat"]), math.radians(second["lat"])
    dlat = lat2 - lat1
    dlon = math.radians(second["lon"] - first["lon"])
    part = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    return 6_371_000 * 2 * math.asin(math.sqrt(min(1, part)))


def optional_number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def valid_point(point):
    lat = optional_number(point.get("lat"))
    lon = optional_number(point.get("lon"))
    return lat is not None and lon is not None and abs(lat) <= 90 and abs(lon) <= 180


def analyze_route(raw_points, active_seconds=0):
    """Keep pauses as gaps. Missing altitude is never changed into zero.

    A three-point median smooths heights. Changes smaller than 3 meters
    accumulate before affecting ascent; implausible grades are omitted.
    """
    if (
        not isinstance(raw_points, list)
        or len(raw_points) > 10_000
        or any(not isinstance(p, dict) or not valid_point(p) for p in raw_points)
    ):
        raise ValueError("Use at most 10,000 valid GPS points.")
    points = []
    total = ascent = descent = 0.0
    anchor_height = None
    anchor_distance = 0.0
    gaps = excluded = 0
    for index, raw in enumerate(raw_points):
        point = dict(raw)
        height = optional_number(raw.get("ele"))
        if (
            0 < index < len(raw_points) - 1
            and not raw.get("breakBefore")
            and not raw_points[index + 1].get("breakBefore")
        ):
            neighbors = [
                optional_number(p.get("ele")) for p in raw_points[index - 1 : index + 2]
            ]
            if all(value is not None for value in neighbors):
                height = median(neighbors)
        if index and not raw.get("breakBefore"):
            total += distance_meters(raw_points[index - 1], raw)
            if height is not None and anchor_height is not None:
                change = height - anchor_height
                if abs(change) >= 3:
                    span = total - anchor_distance
                    if span > 0 and abs(change / span) <= 0.3:
                        ascent += max(0, change)
                        descent += max(0, -change)
                    else:
                        excluded += 1
                    anchor_height, anchor_distance = height, total
            else:
                anchor_height, anchor_distance = height, total
        else:
            gaps += int(index > 0)
            anchor_height, anchor_distance = height, total
        point.update(
            height=height,
            meters=total,
            ascent=ascent,
            elapsed=optional_number(point.get("elapsed")),
        )
        points.append(point)
    have_elapsed = bool(points) and all(
        optional_number(p.get("elapsed")) is not None for p in points
    )
    if have_elapsed and any(
        points[i]["elapsed"] < points[i - 1]["elapsed"] for i in range(1, len(points))
    ):
        raise ValueError("GPS elapsed times must not go backwards.")
    timed = have_elapsed
    if not have_elapsed:
        try:
            stamps = [
                datetime.fromisoformat(p["time"].replace("Z", "+00:00")).timestamp()
                for p in points
            ]
            timed = (
                len(stamps) > 1
                and stamps[-1] > stamps[0]
                and all(a <= b for a, b in zip(stamps, stamps[1:]))
            )
        except (KeyError, TypeError, ValueError):
            stamps, timed = [], False
        for index, point in enumerate(points):
            point["elapsed"] = (
                stamps[index] - stamps[0]
                if timed
                else (point["meters"] / total * active_seconds if total else 0)
            )
    duration = active_seconds or (points[-1]["elapsed"] if points else 0)
    return {
        "points": points,
        "distance": total,
        "ascent": ascent,
        "descent": descent,
        "seconds": duration,
        "gaps": gaps,
        "excluded_slopes": excluded,
        "timed": timed,
        "altitude_points": sum(p["height"] is not None for p in points),
    }


def split_times(analysis, unit_meters=MILE_METERS):
    if not math.isfinite(unit_meters) or unit_meters <= 0:
        raise ValueError("Split distance must be positive.")
    splits = []
    boundary = unit_meters
    last_distance = last_time = 0.0
    points = analysis["points"]
    for previous, point in zip(points, points[1:]):
        if point.get("breakBefore") or point["meters"] <= previous["meters"]:
            continue
        while point["meters"] >= boundary:
            fraction = (boundary - previous["meters"]) / (
                point["meters"] - previous["meters"]
            )
            elapsed = previous["elapsed"] + fraction * (
                point["elapsed"] - previous["elapsed"]
            )
            splits.append(
                {
                    "distance": boundary - last_distance,
                    "seconds": elapsed - last_time,
                    "partial": False,
                }
            )
            last_distance, last_time = boundary, elapsed
            boundary += unit_meters
    if analysis["distance"] - last_distance > 1:
        splits.append(
            {
                "distance": analysis["distance"] - last_distance,
                "seconds": max(0, analysis["seconds"] - last_time),
                "partial": True,
            }
        )
    return splits


def playback_point(analysis, fraction):
    """Interpolate between fixes, but hold position during a GPS gap."""
    points = analysis["points"]
    if not points:
        return None
    target = min(1, max(0, fraction)) * points[-1]["elapsed"]
    for index, right in enumerate(points):
        if right["elapsed"] < target:
            continue
        left = points[max(0, index - 1)]
        if right.get("breakBefore") and target < right["elapsed"]:
            return {
                **left,
                "elapsed": target,
                "in_gap": True,
                "index": max(0, index - 1),
            }
        span = right["elapsed"] - left["elapsed"]
        if span <= 0 or target == right["elapsed"]:
            return {**right, "index": index}
        amount = (target - left["elapsed"]) / span
        point = {**left, "elapsed": target, "index": index}
        for key in ("lat", "lon", "meters", "ascent"):
            point[key] = left[key] + amount * (right[key] - left[key])
        point["height"] = None
        if left["height"] is not None and right["height"] is not None:
            point["height"] = left["height"] + amount * (
                right["height"] - left["height"]
            )
        return point
    return {**points[-1], "index": len(points) - 1}


def parse_gpx(content):
    if (
        len(content.encode()) > 2_000_000
        or "<!DOCTYPE" in content.upper()
        or "<!ENTITY" in content.upper()
    ):
        raise ValueError("Use a GPX file below 2 MB, without document entities.")
    try:
        root = ElementTree.fromstring(content)
    except ElementTree.ParseError:
        raise ValueError("The GPX XML is invalid.") from None
    groups = root.findall(".//{*}trkseg") or [root]
    points = []
    for group in groups:
        nodes = group.findall(".//{*}trkpt") or group.findall(".//{*}rtept")
        for index, node in enumerate(nodes):
            point = {
                "lat": optional_number(node.get("lat")),
                "lon": optional_number(node.get("lon")),
                "ele": optional_number(node.findtext("{*}ele")),
                "time": node.findtext("{*}time"),
                "breakBefore": bool(points) and index == 0,
            }
            if not valid_point(point):
                raise ValueError("The file contains an invalid coordinate.")
            points.append(point)
    if not 2 <= len(points) <= 10_000:
        raise ValueError("The route needs 2–10,000 points.")
    return points


def export_gpx(points):
    root = ElementTree.Element(
        "gpx",
        version="1.1",
        creator="Longevity Simulator",
        xmlns="http://www.topografix.com/GPX/1/1",
    )
    track = ElementTree.SubElement(root, "trk")
    segment = ElementTree.SubElement(track, "trkseg")
    for index, point in enumerate(points):
        if index and point.get("breakBefore"):
            segment = ElementTree.SubElement(track, "trkseg")
        node = ElementTree.SubElement(
            segment, "trkpt", lat=str(point["lat"]), lon=str(point["lon"])
        )
        if point.get("ele") is not None:
            ElementTree.SubElement(node, "ele").text = str(point["ele"])
        if point.get("time"):
            ElementTree.SubElement(node, "time").text = point["time"]
    return ElementTree.tostring(root, encoding="unicode", xml_declaration=True)


def clock(seconds):
    seconds = max(0, int(seconds))
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return (
        f"{hours}:{minutes:02}:{seconds:02}" if hours else f"{minutes:02}:{seconds:02}"
    )
