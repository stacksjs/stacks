---
name: stacks-queue
description: Use when implementing job queues in a Stacks application — background jobs, job dispatching, queue workers, failed jobs, or queue configuration. Covers @stacksjs/queue, config/queue.ts, and app/Jobs/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Queue

The `@stacksjs/queue` package provides job queue functionality for Stacks applications, powered by `bun-queue`.

## Key Paths
- Core package: `storage/framework/core/queue/src/`
- Configuration: `config/queue.ts`
- Application jobs: `app/Jobs/`
- Job model: `storage/framework/models/Job.ts`
- Failed job model: `storage/framework/models/FailedJob.ts`
- Default queue actions: `storage/framework/defaults/actions/Queue/`
- Package: `@stacksjs/queue`

## Architecture
- Jobs are defined in `app/Jobs/`
- Queue processing is powered by `bun-queue`
- Failed jobs are tracked in the `FailedJob` model
- Queue configuration in `config/queue.ts`

## CLI Commands
- `buddy queue` - Queue management commands

## Models
- `Job.ts` - Active/pending jobs
- `FailedJob.ts` - Failed job records for retry

## Creating Jobs
1. Create a job class in `app/Jobs/`
2. Define the `handle()` method
3. Dispatch the job from actions, routes, or events

## Gotchas
- Failed jobs are stored in the database via the FailedJob model
- Queue workers run as separate processes
- Jobs should be idempotent (safe to retry)
- Configure retry policies in `config/queue.ts`
- The underlying library is `bun-queue`
