# Shared production host recovery

This directory contains the settings and systemd overrides for the shared
stacksjs.com host. Buddy removes it when generating an app. The Bun backup
coordinator, project discovery, Restic adapter, SQLite snapshots and database
restore drills live in `@stacksjs/cloud` under `src/host-backup/`.

`config/cloud.ts` declares the persistent paths on the managed deployments
volume. Use storage-only reconciliation for storage migrations so a pending
instance resize cannot restart the shared host. The migration does an online
copy, quiesces the writers, verifies the final copy with checksums, persists
the bind mounts, then checks service health before reclaiming redundant data.

## Backup operators

Build and install from a reviewed checkout on the Linux host with Bun 1.4.4,
Restic, SQLite, the database client tools, and the existing systemd base units
and private repository environment files.

```sh
bun cloud/production/install-preserving.ts
bun cloud/production/install-preserving.ts --apply
```

The first command checks the installed operator hashes. Apply requires root and
the mounted deployments volume, builds and smoke-tests the Bun executable,
archives the previous operators and overrides on that volume, and reloads
systemd. It installs `/usr/local/sbin/stacks-host-ops` and switches
`/usr/local/sbin/mail-host-maintenance` to the Bun command. The pre-install
copies are available for rollback.

The daily application backup and its hourly retry restore from both AWS and
Hetzner before recording success. Both units use `--preserve-backups`. The
hourly retry processes new, failed, missing and stale receipts, and skips
groups verified by every provider within 36 hours. The integrity check reads
one seventh of each repository per run. The database drill restores
PostgreSQL and local Vitess into disposable instances with TCP disabled, using
scratch space on the mounted deployments volume.
Systemd orders recovery checks behind queued backups and keeps the shared
lock and runtime budgets.

The mail units set `MAIL_BACKUP_PRESERVE=1` to retain local archives and remote
snapshots. The mail restore drill waits behind queued host recovery work.
`mail-host-maintenance --verify-only` reports root disk use without applying
cleanup. Running `mail-host-maintenance` without arguments displays the
maintenance plan. `--apply` recovers local disk space from aged duplicate
dumps, abandoned scratch files, old mail binaries and inactive releases. A
local dump is eligible only after a matching restore from both repositories
and a durable receipt. The operator retains remote snapshots.

## Operator checks

- Run `stacks-host-ops snapshot-record --record <private-file>` before the
  change and again with `--verify` afterward. This compares snapshot IDs across
  both providers.
- `stacks-host-ops inventory` refreshes the inventory with staging on the
  deployments volume. Disposable PostgreSQL databases are excluded only if they
  carry the `stacks:disposable-verification` comment and have an owner role that
  expires within 24 hours. Preview removal of a stale database-only selection
  with `inventory --retire-missing-database NAME`. Adding `--apply` archives
  the inventory and removes the selection while retaining backup history.
- `postgres-logs.sql` moves PostgreSQL collector logs to the deployments
  volume. Create the directory owned by postgres, install the systemd mount
  dependency, and apply the SQL as postgres before restarting. Preserve the
  previous log and verify a log rotation.
- ReviewOS declares its private, versioned `reviewos-production` bucket in
  `cloud/object-storage.ts` in the ReviewOS repository. Use
  `stacks-host-ops reviewos-credentials --source <private-S3-env-file>` to
  install the protected credential file. A different existing credential
  requires explicit rotation.
- After applying, verify database readiness, app HTTPS, workers, persistent
  mounts and fstab, both repositories, mail protocols and failed units.
