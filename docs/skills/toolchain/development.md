---
title: "Development skill"
description: "Use when setting up or configuring the Stacks development environment - dev server, hot reload, development utilities, or IDE configuration. Covers the @stacksjs/development package, the dev server, CLI commands, reverse proxy, SSL, and dev workflow."
---
# Development

`stacks-development` · Native Stacks · model-invoked

Use when setting up or configuring the Stacks development environment - dev server, hot reload, development utilities, or IDE configuration. Covers the @stacksjs/development package, the dev server, CLI commands, reverse proxy, SSL, and dev workflow.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

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
- STX Configuration (config/stx.ts)
- Gotchas
- Verify the selected entrypoint

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-development
```

Source: [`stacks-development/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-development/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-development/SKILL.md`. See [Using skills](/skills/using).
