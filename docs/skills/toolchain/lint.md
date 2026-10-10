---
title: "Lint skill"
description: "Use when linting or formatting code in a Stacks project. CRITICAL - always use pickier, NEVER eslint directly. Run 'bunx --bun pickier .' to lint, 'bunx --bun pickier . --fix' to auto-fix. For unused variables, prefer eslint-disable-next-line comments over underscore prefix. Covers @stacksjs/lint and config/code-style.ts."
---
# Lint

`stacks-lint` · Native Stacks · model-invoked

Use when linting or formatting code in a Stacks project. CRITICAL - always use pickier, NEVER eslint directly. Run 'bunx --bun pickier .' to lint, 'bunx --bun pickier . --fix' to auto-fix. For unused variables, prefer eslint-disable-next-line comments over underscore prefix. Covers @stacksjs/lint and config/code-style.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- CRITICAL RULES
- Key Paths
- Package Details
- Commands
- config/code-style.ts (PickierOptions)
- Format Settings (enforced)
- Handling Unused Variables
- Internal Implementation
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-lint
```

Source: [`stacks-lint/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-lint/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-lint/SKILL.md`. See [Using skills](/skills/using).
