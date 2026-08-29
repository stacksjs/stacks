---
title: "Shell skill"
description: "Use when executing shell commands in a Stacks application - running system commands, process management, or using the shell operator. Covers @stacksjs/shell which wraps Bun's native $ operator."
---
# Shell

`stacks-shell` · Toolchain · model-invoked

Running system commands and managing processes, wrapping Bun's native `$`
operator.

## When to reach for it

- Running system commands
- Process management
- Using the shell operator

## Covers

@stacksjs/shell which wraps Bun's native $ operator.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- API
- Usage
- Bun $ Operator Features
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/shell/src/`
- Source: `storage/framework/core/shell/src/index.ts`
- Package: `@stacksjs/shell`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-shell
```

Source: [`stacks-shell/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-shell/SKILL.md).
Shadow it for one project with `app/Skills/stacks-shell/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
