---
title: Database Backups
description: "Dump the application database, list what you have, and put one back. Covers buddy db:backup, db:backups, and db:restore, plus the dump the deploy takes before every migration."
---

# Database Backups

`buddy deploy` runs `migrate` against production on every release. These commands are what you go back to when a migration does something nobody meant.

```bash
./buddy db:backup      # take a dump now
./buddy db:backups     # list the dumps you have
./buddy db:restore     # put the newest one back
```

## The dump the deploy takes for you

You do not have to wire this up. When a site's `preStart` runs `migrate`, the deploy inserts a dump immediately before it:

```ts
// config/cloud.ts - what you write
preStart: [
  'bun install',
  'bun --conditions development storage/framework/core/buddy/src/cli.ts migrate',
]
```

```bash
# what runs on the box
bun install
bun … cli.ts db:backup --before-migrations --out /var/www/<slug>-shared/backups
bun … cli.ts migrate
```

Only the site that runs `migrate` gets the dump, because that is the one that owns the database. The destination sits beside the database itself, outside every release tree, so the release pruner cannot delete your backup along with the release that took it.

If the dump fails, the deploy stops before migrating. That is deliberate: the alternative is changing the schema of a database you have no copy of.

A first deploy has no database yet. `--before-migrations` makes that case succeed quietly instead of failing the release.

## Taking one yourself

```bash
./buddy db:backup
./buddy db:backup --out /mnt/backups --retain 30
```

| Option | What it does |
| --- | --- |
| `--out <dir>` | Where to write. Default `storage/backups/database`. |
| `--retain <n>` | How many dumps to keep. Default 7, oldest pruned first. |
| `--before-migrations` | Deploy mode: succeed quietly when there is no database yet. |
| `--verbose` | Print the dump command being run. |

Dumps are named so that sorting them by name sorts them by time: `2026-08-13T09-00-00-000.postgres.sql`.

## Restoring

```bash
./buddy db:restore                                   # the newest dump
./buddy db:restore 2026-08-13T09-00-00-000.sqlite.sqlite
./buddy db:restore --force                           # no prompt
```

Without `--force` you are asked to confirm, and a non-interactive shell counts as "no" rather than as "yes".

For SQLite the database being replaced is moved aside as `<name>.replaced-<timestamp>` rather than overwritten, so restoring the wrong dump is itself recoverable.

**Restore into a scratch copy first, at least once.** A backup nobody has ever restored is a hypothesis.

## What gets dumped

| Engine | Tool | Notes |
| --- | --- | --- |
| SQLite | built in | `VACUUM INTO`, not a file copy - a copy can miss writes that are still only in the WAL. |
| Postgres | `pg_dump` | `--no-owner --no-acl`, so the dump restores onto a fresh box. |
| MySQL / MariaDB | `mysqldump` | `--single-transaction`, so InnoDB tables are consistent with each other. |
| Vitess | none | A logical dump through a vtgate does not restore a sharded keyspace. Snapshot at the storage layer instead. |
| DynamoDB | none | Not a database on your disk. |

Connections are made as your **application's** database user, for the one database it owns. No superuser is involved. Passwords are passed through the environment, never on the command line, so they do not appear in `ps`.

## This is not offsite

Every dump above lands on the same disk as the database it came from. That survives a bad migration. It does not survive losing the instance.

`buddy doctor` keeps saying so while that is true:

```
⚠ Database backups   postgres is provisioned on the compute instance …
                     The dumps `buddy deploy` takes before each migration land
                     on that same disk: they survive a bad migration, not the
                     loss of the instance.
```

Copy them somewhere else on a schedule. A `schedule.command('db:backup')` in `app/Scheduler.ts` plus your own upload step is enough to start.

## See also

- [Migrate](/guide/buddy/migrate) - the command these dumps run ahead of
- [Deploy](/guide/buddy/deploy) - where the automatic dump is inserted
- [Command Reference](/guide/buddy/commands) - every flag, generated from the registry
