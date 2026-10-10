---
title: "Query builder skill"
description: "Use when building database queries in a Stacks application - constructing SQL queries, using the fluent query API, or configuring the query builder. Covers @stacksjs/query-builder which wraps bun-query-builder, and config/query-builder.ts."
---
# Query builder

`stacks-query-builder` · Native Stacks · model-invoked

Use when building database queries in a Stacks application - constructing SQL queries, using the fluent query API, or configuring the query builder. Covers @stacksjs/query-builder which wraps bun-query-builder, and config/query-builder.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- API
- Usage
- Configuration (config/query-builder.ts)
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-query-builder
```

Source: [`stacks-query-builder/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-query-builder/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-query-builder/SKILL.md`. See [Using skills](/skills/using).
