---
title: "Middleware skill"
description: "Use when working with middleware in a Stacks application."
---
# Middleware

`stacks-middleware` · Backend and API · model-invoked

Defining middleware, applying it to routes, aliasing it in the `app/Middleware.ts`
registry, parameterizing it, grouping it, and the order the pipeline runs in.

## When to reach for it

- Defining middleware
- Applying to routes
- Middleware aliases
- Parameterized middleware
- Groups
- The middleware execution pipeline

## Covers

Middleware class, app/Middleware.ts alias registry, all 22 default middleware files.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Middleware Class
- Creating Custom Middleware
- Alias Registry (app/Middleware.ts)
- Reference forms
- Applying Middleware
- Default Middleware Reference
- Middleware Loading Flow
- Representative Implementations
- Standalone Auth Middleware (@stacksjs/auth)
- Gotchas

## Where the code lives

- Middleware class: `storage/framework/core/router/src/middleware.ts`
- Execution engine: `storage/framework/core/router/src/stacks-router.ts`
- Alias registry: `app/Middleware.ts`
- Default middleware: `storage/framework/defaults/app/Middleware/` (22 files)
- Auth middleware (standalone): `storage/framework/core/auth/src/middleware.ts`
- Tests: `storage/framework/core/router/tests/middleware.test.ts`

## Related skills

- [Router](/skills/backend/router)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-middleware
```

Source: [`stacks-middleware/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-middleware/SKILL.md).
Shadow it for one project with `app/Skills/stacks-middleware/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
