---
name: stacks-scheduler
description: Use when scheduling tasks in a Stacks application — defining scheduled tasks, cron-like scheduling, or task automation. Covers @stacksjs/scheduler and app/Scheduler.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Scheduler

The `@stacksjs/scheduler` package provides task scheduling for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/scheduler/src/`
- Application scheduler: `app/Scheduler.ts`
- Package: `@stacksjs/scheduler`

## Architecture
- Scheduled tasks are defined in `app/Scheduler.ts`
- Uses `@stacksjs/cron` for cron expression parsing
- Tasks can run actions, jobs, or arbitrary functions
- Built-in schedule expressions (daily, hourly, weekly, etc.)

## CLI Commands
- `buddy schedule` - Schedule management commands

## Usage
Define tasks in `app/Scheduler.ts`:
```typescript
schedule.daily(() => {
  // Daily task
})

schedule.everyMinute(() => {
  // Per-minute task
})
```

## Gotchas
- All scheduled tasks go in `app/Scheduler.ts`
- Scheduler builds on `@stacksjs/cron` for expression parsing
- For one-off background work, use `@stacksjs/queue` instead
- Scheduled tasks run in the application process
