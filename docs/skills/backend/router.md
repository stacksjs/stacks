---
title: "Router skill"
description: "Use when working with routing in a Stacks application."
---
# Router

`stacks-router` · Backend and API · model-invoked

The routing layer in full: HTTP methods, groups, middleware, named routes and URL
generation, plus the Laravel-style request helpers, the response helpers, route
model binding and rate limiting.

## When to reach for it

- Defining routes
- HTTP methods
- Route groups
- Middleware
- Named routes
- URL generation
- Request enhancement (Laravel-style input/query/file helpers)
- Response helpers
- Error responses
- Route model binding
- Rate limiting

## Covers

`@stacksjs/router`, `routes/`, `app/Routes.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Route Definition
- The strings are typed
- Typed Routes (zero generation)
- Route Registry (app/Routes.ts)
- Enhanced Request (Laravel-style)
- Response Helpers
- Error Responses
- Request Context
- Middleware
- Query Tracking
- Default API Routes (routes/api.ts)
- Server Integration
- URL Generation
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/router/src/`
- Route files: `routes/` (api.ts, v1.ts, buddy.ts, users.ts)
- Route registry: `app/Routes.ts`
- Generated route manifest: `storage/framework/stx/routes.ts` (written by the dev server)
- Derived name types: `storage/framework/types/registries.d.ts`
- The maps they read: `storage/framework/auto-imports/{actions,listeners,policies,middleware,emails,routes}.ts`

## Related skills

- [API](/skills/backend/api)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-router
```

Source: [`stacks-router/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-router/SKILL.md).
Shadow it for one project with `app/Skills/stacks-router/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
