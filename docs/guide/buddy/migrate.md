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
buddy migrate:dns [options]
```

### Options for `migrate`

| Option | Description |
|--------|-------------|
| `-d, --diff` | Show the SQL that would be run without executing |
| `-p, --project [project]` | Target a specific project |
| `-a, --auth` | Also migrate auth tables (oauth_clients, oauth_access_tokens, etc.) |
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

Migrate DNS configuration:

```bash
buddy migrate:dns
```

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

Shows the SQL statements that would be executed without running them.

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

If your database schema is out of sync:

```bash
# Option 1: Fresh migration (drops all data)
buddy migrate:fresh

# Option 2: Manually fix the schema
# Then run migrations
buddy migrate
```

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

## Related Commands

- [buddy seed](/guide/buddy/seed) - Seed database with test data
- [buddy generate:migrations](/guide/buddy/generate) - Generate migrations from your models
- [buddy make:model](/guide/buddy/generate) - Create a new model
