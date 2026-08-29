---
title: "Scaffolding skill"
description: "Use when generating new code with Stacks."
---
# Scaffolding

`stacks-scaffolding` · Toolchain · model-invoked

The `buddy make:*` generators and the project templates behind them.

## When to reach for it

- Buddy make commands
- Project scaffolding
- component/page/store/layout generation
- Project templates

## Covers

buddy make:* commands, STX scaffolding utilities.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- CLI Make Commands
- STX Scaffolding API
- Project Templates
- Generated File Locations
- Default Templates
- Gotchas

## Where the code lives

- Buddy commands: `storage/framework/core/buddy/src/commands/make.ts`
- Default templates: `storage/framework/defaults/`
- STX scaffolding: `@stacksjs/stx` (scaffolding module)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-scaffolding
```

Source: [`stacks-scaffolding/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-scaffolding/SKILL.md).
Shadow it for one project with `app/Skills/stacks-scaffolding/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
