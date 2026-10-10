---
name: stacks-database
description: Use when working with databases in a Stacks application - configuring connections, running queries, migrations, seeding, SQL helpers, or using SQLite/Turso/MySQL/PostgreSQL/DynamoDB. Covers @stacksjs/database, bun-query-builder, config/database.ts, and the database/ migrations directory.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, SQLite >= 3.47.2
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Database

## Key Paths
- Database package: `storage/framework/core/database/src/`
- Configuration: `config/database.ts`
- QB config: `config/query-builder.ts`
- Migrations: `database/migrations/` (237 migration files, `.sql` format)
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
- `createTursoDatabase(url: string, authToken?: string, options?): Database`
- `createPostgresDatabase(connection: DatabaseConnectionConfig, options?): Database`
- `createMysqlDatabase(connection: DatabaseConnectionConfig, options?): Database`

## Driver Configuration (driver-config.ts)
- `detectDriver(): SupportedDialect` -- checks `DB_CONNECTION` env, then `DATABASE_URL` prefix, defaults to `'sqlite'`
- `validateDriverConfig(driver, config): { valid: boolean, errors: string[] }`
- `mergeWithDefaults(driver, config): Config`
- `getConfigFromEnv(driver): Config` -- reads `DB_DATABASE`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_PREFIX`, `DB_SCHEMA`
- `getConnectionString(driver, config): string` -- builds `sqlite://`, `mysql://`, `postgres://` URL

## Global `db` Instance (utils.ts)

The db export is a lazy runtime facade. It initializes the query builder on use
and resolves application configuration through ensureDatabaseConfigLoaded.
Use @stacksjs/database/runtime for the narrow query/transaction entry; the
package root additionally exports migrations, seeders and driver tooling.

```typescript
import { db } from '@stacksjs/database'

// db auto-initializes here
const users = await db.selectFrom('users').where('active', '=', true).get()
```

`initializeDbConfig(config)` can be called to update the backing config at runtime.

