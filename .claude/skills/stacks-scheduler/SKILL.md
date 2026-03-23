---
name: stacks-scheduler
description: Use when scheduling tasks in a Stacks application — defining scheduled tasks, cron-like scheduling, or task automation. Covers @stacksjs/scheduler, @stacksjs/cron, and app/Scheduler.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Scheduler

The `@stacksjs/scheduler` package provides fluent, chainable task scheduling for Stacks applications. It wraps `@stacksjs/cron` for cron expression parsing and supports scheduling jobs, actions, and shell commands with timezone awareness, overlap prevention, and background execution.

## Key Paths
- Scheduler package: `storage/framework/core/scheduler/src/`
- Cron package: `storage/framework/core/cron/src/`
- Application scheduler: `app/Scheduler.ts`
- CLI command: `storage/framework/core/buddy/src/commands/schedule.ts`
- Run action: `storage/framework/core/actions/src/schedule/run.ts`
- Queue-based scheduler: `storage/framework/core/queue/src/scheduler.ts`
- Job types / `Every` enum: `storage/framework/core/types/src/cron-jobs.ts`
- Lock files: `storage/framework/locks/` (created at runtime)

## Source Files

```
scheduler/src/
├── index.ts       # Re-exports everything from run, schedule, types
├── schedule.ts    # Schedule class, Queue alias, sendAt(), timeout()
├── run.ts         # runScheduler() — loads Jobs/*.ts + app/Scheduler.ts
└── types.ts       # Timezone union, ScheduledJob, UntimedSchedule, TimedSchedule, BaseSchedule

cron/src/
├── index.ts       # parse(), register(), remove() — delegates to Bun.cron or parseCron
├── parser.ts      # parseCron() — native 5-field cron parser with POSIX OR logic
├── types.ts       # CatchCallbackFn, ProtectCallbackFn, IntRange
└── bun-cron.d.ts  # Bun.cron type declarations

queue/src/
└── scheduler.ts   # startScheduler(), stopScheduler(), getSchedulerStatus() — queue-level scheduler
```

## Schedule Class (schedule.ts)

The `Schedule` class is the core scheduling API. The lowercase `schedule` export is an alias for the class itself (used as a static-method namespace).

```typescript
import { schedule } from '@stacksjs/scheduler'

// Static factory methods — each returns UntimedSchedule
schedule.job(name: string): UntimedSchedule      // Runs a job by name via runJob()
schedule.action(name: string): UntimedSchedule    // Runs an action by name via runAction()
schedule.command(cmd: string): UntimedSchedule    // Runs a shell command via runCommand()

// Graceful shutdown — stops all tracked jobs
schedule.gracefulShutdown(): Promise<void>
```

### Constructor

```typescript
new Schedule(task: () => void)
```

The constructor accepts a task function and auto-starts the schedule via `setTimeout(() => this.start(), 0)` after all chained methods have been called in the current tick.

### Timing Methods (returns TimedSchedule)

Each sets an internal cron pattern. Once a timing method is called, the schedule is "timed" and only configuration methods remain available.

| Method                 | Cron Pattern        | Notes                      |
|------------------------|--------------------|-----------------------------|
| `everySecond()`        | `@every_second`    | Uses `setInterval(1000)`, not cron |
| `everyMinute()`        | `* * * * *`        |                             |
| `everyTwoMinutes()`    | `*/2 * * * *`      |                             |
| `everyFiveMinutes()`   | `*/5 * * * *`      |                             |
| `everyTenMinutes()`    | `*/10 * * * *`     |                             |
| `everyThirtyMinutes()` | `*/30 * * * *`     |                             |
| `everyHour()` / `hourly()` | `0 * * * *`    |                             |
| `everyDay()` / `daily()` | `0 0 * * *`      |                             |
| `weekly()`             | `0 0 * * 0`        | Sunday at midnight          |
| `monthly()`            | `0 0 1 * *`        | 1st of month at midnight    |
| `yearly()` / `annually()` | `0 0 1 1 *`    | Jan 1 at midnight           |
| `onDays(days: number[])` | `0 0 * * {days}` | e.g. `onDays([1,3,5])` => `0 0 * * 1,3,5` |
| `at(time: string)`      | `{min} {hr} * * *` | e.g. `at('14:30')` => `30 14 * * *` |

