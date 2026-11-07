"""Retry selection must cover discovered and stale groups without pruning history."""
import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).parent


def load_backup():
    dependency = types.ModuleType('app_backup_retention')
    dependency.ResticArchive = lambda _: None
    dependency.digest = lambda _: 'fixture'
    dependency.STAGING_MARKER = '.host-backup-managed'
    spec = importlib.util.spec_from_file_location('retry_fixture', ROOT / 'host-backup.py')
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {'app_backup_retention': dependency}), patch.object(importlib.machinery.SourceFileLoader, 'load_module', return_value=types.SimpleNamespace()):
        spec.loader.exec_module(module)
    return module


class RetryTests(unittest.TestCase):
    def test_only_fresh_verified_backups_can_be_skipped(self):
        backup = load_backup()
        now = 2_000_000
        fresh = {'timestamp': now - 60, 'restore_verified': True}
        for label, state, due in [
            ('new discovery', {}, True),
            ('one provider missing', {'aws': fresh}, True),
            ('both verified', {'aws': fresh, 'hetzner': fresh}, False),
            ('explicit failure', {'aws': fresh, 'hetzner': fresh, 'error': 'failed'}, True),
            ('stale provider', {'aws': fresh, 'hetzner': {**fresh, 'timestamp': now - 36 * 3600 - 1}}, True),
            ('unverified restore', {'aws': fresh, 'hetzner': {**fresh, 'restore_verified': False}}, True),
            ('future timestamp', {'aws': fresh, 'hetzner': {**fresh, 'timestamp': now + 1}}, True),
        ]:
            with self.subTest(label=label):
                self.assertEqual(backup.project_backup_due(state, ['aws', 'hetzner'], now), due)
                self.assertEqual(backup.all_projects_recovered({'projects': {'app': {}}, 'repositories': ['aws', 'hetzner']}, {'projects': {'app': state}}, now), not due)
        self.assertFalse(backup.all_projects_recovered({'projects': {'new-app': {}}, 'repositories': ['aws', 'hetzner']}, {'projects': {}}, now))

    @unittest.skipUnless(os.geteuid() == 0, 'real root-owned staging integration')
    def test_retry_creates_missing_and_stale_backups_and_preserves_every_snapshot(self):
        backup = load_backup()
        now = int(time.time())
        fresh = {name: {'timestamp': now, 'restore_verified': True} for name in ['aws', 'hetzner']}
        stale = {name: {**value, 'timestamp': now - 37 * 3600} for name, value in fresh.items()}
        calls, archived = [], []
        backup.ResticArchive = lambda _: types.SimpleNamespace(run=lambda *args: archived.append(args))
        backup.command = lambda args: None
        def recover(project, *_):
            calls.append(project)
            return fresh, None
        backup.project_backup = recover
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / 'config.json'
            config.write_text(json.dumps({'repositories': {'aws': '/unused', 'hetzner': '/unused'}, 'projects': {name: {} for name in ['fresh', 'new', 'stale', 'failed']}, 'staging': str(root / 'stage')}))
            backup.STATE = root / 'state.json'
            backup.STATE.write_text(json.dumps({'projects': {'fresh': fresh, 'stale': stale, 'failed': {**fresh, 'error': 'previous failure'}}}))
            real_open = open
            def locked_open(file, *args, **kwargs):
                return real_open(root / 'lock' if file == '/run/lock/host-backup.lock' else file, *args, **kwargs)
            with patch('sys.argv', ['host-backup.py', '--config', str(config), '--retry-failed', '--preserve-backups']), patch('builtins.open', side_effect=locked_open):
                backup.main()
                self.assertEqual(calls, ['new', 'stale', 'failed'])
                self.assertEqual(archived, [], 'retry must never forget or prune an existing snapshot')
                self.assertNotIn('error', json.loads(backup.STATE.read_text())['projects']['failed'])
                backup.main()
                self.assertEqual(calls, ['new', 'stale', 'failed'], 'fresh recovered groups must not be repeated')


if __name__ == '__main__':
    unittest.main()
