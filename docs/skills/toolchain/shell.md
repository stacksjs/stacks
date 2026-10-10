---
title: "Shell skill"
description: "Use when executing shell commands in a Stacks application - running system commands, process management, or using the shell operator. Covers @stacksjs/shell which wraps Bun's native $ operator."
---
# Shell

`stacks-shell` · Native Stacks · model-invoked

Use when executing shell commands in a Stacks application - running system commands, process management, or using the shell operator. Covers @stacksjs/shell which wraps Bun's native $ operator.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- API
- Usage
- Bun $ Operator Features
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-shell
```

Source: [`stacks-shell/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-shell/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-shell/SKILL.md`. See [Using skills](/skills/using).
