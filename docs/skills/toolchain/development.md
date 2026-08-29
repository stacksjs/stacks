---
title: "Development skill"
description: "Use when setting up or configuring the Stacks development environment."
---
# Development

`stacks-development` · Toolchain · model-invoked

The development environment: the dev server, hot reload, the reverse proxy, SSL
and the day-to-day workflow.

## When to reach for it

- Dev server
- Hot reload
- Development utilities
- IDE configuration

## Covers

@stacksjs/development package, dev server, CLI commands, reverse proxy, SSL, dev workflow.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- Port Configuration (config/ports.ts)
- CLI Commands
- Dev Server Architecture
- Reverse Proxy & HTTPS
- Hot Reload / Watch Mode
- Preloader (preloader.ts)
- Production Server (server/src/index.ts)
- Server Build Process (server/build.ts)
- IDE Support
- Doctor Health Checks
- STX Configuration (config/ui.ts)
- Gotchas

## Where the code lives

- Development package: `storage/framework/core/development/` (stub — exports `{}`)
- Dev server entry: `storage/framework/server/src/index.ts`
- Dev server utils: `storage/framework/server/src/utils.ts`
- Server build script: `storage/framework/server/build.ts`
- Dev action handlers: `storage/framework/core/actions/src/dev/`
- Buddy CLI dev commands: `storage/framework/core/buddy/src/commands/dev.ts`
- Preloader: `storage/framework/defaults/resources/plugins/preloader.ts`
- Port config: `config/ports.ts`
- STX config: `config/ui.ts`
- IDE defaults: `storage/framework/defaults/ide/`
- SSL setup: `storage/framework/core/actions/src/setup/ssl.ts`
- Bun config: `bunfig.toml`
- Dockerfile: `storage/framework/server/Dockerfile`

## Related skills

- [Server](/skills/toolchain/server)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-development
```

Source: [`stacks-development/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-development/SKILL.md).
Shadow it for one project with `app/Skills/stacks-development/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
