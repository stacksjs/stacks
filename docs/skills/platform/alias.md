---
title: "Alias skill"
description: "Use when debugging source aliases, package/subpath resolution, or the boundary between checkout and published imports. Covers @stacksjs/alias and its active resolver consumers."
---
# Alias

`stacks-alias` · Native Stacks · model-invoked

Use when debugging source aliases, package/subpath resolution, or the boundary between checkout and published imports. Covers @stacksjs/alias and its active resolver consumers.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Actual mappings
- Source versus published consumers
- Verification

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-alias
```

Source: [`stacks-alias/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-alias/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-alias/SKILL.md`. See [Using skills](/skills/using).
