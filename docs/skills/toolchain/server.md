---
title: "Server skill"
description: "Use when working with the Stacks development or production server - server configuration, server middleware, or server startup. Covers @stacksjs/server and storage/framework/server/."
---
# Server

`stacks-server` · Native Stacks · model-invoked

Use when working with the Stacks development or production server - server configuration, server middleware, or server startup. Covers @stacksjs/server and storage/framework/server/.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Source Files
- Server Entry Point (server/src/index.ts)
- Server Config (core/server/src/config.ts)
- Production Config (core/server/src/config-production.ts)
- Production Start (core/server/src/start.ts)
- Auto-Imports System (core/server/src/imports.ts)
- Base Controller (core/server/src/controllers/base.ts)
- Maintenance Mode (core/server/src/maintenance.ts)
- Sitemap and robots.txt (core/actions/src/seo.ts)
- Docker Build Pipeline (server/build.ts)
- Dockerfile
- dev Script (server/dev)
- Environment Variables
- CLI Commands
- Gotchas
- Runtime evidence

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-server
```

Source: [`stacks-server/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-server/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-server/SKILL.md`. See [Using skills](/skills/using).
