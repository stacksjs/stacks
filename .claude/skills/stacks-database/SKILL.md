---
name: stacks-database
description: Use when working with databases in a Stacks application — configuring database connections, running queries, managing schemas, or using SQLite/MySQL/PostgreSQL. Covers @stacksjs/database, @stacksjs/query-builder, config/database.ts, and database migrations.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, SQLite >= 3.47.2
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Database

The `@stacksjs/database` package provides database integration supporting SQLite, MySQL, and PostgreSQL via `bun-query-builder`.

## Key Paths
- Database package: `storage/framework/core/database/src/`
- Query builder package: `storage/framework/core/query-builder/src/`
- Configuration: `config/database.ts`
- Query builder config: `config/query-builder.ts`, `config/qb.ts`
- Migrations directory: `database/`
- ORM: `storage/framework/orm/`
- QB directory: `.qb/`
- Package: `@stacksjs/database`

## System Requirements
- SQLite >= 3.47.2 (system requirement in package.json)
- Bun >= 1.3.0

## Architecture
- `@stacksjs/database` - High-level database integration
- `@stacksjs/query-builder` - Query builder wrapper around `bun-query-builder`
- `@stacksjs/orm` - Object-Relational Mapping layer
- `bun-query-builder` - External dependency for SQL query building

## Database Commands
- `buddy migrate` - Run database migrations
- `buddy migrate:fresh` - Drop all tables and re-migrate
- `buddy make:migration` - Create a new migration file
- `buddy seed` - Seed the database

## Configuration
Edit `config/database.ts` for connection settings:
- Driver (SQLite, MySQL, PostgreSQL)
- Connection strings and credentials
- Pool settings

## Gotchas
- SQLite is the default and recommended database driver
- Migrations are in the `database/` directory at project root
- The ORM lives in `storage/framework/orm/`, separate from `storage/framework/core/orm/`
- Query builder has its own config files (`config/query-builder.ts` and `config/qb.ts`)
- Always use migrations for schema changes — never modify the database directly
- The `.qb/` directory at root contains query builder state
