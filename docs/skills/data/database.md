---
title: "Database skill"
description: "Use when working with databases in a Stacks application - configuring connections, running queries, migrations, seeding, SQL helpers, or using SQLite/Turso/MySQL/PostgreSQL/DynamoDB. Covers @stacksjs/database, bun-query-builder, config/database.ts, and the database/ migrations directory."
---
# Database

`stacks-database` · Native Stacks · model-invoked

Use when working with databases in a Stacks application - configuring connections, running queries, migrations, seeding, SQL helpers, or using SQLite/Turso/MySQL/PostgreSQL/DynamoDB. Covers @stacksjs/database, bun-query-builder, config/database.ts, and the database/ migrations directory.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

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
- Model-driven migrations
- Model factories and application seeders
- Validator Type Guards (validators.ts)
- DynamoDB Support (drivers/dynamodb.ts)
- Re-exports from bun-query-builder
- Compatibility Type Aliases (types.ts)
- CLI Commands
- Turso / libSQL (`DB_CONNECTION=turso`, alias `libsql`)
- config/database.ts Shape
- config/query-builder.ts (Query Builder Config)
- Gotchas
- Driver conformance and topology
- SQL fragments and temporal values

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-database
```

Source: [`stacks-database/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-database/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-database/SKILL.md`. See [Using skills](/skills/using).
