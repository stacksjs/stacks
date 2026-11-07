import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('inventory', Path(__file__).with_name('configure-host-backup.py'))
inventory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inventory)

class InventoryRetirement(unittest.TestCase):
    def setUp(self):
        self.config = {'projects': {'fixture': {'postgres': ['fixture'], 'sqlite': [], 'files': []}, 'production': {'postgres': ['production'], 'sqlite': [], 'files': []}}}

    def test_retirement_retains_history_and_unrelated_selection(self):
        previous = copy.deepcopy(self.config['projects']['fixture'])
        inventory.retire_missing_database(self.config, 'fixture', {'production'})
        self.assertNotIn('fixture', self.config['projects'])
        self.assertIn('production', self.config['projects'])
        self.assertEqual(self.config['retired_databases'][0]['specification'], previous)

    def test_live_database_is_never_retired(self):
        with self.assertRaises(ValueError): inventory.retire_missing_database(self.config, 'fixture', {'fixture'})
        self.assertIn('fixture', self.config['projects'])

    def test_file_or_sqlite_sources_are_never_retired_with_a_database(self):
        for key in ['files', 'sqlite', 'mysql']:
            config = copy.deepcopy(self.config)
            config['projects']['fixture'][key] = ['preserved']
            with self.assertRaises(ValueError): inventory.retire_missing_database(config, 'fixture', set())
            self.assertIn('fixture', config['projects'])

if __name__ == '__main__': unittest.main()
