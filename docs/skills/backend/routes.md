---
title: "Routes skill"
description: "Use when defining or organizing route files in a Stacks application."
---
# Routes

`stacks-routes` · Backend and API · model-invoked

Where route files live and how they get registered. The organisational half of
routing: files under `routes/`, the `app/Routes.ts` registry, prefixes and
middleware groups.

## When to reach for it

- Creating route files in routes/
- Registering them in app/Routes.ts
- Using route prefixes and middleware groups
- The default API routes structure

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Route Registry (app/Routes.ts)
- Creating a Route File
- Default API Routes (routes/api.ts)
- Versioned Routes (routes/v1.ts)
- Handler Types
- CLI Commands
- Gotchas

## Where the code lives

- Route files: `routes/` (api.ts, v1.ts, buddy.ts, users.ts)
- Route registry: `app/Routes.ts`

## Related skills

- [Router](/skills/backend/router)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-routes
```

Source: [`stacks-routes/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-routes/SKILL.md).
Shadow it for one project with `app/Skills/stacks-routes/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
