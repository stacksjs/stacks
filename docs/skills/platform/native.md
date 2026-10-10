---
title: "Native skill"
description: "Use when planning or implementing a Stacks feature, choosing a native API, or checking which framework capability already solves a task. Covers the complete native package catalog, model-driven workflows, feature gates, driver evidence, and cross-package gotchas."
---
# Native

`stacks-native` · Native Stacks · model-invoked

Use when planning or implementing a Stacks feature, choosing a native API, or checking which framework capability already solves a task. Covers the complete native package catalog, model-driven workflows, feature gates, driver evidence, and cross-package gotchas.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Choose a workflow
- Model-first implementation
- Important boundaries
- Completion and freshness

## Supporting references

- [RECIPES.md](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-native/RECIPES.md)
- [CAPABILITIES.md](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-native/CAPABILITIES.md)
- [CATALOG.md](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-native/CATALOG.md)

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-native
```

Source: [`stacks-native/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-native/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-native/SKILL.md`. See [Using skills](/skills/using).
