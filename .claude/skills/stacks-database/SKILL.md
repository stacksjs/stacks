---
name: stacks-database
description: Use when working with databases in a Stacks application — configuring connections, running queries, migrations, seeding, SQL helpers, or using SQLite/MySQL/PostgreSQL/DynamoDB. Covers @stacksjs/database, bun-query-builder, config/database.ts, and the database/ migrations directory.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, SQLite >= 3.47.2
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Database

## Key Paths
- Database package: `storage/framework/core/database/src/`
- Configuration: `config/database.ts`
- QB config: `config/qb.ts` (re-exported via `config/query-builder.ts`)
- Migrations: `database/migrations/` (96+ migration files, `.sql` format)
- QB state: `.qb/`
- ORM: `storage/framework/orm/`

## Source Files
```
database/src/
├── database.ts        # Database class + factory functions
├── driver-config.ts   # Driver types, defaults, validation, env detection
├── defaults.ts        # DB_HOST_DEFAULT, DB_PORTS, DB_NAMES, DB_USERS constants
├── utils.ts           # Lazy `db` proxy (main query builder entry point)
├── types.ts           # sql template tag, Generated/Insertable/Updateable types
├── sql-helpers.ts     # Cross-dialect helpers (now/boolTrue/param/etc.)
├── migrations.ts      # runDatabaseMigration, resetDatabase, generateMigrations
├── seeder.ts          # seed, seedModel$, freshSeed, listSeedableModels
├── validators.ts      # Column type inference from validator types
├── column.ts          # Column definition helpers
├── schema.ts          # Schema definition helpers
├── table.ts           # Table definition helpers
├── query-parser.ts    # Query parsing utilities
├── query-logger.ts    # Query logging/monitoring
├── auth-tables.ts     # Auth-related table migrations (OAuth, passkeys)
├── custom/            # Custom migrations (jobs.ts, errors.ts)
├── drivers/           # sqlite.ts, mysql.ts, postgres.ts, dynamodb.ts
│   └── defaults/      # Default migration helpers (traits.ts, passwords.ts)
└── index.ts           # Re-exports everything
```

## Database Class (database.ts)

```typescript
const db = new Database(options: DatabaseOptions)
db.driver       // 'sqlite' | 'mysql' | 'postgres'
db.connection   // DatabaseConnectionConfig
db.isInitialized
db.query        // QueryBuilder (lazy-initialized via createQueryBuilder())
db.initialize() // Calls setConfig() + createQueryBuilder() from bun-query-builder
db.switchDriver(driver, connection) // Close + reinitialize with new driver
db.close()      // Close connection, reset state

// Static factories
Database.fromConfig(config, env?)   // From stacks config object
Database.fromEnv()                  // From env vars (DB_CONNECTION, DB_DATABASE, etc.)
```

## Factory Functions (database.ts)
- `createDatabase(options: DatabaseOptions): Database`
- `createSqliteDatabase(database: string, options?): Database`
- `createPostgresDatabase(connection: DatabaseConnectionConfig, options?): Database`
- `createMysqlDatabase(connection: DatabaseConnectionConfig, options?): Database`

## Driver Configuration (driver-config.ts)
- `detectDriver(): SupportedDialect` -- checks `DB_CONNECTION` env, then `DATABASE_URL` prefix, defaults to `'sqlite'`
- `validateDriverConfig(driver, config): { valid: boolean, errors: string[] }`
- `mergeWithDefaults(driver, config): Config`
- `getConfigFromEnv(driver): Config` -- reads `DB_DATABASE`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_PREFIX`, `DB_SCHEMA`
- `getConnectionString(driver, config): string` -- builds `sqlite://`, `mysql://`, `postgres://` URL

## Global `db` Instance (utils.ts)

The `db` export is a **lazy Proxy** that auto-initializes on first property access:
1. At module load: reads env vars via `@stacksjs/env`, calls `setConfig()` on bun-query-builder
2. Background: attempts `import('@stacksjs/config')` to override with app config
3. On first property access: calls `createQueryBuilder()` from bun-query-builder

