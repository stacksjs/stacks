---
title: "Buddy skill"
description: "Use when working with the Stacks CLI (buddy/bud/stacks/stx)."
---
# Buddy

`stacks-buddy` · Toolchain · model-invoked

The CLI in full: every command with its flags, the `make:*` scaffolding, the dev,
build and deploy commands, environment management, and how to add your own
commands in `app/Commands/`.

## When to reach for it

- Understanding all 50+ commands with their flags and options
- Adding custom commands
- The make:* scaffolding commands
- Development server commands
- Build commands
- Deployment commands
- email/mail commands
- Environment management
- domain/DNS commands

## Covers

`@stacksjs/buddy`, all CLI command files.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- CLI Aliases
- Architecture
- Interactive Mode
- Development Commands
- Build Commands
- Database Commands
- Code Generation (make:*)
- Code Generation (generate)
- Environment Management
- Cloud & Deployment
- Domain & DNS
- Email / Mail Commands
- Code Quality
- Project Management
- Maintenance Mode
- Other Commands
- Adding Custom Commands
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/buddy/src/`
- CLI entry point: `storage/framework/core/buddy/src/cli.ts`
- Commands directory: `storage/framework/core/buddy/src/commands/`
- Lazy command registry: `storage/framework/core/buddy/src/lazy-commands.ts`
- Config system: `storage/framework/core/buddy/src/config.ts`
- Shell entry: `buddy` (shell script at project root that invokes `bun run ./storage/framework/core/buddy/src/cli.ts`)
- Application commands: `app/Commands/` (auto-discovered; no registration step)
- Optional registry: `app/Commands.ts`
- Make templates: `storage/framework/defaults/`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-buddy
```

Source: [`stacks-buddy/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-buddy/SKILL.md).
Shadow it for one project with `app/Skills/stacks-buddy/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
