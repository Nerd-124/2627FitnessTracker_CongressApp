import math
import unittest
from app import simulate, activity


class ModelTests(unittest.TestCase):
    def test_bmi_and_published_bmr_coefficients(self):
        r = simulate(dict(age=30, height=180, weight=80, sex='male'))
        self.assertAlmostEqual(r['bmi'], 24.7)
        self.assertEqual(r['bmr'], [1780, 1780])
        self.assertEqual(simulate(dict(age=30,height=180,weight=80,sex='female'))['bmr'], [1614,1614])

    def test_ascent_cost_uses_vertical_distance(self):
        base = dict(weight=70,minutes=60,distance=5,mode='walk')
        flat = activity({**base,'gain':0})
        hill = activity({**base,'gain':100})
        self.assertEqual(hill['uphill'], 63)
        self.assertAlmostEqual(hill['calories']-flat['calories'], 63, delta=1)  # independently rounded outputs
        # 500m/minute-independent vertical oxygen cost for the same ascent.
        self.assertEqual(activity({**base,'gain':100,'minutes':30})['uphill'],63)

    def test_weather_is_context_not_fabricated_energy(self):
        normal = activity(dict(temperature=22, humidity=50))
        hot = activity(dict(temperature=32,humidity=80))
        self.assertEqual(normal['calories'],hot['calories'])
        self.assertNotEqual(normal['heat'],hot['heat'])

    def test_invalid_input(self):
        for data in [dict(age=17),dict(weight=0),dict(height=math.nan),dict(sleep=30),dict(sex='invalid')]:
            with self.assertRaises(ValueError):
                simulate(data)
        with self.assertRaises(ValueError):
            activity(dict(distance=1,gain=1000))

    def test_illustrative_index_is_bounded(self):
        r=simulate(dict(exercise=600,plants=10,sleep=8))
        self.assertEqual(r['score'],100)
        self.assertTrue(all(0<=x<=100 for x in r['scenario']))
        low=simulate(dict(exercise=0,plants=0,sleep=3))
        self.assertEqual(low['score'],0)

class RouteModelTests(unittest.TestCase):
    def test_segment_uphill_and_downhill(self):
        base=dict(weight=70,minutes=30,distance=1,gain=0)
        flat=activity(base)
        routed=activity({**base,'segments':[dict(distance_m=500,elevation_delta_m=50),dict(distance_m=500,elevation_delta_m=-50)]})
        self.assertEqual(routed['gain'],50)
        self.assertEqual(routed['max_grade'],10)
        self.assertEqual(routed['segment_count'],2)
        self.assertGreater(routed['calories'],flat['calories'])
        self.assertEqual(routed['uphill'],32)

    def test_missing_elevation_is_disclosed(self):
        r=activity(dict(segments=[dict(distance_m=1000,elevation_delta_m=None)]))
        self.assertEqual(r['unknown_elevation'],1)
        self.assertEqual(r['uphill'],0)

    def test_noisy_elevation_rejected(self):
        with self.assertRaises(ValueError):
            activity(dict(segments=[dict(distance_m=10,elevation_delta_m=10)]))

    def test_heat_index_responds_to_humidity(self):
        dry=activity(dict(temperature=32,humidity=30))
        humid=activity(dict(temperature=32,humidity=80))
        self.assertGreater(humid['heat_index_c'],dry['heat_index_c'])
        self.assertEqual(humid['calories'],dry['calories'])
        self.assertIsNone(activity(dict(temperature=15))['heat_index_c'])


if __name__=='__main__':
    unittest.main()
