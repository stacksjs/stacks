#!/usr/bin/env python3
"""Install reviewed recovery operators only when every baseline still matches."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
from datetime import datetime, timezone

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
source = Path(__file__).resolve().parent
manifest = json.loads((source / 'operator-baseline.json').read_text())
for name, entry in manifest.items():
    actual = hashlib.sha256(Path(entry['target']).read_bytes()).hexdigest()
    expected = {entry['baseline'], hashlib.sha256((source / name).read_bytes()).hexdigest()}
    if actual not in expected:
        raise SystemExit(f"Operator changed since review; preserving it: {entry['target']}")
print(f"Verified {len(manifest)} operator baselines")
if args.apply:
    if os.geteuid() != 0 or not os.path.ismount('/var/lib/stacks-deployments'):
        raise SystemExit('Root and mounted persistent volume are required')
    saved = Path('/var/lib/stacks-deployments/recovery/operators') / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
    saved.mkdir(parents=True, mode=0o700)
    for name, entry in manifest.items():
        target = Path(entry['target'])
        shutil.copy2(target, saved / name)
        temporary = target.with_name(target.name + '.recovery-new')
        with temporary.open('xb') as output:
            output.write((source / name).read_bytes())
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary, target.stat().st_mode)
        temporary.replace(target)
    for entry in (source / 'systemd').glob('*.service.d/disk-recovery.conf'):
        target = Path('/etc/systemd/system') / entry.relative_to(source / 'systemd')
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            shutil.copy2(target, saved / (target.parent.name + '-' + target.name))
        target.write_bytes(entry.read_bytes())
        os.chmod(target, 0o644)
    import subprocess
    subprocess.run(['systemctl', 'daemon-reload'], check=True)
    print(f'Installed reviewed operators; previous versions retained at {saved}')