For reads which cannot tolerate replication lag, use `db.primary.selectFrom(...)`.
It stays on the primary when automatic replica routing is enabled, and uses the
active transaction connection inside a transaction. It does not mark the request
as a writer or change routing for unrelated reads. Session authentication uses
this handle so a revoked session cannot authenticate from a stale replica.

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
interface TursoConfig { url: string, authToken?: string, prefix?: string }
interface MysqlConfig { name: string, host?: string, port?: number, username?: string, password?: string, prefix?: string, charset?: string, collation?: string }
interface PostgresConfig { name: string, host?: string, port?: number, username?: string, password?: string, prefix?: string, schema?: string, sslMode?: 'disable' | 'require' | 'verify-ca' | 'verify-full' }
interface DynamoDbConfig { key: string, secret: string, region?: string, prefix?: string, endpoint?: string, tableName?: string, singleTable?: { enabled?, pkAttribute?, skAttribute?, entityTypeAttribute?, keyDelimiter?, gsiCount? } }
```

## Model-driven migrations

Change the model, generate migrations, review the resulting SQL, then migrate.
The native runner loads application config, selects the dialect corpus, handles
feature-gated migration resources, and acquires the migration lock. It returns
a Result; inspect failures rather than treating a resolved call as success.
RunDatabaseMigration, generateMigrations and resetDatabase are exported tooling,
but their CLI actions supply the application's operation policy and environment.

Read stacks-migrations before using full regeneration, snapshot recovery,
preprocessing or destructive fresh/reset commands. SQLite preprocessing and
provider-specific DDL rules are implemented in core/database/src/migrations.ts;
installed package sources are copied before their SQL is rewritten.
The migration ledger and snapshot are different state, not interchangeable
proof that a table exists.

## Model factories and application seeders

Models opt into the factory pass with traits.useSeeder/seedable. Attribute
factories receive faker and the attributes generated so far; column names are
converted to snake_case, and password fields are hashed by the seeder's bcrypt
path. The source defines factory fallback behavior: a failed factory can use
its attribute default, so inspect the summary and warnings as well as row count.

seed(options?) returns a SeedSummary; seedModel$(name, options?) targets one
model; freshSeed truncates before generation; listSeedableModels inspects the
available definitions; makeModelRecords produces factory data without insertion.
These are public exports from @stacksjs/database.

When app/Models has user models, the default seed pass uses those definitions.
includeDefaults explicitly merges framework defaults; an app with no user models
uses defaults as fallback. User identity overrides a default even when the app
model opts out of seeding. The current model-seeder app scan is flat, unlike
recursive model resolution elsewhere; verify nested models at this seam.

Options also include only/except, defaultCount, fresh, append, allowProtected,
attachAccounts and includeDefaults. Default non-empty tables are skipped;
append is explicit. Protected auth/OAuth data and attachment to existing accounts
have their own guards because fixture generation can alter live credentials or
associate invented records with real people. Read buddy seed --help and inspect
the target connection before requesting a destructive or bypassing mode.

Application seeders default-export a class extending the native Seeder:

~~~ts
import { Seeder } from '@stacksjs/database'

export default class WorkspaceSeeder extends Seeder {
  static override order = 10
  static override tags = ['deploy']

  async run(): Promise<void> {
    // Find the application's existing workspace before creating missing state.
  }
}
~~~

runApplicationSeeders applies order (lower first), then relative path for ties.
Tag/only/except selection lets deploy bootstrap remain separate from a large demo
corpus. Buddy seed and migrate:fresh --seed run the model and application passes;
model dependencies determine parent-first generation rather than a hard-coded
User/Team/Project order. fresh empties in reverse dependency order.

Source: storage/framework/core/database/src/seeder.ts and
core/buddy/src/commands/seed.ts. Retained seeder tests cover override opt-out,
dependency order, protected models and non-empty/append behavior. See
stacks-models for fixtures/factory declarations and stacks-testing for factories
that produce test records.

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

## Turso / libSQL (`DB_CONNECTION=turso`, alias `libsql`)

SQLite's SQL on a Turso or `sqld` server. Configure `TURSO_DATABASE_URL`
(`libsql://<db>-<org>.turso.io`, or `http://127.0.0.1:8080` for `turso dev`) and
`TURSO_AUTH_TOKEN` (a secret, never logged).

- Everything that renders SQL or DDL treats it as `sqlite`: `dialectCapabilities('turso').wire === 'sqlite'`,
  `getDatabaseDialect()` returns `'sqlite'`, and it shares the SQLite migration corpus and
  `model-snapshot.sqlite.json`. Switching between `sqlite` and `turso` needs no regeneration.
- The transport is bun-query-builder's: `setConfig({ dialect: 'sqlite', database: { url, authToken } })`
  with a libSQL URL selects its dependency-free Hrana-over-HTTP connection (`createLibSQLSQL`).
- Code that opens the database FILE must ask `isLibsqlDriver(driver)` first - there is none. The SQLite
  migration preprocessor reads an in-memory replica of the server's schema instead
  (`loadLibsqlSchemaMirror` in migrations.ts), and the migration lock is a row in
  `stacks_migration_lock` (`acquireLibsqlMigrationLock`), since migrating hosts share no filesystem.
- libSQL rejects SQLite's double-quoted-string fallback, so a statement naming a missing column fails
  instead of storing the column name as text. `tests/corpus-rebuild-sources.test.ts` guards the corpus.
- Inside `transaction()`, write through the `tx` handle; model writes use their own connection.

