"""Exercise the actual Python screens without installing a browser."""

import os
from pathlib import Path
import tempfile
import unittest
from streamlit.testing.v1 import AppTest
from longevity.storage import Database

ROOT = Path(__file__).resolve().parents[1]


def labeled(widgets, label):
    return next(widget for widget in widgets if widget.label == label)


class InterfaceTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.old_folder = os.environ.get("LONGEVITY_DATA_DIR")
        os.environ["LONGEVITY_DATA_DIR"] = self.folder.name
        self.db = Database(Path(self.folder.name) / "longevity.sqlite3")

    def tearDown(self):
        if self.old_folder is None:
            os.environ.pop("LONGEVITY_DATA_DIR", None)
        else:
            os.environ["LONGEVITY_DATA_DIR"] = self.old_folder
        self.folder.cleanup()

    def test_signup_profile_and_every_screen(self):
        app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=20).run()
        self.assertFalse(app.exception)
        labeled(app.text_input, "Name or nickname").set_value("Alex")
        labeled(app.text_input, "Email address").set_value("alex@example.test")
        labeled(app.text_input, "Choose a password (10+ characters)").set_value(
            "long-password-123"
        )
        labeled(app.text_input, "Repeat password").set_value("long-password-123")
        labeled(app.button, "Create account").click().run()
        self.assertFalse(app.exception)
        self.assertEqual(app.title[0].value, "Your starting point")
        labeled(app.button, "Save my profile").click().run()
        self.assertFalse(app.exception)
        for screen in [
            "Today",
            "Daily journal",
            "Sleep",
            "Exercise & routes",
            "Try a habit",
            "My profile",
            "Account & backups",
            "The science",
        ]:
            app.sidebar.radio[0].set_value(screen).run()
            self.assertFalse(app.exception, f"Screen failed: {screen}")
        app.sidebar.button[0].click().run()
        self.assertFalse(app.exception)
        self.assertEqual(app.title[0].value, "Longevity Simulator")

    def test_journal_save_and_chart(self):
        user = self.db.register("Alex", "alex@example.test", "long-password-123")
        self.db.save(
            user["id"],
            "profile",
            "main",
            {
                "name": "Alex",
                "age": 30,
                "height": 170,
                "weight": 70,
                "sex": "male",
                "exercise": 150,
                "sleep": 8,
                "plants": 5,
            },
        )
        app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=20)
        app.session_state["user"] = user
        app.run()
        app.sidebar.radio[0].set_value("Daily journal").run()
        self.assertFalse(app.exception)
        labeled(app.text_input, "Breakfast").set_value("Oatmeal")
        labeled(app.number_input, "Breakfast estimated kcal").set_value(350.0)
        labeled(app.button, "Save day").click().run()
        self.assertFalse(app.exception)
        rows = self.db.list(user["id"], "journal")
        self.assertEqual(rows[0]["data"]["breakfast"], "Oatmeal")
        self.assertEqual(rows[0]["data"]["breakfastCalories"], 350)
        self.assertEqual(rows[0]["data"]["sleepHours"], 8)
        labeled(app.selectbox, "Measurement").set_value("calories").run()
        self.assertFalse(app.exception)

    def test_saved_route_playback_screen(self):
        user = self.db.register("Alex", "alex@example.test", "long-password-123")
        self.db.save(
            user["id"],
            "profile",
            "main",
            {
                "name": "Alex",
                "age": 30,
                "height": 170,
                "weight": 70,
                "sex": "male",
                "exercise": 150,
                "sleep": 8,
                "plants": 5,
            },
        )
        points = [
            {"lat": 40, "lon": -80, "ele": 100, "elapsed": 0},
            {"lat": 40.02, "lon": -80, "ele": 120, "elapsed": 600},
        ]
        self.db.save(
            user["id"],
            "run",
            "example",
            {
                "date": "2026-10-17",
                "mode": "run",
                "weight": 70,
                "seconds": 600,
                "route": points,
                "calories": 180,
            },
        )
        app = AppTest.from_file(str(ROOT / "app.py"), default_timeout=20)
        app.session_state["user"] = user
        app.run()
        app.sidebar.radio[0].set_value("Exercise & routes").run()
        self.assertFalse(app.exception)
        labeled(app.slider, "Seek along the route (%)").set_value(50).run()
        self.assertFalse(app.exception)
        labeled(app.checkbox, "Play route").check().run()
        self.assertFalse(app.exception)


if __name__ == "__main__":
    unittest.main()
