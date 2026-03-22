---
name: stacks-jobs
description: Use when creating background job classes in app/Jobs/ — job structure, the handle method, job configuration (queue, tries, backoff, timeout, rate), dispatching patterns (dispatch, dispatchIf, dispatchAfter, dispatchNow), or the Every schedule constants. For the queue system internals (workers, batching, events, drivers, testing), see stacks-queue.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Jobs

Background job classes defined in `app/Jobs/`.

## Key Paths
- Application jobs: `app/Jobs/`
- Queue config: `config/queue.ts`

## Creating a Job

```typescript
// app/Jobs/SendWelcomeEmail.ts
import { Job } from '@stacksjs/queue'

export default new Job({
  name: 'SendWelcomeEmail',
  description: 'Send welcome email to new user',
  queue: 'emails',       // queue name (default: 'default')
  tries: 3,              // max attempts
  backoff: 10,           // seconds between retries
  timeout: 30,           // max execution time (seconds)
  enabled: true,         // can be disabled

  async handle(payload: { email: string; name: string }) {
    console.log(`Sending to ${payload.email}`)
    // Do work here
    return { sent: true }
  }
})
```

## Job Configuration Options

```typescript
{
  name: string               // job identifier
  description?: string       // human-readable description
  queue?: string             // queue name (default: 'default')
  tries?: number             // max retry attempts
  backoff?: number           // seconds between retries
  backoffConfig?: {          // advanced backoff
    strategy: 'fixed' | 'exponential' | 'linear'
    initialDelay: number
    factor: number
    maxDelay: number
    jitter?: { enabled: boolean, factor: number }
  }
  timeout?: number           // max seconds per attempt
  rate?: string              // cron schedule (e.g., Every.Hour)
  enabled?: boolean          // enable/disable job
  handle: (payload?) => any  // job logic
}
```

## Dispatching Jobs

```typescript
// Simple dispatch
await SendWelcomeEmail.dispatch({ email: 'user@example.com', name: 'John' })

// Conditional dispatch
await SendWelcomeEmail.dispatchIf(isNewUser, { email, name })
await SendWelcomeEmail.dispatchUnless(isExistingUser, { email, name })

// Delayed dispatch (60 second delay)
await SendWelcomeEmail.dispatchAfter(60, { email, name })

// Immediate execution (bypasses queue)
await SendWelcomeEmail.dispatchNow({ email, name })
```

## Fluent Job Builder

```typescript
import { job } from '@stacksjs/queue'

await job('SendWelcomeEmail', { email, name })
  .onQueue('emails')
  .delay(60)
  .tries(5)
  .timeout(30)
  .backoff([10, 30, 60])
  .dispatch()
```

## Scheduled Jobs

Use the `rate` property for automatic scheduling:

```typescript
import { Every } from '@stacksjs/enums'

export default new Job({
  name: 'CleanupExpiredTokens',
  rate: Every.Hour,          // runs every hour
  // rate: Every.Day,        // runs daily
  // rate: '*/5 * * * *',   // custom cron: every 5 minutes

  handle() {
    // cleanup logic
  }
})
```

Register in `app/Scheduler.ts`:
```typescript
import { schedule } from '@stacksjs/scheduler'

export default function() {
  schedule.job('CleanupExpiredTokens').hourly().setTimeZone('America/New_York')
}
```

## CLI Commands
```bash
buddy make:job [name]       # scaffold a new job
buddy queue                  # queue management
```

## Gotchas
- Jobs must export `default new Job({...})` — not a plain object
- The `handle()` method receives the payload passed to `dispatch()`
- `dispatchNow()` runs immediately in the current process — no queue involved
- Default queue driver is `sync` — jobs run immediately unless changed to `database` or `redis`
- Jobs with `rate` are auto-discovered by the scheduler
- Backoff array `[10, 30, 60]` means: retry after 10s, then 30s, then 60s
- Jobs should be idempotent — safe to retry on failure
- For queue workers, batching, events, and testing, see the `stacks-queue` skill