### Configuration Methods (chainable, returns `this`)

```typescript
setTimeZone(timezone: Timezone): this
withErrorHandler(handler: CatchCallbackFn): this
withMaxRuns(runs: number): this
withProtection(callback?: (job: ScheduledJob) => void): this
withName(name: string): this
withContext(context: any): this
withInterval(seconds: number): this
between(startAt: string | Date, stopAt: string | Date): this
withoutOverlapping(expiresAfterMinutes?: number): this
onOneServer(): this
runInBackground(): this
```

### ScheduledJob Interface

```typescript
interface ScheduledJob {
  stop: () => void
  nextRun: () => Date | null
}
```

### Timezone Type

The `Timezone` type is a string union of ~70 IANA timezone identifiers (e.g., `'America/New_York'`, `'Europe/Berlin'`, `'Asia/Tokyo'`, `'UTC'`). Default is `'America/Los_Angeles'`.

### Internal Scheduling Engine

- **Sub-minute** (`everySecond`): Uses `setInterval` with the configured `intervalMs`.
- **Minute+**: Uses `parse()` from `@stacksjs/cron` to compute the next run time, then `setTimeout` to fire at the right moment. When the delay exceeds `2^31-1 ms` (~24.8 days), it chains shorter timeouts.
- **Timezone-aware**: Converts "now" to the configured timezone via `toLocaleString()`, parses the cron pattern from that local time, then computes the real-world delay.
- **maxRuns**: Tracks `runCount` and calls `stop()` when the limit is reached.
- **Error handling**: If `options.catch` is set, errors are caught and passed to the handler instead of propagating.

### Overlap Prevention and Locking

When `withoutOverlapping()` or `onOneServer()` is called:
1. Lock files are created in `storage/framework/locks/{taskName}.lock`
2. The lock directory is created automatically if missing
3. Lock files use exclusive write (`flag: 'wx'`) for atomicity
4. Stale locks expire after `overlapExpiresAfterMinutes` (default: 1440 = 24 hours)
5. Lock age is checked via file `mtime`
6. Locks are released in a `finally` block (or `.finally()` for async tasks)

### Background Execution

When `runInBackground()` is called, the task is spawned as a detached child process via `node:child_process.spawn`. The child is `unref()`'d so it does not keep the parent alive.

## Helper Functions

```typescript
import { sendAt, timeout } from '@stacksjs/scheduler'

// Get the next Date a cron expression will fire
sendAt(cronExpression: string | Date): Date | null
// - String: delegates to parse() from @stacksjs/cron
// - Date: returns the date if it's in the future, null otherwise

// Get milliseconds until the next fire time
timeout(cronExpression: string | Date): number
// Returns -1 if no upcoming run
```

## Cron Parser (@stacksjs/cron)

### parse()

```typescript
import { parse } from '@stacksjs/cron'

parse(expression: string, relativeDate?: Date | number): Date | null
```

- Uses `Bun.cron.parse()` when available (native Bun cron support), otherwise falls back to the built-in `parseCron()` implementation.
- Returns the next matching UTC `Date`, or `null` if no match within ~4 years.
- Throws on invalid expressions (wrong field count, out-of-range values).

### parseCron() (built-in parser)

Supports the standard 5-field format: `minute hour dayOfMonth month dayOfWeek`

**Operators**: `*` (all), `,` (list), `-` (range), `/` (step)
**Named values**: `JAN`-`DEC`, `SUN`-`SAT` (case-insensitive, full names also accepted)
**Nicknames**: `@yearly`, `@annually`, `@monthly`, `@weekly`, `@daily`, `@midnight`, `@hourly`
**POSIX OR logic**: When both dayOfMonth and dayOfWeek are specified (neither is `*`), the expression matches when *either* condition is true.