## config/database.ts Shape
```typescript
{
  default: env.DB_CONNECTION || 'sqlite',
  connections: { sqlite, turso, mysql, singlestore, vitess, postgres, dynamodb },
  migrations: 'migrations',
  migrationLocks: 'migration_locks',
  queryLogging: {
    // Defaults on outside production and off in production. Production also
    // skips query hooks unless persistent history is explicitly enabled,
    // except one onQueryError hook on PostgreSQL and MySQL that reports a
    // pool broken by oven-sh/bun#42804.
    enabled: env.DB_QUERY_LOGGING_ENABLED ?? !['production', 'prod'].includes(env.APP_ENV || ''),
    captureAllTraces: false, // slow and failed queries always keep traces
    // Bound values in query_logs.bindings, credentials stored as `<redacted>`
    // (by name and shape, so not every secret); production keeps only each
    // value's type unless this is enabled. Env takes true/false, 1/0, yes/no, on/off.
    captureBindings: env.DB_QUERY_LOGGING_CAPTURE_BINDINGS ?? !['production', 'prod'].includes(env.APP_ENV || ''),
    // More secret columns, on top of those names: 'code' in every table,
    // 'gift_cards.code' in that one. Also taken out of a failed query's error.
    sensitiveColumns: [],
    slowThreshold: 100,  // ms
    retention: 7,        // days
    pruneFrequency: 24,  // hours
    excludedQueries: ['query_logs'],
    analysis: { enabled: true, analyzeAll: false, explainPlan: true, suggestions: true }
  }
}
```

## config/query-builder.ts (Query Builder Config)
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
- Default connection is SQLite in the shipped config; inspect application config and DB_CONNECTION before choosing a driver
- The db facade initializes lazily; invalid connection configuration may surface at first query use
- Query builder config lives in `config/query-builder.ts`, and reads `DB_CONNECTION` / `DB_*` from the env - it is not a second copy of `config/database.ts`
- The `.qb/` directory at project root stores query builder state for migration diffing
- `resetDatabase()` drops ALL tables including framework tables (OAuth, passkeys, jobs, etc.) -- only use in development
- `freshSeed()` truncates tables before seeding using `deleteFrom()` (not `DROP TABLE`)
- SQLite migration preprocessing mutates `.sql` files in-place (rewrites them to no-ops)
- The `ensureDatabaseExists()` function connects to admin DB (`postgres` or `mysql`) to run `CREATE DATABASE` before switching to the target DB
- `Database.fromConfig()` appends `_testing` to database name/path when `env === 'testing'`
- DynamoDB support uses a separate entity-centric API, not the standard query builder
- Soft deletes are disabled by default in qb.ts config (`enabled: false`)
- Keep the process-wide raw query-builder soft-delete filter disabled. Raw
  `db.selectFrom()` calls do not carry a model definition, so they cannot know
  whether a table has `useSoftDeletes` or a `deleted_at` column. Model queries
  and generated `useApi` routes apply the trait-aware scope themselves.
- Transaction defaults: 2 retries, `read committed` isolation, with exponential backoff + jitter
- The ORM lives in TWO locations: `storage/framework/core/orm/` (package) and `storage/framework/orm/` (implementation)


## Driver conformance and topology

Read `storage/framework/core/config/src/capabilities.ts` before selecting a
driver. SQLite, MySQL and PostgreSQL have retained supported contracts. MySQL
and PostgreSQL need migrations generated for their dialect: the shipped SQLite
SQL corpus is not a portable migration bundle. SingleStore, Vitess and Turso
are experimental with explicit service/topology limits. DynamoDB helpers are a
separate entity API and cannot be selected as the SQL/ORM default.

Turso's libsql alias shares SQLite rendering, but uses remote Hrana transport.
Transactions must write through the tx handle; no embedded replicas or native
file backup are provided. Scheduler locks remain per host. Read the registry's
provider versions and retained evidence rather than equating an available adapter
with an unrestricted supported service.


## SQL fragments and temporal values

Parameterized sql fragments are compiled through the query builder; do not
extract .sql/.parameters and feed question marks directly to PostgreSQL unsafe.
whereRaw does not accept bound-value fragments on that path. Use typed where
or dialect-aware raw helpers. sql.as validates an alias; raw text remains a
trusted-code operation. sqlDateTime/parseSqlDateTime provide the canonical
application timestamp representation. Mixing SQLite datetime text with
application ISO text in raw comparisons can give wrong expiry boundaries.
Source: core/database/src/types.ts and sql-helpers.ts; see stacks-query-builder
for typed tables, raw binding, transaction handles and replica routing.
