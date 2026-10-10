---
title: "Config skill"
description: "Use when working with Stacks configuration, asynchronous overrides, driver capability evidence, framework feature gates, package resource discovery, or request context. Covers @stacksjs/config and the config/ directory."
---
# Config

`stacks-config` · Native Stacks · model-invoked

Use when working with Stacks configuration, asynchronous overrides, driver capability evidence, framework feature gates, package resource discovery, or request context. Covers @stacksjs/config and the config/ directory.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Loading and readiness
- Driver capability evidence
- Framework feature gates
- Native resource discovery
- Configuration paths
- Sources and verification

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-config
```

Source: [`stacks-config/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-config/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-config/SKILL.md`. See [Using skills](/skills/using).
