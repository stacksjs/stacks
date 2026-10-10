---
title: "Features skill"
description: "Use when installing or disabling optional Stacks bundles, understanding model/migration/view gates, or choosing default route bundles. Covers @stacksjs/features and @stacksjs/config feature controls."
---
# Features

`stacks-features` · Native Stacks · model-invoked

Use when installing or disabling optional Stacks bundles, understanding model/migration/view gates, or choosing default route bundles. Covers @stacksjs/features and @stacksjs/config feature controls.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Installation and gates
- Schema and discovery

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-features
```

Source: [`stacks-features/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-features/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-features/SKILL.md`. See [Using skills](/skills/using).
