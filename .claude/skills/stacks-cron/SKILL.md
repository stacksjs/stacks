---
name: stacks-cron
description: Use when scheduling cron jobs in a Stacks application — defining recurring tasks, cron expressions, or periodic job execution. Covers the @stacksjs/cron package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Cron

The `@stacksjs/cron` package provides cron job scheduling for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/cron/src/`
- Package: `@stacksjs/cron`

## Features
- Cron expression parsing and scheduling
- Recurring task definition
- Integration with the Stacks scheduler

## Usage
```typescript
import { cron } from '@stacksjs/cron'
```

## Related Packages
- `@stacksjs/scheduler` - Higher-level task scheduling (uses cron under the hood)
- `@stacksjs/queue` - Job queue for background processing

## Gotchas
- For most use cases, prefer `@stacksjs/scheduler` which provides a more expressive API
- Cron is the low-level primitive; scheduler builds on top of it
- Configure scheduled tasks in `app/Scheduler.ts`
