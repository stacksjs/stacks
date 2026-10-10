---
name: stacks-jobs
description: Use when creating background job classes in app/Jobs/ - job structure, the handle method, job configuration (queue, tries, backoff, timeout, rate), dispatching patterns (dispatch, dispatchIf, dispatchAfter, dispatchNow), or the Every schedule constants. For the queue system internals (workers, batching, events, drivers, testing), see stacks-queue. Covers app/Jobs, the native Job class and typed by-name dispatch.
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
  backoff?: number | number[] // seconds between retries
  backoffConfig?: {          // advanced backoff
    strategy: 'fixed' | 'exponential' | 'linear'
    initialDelay: number
    factor: number
    maxDelay: number
    jitter?: { enabled: boolean, factor: number }
  }
  timeout?: number           // max seconds per attempt
  rate?: string              // schedule, e.g. Every.Hour; use an explicit schedule for custom policy
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

// Checked against `app/Jobs/` AND the framework defaults - the same three
// directories `resolveJobFile` searches, so the jobs Stacks ships are
// dispatchable and schedulable by name too.
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
import { Every } from '@stacksjs/types'

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
- Prefer `default new Job({...})` for dispatch methods. Discovery also supports default objects with handle and class exports with a handle method
- The `handle()` method receives the payload passed to `dispatch()`
- `dispatchNow()` runs immediately in the current process - no queue involved
- Default queue driver is `sync` - jobs run immediately unless changed to `database` or `redis`
- Jobs with `rate` are auto-discovered by the scheduler
- Backoff array `[10, 30, 60]` means: retry after 10s, then 30s, then 60s
- Jobs should be idempotent - safe to retry on failure
- For queue workers, batching, events, and testing, see the `stacks-queue` skill


## Durable dispatch and context

The fluent `job(name, payload)` builder checks job names and payloads against
the generated registry. `.withContext(context)` passes a second argument to
the handler; JSON serialization applies to both payload and context on a durable
driver. `.withIdempotencyKey(key)` claims a persistent dispatch key.
Inside `db.transaction()` dispatch defers until commit by default;
`.afterCommit()` states that intent, and `.withoutCommit()` explicitly opts
out. Outside a transaction, afterCommit warns and dispatches immediately.
See `stacks-queue` for the complete envelope and batch lifecycle.

Scheduling a named job through `schedule.job()` runs it in the scheduler by
default. Chain `.onQueue(name)` to dispatch it through the configured queue;
durable drivers require a worker. The explicit Scheduler entry wins over a
job's rate in runScheduler, so keep the policy in that explicit registration.
Source: `core/queue/src/job.ts`,
`action.ts`, `discovery.ts` and `core/scheduler/src/schedule.ts`.
Tests: `core/queue/tests/job-context.test.ts`,
`job-declared-retries.test.ts` and `job-payload.test-d.ts`.