```typescript
import { db } from '@stacksjs/database'

// db auto-initializes here
const users = await db.selectFrom('users').where('active', '=', true).get()
```

`initializeDbConfig(config)` can be called to update the backing config at runtime.

## SQL Template Tag (types.ts)

```typescript
import { sql } from '@stacksjs/database'

const query = sql`SELECT * FROM users WHERE id = ${userId}`
// Returns: { sql: 'SELECT * FROM users WHERE id = ?', parameters: [userId] }

sql.raw('NOW()')          // Raw SQL (NOT parameterized) -- returns { raw: 'NOW()' }
sql.ref('users.name')     // Column reference -- returns { raw: 'users.name' }
```

How it works: template values are replaced with `?` placeholders and collected into `parameters[]`. Values wrapped in `sql.raw()` or `sql.ref()` are inlined directly into the SQL string.

## SQL Dialect Helpers (sql-helpers.ts)

```typescript
import { sqlHelpers } from '@stacksjs/database'

const h = sqlHelpers('sqlite') // or 'mysql' or 'postgres'
h.isPostgres  // false
h.isMysql     // false
h.isSqlite    // true
h.now         // "datetime('now')" for sqlite, 'NOW()' for mysql/postgres
h.boolTrue    // '1' for sqlite/mysql, 'true' for postgres
h.boolFalse   // '0' for sqlite/mysql, 'false' for postgres
h.autoIncrement // 'INTEGER' for sqlite, 'SERIAL' for postgres
h.primaryKey  // 'PRIMARY KEY AUTOINCREMENT' | 'PRIMARY KEY AUTO_INCREMENT' | 'PRIMARY KEY'
h.param(1)    // '?' for sqlite/mysql, '$1' for postgres
h.params('a', 'b')  // { sql: '?, ?', values: ['a', 'b'] } or { sql: '$1, $2', values: ['a', 'b'] }
```

## Connection Defaults (defaults.ts)

```typescript
DB_HOST_DEFAULT = '127.0.0.1'
DB_PORTS = { mysql: 3306, postgres: 5432, sqlite: 0 }
DB_NAMES = { default: 'stacks', sqlitePath: 'database/stacks.sqlite', sqliteTestingPath: 'database/stacks_testing.sqlite' }
DB_USERS = { mysql: 'root', postgres: 'postgres', sqlite: '' }
REDIS_DEFAULTS = { host: 'localhost', port: 6379 }
AWS_DEFAULTS = { region: 'us-east-1' }

getConnectionDefaults(driver: string, envProxy?): ConnectionDefaults
```

## DatabaseOptions Type (database.ts)

```typescript
interface DatabaseOptions {
  driver: 'sqlite' | 'mysql' | 'postgres'
  connection: { database: string, host?: string, port?: number, username?: string, password?: string, url?: string }
  verbose?: boolean
  timestamps?: { createdAt?: string, updatedAt?: string, defaultOrderColumn?: string }
  softDeletes?: { enabled?: boolean, column?: string, defaultFilter?: boolean }
  hooks?: QueryBuilderConfig['hooks']
}
```

## Connection Types (driver-config.ts)

```typescript
interface SqliteConfig { database: string, prefix?: string }
interface MysqlConfig { name: string, host?: string, port?: number, username?: string, password?: string, prefix?: string, charset?: string, collation?: string }
interface PostgresConfig { name: string, host?: string, port?: number, username?: string, password?: string, prefix?: string, schema?: string, sslMode?: 'disable' | 'require' | 'verify-ca' | 'verify-full' }
interface DynamoDbConfig { key: string, secret: string, region?: string, prefix?: string, endpoint?: string, tableName?: string, singleTable?: { enabled?, pkAttribute?, skAttribute?, entityTypeAttribute?, keyDelimiter?, gsiCount? } }
```

## Migrations (migrations.ts)

