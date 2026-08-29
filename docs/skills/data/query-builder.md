---
title: "Query builder skill"
description: "Use when building database queries in a Stacks application."
---
# Query builder

`stacks-query-builder` · Data layer · model-invoked

The fluent query surface, backed by `bun-query-builder`. Chainable conditions,
ordering, eager loading, pagination and transactions, plus the configuration in
`config/query-builder.ts`.

## When to reach for it

- Constructing SQL queries
- Using the fluent query API
- Configuring the query builder

## Covers

@stacksjs/query-builder which wraps bun-query-builder, `config/query-builder.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- API
- Usage
- Configuration (config/query-builder.ts)
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/query-builder/src/`
- Configuration: `config/query-builder.ts`
- QB state: `.qb/`
- External library: `bun-query-builder`
- Package: `@stacksjs/query-builder`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-query-builder
```

Source: [`stacks-query-builder/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-query-builder/SKILL.md).
Shadow it for one project with `app/Skills/stacks-query-builder/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
