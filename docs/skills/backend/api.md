---
title: "API skill"
description: "Use when building, modifying, or debugging API endpoints in a Stacks application."
---
# API

`stacks-api` · Backend and API · model-invoked

Everything about the API surface: defining endpoints, handling requests and
responses, API middleware, the outbound HTTP client, API resources, and OpenAPI
generation. Covers both the utilities and the server that runs them.

## When to reach for it

- Defining routes
- Handling requests
- API middleware
- Working with the API server
- HTTP client (fetcher)
- API resources
- OpenAPI generation

## Covers

both @stacksjs/api utilities, stacks-api server implementation.

## Inside the skill

The sections an agent reads once the skill loads.

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

## Where the code lives

- Core utilities (package): `storage/framework/core/api/src/`
- API server: `storage/framework/api/`
- Router package: `storage/framework/core/router/src/`
- Route definitions: `routes/`
- Route registry: `app/Routes.ts` (re-exports `storage/framework/defaults/app/Routes.ts`)
- Port configuration: `config/ports.ts`
- Generated OpenAPI spec: `storage/framework/api/openapi.json`
- Generated API types: `storage/framework/api/api-types.ts`
- Actions directory: `app/Actions/`
- Controllers directory: `app/Controllers/`
- Middleware directory: `app/Middleware/`
- Middleware alias map: `app/Middleware.ts`
- Package: `@stacksjs/api`

## Related skills

- [Router](/skills/backend/router)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-api
```

Source: [`stacks-api/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-api/SKILL.md).
Shadow it for one project with `app/Skills/stacks-api/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
