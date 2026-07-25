---
name: stacks-query-builder
description: Use when building database queries in a Stacks application — constructing SQL queries, using the fluent query API, or configuring the query builder. Covers @stacksjs/query-builder which wraps bun-query-builder, and config/qb.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, SQLite >= 3.47.2
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Query Builder

## Key Paths
- Core package: `storage/framework/core/query-builder/src/`
- Configuration: `config/qb.ts` (re-exported via `config/query-builder.ts`)
- QB state: `.qb/`
- External library: `bun-query-builder`
- Package: `@stacksjs/query-builder`

## API

The package re-exports everything from `bun-query-builder` plus a compatibility alias:

```typescript
export * from 'bun-query-builder'
export { createQueryBuilder as QueryBuilder } from 'bun-query-builder'
```

## Usage

```typescript
import { db } from '@stacksjs/database'

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

## Configuration (config/qb.ts)

```typescript
{
  verbose: true,
  dialect: env.DB_CONNECTION || 'sqlite',
  database: { database, username?, password?, host?, port? },

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
- **Thin wrapper** — re-exports `bun-query-builder` with no additions
- **Two config files** — `config/query-builder.ts` re-exports from `config/qb.ts`
- **`.qb/` directory** — stores query builder state for migration diffing
- **Prefer ORM models** — query builder is the low-level interface; use models for most operations
- **`db` proxy** — the `db` export from `@stacksjs/database` is a lazy proxy that auto-initializes the query builder on first access
- **Soft deletes disabled by default** — must be explicitly enabled in config
- **Transaction retries** — defaults to 2 retries with exponential backoff + jitter
- **Dialect detection** — reads `DB_CONNECTION` env var, falls back to `sqlite`
