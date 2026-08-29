---
title: "Server skill"
description: "Use when working with the Stacks development or production server - server configuration, server middleware, or server startup. Covers @stacksjs/server and storage/framework/server/."
---
# Server

`stacks-server` · Toolchain · model-invoked

The server itself, in development and production: configuration, middleware and
startup.

## When to reach for it

- Server configuration
- Server middleware
- Server startup

## Covers

`@stacksjs/server`, `storage/framework/server/`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- Server Entry Point (server/src/index.ts)
- Server Config (core/server/src/config.ts)
- Production Config (core/server/src/config-production.ts)
- Production Start (core/server/src/start.ts)
- Auto-Imports System (core/server/src/imports.ts)
- Base Controller (core/server/src/controllers/base.ts)
- Maintenance Mode (core/server/src/maintenance.ts)
- Docker Build Pipeline (server/build.ts)
- Dockerfile
- dev Script (server/dev)
- Environment Variables
- CLI Commands
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/server/src/` (published as `@stacksjs/server`)
- Server runtime: `storage/framework/server/` (the actual Bun HTTP server + Docker build)
- Server types: `storage/framework/core/types/src/server.ts`
- Ports types: `storage/framework/core/types/src/ports.ts`
- Package (core): `storage/framework/core/server/package.json`
- Package (runtime): `storage/framework/server/package.json`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-server
```

Source: [`stacks-server/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-server/SKILL.md).
Shadow it for one project with `app/Skills/stacks-server/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
