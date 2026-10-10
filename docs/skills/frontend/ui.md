---
title: "UI skill"
description: "Use when composing Stacks UI components, web fonts, pagination controls, accessibility, or choosing frontend primitives. Covers @stacksjs/ui, its components subpath, the STX component plugin, and native frontend skill discovery."
---
# UI

`stacks-ui` · Native Stacks · model-invoked

Use when composing Stacks UI components, web fonts, pagination controls, accessibility, or choosing frontend primitives. Covers @stacksjs/ui, its components subpath, the STX component plugin, and native frontend skill discovery.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Package and component resolution
- Fonts
- Pagination controls
- Gotchas
- Source and evidence

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-ui
```

Source: [`stacks-ui/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-ui/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-ui/SKILL.md`. See [Using skills](/skills/using).
