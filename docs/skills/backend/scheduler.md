---
title: "Scheduler skill"
description: "Use when scheduling tasks in a Stacks application - defining scheduled tasks, cron-like scheduling, or task automation. Covers @stacksjs/scheduler, @stacksjs/cron, and app/Scheduler.ts."
---
# Scheduler

`stacks-scheduler` · Backend and API · model-invoked

Scheduled tasks in `app/Scheduler.ts`, with a cron-like fluent surface over the
low-level parsing in [Cron](/skills/backend/cron).

## When to reach for it

- Defining scheduled tasks
- Cron-like scheduling
- Task automation

## Covers

`@stacksjs/scheduler`, `@stacksjs/cron`, `app/Scheduler.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- Schedule Class (schedule.ts)
- Helper Functions
- Cron Parser (@stacksjs/cron)
- Every Enum (cron-jobs.ts)
- runScheduler() (run.ts)
- Queue-Level Scheduler (queue/src/scheduler.ts)
- app/Scheduler.ts
- CLI Commands
- Code Examples
- Gotchas

## Where the code lives

- Scheduler package: `storage/framework/core/scheduler/src/`
- Cron package: `storage/framework/core/cron/src/`
- Application scheduler: `app/Scheduler.ts`
- CLI command: `storage/framework/core/buddy/src/commands/schedule.ts`
- Run action: `storage/framework/core/actions/src/schedule/run.ts`
- Queue-based scheduler: `storage/framework/core/queue/src/scheduler.ts`
- Job types / `Every` enum: `storage/framework/core/types/src/cron-jobs.ts`
- Lock files: `storage/framework/locks/` (created at runtime)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-scheduler
```

Source: [`stacks-scheduler/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-scheduler/SKILL.md).
Shadow it for one project with `app/Skills/stacks-scheduler/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
