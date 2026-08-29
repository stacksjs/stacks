---
title: "Queue skill"
description: "Use when working with job queues in a Stacks application."
---
# Queue

`stacks-queue` · Backend and API · model-invoked

The queue system itself: workers, batches, failed jobs, queue events, health
checks, testing, and the Redis, database and sync drivers.

## When to reach for it

- Creating jobs
- Dispatching
- Workers
- Batches
- Failed jobs
- Queue events
- Health checks
- Testing
- Redis/database/sync drivers
- Rate limiting
- Scheduled jobs

## Covers

`@stacksjs/queue`, `config/queue.ts`, `app/Jobs/`.

## Inside the skill

The sections an agent reads once the skill loads.

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

## Where the code lives

- Queue package: `storage/framework/core/queue/src/`
- Configuration: `config/queue.ts`
- Application jobs: `app/Jobs/`
- Job model: `storage/framework/defaults/app/Models/Job.ts`
- Failed job model: `storage/framework/defaults/app/Models/FailedJob.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-queue
```

Source: [`stacks-queue/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-queue/SKILL.md).
Shadow it for one project with `app/Skills/stacks-queue/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
