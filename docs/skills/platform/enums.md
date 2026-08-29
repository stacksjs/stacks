---
title: "Enums skill"
description: "Use when working with framework constants in a Stacks application."
---
# Enums

`stacks-enums` · Platform · model-invoked

The framework's enumerated constants, used across the build system, the CLI and
the actions.

## When to reach for it

- NpmScript commands
- Action identifiers
- Any enumerated constants used across the build system
- CLI
- Actions

## Covers

`@stacksjs/enums`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- NpmScript Enum (45 values)
- Action Enum (60+ values)
- Usage
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/enums/src/`
- Source: `storage/framework/core/enums/src/index.ts`
- Package: `@stacksjs/enums`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-enums
```

Source: [`stacks-enums/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-enums/SKILL.md).
Shadow it for one project with `app/Skills/stacks-enums/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