### Migration Functions
- `runDatabaseMigration(): Promise<Result<string, Error>>` -- ensures DB exists (postgres/mysql), configures QB, preprocesses SQLite migrations, then calls `qbExecuteMigration()`
- `resetDatabase(): Promise<Result<string, Error>>` -- drops framework tables (OAuth, passkeys, jobs, etc.) then calls `qbResetDatabase()`
- `generateMigrations(): Promise<Result<string, Error>>` -- compares models to DB state, generates `.sql` diff files
- `generateMigrations2(): Promise<Result<string, Error>>` -- full regeneration ignoring previous state (`{ full: true }`)

### SQLite Migration Preprocessing
Before running migrations on SQLite, `preprocessSqliteMigrations()`:
1. Rewrites `ALTER TABLE ADD CONSTRAINT` to no-ops (SQLite does not support this)
2. Rewrites `CREATE UNIQUE INDEX` to no-ops (redundant when table already has inline UNIQUE)
3. Filters out `DROP COLUMN` for non-existent columns (checks via `PRAGMA table_info`)

### Framework Tables Dropped on Reset
`oauth_refresh_tokens`, `oauth_access_tokens`, `oauth_clients`, `passkeys`, `failed_jobs`, `jobs`, `notifications`, `password_reset_tokens`

## Seeding (seeder.ts)

### Seed Functions
- `seed(config?: SeederConfig): Promise<SeedSummary>` -- loads models from both `storage/framework/defaults/models/` (recursive) and `app/Models/` (flat), user models override defaults by name
- `seedModel$(modelName, options?): Promise<SeedResult>` -- seed one model by name
- `freshSeed(config?): Promise<SeedSummary>` -- calls `seed({ ...config, fresh: true })` (truncates before seeding)
- `listSeedableModels(): Promise<Array<{ name, table, count, source: 'default' | 'user' }>>` -- list without seeding

### SeederConfig
```typescript
interface SeederConfig {
  modelsDir?: string     // defaults to path.userModelsPath()
  defaultCount?: number  // default 10
  verbose?: boolean      // default true
  fresh?: boolean        // truncate tables first
  only?: string[]        // specific models to seed
  except?: string[]      // models to exclude
}
```

### Seeding Behavior
- Models must have `traits.useSeeder` (or `traits.seedable`) set to `true` or `{ count: N }`
- Attributes with `factory: (faker) => ...` generate fake data via `@stacksjs/faker`
- Password fields are auto-detected (by name pattern or `hidden: true` + name includes "pass") and hashed with bcrypt
- Field names are converted from camelCase to snake_case for DB columns
- Records inserted in batches of 100
- Models sorted by dependency: User (0), Team (1), Project (2), everything else (10)
- Missing tables are skipped gracefully

### SeedResult / SeedSummary
```typescript
interface SeedResult { model: string, table: string, count: number, success: boolean, error?: string, duration: number }
interface SeedSummary { total: number, successful: number, failed: number, results: SeedResult[], duration: number }
```

## Validator Type Guards (validators.ts)
`isStringValidator`, `isNumberValidator`, `enumValidator`, `isBooleanValidator`, `isDateValidator`, `isUnixValidator`, `isFloatValidator`, `isDatetimeValidator`, `isTimestampValidator`, `isTimestampTzValidator`, `isDecimalValidator`, `isSmallintValidator`, `isIntegerValidator`, `isBigintValidator`, `isBinaryValidator`, `isBlobValidator`, `isJsonValidator`

- `checkValidator(validator, driver): string` -- converts validator type to SQL column type string (e.g., `'integer'`, `'text'`, `'varchar(255)'`)
- SQLite uses `'text'` for all strings, `'integer'` for numbers; MySQL uses `'varchar(N)'`, native `enum()`

## DynamoDB Support (drivers/dynamodb.ts)
Entity-centric API for single-table design:
- `createDynamo(config)`, `dynamo` (default instance)
- `EntityQueryBuilder` -- query builder for DynamoDB entities
- `generateKeyPattern`, `parseKeyPattern`, `buildKey` -- key pattern utilities
- `marshall`, `unmarshall` -- DynamoDB data type conversion

