# Production disk recovery

The shared host placed releases on the managed deployments volume but left ReviewOS blob packs and repository storage on root. `config/cloud.ts` now declares those mutable paths through the published ts-cloud persistent-storage policy. The operator must use storage-only reconciliation, so a pending instance resize cannot restart the shared host.

The migration copies online, stops declared services and liveness timers, checks for remaining open files, performs a final checksum copy and a checksum dry run, persists bind mounts and service dependencies, restarts the previous writers, and verifies HTTPS before reclaiming only the redundant root copies. The durable journal records verified bytes and supports retry. Never run a blind cleanup against application storage.

These host operator scripts retain the currently deployed backup implementation and add explicit preservation controls:

- `host-backup.py --preserve-backups` creates and restores fresh backups without Restic forget/prune.
- `MAIL_BACKUP_PRESERVE=1 mail-restic-backup` preserves both local mail archives and remote snapshots. Install the companion `mail-backup.sh` at `/opt/mail/backup.sh` for the local archive control.
- `mail-host-maintenance --verify-only` checks capacity without running retention or deleting releases.

The inventory places future database dump staging on the mounted deployments volume; the old root staging is retained as recovery evidence. The existing `app_backup_retention.py`, repository environment files, systemd units and protected state remain host prerequisites. Credentials are never stored here. Before replacing an operator, verify the deployed script still matches the reviewed baseline and save its previous version on the persistent volume. Preserve the staged database dumps before refreshing them. Backup verification must compare snapshot identities before and after, not merely count them.

`postgres-logs.sql` enables the PostgreSQL collector and rotates logs on the persistent volume. Create its log directory owned by postgres, add `RequiresMountsFor=/var/lib/stacks-deployments` to `postgresql-pantry.service`, and apply the SQL as postgres before a controlled service restart. Keep the existing `pg.log` intact. Verify the collector and a real log rotation after restart; there is no log deletion policy.

Checks: `python3 test-preserve-backups.py` on Linux as root, shell syntax checks, ts-cloud driver tests and its isolated Linux mount tests. Verify database readiness, app HTTPS, workers, persistent mount identities, fstab, backups, mail protocols and failed units after applying.

ReviewOS uses a separate private, versioned `reviewos-production` bucket in `hel1`, declared in its `cloud/object-storage.ts`. The shared host's existing operator credential can be installed into the app's private credential file using `reviewos-credentials.py --source <protected-S3-env-file>`. It never emits credentials or overwrites a different key pair. Prefer a dedicated project credential when rotating keys; the current trusted application processes already run as root on this host. Keep the backup bucket and its snapshots untouched.

`install-preserving.py --apply` checks all operator baselines first, saves prior versions, installs the companion systemd declarations and reloads systemd. The declarations preserve app/mail backup history, put staging behind the required volume and make automated capacity maintenance read-only. The PostgreSQL declaration requires the logging volume before startup.

Mail restore drills order after already queued application backups, integrity
checks and database drills. Their runtime budget starts when the drill can run,
so a long initial upload cannot exhaust the mail service's lock-wait budget.
The existing shared lock still serializes later arrivals.

Host integrity checks and database drills order after already queued backups
and retries. They begin their own six-hour operational budget when runnable.
This accounts for full SQLite validation on the persistent volume; observed
random-read throughput was about 1 MiB/s during the initial 4.5 GiB snapshot
set. Integrity and restore validation remain complete.

Disposable verification databases are excluded from discovery only when they
carry the explicit PostgreSQL comment `stacks:disposable-verification` and
belong to a role with a finite expiry within 24 hours. Unmarked databases
remain protected. If an older fixture was already discovered, preview its
retirement with `configure-host-backup.py --retire-missing-database NAME`,
then use `--apply` after review. This refuses live databases and selections
with file, SQLite or MySQL sources, archives the previous inventory, and
retains every existing backup and recovery receipt.
