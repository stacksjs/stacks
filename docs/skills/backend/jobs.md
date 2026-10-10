---
title: "Jobs skill"
description: "Use when creating background job classes in app/Jobs/ - job structure, the handle method, job configuration (queue, tries, backoff, timeout, rate), dispatching patterns (dispatch, dispatchIf, dispatchAfter, dispatchNow), or the Every schedule constants. For the queue system internals (workers, batching, events, drivers, testing), see stacks-queue. Covers app/Jobs, the native Job class and typed by-name dispatch."
---
# Jobs

`stacks-jobs` · Backend and API · model-invoked

Writing the job classes in `app/Jobs/`: the handle method, the queue, retry and
timeout configuration, and the dispatch patterns. The queue internals live in
[Queue](/skills/backend/queue).

## When to reach for it

- Job structure
- The handle method
- Job configuration (queue, tries, backoff, timeout, rate)
- Dispatching patterns (dispatch, dispatchIf, dispatchAfter, dispatchNow)
- The Every schedule constants

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Creating a Job
- Job Configuration Options
- Dispatching Jobs
- Fluent Job Builder
- Scheduled Jobs
- CLI Commands
- Gotchas

## Where the code lives

- Application jobs: `app/Jobs/`
- Queue config: `config/queue.ts`

## Related skills

- [Queue](/skills/backend/queue)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-jobs
```

Source: [`stacks-jobs/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-jobs/SKILL.md).
Shadow it for one project with `app/Skills/stacks-jobs/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).

## Native source verification

The skill has been checked against current source and retained tests. Read its
entrypoint and linked references for the actual contract; summaries here are
discovery pointers. [Native capabilities](/skills/platform/native) maps every
core package and records driver evidence without claiming universal parity.
