"""A GPS recording state machine written in Python, not JavaScript."""

from datetime import datetime, timezone
import time
import uuid
from .routes import distance_meters, optional_number, valid_point


class Recorder:
    def __init__(self, mode="run", weight=70, draft=None):
        self.data = draft or {
            "id": str(uuid.uuid4()),
            "mode": mode,
            "weight": weight,
            "points": [],
            "seconds": 0,
            "phase": "paused",
            "needs_break": False,
        }
        self.data["phase"] = "paused"
        self.active_since = None
        self.wait_since = None
        self.message = "Ready to start."

    def start(self, now=None):
        now = time.time() if now is None else now
        self.data["phase"] = "acquiring"
        self.data["needs_break"] = bool(self.data["points"])
        self.wait_since = now
        self.message = "Getting GPS. Active time starts after a usable fix."

    def seconds(self, now=None):
        now = time.time() if now is None else now
        extra = max(0, now - self.active_since) if self.active_since is not None else 0
        return self.data["seconds"] + extra

    def wait_seconds(self, now=None):
        now = time.time() if now is None else now
        return max(0, now - self.wait_since) if self.wait_since is not None else 0

    def add_fix(self, fix, now=None):
        now = time.time() if now is None else now
        if self.data["phase"] not in ("acquiring", "recording"):
            return False
        accuracy = optional_number(fix.get("accuracy"))
        timestamp = optional_number(fix.get("timestamp"))
        if (
            not valid_point(fix)
            or accuracy is None
            or not 0 <= accuracy <= 35
            or timestamp is None
            or not -5 <= now - timestamp / 1000 <= 15
        ):
            self.message = f"Waiting for a fresh GPS fix within 35 m. Reported accuracy: {accuracy} m."
            return False
        previous = self.data["points"][-1] if self.data["points"] else None
        if previous and timestamp <= previous["timestamp"]:
            return False
        if self.data["phase"] == "acquiring":
            self.data["phase"] = "recording"
            self.active_since = now
        altitude_accuracy = optional_number(fix.get("altitudeAccuracy"))
        height = optional_number(fix.get("ele"))
        if altitude_accuracy is not None and altitude_accuracy > 30:
            height = None
        point = {
            "lat": float(fix["lat"]),
            "lon": float(fix["lon"]),
            "ele": height,
            "timestamp": timestamp,
            "time": datetime.fromtimestamp(timestamp / 1000, timezone.utc).isoformat(),
            "elapsed": self.seconds(now),
            "breakBefore": self.data["needs_break"],
            "accuracy": accuracy,
        }
        if previous:
            gap = (timestamp - previous["timestamp"]) / 1000
            distance = distance_meters(previous, point)
            if gap > 30:
                point["breakBefore"] = True
            elif not point["breakBefore"]:
                if distance / gap > (6 if self.data["mode"] == "walk" else 12):
                    self.message = "An implausible GPS jump was ignored."
                    return False
                if distance < max(4, min(8, accuracy * 0.25)):
                    self.message = (
                        "GPS is ready. Standing still does not stop the active timer."
                    )
                    return False
        if len(self.data["points"]) >= 10_000:
            self.pause(now)
            self.message = "Point limit reached. Finish this session."
            return False
        self.data["points"].append(point)
        self.data["needs_break"] = False
        self.message = f"Recording with GPS accuracy ±{accuracy:.0f} m."
        return True

    def pause(self, now=None):
        self.data["seconds"] = self.seconds(now)
        self.active_since = None
        self.wait_since = None
        self.data["phase"] = "paused"
        self.data["needs_break"] = True
        self.message = "Paused. Your route is preserved."

    def check_timeout(self, now=None):
        if self.data["phase"] == "acquiring" and self.wait_seconds(now) >= 45:
            self.pause(now)
            self.message = "GPS did not become ready within 45 seconds. Enable precise location and retry outdoors."
            return True
        return False

    def draft(self, now=None):
        return {**self.data, "seconds": self.seconds(now), "phase": "paused"}
