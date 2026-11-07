#!/usr/bin/env python3
"""Record or verify that every original off-host snapshot still exists."""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0, '/usr/local/sbin')
from app_backup_retention import ResticArchive

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('record', type=Path)
parser.add_argument('--verify', action='store_true')
args = parser.parse_args()
config = json.loads(Path('/var/lib/mail-storage/data/restic/host-backup.json').read_text())
current = {name: sorted(item['id'] for item in json.loads(ResticArchive(Path(env)).run('snapshots', '--json'))) for name, env in config['repositories'].items()}
if args.verify:
    original = json.loads(args.record.read_text())
    for name, identifiers in original.items():
        if not set(identifiers).issubset(set(current[name])):
            raise SystemExit(f'{name}: original snapshots are missing')
        print(f'{name}: all {len(identifiers)} original snapshots preserved; {len(current[name])} present')
else:
    with args.record.open('x') as output:
        import os
        os.chmod(args.record, 0o600)
        json.dump(current, output)
    print(json.dumps({name: len(ids) for name, ids in current.items()}))
