---
title: "Migrations skill"
description: "Use when working with database migrations in a Stacks application - creating migration files, running migrations, fresh migration (drop + recreate), seeding after migration, migration file naming conventions, or the 237 built-in migration files. For the database API itself (queries, connections, SQL helpers), see stacks-database."
---
# Migrations

`stacks-migrations` · Data layer · model-invoked

Migrations here are derived from your models rather than hand-written. You change
the model, `buddy generate:migrations` diffs it against the schema and emits the
SQL, and you read that SQL before applying it. This skill covers the generation
workflow, the naming conventions and the 96+ migrations that ship.

## When to reach for it

- Creating migration files
- Running migrations
- Fresh migration (drop + recreate)
- Seeding after migration
- Migration file naming conventions
- The 96+ built-in migration files

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- CLI Commands
- Creating a Migration
- Migration Generation from Models
- Built-in Migrations (96+)
- Workflow
- Gotchas

## Where the code lives

- Migration files: `database/migrations/` (96+ files)
- Database config: `config/database.ts`
- Model snapshot: `storage/framework/database/model-snapshot.<dialect>.json`

## Related skills

- [Database](/skills/data/database)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-migrations
```

Source: [`stacks-migrations/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-migrations/SKILL.md).
Shadow it for one project with `app/Skills/stacks-migrations/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).

## Native source verification

The skill has been checked against current source and retained tests. Read its
entrypoint and linked references for the actual contract; summaries here are
discovery pointers. [Native capabilities](/skills/platform/native) maps every
core package and records driver evidence without claiming universal parity.
