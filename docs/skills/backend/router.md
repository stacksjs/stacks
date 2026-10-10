---
title: "Router skill"
description: "Use when working with routing in a Stacks application - defining routes, HTTP methods, route groups, middleware, named routes, URL generation, request enhancement (Laravel-style input/query/file helpers), response helpers, error responses, route model binding, or rate limiting. Covers @stacksjs/router, routes/, and app/Routes.ts."
---
# Router

`stacks-router` · Native Stacks · model-invoked

Use when working with routing in a Stacks application - defining routes, HTTP methods, route groups, middleware, named routes, URL generation, request enhancement (Laravel-style input/query/file helpers), response helpers, error responses, route model binding, or rate limiting. Covers @stacksjs/router, routes/, and app/Routes.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Route Definition
- The strings are typed
- Typed Routes (zero generation)
- Route Registry (app/Routes.ts)
- Binding, signed access, and request lifecycle
- Enhanced Request (Laravel-style)
- Response Helpers
- Error Responses
- Request Context
- Middleware
- Query Tracking
- Default API route families
- Server Integration
- URL Generation
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-router
```

Source: [`stacks-router/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-router/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-router/SKILL.md`. See [Using skills](/skills/using).