### OS-Level Cron Registration

```typescript
import { register, remove } from '@stacksjs/cron'

// Register a persistent OS-level cron job (requires Bun.cron native support)
await register(path: string, schedule: string, title: string)

// Remove a registered cron job by title
await remove(title: string)
```

These require Bun's native cron support (crontab on Linux, launchd on macOS, schtasks on Windows). The target script must export a `scheduled(controller)` handler.

## Every Enum (cron-jobs.ts)

The `Every` enum maps human-readable intervals to cron expressions. Used in Job `rate` fields.

```typescript
import { Every } from '@stacksjs/types'

Every.Second         // '* * * * * *'  (6-field, sub-minute)
Every.FiveSeconds    // '*/5 * * * * *'
Every.TenSeconds     // '*/10 * * * * *'
Every.ThirtySeconds  // '*/30 * * * * *'
Every.Minute         // '* * * * *'
Every.TwoMinutes     // '*/2 * * * *'
Every.FiveMinutes    // '*/5 * * * *'
Every.TenMinutes     // '*/10 * * * *'
Every.FifteenMinutes // '*/15 * * * *'
Every.ThirtyMinutes  // '*/30 * * * *'
Every.Hour           // '0 * * * *'
Every.HalfHour       // '0,30 * * * *'
Every.Day            // '0 0 * * *'
Every.Week           // '0 0 * * 0'
Every.Weekday        // '0 0 * * 1-5'
Every.Weekend        // '0 0 * * 0,6'
Every.Month          // '0 0 1 * *'
Every.Year           // '0 0 1 1 *'
```

## runScheduler() (run.ts)

The entry point for starting the scheduler process:

1. Globs `app/Jobs/*.ts` for job files
2. For each job with a `rate` property, maps the rate to a schedule method via `executeJobRate()` (switch on `Every.*` values)
3. Job names are derived from `job.name` or the filename, then `snakeCase()`'d
4. Imports and calls the default export from `app/Scheduler.ts`
5. Returns `Ok<string>` on success

```typescript
import { runScheduler } from '@stacksjs/scheduler'
const result = await runScheduler()
```

## Queue-Level Scheduler (queue/src/scheduler.ts)

A separate, queue-integrated scheduler that discovers jobs and dispatches them to the queue system:

```typescript
import { startScheduler, stopScheduler, getSchedulerStatus, triggerJob } from '@stacksjs/queue'

await startScheduler(config?: Partial<SchedulerConfig>)
await stopScheduler()
getSchedulerStatus(): { isRunning, jobCount, jobs[] }
isSchedulerRunning(): boolean
getRegisteredJobs(): Map<string, ScheduledJobState>
await triggerJob(name: string)  // Manually dispatch a scheduled job
```

### SchedulerConfig

```typescript
interface SchedulerConfig {
  checkInterval: number   // ms between checks (default: 60000)
  timezone?: string
  preventOverlapping: boolean  // default: true
}
```

This scheduler polls on `checkInterval`, uses its own `shouldRunNow()` cron matcher (supports 5- and 6-field expressions), and dispatches jobs to the queue via `storeJob()` and `emitQueueEvent()`.

## app/Scheduler.ts

User-defined scheduled tasks live here. Must export a default function:

```typescript
import { schedule } from '@stacksjs/scheduler'

export default function () {
  schedule.job('Inspire').hourly().setTimeZone('America/Los_Angeles')
  schedule.action('CleanupTempFiles').everyFiveMinutes()
  schedule.command('echo "maintenance"').daily()
}

// Graceful shutdown on SIGINT
process.on('SIGINT', () => {
  schedule.gracefulShutdown().then(() => process.exit(0))
})
```

## CLI Commands

- `buddy schedule:run` -- Runs `Action.ScheduleRun`, which calls `runScheduler()`
  - Options: `-p, --project [project]`, `--verbose`

