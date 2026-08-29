---
title: "Dependencies skill"
description: "Use when managing dependencies in a Stacks project."
---
# Dependencies

`stacks-dependencies` · Platform · model-invoked

Managing dependencies: system dependencies through Pantry, Bun workspaces,
buddy-bot updates and the shared `better-dx` tooling.

## When to reach for it

- System dependencies via Pantry
- Bun workspaces
- Buddy-bot updates
- Better-dx tooling
- Dependency configuration

## Covers

`config/deps.ts`, Pantry, workspace management.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Pantry Configuration (config/deps.ts)
- Workspace Dependencies
- Key Framework Dependencies
- CLI Commands
- Dependency Update System
- Gotchas

## Where the code lives

- Root: `package.json`
- Deps config: `config/deps.ts`
- Bun lock: `bun.lock`
- Bun config: `bunfig.toml`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-dependencies
```

Source: [`stacks-dependencies/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-dependencies/SKILL.md).
Shadow it for one project with `app/Skills/stacks-dependencies/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
