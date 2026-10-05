---
title: Migrate Command
description: "The  command runs database migrations based on your model definitions, creating and updating database tables to match your application's data structure."
---
# Migrate Command

The `buddy migrate` command runs database migrations based on your model definitions, creating and updating database tables to match your application's data structure.

## Basic Usage

```bash
# Run all pending migrations
buddy migrate

# Fresh migration (drop all tables and re-migrate)
buddy migrate:fresh
```

## Command Syntax

```bash
buddy migrate [options]
buddy migrate:fresh [options]
```

### Options for `migrate`

| Option | Description |
|--------|-------------|
| `-d, --diff` | Show the SQL that would be run without executing |
| `-p, --project [project]` | Target a specific project |
| `-a, --auth` | Also migrate auth tables (oauth_clients, oauth_access_tokens, etc.) |
| `--strict` | Exit non-zero when the database has drifted from its migrations or models (for CI) |
| `--verbose` | Enable verbose output |

### Options for `migrate:fresh`

| Option | Description |
|--------|-------------|
| `-d, --diff` | Show the SQL that would be run without executing |
| `-p, --project [project]` | Target a specific project |
| `-s, --seed` | Run database seeders after migration |
| `-a, --auth` | Also migrate auth tables |
| `--verbose` | Enable verbose output |

## Available Commands

### Standard Migration

Run pending migrations:

```bash
buddy migrate
# or
buddy db:migrate
```

### Fresh Migration

Drop all tables and re-run all migrations:

```bash
buddy migrate:fresh
# or
buddy db:fresh
```

### DNS Migration

DNS is not migrated from here. `buddy dns:pull` prints a domain's live records
as a `config/dns.ts` block, `buddy dns:diff` shows what the file declares and the
zone is missing, and `buddy dns:sync` creates those records at the registrar.

## Examples

### Run Migrations

```bash
buddy migrate
```

Output:

```
buddy migrate

Migrated your local database.

Completed in 2.34s
```

### Fresh Migration with Seeding

```bash
buddy migrate:fresh --seed
```

This drops all tables, runs migrations, and seeds the database with test data.

### Preview Migration SQL

```bash
buddy migrate --diff
```

Shows what the next `buddy migrate` would do, without doing it: the committed
migration files the `migrations` table has not recorded yet, the model changes
that are not in a migration file yet, and any drift between the live database
and what its recorded migrations and models describe. It only says "your models
match the database" when all three are empty, and it exits non-zero if any of
them could not be read.

### Migrate with Auth Tables

```bash
buddy migrate --auth
```

Includes authentication-related tables:

- `oauth_clients`
- `oauth_access_tokens`
- `oauth_refresh_tokens`
- `password_resets`

### Full Fresh Migration with Everything

```bash
buddy migrate:fresh --seed --auth
```

## Model-Based Migrations

Stacks uses a model-first approach to migrations. Your migrations are generated from model definitions:

```typescript
// app/Models/User.ts
import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'User',
  table: 'users',

  traits: {
    useTimestamps: true,   // created_at / updated_at
  },

  hasMany: ['Post'],
  hasOne: ['Profile'],

  attributes: {
    name: {
      required: true,
      fillable: true,
      validation: { rule: schema.string().max(255) },
    },
    email: {
      required: true,
      unique: true,
      fillable: true,
      validation: { rule: schema.string().email() },
    },
    password: {
      required: true,
      hidden: true,          // excluded from JSON
      validation: { rule: schema.string().min(8) },
    },
  },
} as const)
```

When you run `buddy migrate`, Stacks:

1. Reads every model definition from `app/Models`
2. Diffs them against the current database schema
3. Emits SQL into `database/migrations/` and runs what is pending

> **Migrations are emitted for one database.** The SQL under `database/migrations/`
> is generated for whichever dialect was configured at generation time, and the
> files shipped with a new project are SQLite. Pointing `DB_CONNECTION` at
> Postgres or MySQL without regenerating them will refuse to run, because the
> DDL is not portable. Run `buddy migrate:switch <driver>` to see what a switch
> involves.
>
> The generator currently reads **only** `app/Models`. If that directory is
> absent it produces nothing, so the framework's own
> `storage/framework/defaults/app/Models` are not picked up automatically.

Run `buddy generate:migrations` on its own to produce the SQL without applying
it, so you can review the file first.

### Pre-flight checks

Before a single statement runs, `buddy migrate` audits the corpus twice and
refuses rather than failing halfway through, which would leave the schema
partly applied.

**Is this SQL written for a different database?** Dialect-exclusive syntax
(`AUTOINCREMENT`, `SERIAL`, `AUTO_INCREMENT`) is matched against the target.
This is what catches a SQLite corpus pointed at Postgres.

