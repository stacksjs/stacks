---
title: "Enums skill"
description: "Use when working with framework constants in a Stacks application - NpmScript commands, Action identifiers, or any enumerated constants used across the build system, CLI, and actions. Covers @stacksjs/enums."
---
# Enums

`stacks-enums` · Native Stacks · model-invoked

Use when working with framework constants in a Stacks application - NpmScript commands, Action identifiers, or any enumerated constants used across the build system, CLI, and actions. Covers @stacksjs/enums.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Action paths
- Script values
- Scheduling constants
- Source and verification

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-enums
```

Source: [`stacks-enums/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-enums/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-enums/SKILL.md`. See [Using skills](/skills/using).
