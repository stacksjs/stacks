---
title: "ORM skill"
description: "Use when querying or writing Stacks models, using transactions and relationships, preserving inferred model types, or enabling native model traits. Covers @stacksjs/orm, the model runtime, and 107 built-in models."
---
# ORM

`stacks-orm` · Native Stacks · model-invoked

Use when querying or writing Stacks models, using transactions and relationships, preserving inferred model types, or enabling native model traits. Covers @stacksjs/orm, the model runtime, and 107 built-in models.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Definitions and typed rows
- Write behavior
- Relationships and model instance methods
- Transactions
- Native pagination and search
- Runtime and schema boundaries
- Source and retained evidence

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-orm
```

Source: [`stacks-orm/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-orm/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-orm/SKILL.md`. See [Using skills](/skills/using).
