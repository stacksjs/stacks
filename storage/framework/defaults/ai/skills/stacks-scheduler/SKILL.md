---
name: stacks-scheduler
description: Use when scheduling tasks in a Stacks application - defining scheduled tasks, cron-like scheduling, or task automation. Covers @stacksjs/scheduler, @stacksjs/cron, and app/Scheduler.ts.
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
├── run.ts         # runScheduler() - loads Jobs/*.ts + app/Scheduler.ts
└── types.ts       # Timezone union, ScheduledJob, UntimedSchedule, TimedSchedule, BaseSchedule

cron/src/
├── index.ts       # parse(), register(), remove() - delegates to Bun.cron or parseCron
├── parser.ts      # parseCron() - native 5-field cron parser with POSIX OR logic
├── types.ts       # CatchCallbackFn, ProtectCallbackFn, IntRange
└── bun-cron.d.ts  # Bun.cron type declarations

queue/src/
└── scheduler.ts   # startScheduler(), stopScheduler(), getSchedulerStatus() - queue-level scheduler
```

## Schedule Class (schedule.ts)

The `Schedule` class is the core scheduling API. The lowercase `schedule` export is an alias for the class itself (used as a static-method namespace).

```typescript
import { schedule } from '@stacksjs/scheduler'

// Static factory methods - each returns UntimedSchedule
schedule.job(name: JobName): UntimedSchedule     // Runs a job by name via runJob()
schedule.action(name: string): UntimedSchedule    // Runs an action by name via runAction()
schedule.command(cmd: string): UntimedSchedule    // Runs a shell command via runCommand()

// Graceful shutdown - stops all tracked jobs
schedule.gracefulShutdown(): Promise<void>
```

### Constructor

```typescript
new Schedule(task: () => void)
```

The constructor accepts a task function and auto-starts through queueMicrotask
after the synchronous chain completes. Keep configuration in that same chain.

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
withProtection(callback?: (job: ScheduledJob) => void): this  // skip a tick while the last run is still going (this process); callback hears each skip
withName(name: string): this
withContext(context: any): this          // passed to the task on each run: the callback's argument, or the job's `context`
withInterval(seconds: number): this      // at least this many seconds between runs; sooner ticks are skipped
between(startAt: string | Date, stopAt: string | Date): this  // only run inside the window; stops for good once it closes
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
- **Timezone-aware**: passes the configured IANA timezone to the cron parser through nextCronTime(). The returned Date is a UTC instant; local DST windows can still skip or repeat a scheduled local hour. Use idempotency when a task must have one effect in that window.
- **maxRuns**: Tracks `runCount` and calls `stop()` when the limit is reached.
- **Error handling**: If `options.catch` is set, errors are caught and passed to the handler instead of propagating.


### Overlap Prevention and Locking

`withoutOverlapping()` uses a local exclusive file lock, with a stale-lock
expiry. `onOneServer()` also requests a dedicated PostgreSQL/MySQL advisory
lock through `scheduler-lock.ts`, alongside the local file lock. DB locks
release when their connection disconnects. SQLite/Turso use only the host's file
lock, and a DB-unavailable fallback warns rather than promising cluster
coordination. Use the same task name on all participating hosts. Names are
sanitized and hashed for lock paths.

### Background Execution

When `runInBackground()` is called, each run starts `buddy schedule:run-one <name> --in-process` as a detached child in the project directory. That process registers the app's schedule the way `schedule:run` does and runs the one task there, taking any `withoutOverlapping()` / `onOneServer()` lock itself. The child is `unref()`'d so it does not keep the parent alive, and a non-zero exit is logged under the task's name. The task needs a name (`schedule.job/action/command` have one; a callback needs `.withName()`), or registration fails.

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

parse(expression: string, relativeDate?: Date | number, options?: { tz?: string }): Date | null
```

- Uses `Bun.cron.parse()` when available and no timezone is supplied. With tz, or without native support, it uses the built-in parseCron implementation.
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

