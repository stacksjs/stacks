---
title: "Composables skill"
description: "Use when choosing or implementing reactive composables in STX, data queries, forms, consent, browser APIs, motion, or debugging client delivery. Covers @stacksjs/composables, STX eager and demand browser delivery, and the difference between callable signals and module Refs."
---
# Composables

`stacks-composables` · Native Stacks · model-invoked

Use when choosing or implementing reactive composables in STX, data queries, forms, consent, browser APIs, motion, or debugging client delivery. Covers @stacksjs/composables, STX eager and demand browser delivery, and the difference between callable signals and module Refs.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Eager window aliases
- Explicit module imports
- Module query cache
- Module forms and consent
- Gotchas
- Source and evidence

## Supporting references

- [BROWSER.md](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-composables/BROWSER.md)

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-composables
```

Source: [`stacks-composables/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-composables/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-composables/SKILL.md`. See [Using skills](/skills/using).
