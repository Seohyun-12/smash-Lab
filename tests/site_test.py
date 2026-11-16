"""Offline regression checks for the target identity and shared map transform."""
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('osm_site', ROOT / 'tools/osm_site.py')
osm = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(osm)


class SiteTest(unittest.TestCase):
    def setUp(self):
        self.raw = json.loads((ROOT / 'data/innovalley-osm.json').read_text())
        self.site = osm.generate(self.raw)

    def test_generated_file_reproduces_snapshot(self):
        self.assertEqual(osm.serialize(self.site), (ROOT / 'dist/site.js').read_text())

    def test_both_distinct_targets_keep_source_and_meter_scale(self):
        e, f = self.site['targets']
        self.assertEqual((e['id'], e['osmWay'], e['levels'], e['heightMeters']), ('E', 684716463, 10, 44))
        self.assertEqual((f['id'], f['osmWay'], f['levels'], f['heightMeters']), ('F', 684716461, 9, 43))
        self.assertAlmostEqual(f['height'] / e['height'], 43 / 44, places=4)
        self.assertGreater(min(p[0] for p in f['outline']), max(p[0] for p in e['outline']))
        self.assertNotIn(f['osmWay'], [n['osmWay'] for n in self.site['neighbors']])

    def test_missing_target_stops_generation(self):
        self.raw['elements'] = [e for e in self.raw['elements'] if e['id'] != 684716461]
        with self.assertRaises(KeyError):
            osm.generate(self.raw)


if __name__ == '__main__':
    unittest.main()
