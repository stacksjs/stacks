---
title: "Cron skill"
description: "Use when working with cron expressions in a Stacks application."
---
# Cron

`stacks-cron` · Backend and API · model-invoked

Cron expression parsing and OS-level job registration. The layer under
[Scheduler](/skills/backend/scheduler), and rarely what you want directly.

## When to reach for it

- Parsing cron syntax
- Registering OS-level cron jobs
- Low-level scheduling

## Covers

`@stacksjs/cron`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- API
- Types
- Cron Expression Examples
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/cron/src/`
- Package: `@stacksjs/cron`

## Related skills

- [Scheduler](/skills/backend/scheduler)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-cron
```

Source: [`stacks-cron/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-cron/SKILL.md).
Shadow it for one project with `app/Skills/stacks-cron/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