1. Globs `app/Jobs/*.ts` and loads app/Scheduler.ts first.
2. Preserves each job filename's case as its schedulable name.
3. Skips a rate when the file or declared job name already has an explicit schedule.
4. Schedules remaining rate strings through schedule.job(name).cron(rate), including supported sub-minute intervals.
5. Logs individual import/rate failures and returns Ok on successful scheduler registration.

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
- The Schedule constructor starts through a microtask after the synchronous chain; asynchronous configuration arrives too late
- Default timezone is `'America/Los_Angeles'`, not UTC
- `everySecond()` uses `setInterval`, not cron -- it sets `intervalMs = 1000` and bypasses the cron parser entirely
- The `Queue` class in `schedule.ts` is just an empty subclass of `Schedule` (`export class Queue extends Schedule {}`) -- it adds no functionality
- `withoutOverlapping()` provides local file locking. `onOneServer()` adds PostgreSQL/MySQL advisory coordination where available
- SQLite/Turso and DB-unavailable fallback cannot provide cluster-wide scheduler coordination; read scheduler-lock.ts and its warning
- `runInBackground()` runs the task by name in a `buddy schedule:run-one <name> --in-process` child, so the task must be registered under that name by the app's scheduler file, and an unnamed callback is refused
- There are TWO scheduler systems: `@stacksjs/scheduler` (fluent API in `schedule.ts`) and the queue-level scheduler in `@stacksjs/queue` (`queue/src/scheduler.ts`). The former runs tasks in-process; the latter dispatches to the queue
- `sendAt()` throws on invalid cron expressions (it delegates to `parse()` which throws)
- `timeout()` returns `-1` (not `0` or `Infinity`) when there is no upcoming run
- The `Every.Second/FiveSeconds/TenSeconds/ThirtySeconds` enum values use 6-field cron (with seconds), but the `@stacksjs/cron` parser only supports 5-field expressions -- the queue scheduler's `parseScheduleString()` maps sub-minute intervals to `'* * * * *'` (every minute)
- `runScheduler()` silently catches and logs errors when individual job files fail to import -- a broken job file does not prevent other jobs from being scheduled
- Named jobs via `withName()` are tracked in a static `Map<string, ScheduledJob>` on the `Schedule` class -- `gracefulShutdown()` iterates and stops all of them
- The cron parser uses POSIX OR logic when both day-of-month and day-of-week are specified (neither `*`) -- this means `0 0 15 * FRI` matches the 15th OR every Friday, not only Fridays that fall on the 15th
- Lock files are written with `{ flag: 'wx' }` for atomic creation, but this is not NFS-safe
- `parse()` returns `null` for impossible patterns (e.g., `0 0 30 2 *` -- Feb 30 never exists) rather than throwing


## Additional native scheduling operations

`cron(expression)` accepts five-field cron and deliberately restricted
six-field forms: all-wildcard intervals in seconds dividing 60, or leading zero
seconds with a five-field schedule. Unsupported specific-second forms throw.
`dailyAt(time)`, `weekdays()` and `onQueue(name)` are native methods.
`sendOutputTo(path)` and `appendOutputTo(path)` capture supported command
output. `runMissed({ since, max? })` performs bounded catch-up; read its
window/overlap behavior before using it for non-idempotent tasks.

`schedule.notification(recipient, payload, channels?, options?)` schedules
native notify fan-out and fails the task if any channel result failed.
Use `.withName()` for a stable operational name. `Schedule.listJobs()`,
`runNow(name, { inProcess? })`, `setEnabled/isEnabled/isScheduled` and
`listLocks()` expose registered process state, not an inventory of every host.
CLI: schedule:list/status/run-one/enable/disable. Read each command's help for
persistence scope and flags; schedule:run starts a long-running scheduler.

Source: `storage/framework/core/scheduler/src/schedule.ts` and
`scheduler-lock.ts`, `core/buddy/src/commands/schedule.ts`. Tests:
`cron-expression.test.ts`, `schedule-options.test.ts`,
`scheduler-lock.test.ts`, `run-missed.test.ts`,
`notification.test.ts` under `core/scheduler/tests/`.
