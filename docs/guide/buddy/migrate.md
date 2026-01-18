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
import { Model } from '@stacksjs/orm'

export default class User extends Model {
  static table = 'users'

  static fields = {
    name: { type: 'string', required: true },
    email: { type: 'string', unique: true, required: true },
    password: { type: 'string', required: true },
    createdAt: { type: 'timestamp' },
    updatedAt: { type: 'timestamp' },
  }
}
```

When you run `buddy migrate`, Stacks:
1. Reads all model definitions from `app/Models`
2. Compares with current database schema
3. Generates and runs necessary SQL

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
- [buddy generate:model-files](/guide/buddy/generate) - Generate model files
- [buddy make:model](/guide/buddy/generate) - Create a new model
