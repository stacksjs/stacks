---
title: "Scheduler skill"
description: "Use when scheduling tasks in a Stacks application - defining scheduled tasks, cron-like scheduling, or task automation. Covers @stacksjs/scheduler, @stacksjs/cron, and app/Scheduler.ts."
---
# Scheduler

`stacks-scheduler` · Native Stacks · model-invoked

Use when scheduling tasks in a Stacks application - defining scheduled tasks, cron-like scheduling, or task automation. Covers @stacksjs/scheduler, @stacksjs/cron, and app/Scheduler.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

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
- Additional native scheduling operations

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-scheduler
```

Source: [`stacks-scheduler/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-scheduler/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-scheduler/SKILL.md`. See [Using skills](/skills/using).
