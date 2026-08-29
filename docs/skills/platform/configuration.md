---
title: "Configuration skill"
description: "Use when setting up or modifying Stacks project-level configuration."
---
# Configuration

`stacks-configuration` · Platform · model-invoked

Project-level setup rather than feature config: the `bunfig.toml` preload order,
the tsconfig chain and tsgo type checking, workspaces, `.env`, the package
scripts and the system requirements.

## When to reach for it

- bunfig.toml preload order
- The tsconfig chain and TypeScript 7 / tsgo type checking
- Workspace configuration
- .env setup
- package.json scripts
- System requirements (Bun >= 1.3.0, SQLite >= 3.47.2)
- The project bootstrap process

## Inside the skill

The sections an agent reads once the skill loads.

- bunfig.toml
- TypeScript
- package.json (Root)
- .env Setup
- System Requirements
- Key Project Scripts
- better-dx Integration
- Gotchas

## Related skills

- [Plugins](/skills/toolchain/plugins)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-configuration
```

Source: [`stacks-configuration/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-configuration/SKILL.md).
Shadow it for one project with `app/Skills/stacks-configuration/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
