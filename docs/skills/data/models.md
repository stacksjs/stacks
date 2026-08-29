---
title: "Models skill"
description: "Use when working with data models in Stacks."
---
# Models

`stacks-models` · Data layer · model-invoked

The `defineModel()` surface in full: attributes with validation and factories,
relationships, the behaviour traits, computed properties, and the 50+ models the
framework ships. This is where you look before writing a model, because traits do
real work and a hand-rolled version of one is wasted effort.

## When to reach for it

- The defineModel() API
- Model attributes with validation and factories
- Relationships (hasOne/hasMany/belongsTo/belongsToMany)
- Traits (useAuth, useUuid, useTimestamps, useSearch, useApi, billable, taggable, categorizable, commentable, likeable, observe)
- Computed properties (get/set)
- Model generation
- The 50+ built-in framework models

## Covers

model definitions, `storage/framework/defaults/app/Models/`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Writing a model
- Workflow
- Seeding
- All 62 built-in models by category
- CLI Commands
- Gotchas

## Where the code lives

- Your models: `app/Models/` (create it; it does not exist in a fresh project)
- Built-in models: `storage/framework/defaults/app/Models/` (62 files, grouped
- `ModelOptions` / `Attribute` types: `storage/framework/core/types/src/model.ts`
- Attribute presets: `storage/framework/types/attributes.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-models
```

Source: [`stacks-models/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-models/SKILL.md).
Shadow it for one project with `app/Skills/stacks-models/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
