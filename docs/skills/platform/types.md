---
title: "Types skill"
description: "Use when working with TypeScript type definitions in a Stacks application."
---
# Types

`stacks-types` · Platform · model-invoked

The generated and hand-written type definitions: model types, request types,
environment variables, event types and the ambient globals.

## When to reach for it

- Model types
- Request types
- Environment variables
- Event types
- Billing types
- Attribute types
- Auto-imported globals

## Covers

`storage/framework/types/`, `storage/framework/core/types/src/`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Authentication Types (auth.ts)
- ORM Global Types (orm-globals.d.ts)
- Environment Types (env.d.ts)
- Event Types (events.ts)
- Billing Types (billing.ts)
- Attribute Types (attributes.ts)
- Request Types (traits.d.ts)
- Auto-Imported Globals
- CLI Types (cli.ts)
- Gotchas

## Where the code lives

- Core types: `storage/framework/core/types/src/`
- Generated types: `storage/framework/types/`
- ORM globals: `storage/framework/types/orm-globals.d.ts`
- Environment: `storage/framework/types/env.d.ts`
- Actions: `storage/framework/types/actions.d.ts` (generated `ActionPath` union)
- Model traits: `storage/framework/types/traits.d.ts`
- Model attributes: `storage/framework/types/attributes.d.ts`
- Events: `storage/framework/types/events.ts`
- Attributes: `storage/framework/types/attributes.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-types
```

Source: [`stacks-types/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-types/SKILL.md).
Shadow it for one project with `app/Skills/stacks-types/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
