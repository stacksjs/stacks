---
title: "CLI skill"
description: "Use when building CLI commands or tools with Stacks."
---
# CLI

`stacks-cli` · Toolchain · model-invoked

The package you build commands *with*: argument parsing, option handling, coloured
output, tables, progress indicators and prompts.

## When to reach for it

- The @stacksjs/cli package for creating commands with argument parsing
- Option handling
- Colored output
- Tables
- Progress indicators
- Prompts
- Integrating with the buddy command system

## Covers

`@stacksjs/cli`, `app/Commands/`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Creating Commands
- CLI Event Listeners
- Output Formatting
- config/cli.ts (BinaryConfig)
- CLI Commands
- Compiled Binaries
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/cli/src/`
- CLI configuration: `config/cli.ts`
- Application commands: `app/Commands/`
- Optional registry: `app/Commands.ts` (not needed - see below)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-cli
```

Source: [`stacks-cli/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-cli/SKILL.md).
Shadow it for one project with `app/Skills/stacks-cli/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
