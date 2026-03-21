---
name: stacks-query-builder
description: Use when building database queries in a Stacks application — constructing SQL queries, using the fluent query API, or configuring the query builder. Covers @stacksjs/query-builder, config/query-builder.ts, and bun-query-builder.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, SQLite >= 3.47.2
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Query Builder

The `@stacksjs/query-builder` package provides a query builder integration wrapping `bun-query-builder`.

## Key Paths
- Core package: `storage/framework/core/query-builder/src/`
- Configuration: `config/query-builder.ts`, `config/qb.ts`
- QB directory: `.qb/`
- External library: `bun-query-builder` (dependency)
- Package: `@stacksjs/query-builder`

## Architecture
- Wraps `bun-query-builder` for Stacks integration
- Provides fluent SQL query building
- Supports SQLite, MySQL, and PostgreSQL
- Used by the ORM for query generation

## Usage
```typescript
import { query } from '@stacksjs/query-builder'

const users = await query('users')
  .where('active', true)
  .orderBy('name')
  .get()
```

## Configuration
- `config/query-builder.ts` - Main query builder settings
- `config/qb.ts` - Alternative/short config
- `.qb/` - Query builder state directory

## Gotchas
- Query builder is the low-level query interface; prefer ORM models for most operations
- Two config files exist: `query-builder.ts` and `qb.ts`
- The `.qb/` directory at project root contains QB state
- `bun-query-builder` is the external dependency
- For raw queries, use the database package directly
