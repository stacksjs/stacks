---
title: "ORM skill"
description: "Use when working with the Stacks ORM."
---
# ORM

`stacks-orm` · Data layer · model-invoked

The ORM itself: how `defineModel()` becomes a queryable model, how relationships
resolve, what the traits attach, which system fields appear on their own, and the
naming conventions the rest of the framework infers from.

## When to reach for it

- Defining models with defineModel()
- Model relationships (hasOne, hasMany, belongsTo, belongsToMany, morphOne, hasManyThrough)
- Attributes
- Traits
- Factories
- Computed properties
- Query building
- Transactions
- The 50+ built-in models

## Covers

`@stacksjs/orm`, `storage/framework/orm/`, `storage/framework/defaults/app/Models/`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- defineModel() API (define-model.ts)
- Transactions (transaction.ts)
- Trait Methods (traits/)
- Auto-Generated System Fields
- Naming Conventions
- ORM Utility Types (model-types.ts)
- ORM Utility Functions (utils.ts)
- Relationship Processing (utils.ts)
- Model Events (when `traits.observe: true`)
- Stub Types in index.ts
- All 50+ Framework Models
- CLI Commands
- Gotchas

## Where the code lives

- Core ORM package: `storage/framework/core/orm/src/`
- ORM implementation: `storage/framework/orm/`
- Model definitions: `storage/framework/defaults/app/Models/` (50+ models)
- Application models: `app/Models/`
- Default model templates: `storage/framework/defaults/app/Models/`
- ORM type globals: `storage/framework/types/orm-globals.d.ts`
- Attribute types: `storage/framework/types/attributes.ts` (240+ attributes)
- Model events: `storage/framework/types/events.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-orm
```

Source: [`stacks-orm/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-orm/SKILL.md).
Shadow it for one project with `app/Skills/stacks-orm/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