## Re-exports from bun-query-builder
- `createQueryBuilder`, `setConfig` -- core QB functions
- `QueryBuilder`, `QueryBuilderConfig`, `Seeder`, `SupportedDialect` -- types

## Compatibility Type Aliases (types.ts)
- `Generated<T>`, `GeneratedAlways<T>` -- column generation markers (both alias to `T`)
- `Insertable<T>`, `Selectable<T>`, `Updateable<T>` -- CRUD type utilities
- `RawBuilder<T>`, `Sql` -- raw SQL expression types

## CLI Commands
- `buddy migrate` -- run pending migrations
- `buddy migrate:fresh` -- drop all + re-migrate (add `--seed` to also seed)
- `buddy make:migration <name>` -- create migration file
- `buddy seed` -- seed database
- `buddy generate:migrations` -- generate migration diffs from models

## config/database.ts Shape
```typescript
{
  default: env.DB_CONNECTION || 'mysql',
  connections: { sqlite, mysql, postgres, dynamodb },
  migrations: 'migrations',
  migrationLocks: 'migration_locks',
  queryLogging: {
    enabled: true,
    slowThreshold: 100,  // ms
    retention: 7,        // days
    pruneFrequency: 24,  // hours
    excludedQueries: ['query_logs'],
    analysis: { enabled: true, analyzeAll: false, explainPlan: true, suggestions: true }
  }
}
```

## config/qb.ts (Query Builder Config)
```typescript
{
  verbose: true,
  dialect: env.DB_CONNECTION || 'sqlite',
  database: { database, username?, password?, host?, port? },
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at', defaultOrderColumn: 'created_at' },
  pagination: { defaultPerPage: 25, cursorColumn: 'id' },
  aliasing: { relationColumnAliasFormat: 'table_column' },
  relations: { foreignKeyFormat: 'singularParent_id', maxDepth: 10, maxEagerLoad: 50, detectCycles: true },
  transactionDefaults: { retries: 2, isolation: 'read committed', sqlStates: ['40001', '40P01'], backoff: { baseMs: 50, factor: 2, maxMs: 2000, jitter: true } },
  sql: { randomFunction: 'RANDOM()', sharedLockSyntax: 'FOR SHARE', jsonContainsMode: 'operator' },
  features: { distinctOn: true },
  debug: { captureText: true },
  softDeletes: { enabled: false, column: 'deleted_at', defaultFilter: true }
}
```

## Gotchas
- The actual default driver in `config/database.ts` is `'mysql'` (not `'sqlite'`), but `utils.ts` and `driver-config.ts` fall back to `'sqlite'` when `DB_CONNECTION` is unset
- The `db` export is a lazy Proxy -- it auto-initializes on first property access, which means errors are deferred until first use
- Query builder has TWO config files: `config/query-builder.ts` re-exports from `config/qb.ts`
- The `.qb/` directory at project root stores query builder state for migration diffing
- `resetDatabase()` drops ALL tables including framework tables (OAuth, passkeys, jobs, etc.) -- only use in development
- `freshSeed()` truncates tables before seeding using `deleteFrom()` (not `DROP TABLE`)
- SQLite migration preprocessing mutates `.sql` files in-place (rewrites them to no-ops)
- The `ensureDatabaseExists()` function connects to admin DB (`postgres` or `mysql`) to run `CREATE DATABASE` before switching to the target DB
- `Database.fromConfig()` appends `_testing` to database name/path when `env === 'testing'`
- DynamoDB support uses a separate entity-centric API, not the standard query builder
- Soft deletes are disabled by default in qb.ts config (`enabled: false`)
- Transaction defaults: 2 retries, `read committed` isolation, with exponential backoff + jitter
- The ORM lives in TWO locations: `storage/framework/core/orm/` (package) and `storage/framework/orm/` (implementation)
