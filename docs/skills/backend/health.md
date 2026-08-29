---
title: "Health skill"
description: "Use when implementing health checks in a Stacks application - service monitoring, health endpoints, or diagnostic checks. Covers @stacksjs/health (currently WIP - Oh Dear integration planned)."
---
# Health

`stacks-health` · Backend and API · model-invoked

Health checks and service monitoring. Currently a work in progress, with an Oh
Dear integration planned.

## When to reach for it

- Service monitoring
- Health endpoints
- Diagnostic checks

## Covers

`@stacksjs/health` (currently WIP - Oh Dear integration planned).

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- Current Status
- Built-in Health Endpoint
- CLI Commands
- Planned Features
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/health/src/`
- Drivers: `storage/framework/core/health/src/drivers/`
- Notifications: `storage/framework/core/health/src/notifications/`
- Package: `@stacksjs/health`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-health
```

Source: [`stacks-health/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-health/SKILL.md).
Shadow it for one project with `app/Skills/stacks-health/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
