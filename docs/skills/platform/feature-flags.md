---
title: "Feature Flags skill"
description: "Use when implementing per-user or per-team feature rollouts, persisted flag values, percentage experiments, or weighted variants. Covers @stacksjs/feature-flags and config/feature-flags.ts."
---
# Feature Flags

`stacks-feature-flags` · Native Stacks · model-invoked

Use when implementing per-user or per-team feature rollouts, persisted flag values, percentage experiments, or weighted variants. Covers @stacksjs/feature-flags and config/feature-flags.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Define, scope, and evaluate
- Drivers and boundaries

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-feature-flags
```

Source: [`stacks-feature-flags/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-feature-flags/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-feature-flags/SKILL.md`. See [Using skills](/skills/using).
