---
title: "API skill"
description: "Use when building, modifying, or debugging API endpoints in a Stacks application - defining routes, handling requests, API middleware, working with the API server, HTTP client (fetcher), API resources, or OpenAPI generation. Covers both @stacksjs/api utilities and the stacks-api server implementation."
---
# API

`stacks-api` · Native Stacks · model-invoked

Use when building, modifying, or debugging API endpoints in a Stacks application - defining routes, handling requests, API middleware, working with the API server, HTTP client (fetcher), API resources, or OpenAPI generation. Covers both @stacksjs/api utilities and the stacks-api server implementation.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Source Files
- API Server (dev.ts)
- Route Definitions
- Action Resolution
- Response Factory
- Enhanced Request (EnhancedRequest)
- Request Context (AsyncLocalStorage)
- Middleware
- Which client to reach for
- Typed client (zero generation)
- Fetcher (HTTP Client)
- API Resources (Laravel-style)
- OpenAPI Generation
- Error Handling
- Port Configuration (config/ports.ts)
- Route Groups in routes/api.ts
- ORM-Generated CRUD Routes
- CLI Commands
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-api
```

Source: [`stacks-api/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-api/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-api/SKILL.md`. See [Using skills](/skills/using).
