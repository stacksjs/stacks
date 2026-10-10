---
title: "Pagination skill"
description: "Use when returning database pages, simple or cursor feeds, building pagination links, or adapting upstream paginator results. Covers @stacksjs/pagination, ORM pagination and the native UI helper contract."
---
# Pagination

`stacks-pagination` · Native Stacks · model-invoked

Use when returning database pages, simple or cursor feeds, building pagination links, or adapting upstream paginator results. Covers @stacksjs/pagination, ORM pagination and the native UI helper contract.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Shapes
- HTTP and UI

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-pagination
```

Source: [`stacks-pagination/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-pagination/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-pagination/SKILL.md`. See [Using skills](/skills/using).
