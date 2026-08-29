---
title: "REPL skill"
description: "Use when working with the Stacks REPL - interactive TypeScript sessions, tinker sessions, debugging, or exploring the framework interactively. Covers @stacksjs/repl and @stacksjs/tinker."
---
# REPL

`stacks-repl` · Toolchain · model-invoked

Interactive TypeScript sessions against the running app. The fastest loop for
poking at a model, a relationship or a config value.

## When to reach for it

- Interactive TypeScript sessions
- Tinker sessions
- Debugging
- Exploring the framework interactively

## Covers

`@stacksjs/repl`, `@stacksjs/tinker`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- API
- Re-exports from @stacksjs/tinker
- CLI Commands
- Usage
- Gotchas

## Where the code lives

- REPL package: `storage/framework/core/repl/src/`
- Tinker package: `storage/framework/core/tinker/src/`
- Packages: `@stacksjs/repl`, `@stacksjs/tinker`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-repl
```

Source: [`stacks-repl/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-repl/SKILL.md).
Shadow it for one project with `app/Skills/stacks-repl/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