**Does it use a feature this engine lacks?** A separate question, and invisible
to the first check: `FOREIGN KEY` is perfectly valid MySQL, so a MySQL corpus
aimed at a distributed engine passes the syntax audit cleanly and then fails on
the first constraint. Distributed engines reject foreign keys, and sharded ones
also reject `AUTO_INCREMENT`.

Each failure names the affected files and what to do instead. If you know your
corpus is correct, either check can be bypassed:

```bash
STACKS_ALLOW_DIALECT_MISMATCH=1 buddy migrate
STACKS_ALLOW_DDL_CONSTRAINT_VIOLATIONS=1 buddy migrate
```

::: warning Vitess uses its own online DDL
`buddy migrate` applies DDL over the connection. That is right for an
unsharded keyspace, but a sharded one expects schema changes through Vitess's
online DDL so they can roll out shard by shard. Generate the SQL and apply it
with `vtctldclient ApplySchema`. See
[Scaling the Database](/guide/database-scaling#schema-changes).
:::

## Environment-Specific Migrations

Migrations respect the `APP_ENV` environment variable:

```bash
# Migrate local database (default)
APP_ENV=local buddy migrate

# Migrate staging database
APP_ENV=staging buddy migrate

# Migrate production database
APP_ENV=production buddy migrate
```

## Database Configuration

Configure your database in `config/database.ts`:

```typescript
export default {
  default: 'sqlite',

  connections: {
    sqlite: {
      driver: 'sqlite',
      database: 'storage/database.sqlite',
    },
    mysql: {
      driver: 'mysql',
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_DATABASE,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
    },
  },
}
```

## Troubleshooting

### No Models Found

```
Error: No models found. Please create models in app/Models or ensure framework defaults exist.
```

**Solution**: Create at least one model in `app/Models/`:

```bash
buddy make:model User
```

### Migration Fails

If a migration fails:

1. Check the error message for SQL issues
2. Review your model definitions
3. Run with `--verbose` for more details:

```bash
buddy migrate --verbose
```

### Database Connection Failed

```bash
# Check your database configuration
cat config/database.ts

# Verify environment variables
echo $DB_HOST $DB_PORT $DB_DATABASE
```

### Permission Denied

For SQLite:

```bash
chmod 664 storage/database.sqlite
```

For MySQL/PostgreSQL:

Verify your database user has the necessary permissions.

### Schema Out of Sync

`buddy migrate` runs the files the `migrations` table does not list. A table
whose migration *is* listed but which is not in the database - dropped by hand,
lost in a restore - is therefore never recreated by a plain migrate. Both
`migrate` and `migrate --diff` report it, and neither calls the database up to
date while it is missing.

```bash
# Compare the migration files, the migrations table and the live schema
buddy migrate:status

# Rebuild a missing table without touching anything else
buddy migrate:status --reconcile --requeue-reverted
buddy migrate
```

`--requeue-reverted` un-records every migration that built the missing table,
so the next `migrate` replays its whole history in order. It only does so when
none of those files also changes a table that is still there, or writes data to
one; those tables are listed with the reason and left for you. A migration that
fails to apply is never silently skipped either: if any file the runner could
see is still unrecorded after a run, `migrate` fails and names it.

As a last resort, `buddy migrate:fresh` rebuilds everything and drops all data.

## Best Practices

### Development

```bash
# Use fresh migrations during development
buddy migrate:fresh --seed
```

### Staging/Production

```bash
# Never use migrate:fresh in production
# Use regular migrate to preserve data
buddy migrate
```

### Before Deployment

```bash
# Preview changes before applying
buddy migrate --diff
```

## The snapshot is the baseline

`buddy migrate` works out what changed by diffing your models against a snapshot
of the last known schema:

```
storage/framework/database/model-snapshot.<dialect>.json
```

Without that file there is no baseline, so the same change is derived again on
every run. Applying it fixes exactly one run, and the next one proposes it back.

That path sits inside the project, which is right for a checkout and wrong for a
release-directory deploy. Capistrano-style layouts put every deploy in a fresh
`releases/<sha>`, so the snapshot is never there, and a schema that is already
correct keeps reporting a pending change.

Point `DB_SNAPSHOT_PATH` at a directory that outlives the release:

```bash
# absolute, or relative to the release directory
DB_SNAPSHOT_PATH=/srv/app/shared/db
DB_SNAPSHOT_PATH=../../shared/db
```

The directory must be writable: migrate writes the new snapshot back after a
successful run, and a read-only one leaves you where you started. When a
destructive change is proposed and no snapshot exists, migrate now names the
directory it looked in rather than leaving you to guess.

## Related Commands

- [buddy seed](/guide/buddy/seed) - Seed database with test data
- [buddy generate:migrations](/guide/buddy/generate) - Generate migrations from your models
- [buddy make:model](/guide/buddy/generate) - Create a new model
