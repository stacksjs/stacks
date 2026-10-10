---
title: "REPL skill"
description: "Use when working with the Stacks REPL - interactive TypeScript sessions, tinker sessions, debugging, or exploring the framework interactively. Covers @stacksjs/repl and @stacksjs/tinker."
---
# REPL

`stacks-repl` · Native Stacks · model-invoked

Use when working with the Stacks REPL - interactive TypeScript sessions, tinker sessions, debugging, or exploring the framework interactively. Covers @stacksjs/repl and @stacksjs/tinker.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- API
- Re-exports from @stacksjs/tinker
- CLI Commands
- Usage
- Gotchas
- Native options and bootstrap limits

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-repl
```

Source: [`stacks-repl/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-repl/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-repl/SKILL.md`. See [Using skills](/skills/using).
