---
title: "Queue skill"
description: "Use when working with job queues in a Stacks application - creating jobs, dispatching, workers, batches, failed jobs, queue events, health checks, testing, Redis/database/sync drivers, rate limiting, or scheduled jobs. Covers @stacksjs/queue, config/queue.ts, and app/Jobs/."
---
# Queue

`stacks-queue` · Native Stacks · model-invoked

Use when working with job queues in a Stacks application - creating jobs, dispatching, workers, batches, failed jobs, queue events, health checks, testing, Redis/database/sync drivers, rate limiting, or scheduled jobs. Covers @stacksjs/queue, config/queue.ts, and app/Jobs/.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Source Files
- Job Class (action.ts)
- JobBuilder Fluent API (job.ts)
- Job Batching (batch.ts)
- Job Discovery (discovery.ts)
- Job Scheduler (scheduler.ts)
- Queue Worker (worker.ts)
- Queue Events (events.ts)
- Queue Health (health.ts)
- Failed Job Notifications (notifications.ts)
- Queue Testing (testing.ts)
- Redis Driver (drivers/redis.ts)
- Creating a Job
- config/queue.ts
- Gotchas
- Dispatch correctness and durable workflows
- Driver evidence

## Supporting references

- [DURABLE-WORKFLOWS.md](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-queue/DURABLE-WORKFLOWS.md)

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-queue
```

Source: [`stacks-queue/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-queue/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-queue/SKILL.md`. See [Using skills](/skills/using).
