---
title: "Health skill"
description: "Use when implementing health checks in a Stacks application - service monitoring, health endpoints, or diagnostic checks. Covers @stacksjs/health (currently WIP - Oh Dear integration planned)."
---
# Health

`stacks-health` · Native Stacks · model-invoked

Use when implementing health checks in a Stacks application - service monitoring, health endpoints, or diagnostic checks. Covers @stacksjs/health (currently WIP - Oh Dear integration planned).

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Source Files
- Current Status
- Built-in Health Endpoint
- CLI Commands
- Planned Features
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-health
```

Source: [`stacks-health/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-health/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-health/SKILL.md`. See [Using skills](/skills/using).