## Code Examples

### Schedule a job with overlap prevention

```typescript
schedule
  .job('ProcessPayments')
  .everyFiveMinutes()
  .withoutOverlapping(30)          // Lock expires after 30 minutes
  .setTimeZone('America/New_York')
  .withErrorHandler((err) => console.error('Payment processing failed:', err))
```

### Schedule a command with max runs

```typescript
schedule
  .command('bun run cleanup')
  .daily()
  .withMaxRuns(7)                  // Stop after 7 executions
  .withName('weekly-cleanup')
```

### Schedule on specific days

```typescript
schedule
  .action('SendWeeklyReport')
  .onDays([1, 3, 5])              // Mon, Wed, Fri at midnight
  .setTimeZone('Europe/London')
```

### Schedule at a specific time

```typescript
schedule
  .job('DailyDigest')
  .at('09:00')                     // 9 AM daily
  .setTimeZone('Asia/Tokyo')
```

### Query next run time

```typescript
import { sendAt, timeout } from '@stacksjs/scheduler'

const nextRun = sendAt('*/15 * * * *')    // Next 15-min mark
const msUntil = timeout('0 0 * * *')      // ms until next midnight
```

### Job with rate-based scheduling

```typescript
// app/Jobs/CleanupExpiredSessions.ts
import { Every } from '@stacksjs/types'

export default {
  name: 'CleanupExpiredSessions',
  rate: Every.Hour,
  handle: async () => {
    // cleanup logic
  },
}
```

## Gotchas
- The `Schedule` constructor auto-starts via `setTimeout(0)` -- all chained methods must be called synchronously in the same tick, or the schedule starts with incomplete configuration
- Default timezone is `'America/Los_Angeles'`, not UTC
- `everySecond()` uses `setInterval`, not cron -- it sets `intervalMs = 1000` and bypasses the cron parser entirely
- The `Queue` class in `schedule.ts` is just an empty subclass of `Schedule` (`export class Queue extends Schedule {}`) -- it adds no functionality
- `withoutOverlapping()` uses file-based locks in `storage/framework/locks/` -- this only prevents overlap within a single machine, not across a cluster
- `onOneServer()` also uses file-based locks (same as `withoutOverlapping`), so it does not actually coordinate across multiple servers
- `runInBackground()` spawns a detached child process with `spawn(process.execPath, ['-e', ...])` -- the task function is `.toString()`'d and eval'd, so closures over external variables will not work
- There are TWO scheduler systems: `@stacksjs/scheduler` (fluent API in `schedule.ts`) and the queue-level scheduler in `@stacksjs/queue` (`queue/src/scheduler.ts`). The former runs tasks in-process; the latter dispatches to the queue
- `sendAt()` throws on invalid cron expressions (it delegates to `parse()` which throws)
- `timeout()` returns `-1` (not `0` or `Infinity`) when there is no upcoming run
- The `Every.Second/FiveSeconds/TenSeconds/ThirtySeconds` enum values use 6-field cron (with seconds), but the `@stacksjs/cron` parser only supports 5-field expressions -- the queue scheduler's `parseScheduleString()` maps sub-minute intervals to `'* * * * *'` (every minute)
- `runScheduler()` silently catches and logs errors when individual job files fail to import -- a broken job file does not prevent other jobs from being scheduled
- Named jobs via `withName()` are tracked in a static `Map<string, ScheduledJob>` on the `Schedule` class -- `gracefulShutdown()` iterates and stops all of them
- The cron parser uses POSIX OR logic when both day-of-month and day-of-week are specified (neither `*`) -- this means `0 0 15 * FRI` matches the 15th OR every Friday, not only Fridays that fall on the 15th
- Lock files are written with `{ flag: 'wx' }` for atomic creation, but this is not NFS-safe
- `parse()` returns `null` for impossible patterns (e.g., `0 0 30 2 *` -- Feb 30 never exists) rather than throwing
