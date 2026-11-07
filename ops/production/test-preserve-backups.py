"""Exercise recovery operations without expiring an existing backup."""
import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sqlite3
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).parent

class PreservationTests(unittest.TestCase):
    @unittest.skipUnless(os.geteuid() == 0, "root-owned backup staging integration")
    def test_app_backup_preservation_never_forgets_snapshots(self):
        stub = types.ModuleType('app_backup_retention')
        stub.ResticArchive = lambda _: archive
        stub.digest = lambda _: 'hash'
        stub.STAGING_MARKER = '.host-backup-managed'
        calls = []
        archive = types.SimpleNamespace(run=lambda *args: calls.append(args))
        spec = importlib.util.spec_from_file_location('backup_fixture', ROOT / 'host-backup.py')
        module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'app_backup_retention': stub}), patch.object(importlib.machinery.SourceFileLoader, 'load_module', return_value=types.SimpleNamespace()):
            spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / 'config.json'
            config.write_text(json.dumps({'repositories': {'fixture': '/unused'}, 'projects': {'fixture': {}}, 'staging': str(root / 'stage')}))
            module.STATE = root / 'state.json'
            module.project_backup = lambda *args: ({'fixture': {'restore_verified': True}}, None)
            with patch('sys.argv', ['host-backup.py', '--config', str(config), '--preserve-backups']), patch('builtins.open', wraps=open) as original:
                # Map only the host coordinator lock into the private fixture.
                real_open = original._mock_wraps
                original.side_effect = lambda file, *args, **kwargs: real_open(root / 'lock' if file == '/run/lock/host-backup.lock' else file, *args, **kwargs)
                module.main()
            self.assertEqual(calls, [])
            self.assertTrue(json.loads(module.STATE.read_text())['projects']['fixture']['fixture']['restore_verified'])

    @unittest.skipUnless(sys.platform == 'linux' and os.geteuid() == 0, 'Linux root mail archive integration')
    def test_mail_preserves_aged_backups_and_still_creates_a_valid_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with sqlite3.connect(root / 'smtp.db') as database:
                database.execute('CREATE TABLE messages (body TEXT)')
                database.execute("INSERT INTO messages VALUES ('preserved database row')")
            (root / 'mail').mkdir()
            (root / 'mail/message').write_text('preserve this user message')
            (root / 'backups').mkdir()
            old = root / 'backups/mail-backup-20000101-000000.tgz'
            old.write_bytes(b'old backup bytes')
            os.utime(old, (1, 1))
            env = dict(os.environ, MAIL_DIR=str(root), MAIL_ENV_FILE=str(root / 'missing.env'), MAIL_BACKUP_PRESERVE='1')
            subprocess.run(['bash', str(ROOT / 'mail-backup.sh')], env=env, check=True, capture_output=True)
            self.assertEqual(old.read_bytes(), b'old backup bytes')
            new = [item for item in (root / 'backups').glob('*.tgz') if item != old]
            self.assertEqual(len(new), 1)
            archive = subprocess.check_output(['tar', '-xOzf', str(new[0]), 'mail/message'])
            self.assertEqual(archive, b'preserve this user message')

if __name__ == '__main__':
    unittest.main()
