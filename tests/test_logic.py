import json
import tempfile
import unittest
from pathlib import Path
from longevity.backups import prepare_import
from longevity.eeg import parse_eeg
from longevity.health import (
    calculate_bmi,
    calculate_bmr,
    estimate_calories,
    sleep_hours,
)
from longevity.journal import metric_value, month_weeks, summarize, validate_entry
from longevity.recorder import Recorder
from longevity.routes import (
    analyze_route,
    export_gpx,
    parse_gpx,
    playback_point,
    split_times,
)
from longevity.storage import Database


class CalculationTests(unittest.TestCase):
    def test_bmi_bmr_and_sleep(self):
        self.assertEqual(calculate_bmi(80, 180), 24.7)
        self.assertEqual(calculate_bmr(30, 80, 180, "male"), [1780, 1780])
        self.assertEqual(sleep_hours("23:00", "07:00"), 8)
        with self.assertRaises(ValueError):
            sleep_hours("07:00", "07:00")

    def test_ascent_requires_more_energy(self):
        self.assertGreater(
            estimate_calories(5000, 100, 3600, 70, "walk"),
            estimate_calories(5000, 0, 3600, 70, "walk"),
        )
        self.assertEqual(estimate_calories(5000, 100, 3600, 100, "walk"), 445)

    def test_missing_journal_values_are_not_zero(self):
        self.assertIsNone(metric_value({}, "calories"))
        self.assertEqual(metric_value({"breakfastCalories": 0}, "calories"), 0)
        self.assertIsNone(summarize([])["average_sleep"])
        self.assertEqual(
            sum(day > 0 for week in month_weeks(2024, 2) for day in week), 29
        )

    def test_journal_validation(self):
        entry = validate_entry(
            {"date": "2026-10-17", "bed": "23:00", "wake": "07:00", "duration": 0}
        )
        self.assertEqual(entry["duration"], 0)
        self.assertEqual(entry["sleepHours"], 8)
        with self.assertRaises(ValueError):
            validate_entry({**entry, "systolic": 100, "diastolic": 120})

    def test_eeg(self):
        self.assertTrue(parse_eeg("time_s,amplitude_uv\n0,-2\n1,3")["raw"])
        with self.assertRaises(ValueError):
            parse_eeg("time_s,amplitude_uv\n0,2\n0,3")

    def test_route_gaps_elevation_splits_and_gpx(self):
        points = [
            {"lat": 0, "lon": 0, "ele": 100, "elapsed": 0},
            {"lat": 0.001, "lon": 0, "ele": 110, "elapsed": 10},
            {"lat": 0.01, "lon": 0, "ele": 110, "elapsed": 20, "breakBefore": True},
            {"lat": 0.011, "lon": 0, "ele": 120, "elapsed": 30},
        ]
        route = analyze_route(points, 30)
        self.assertAlmostEqual(route["distance"], 222.39, places=1)
        self.assertEqual(route["gaps"], 1)
        self.assertTrue(playback_point(route, 0.5)["in_gap"])
        self.assertAlmostEqual(playback_point(route, 0.5)["lat"], 0.001)
        self.assertEqual(len(split_times(route)), 1)
        decoded = parse_gpx(export_gpx(points))
        self.assertTrue(decoded[2]["breakBefore"])
        self.assertIsNone(
            analyze_route([{**p, "ele": None} for p in points])["points"][0]["height"]
        )

    def test_invalid_xml_is_rejected(self):
        with self.assertRaises(ValueError):
            parse_gpx('<!DOCTYPE x [<!ENTITY y "bad">]><gpx/>')


class RecorderTests(unittest.TestCase):
    def fix(self, latitude, now, accuracy=5):
        return {
            "lat": latitude,
            "lon": 0,
            "ele": 100,
            "accuracy": accuracy,
            "timestamp": now * 1000,
            "altitudeAccuracy": 5,
        }

    def test_waiting_stationary_pause_resume(self):
        recorder = Recorder()
        recorder.start(1000)
        self.assertFalse(recorder.add_fix(self.fix(0, 1000, 200), 1000))
        self.assertEqual(recorder.wait_seconds(1010), 10)
        recorder.add_fix(self.fix(0, 1010), 1010)
        self.assertEqual(recorder.seconds(1015), 5)
        recorder.add_fix(self.fix(0.001, 1030), 1030)
        recorder.pause(1030)
        recorder.start(1040)
        recorder.add_fix(self.fix(0.01, 1040), 1040)
        recorder.add_fix(self.fix(0.011, 1060), 1060)
        recorder.pause(1060)
        self.assertEqual(recorder.seconds(2000), 40)
        self.assertAlmostEqual(
            analyze_route(recorder.data["points"])["distance"], 222.39, places=1
        )
        self.assertEqual(Recorder(draft=recorder.draft()).data["phase"], "paused")

    def test_timeout_and_duplicate_fixes(self):
        recorder = Recorder()
        recorder.start(1000)
        self.assertTrue(recorder.check_timeout(1045))
        recorder.start(1050)
        recorder.add_fix(self.fix(0, 1050), 1050)
        self.assertFalse(recorder.add_fix(self.fix(0, 1050), 1051))
        self.assertEqual(len(recorder.data["points"]), 1)


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.db = Database(Path(self.folder.name) / "test.sqlite3")
        self.first = self.db.register("Alex", "alex@example.test", "long-password-1")
        self.second = self.db.register("Blair", "blair@example.test", "long-password-2")

    def tearDown(self):
        self.folder.cleanup()

    def test_accounts_and_isolation(self):
        user = self.db.sign_in("ALEX@example.test", "long-password-1")
        self.assertEqual(user["id"], self.first["id"])
        self.db.save(user["id"], "journal", "today", {"secret": 123})
        self.assertIsNone(self.db.get(self.second["id"], "journal", "today"))
        self.db.delete(self.second["id"], "journal", "today")
        self.assertEqual(len(self.db.list(user["id"], "journal")), 1)
        with self.db.connect() as connection:
            row = connection.execute(
                "SELECT password_hash FROM users WHERE id=?", (user["id"],)
            ).fetchone()
            self.assertNotEqual(row["password_hash"], "long-password-1")
        with self.assertRaises(ValueError):
            self.db.sign_in("alex@example.test", "wrong-password")

    def test_backups_and_atomic_import(self):
        profile = {
            "name": "Alex",
            "age": 30,
            "height": 170,
            "weight": 70,
            "sex": "male",
        }
        legacy = {
            "profile": profile,
            "habits": {"exercise": 150, "sleep": 8, "plants": 5},
            "records": [{"date": "2026-10-17", "bed": "23:00", "wake": "07:00"}],
        }
        documents = prepare_import(json.dumps(legacy))
        self.db.import_documents(self.first["id"], documents)
        self.assertEqual(
            self.db.get(self.first["id"], "profile", "main")["name"], "Alex"
        )
        backup = json.dumps({"version": 2, "records": self.db.export(self.first["id"])})
        self.db.import_documents(self.second["id"], prepare_import(backup))
        self.assertEqual(len(self.db.list(self.second["id"], "journal")), 1)
        with self.assertRaises(ValueError):
            self.db.import_documents(
                self.first["id"], [("journal", "bad", {}), ("unknown", "x", {})]
            )
        self.assertIsNone(self.db.get(self.first["id"], "journal", "bad"))


if __name__ == "__main__":
    unittest.main()
