---
name: stacks-jobs
description: Use when working with background jobs in a Stacks application — creating job classes, dispatching jobs, handling job failures, or configuring job processing. Covers app/Jobs/ and the queue system.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Jobs

Background jobs enable deferred processing in Stacks applications.

## Key Paths
- Application jobs: `app/Jobs/`
- Queue config: `config/queue.ts`
- Job model: `storage/framework/models/Job.ts`
- Failed job model: `storage/framework/models/FailedJob.ts`
- Queue package: `storage/framework/core/queue/src/`

## Creating a Job
1. Create a job class in `app/Jobs/`
2. Define the `handle()` method with the job logic
3. Dispatch the job from actions, routes, or listeners

## Job Lifecycle
1. **Dispatch** - Job is placed on the queue
2. **Process** - Worker picks up and executes the job
3. **Complete** - Job finishes successfully, or...
4. **Fail** - Job fails and is recorded in FailedJob model

## CLI Commands
- `buddy queue` - Queue management
- `buddy queue:work` - Start processing jobs

## Gotchas
- Jobs should be serializable (avoid closures)
- Jobs should be idempotent (safe to retry)
- Failed jobs are stored in the database
- Queue configuration (retry, timeout) is in `config/queue.ts`
- Jobs are processed by queue workers, not the main application process
