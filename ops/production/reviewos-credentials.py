#!/usr/bin/env python3
"""Install protected object-store credentials on the shared host without logging them."""
import argparse
import json
import os
from pathlib import Path
import shlex

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', required=True, type=Path, help='Existing operator-owned S3 environment file')
parser.add_argument('--target', type=Path, default=Path('/var/www/reviewos-shared/credentials/object-storage.json'))
args = parser.parse_args()
if os.geteuid() != 0:
    parser.error('root is required')
info = args.source.lstat()
if args.source.is_symlink() or info.st_uid != 0 or info.st_mode & 0o077:
    parser.error('source must be a private root-owned regular file')
values = {}
for line in args.source.read_text().splitlines():
    if '=' not in line or line.lstrip().startswith('#'):
        continue
    key, value = line.split('=', 1)
    tokens = shlex.split(value)
    if tokens:
        values[key.strip()] = tokens[0]
credentials = {'accessKeyId': values.get('HETZNER_S3_ACCESS_KEY') or values.get('AWS_ACCESS_KEY_ID'),
               'secretAccessKey': values.get('HETZNER_S3_SECRET_KEY') or values.get('AWS_SECRET_ACCESS_KEY')}
if not all(isinstance(value, str) and value for value in credentials.values()):
    parser.error('source has no usable S3 credential pair')
args.target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
if args.target.exists():
    if args.target.is_symlink() or json.loads(args.target.read_text()) != credentials:
        parser.error('existing credential file differs; explicit rotation is required')
else:
    fd = os.open(args.target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as output:
        json.dump(credentials, output); output.flush(); os.fsync(output.fileno())
print('Protected object storage credential file installed; no credentials emitted')
