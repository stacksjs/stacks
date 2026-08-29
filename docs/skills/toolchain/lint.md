---
title: "Lint skill"
description: "Use when linting or formatting code in a Stacks project. CRITICAL."
---
# Lint

`stacks-lint` · Toolchain · model-invoked

Linting and formatting, which in a Stacks project means pickier and never eslint
directly.

## When to reach for it

- Always use pickier
- NEVER eslint directly. Run 'bunx --bun pickier .' to lint
- 'bunx --bun pickier . --fix' to auto-fix

## Covers

`@stacksjs/lint`, `config/code-style.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- CRITICAL RULES
- Key Paths
- Package Details
- Commands
- config/code-style.ts (PickierOptions)
- Format Settings (enforced)
- Handling Unused Variables
- Internal Implementation
- Gotchas

## Where the code lives

- Lint package: `storage/framework/core/lint/` (package: `@stacksjs/lint`)
- Configuration: `config/code-style.ts` (auto-loaded via pickier's bunfig alias `code-style`; pickier handles both linting and formatting)
- Lint command source: `storage/framework/core/buddy/src/commands/lint.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-lint
```

Source: [`stacks-lint/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-lint/SKILL.md).
Shadow it for one project with `app/Skills/stacks-lint/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
