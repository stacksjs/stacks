---
title: "Database skill"
description: "Use when working with databases in a Stacks application."
---
# Database

`stacks-database` · Data layer · model-invoked

Connections, raw queries, SQL helpers and the four supported engines: SQLite,
MySQL, PostgreSQL and DynamoDB. Covers what differs between them, which matters
because local development is usually SQLite and production usually is not.

## When to reach for it

- Configuring connections
- Running queries
- Migrations
- Seeding
- SQL helpers
- Using SQLite/MySQL/PostgreSQL/DynamoDB

## Covers

`@stacksjs/database`, bun-query-builder, `config/database.ts`, the database/ migrations directory.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- Database Class (database.ts)
- Factory Functions (database.ts)
- Driver Configuration (driver-config.ts)
- Global `db` Instance (utils.ts)
- SQL Template Tag (types.ts)
- SQL Dialect Helpers (sql-helpers.ts)
- Connection Defaults (defaults.ts)
- DatabaseOptions Type (database.ts)
- Connection Types (driver-config.ts)
- Migrations (migrations.ts)
- Seeding (seeder.ts)
- Validator Type Guards (validators.ts)
- DynamoDB Support (drivers/dynamodb.ts)
- Re-exports from bun-query-builder
- Compatibility Type Aliases (types.ts)
- CLI Commands
- config/database.ts Shape
- config/query-builder.ts (Query Builder Config)
- Gotchas

## Where the code lives

- Database package: `storage/framework/core/database/src/`
- Configuration: `config/database.ts`
- QB config: `config/query-builder.ts`
- Migrations: `database/migrations/` (96+ migration files, `.sql` format)
- QB state: `.qb/`
- ORM: `storage/framework/orm/`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-database
```

Source: [`stacks-database/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-database/SKILL.md).
Shadow it for one project with `app/Skills/stacks-database/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
