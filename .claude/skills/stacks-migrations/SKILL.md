---
name: stacks-migrations
description: Use when working with database migrations in a Stacks application — creating migrations, running migrations, rolling back, or managing database schema changes. Covers the database/ directory and buddy migrate commands.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, SQLite >= 3.47.2
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Migrations

Database migrations manage schema changes in a Stacks application.

## Key Paths
- Migration files: `database/`
- Framework migrations: `storage/framework/` (generated)
- Database config: `config/database.ts`

## CLI Commands
- `buddy migrate` - Run pending migrations
- `buddy migrate:fresh` - Drop all tables and re-migrate
- `buddy make:migration` - Create a new migration file
- `buddy seed` - Seed the database

## Migration Workflow
1. Create a migration: `buddy make:migration create_users_table`
2. Define the schema changes in the migration file
3. Run migrations: `buddy migrate`

## Gotchas
- Migrations are in the `database/` directory at project root
- Never edit a migration that has already been run in production
- Use `migrate:fresh` only in development (drops all data)
- Migrations should be idempotent where possible
- Always backup before running migrations in production
- SQLite >= 3.47.2 is required (system requirement)
