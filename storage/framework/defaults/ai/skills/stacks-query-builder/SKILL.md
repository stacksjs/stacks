---
name: stacks-query-builder
description: Use when building database queries in a Stacks application - constructing SQL queries, using the fluent query API, or configuring the query builder. Covers @stacksjs/query-builder which wraps bun-query-builder, and config/query-builder.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, SQLite >= 3.47.2
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Query Builder

## Key Paths
- Core package: `storage/framework/core/query-builder/src/`
- Configuration: `config/query-builder.ts`
- Migration snapshot: `storage/framework/database/model-snapshot.<dialect>.json`
- External library: `bun-query-builder`
- Package: `@stacksjs/query-builder`

## API

The package wraps `bun-query-builder`, preserves its fluent surface, and adds
Stacks configuration, persistent query hooks, SQLite bootstrap behavior, and
identifier/operator validation. The `QueryBuilder` compatibility alias remains:

```typescript
export * from 'bun-query-builder'
export { createQueryBuilder as QueryBuilder } from 'bun-query-builder'
```

## Usage

```typescript
import { db } from '@stacksjs/database/runtime'

// Select
const users = await db.selectFrom('users')
  .where('active', '=', true)
  .orderBy('name', 'asc')
  .limit(10)
  .get()

// Insert
await db.insertInto('users')
  .values({ name: 'Alice', email: 'alice@example.com' })
  .execute()

// Update
await db.update('users')
  .set({ active: false })
  .where('id', '=', 1)
  .execute()

// Delete
await db.deleteFrom('users')
  .where('id', '=', 1)
  .execute()

// Joins
const posts = await db.selectFrom('posts')
  .join('users', 'posts.user_id', '=', 'users.id')
  .select(['posts.*', 'users.name as author_name'])
  .get()

// Aggregates
const count = await db.selectFrom('users').count()
const total = await db.selectFrom('orders').sum('amount')
```

Production SQLite uses a compact deferred builder for the common
`select().where().limit().execute()` chain when no query hooks or global
soft-delete scope is active. Complex methods and arguments automatically replay
onto the complete upstream builder. Use the normal API in either case; do not
fork application code into a separate raw-query path for this optimization.

## Configuration (config/query-builder.ts)

```typescript
{
  verbose: true,
  dialect: env.DB_CONNECTION || 'sqlite',
  database: { database, username?, password?, host?, port? },
  snapshotDir: 'storage/framework/database',

  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    defaultOrderColumn: 'created_at',
  },

  pagination: {
    defaultPerPage: 25,
    cursorColumn: 'id',
  },

  aliasing: {
    relationColumnAliasFormat: 'table_column',
  },

  relations: {
    foreignKeyFormat: 'singularParent_id',
    maxDepth: 10,
    maxEagerLoad: 50,
    detectCycles: true,
  },

  transactionDefaults: {
    retries: 2,
    isolation: 'read committed',
    sqlStates: ['40001', '40P01'],
    backoff: { baseMs: 50, factor: 2, maxMs: 2000, jitter: true },
  },

  sql: {
    randomFunction: 'RANDOM()',
    sharedLockSyntax: 'FOR SHARE',
    jsonContainsMode: 'operator',
  },

  features: { distinctOn: true },
  debug: { captureText: true },

  softDeletes: {
    enabled: false,
    column: 'deleted_at',
    defaultFilter: true,
  },
}
```

## Gotchas
- **Wrapped surface** - use `assertSafeIdentifier`, `assertSafeOperator`, and
  allowlists when a request influences column, table, ordering or operator names.
  Parameter binding protects values, not arbitrary SQL identifiers.
- **One config file** — `config/query-builder.ts`. Its `dialect` and connection details are derived from `DB_CONNECTION` and the other `DB_*` env vars, so switching databases is an env change, not a config edit
- **One committed snapshot** - Stacks config directs migration state to
  `storage/framework/database`; a second `.qb` snapshot indicates the wrong configuration.
- **Prefer ORM models** — query builder is the low-level interface; use models for most operations
- **`db` proxy** — the `db` export from `@stacksjs/database` is a lazy proxy that auto-initializes the query builder on first access
- **Soft deletes disabled by default** — must be explicitly enabled in config
- **Transaction retries** — defaults to 2 retries with exponential backoff + jitter
- **Dialect detection** — reads `DB_CONNECTION` env var, falls back to `sqlite`
- **Turso/libSQL** - uses SQLite SQL with a remote transport selected by the
  libSQL URL and credentials. Vitess maps to MySQL wire SQL with distinct DDL
  and transaction constraints. Read the driver capability registry.
- **Raw versus model queries** - raw `db` has no model definition and cannot
  infer ownership, hidden fields, per-model casts, encryption or soft-delete traits.
- **After commit** - `@stacksjs/database/runtime` exposes the native transaction
  scope helpers; deferring side effects does not rebind model executors to `tx`.

Source: `core/query-builder/src/index.ts`, `config/query-builder.ts`, and the
database runtime, query-hook, pragma, identifier and transaction tests.
