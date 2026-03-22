---
name: stacks-queue
description: Use when working with job queues in a Stacks application — creating jobs, dispatching, workers, batches, failed jobs, queue events, health checks, testing, Redis/database/sync drivers, rate limiting, or scheduled jobs. Covers @stacksjs/queue, config/queue.ts, and app/Jobs/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Queue System

## Key Paths
- Queue package: `storage/framework/core/queue/src/`
- Configuration: `config/queue.ts`
- Application jobs: `app/Jobs/`
- Job model: `storage/framework/models/Job.ts`
- Failed job model: `storage/framework/models/FailedJob.ts`

## Source Files
```
queue/src/
├── action.ts          # Job class with dispatch/dispatchIf/dispatchAfter/dispatchNow
├── job.ts             # JobBuilder fluent API + job() helper + jobBatch() + runJob()
├── discovery.ts       # Job auto-discovery from app/Jobs/ via Bun.Glob
├── scheduler.ts       # Cron-based job scheduling with overlap prevention
├── worker.ts          # Queue worker (database polling & Redis processing)
├── batch.ts           # Job batching (PendingBatch, DispatchedBatch, Batch)
├── events.ts          # QueueEvents emitter, QueueMetrics, WorkerTracker
├── health.ts          # Queue health checks (checkQueueHealth, HTTP handler)
├── notifications.ts   # Failed job notifications (email/slack/discord/webhook)
├── testing.ts         # FakeQueue, QueueTester, runJob, expectJobToFail
├── utils.ts           # storeJob helper
├── drivers/redis.ts   # RedisQueue (bun-queue wrapper), StacksQueueManager
└── index.ts           # Re-exports everything
```

## Job Class (action.ts)

```typescript
export class Job {
  name: string
  description: string
  action?: string | Function  // action name or function
  handle?: Function           // direct handler function
  queue?: string              // queue name (default: 'default')
  rate?: string               // cron expression for scheduling
  tries?: number              // max retry attempts
  timeout?: number            // timeout in seconds
  backoff?: number | number[] // backoff delay(s) in seconds
  backoffConfig?: { strategy, initialDelay, factor, maxDelay, jitter }
  enabled?: boolean

  async dispatch(payload?): Promise<void>
  async dispatchIf(condition: boolean, payload?): Promise<void>
  async dispatchUnless(condition: boolean, payload?): Promise<void>
  async dispatchAfter(delaySeconds: number, payload?): Promise<void>
  async dispatchNow(payload?): Promise<void>  // bypasses queue, runs immediately
}
```

### Dispatch Routing
1. Checks `isFaked()` -- if testing, dispatches to FakeQueue
2. `sync` driver: calls `dispatchNow()` (immediate execution)
3. `redis` driver: creates `RedisQueue`, calls `queue.add()` with bun-queue options
4. `database` driver: inserts into `jobs` table with JSON payload
5. Fallback: `dispatchNow()`

### dispatchNow() Execution Order
1. If `handle` is a function: `await this.handle(payload)`
2. If `action` is a string: `await runAction(this.action)` via `@stacksjs/actions`
3. If `action` is a function: `await this.action()`
4. Otherwise: throws error

## JobBuilder Fluent API (job.ts)

```typescript
import { job } from '@stacksjs/queue'

await job('SendWelcomeEmail', { email, name })
  .onQueue('emails')
  .delay(60)           // seconds
  .tries(5)
  .timeout(30)         // seconds
  .backoff([10, 30, 60])
  .withContext({ userId })
  .dispatch()

// Conditional dispatch
await job('ProcessOrder', data).dispatchIf(isValid)
await job('ProcessOrder', data).dispatchUnless(isDuplicate)

// Immediate execution
await job('SendNotification', data).dispatchNow()
```

The `job()` helper loads job modules from `app/Jobs/{name}.ts` via `runJob()`.

### runJob(name, options)
Dynamically imports `app/Jobs/{name}.ts` and executes:
1. `jobConfig.handle(payload)` if handle is a function
2. `runAction(jobConfig.action)` if action is a string
3. `jobConfig.action()` if action is a function
4. `jobConfig(payload, context)` if default export is a function

### jobBatch() Helper
```typescript
import { jobBatch } from '@stacksjs/queue'
const batch = await jobBatch([SendEmail, ProcessOrder])
  .name('Onboard User')
  .allowFailures()
  .then(async (b) => console.log('All done!'))
  .dispatch()
```

## Job Batching (batch.ts)

### PendingBatch (not yet dispatched)
```typescript
const batch = Batch.create([
  { job: SendEmail, payload: { to: 'a@b.com' } },
  { job: ProcessImage, payload: { id: 1 } },
])
  .name('welcome-batch')
  .onQueue('default')
  .allowFailures()           // continue processing on failure
  .then(async (batch) => {}) // all succeeded (or allowFailures + all done)
  .catch(async (batch, error) => {}) // first failure
  .finally(async (batch) => {})      // always runs
  .progress(async (batch) => {})     // each job completion

const dispatched = await batch.dispatch()
```

### DispatchedBatch (inspectable)
```typescript
const b = await Batch.find(batchId)  // returns DispatchedBatch | null
await b.progress()        // 0-100 percentage
await b.pendingJobs()     // count
await b.failedJobs()      // count
await b.completedJobs()   // total - pending
await b.failedJobIds()    // string[]
await b.finished()        // boolean (finished_at !== null)
await b.cancelled()       // boolean
await b.hasFailures()     // boolean
await b.cancel()          // prevents remaining jobs, fires finally callbacks
await b.add([moreJobs])   // add jobs to running batch
await b.delete()          // remove batch record + callbacks
await b.fresh()           // get fresh BatchRecord from storage
```

### Batch Static Methods
```typescript
Batch.create(jobs): PendingBatch
await Batch.find(id): DispatchedBatch | null
await Batch.all(): DispatchedBatch[]
await Batch.prune(olderThanHours = 24): number  // delete finished batches
```

### Batch Storage
- **Database**: `job_batches` table with columns: `id`, `name`, `total_jobs`, `pending_jobs`, `failed_jobs`, `failed_job_ids` (JSON), `options` (JSON), `cancelled_at`, `created_at`, `finished_at`
- **Redis**: hash at `stacks:batch:{id}`, set index at `stacks:batches`
- Callbacks stored in in-memory `Map` (not serializable -- only work in dispatching process)

### Batch Lifecycle
- On job completion: decrements `pending_jobs`, fires progress callbacks. When `pending_jobs === 0`: fires `then` + `finally` callbacks, emits `batch:completed`
- On job failure: increments `failed_jobs`, appends to `failed_job_ids`. If `allowFailures` is false: cancels batch immediately. Fires `catch` callbacks, emits `batch:failed`
- Worker checks `_batchId` in payload to skip cancelled batch jobs

## Job Discovery (discovery.ts)

```typescript
const jobs = await discoverJobs()         // scans app/Jobs/**/*.{ts,js} via Bun.Glob
const job = getJob('SendWelcomeEmail')    // by name from registry
const scheduled = getScheduledJobs()      // jobs with rate/schedule
const all = getAllJobs()
await executeJob('SendWelcomeEmail', payload)  // execute by name
```

Skips `.test.`, `.spec.`, and `index` files. Supports both class-based (has `handle` on prototype) and function-based (object with `handle` method) jobs.

### JobRegistry
Global singleton `jobRegistry`:
- `register(job)`, `get(name)`, `all()`, `byQueue(queue)`, `scheduled()`, `has(name)`, `clear()`

### BackoffConfig
```typescript
interface BackoffConfig {
  strategy?: 'fixed' | 'exponential' | 'linear'
  initialDelay?: number
  factor?: number
  maxDelay?: number
  jitter?: { enabled?: boolean, factor?: number, minDelay?: number, maxDelay?: number }
}
```

## Job Scheduler (scheduler.ts)

Cron-based scheduling with 1-minute check interval.

```typescript
await startScheduler({ checkInterval: 60000, timezone: 'UTC', preventOverlapping: true })
await stopScheduler()
isSchedulerRunning()
getSchedulerStatus()  // { isRunning, jobCount, jobs: [{ name, schedule, lastRun, nextRun, isRunning }] }
getRegisteredJobs()   // Map<string, ScheduledJobState>
await triggerJob('SendReport')  // manually trigger a scheduled job
```

### Cron Support
- Standard 5-part cron: `minute hour day month dayOfWeek`
- 6-part cron (with seconds): seconds are stripped, runs at minute granularity
- Predefined: `@yearly`, `@monthly`, `@weekly`, `@daily`, `@hourly`, `@midnight`
- Every expressions: `Every.minute`, `Every.fiveMinutes`, `Every.hour`, `Every.day`, etc.
- Supports lists (`1,2,3`), ranges (`1-5`), steps (`*/5`, `1-5/2`), wildcards (`*`)

### Overlap Prevention
- Global `preventOverlapping: true` (default) skips if job is still running
- Per-job `withoutOverlapping: true` on job config

## Queue Worker (worker.ts)

```typescript
await startProcessor('default', { concurrency: 5 })  // start worker
await stopProcessor()                    // graceful shutdown
await executeFailedJobs()                // requeue all failed jobs
await retryFailedJob(id)                 // requeue specific failed job
getActiveJobCount()                      // currently processing count
isWorkerRunning()                        // boolean
```

### Database Worker Details
- Polls `jobs` table every **1 second** (`sleep(1000)`)
- Refreshes queue list every **10 seconds** via `getAllQueues()` (SELECT DISTINCT queue FROM jobs)
- **Atomic claim**: SELECT pending job + UPDATE with CAS pattern (`WHERE reserved_at IS NULL`)
  - Increments `attempts`, sets `reserved_at` to current timestamp
  - If `numUpdatedRows === 0`, another worker claimed it -- tries next
- On success: DELETE from `jobs`, emit `job:completed`
- On failure: compare `attempts` vs `maxAttempts` (from payload `options.tries`, default 1)
  - **Exceeded**: move to `failed_jobs` table (uuid, connection, queue, payload, exception, failed_at), emit `job:failed`
  - **Retrying**: release job by setting `reserved_at = null`, `available_at = now + backoff`, emit `job:retrying`
- Backoff: uses `options.backoff` from payload -- array (indexed by attempt), number (fixed), or 30s default
- Worker ID: `worker-{pid}-{timestamp}`
- Handles `SIGINT` / `SIGTERM` for graceful shutdown

### Redis Worker Details
- Uses `RedisQueue.process(concurrency, handler)` from bun-queue
- Handler receives `BunJob` objects
- **Throws on failure** for bun-queue's built-in retry handling
- Keep-alive loop: polls `sleep(1000)` until `workerRunning === false`
- Closes queue on shutdown

### Job Payload Format (database)
```json
{
  "jobName": "SendWelcomeEmail",
  "payload": { "email": "user@example.com" },
  "options": { "queue": "emails", "tries": 3, "timeout": 30, "backoff": [10, 30, 60] }
}
```

## Queue Events (events.ts)

### QueueEvents Class
Custom event emitter (not mitt-based) with `Map<QueueEventType, Set<Handler>>` + wildcard Set.

```typescript
const events = getQueueEvents()  // global singleton
const unsub = events.on('job:failed', handler)
const unsub2 = events.onAny((event, payload) => { ... })
events.once('job:completed', handler)
await events.emit('job:completed', payload)
events.off('job:completed')       // remove all handlers for event
events.removeAllListeners()
```

### Convenience Functions
```typescript
const unsub = onQueueEvent('job:failed', (payload) => { ... })
const unsub2 = onQueueEvent('*', (event, payload) => { ... })
await emitQueueEvent('job:completed', { jobId, result, duration })
```

### Event Types
`'job:added'` | `'job:processing'` | `'job:completed'` | `'job:failed'` | `'job:retrying'` | `'job:stalled'` | `'job:progress'` | `'queue:paused'` | `'queue:resumed'` | `'queue:error'` | `'worker:started'` | `'worker:stopped'` | `'batch:added'` | `'batch:completed'` | `'batch:failed'`

### QueueEventPayload
```typescript
interface QueueEventPayload {
  jobId?: string, queueName?: string, jobName?: string, data?: any,
  result?: any, error?: Error, progress?: number, timestamp: number,
  attemptsMade?: number, duration?: number
}
```

### Event-Aware Wrapper
```typescript
const wrappedHandler = withEvents('emails', originalHandler)
// Automatically emits job:processing, job:completed, job:failed
```

### OnQueueEvent Decorator
```typescript
class MyHandler {
  @OnQueueEvent('job:failed')
  handleFailed(payload: QueueEventPayload) { ... }
}
```

### QueueMetrics
```typescript
const metrics = getGlobalMetrics()  // global singleton
metrics.getThroughputPerMinute()    // completions in last 60 seconds
metrics.getAverageProcessingTime()  // avg duration in last 60 seconds
metrics.getMetrics()  // { counts: {added,completed,failed,processing}, averageDuration, recentErrors, throughputPerMinute }
metrics.reset()
metrics.stop()  // unsubscribe from events
```
Tracks last 1000 completions and last 100 errors in sliding windows.

### WorkerTracker
```typescript
const tracker = getWorkerTracker()  // global singleton (not lazy)
tracker.register(id, queue)
tracker.markActive(id) / tracker.markIdle(id)
tracker.recordCompletion(id) / tracker.recordFailure(id)
tracker.unregister(id)  // marks as 'stopped'
tracker.getAll(): TrackedWorker[]
tracker.clear()
```

```typescript
interface TrackedWorker {
  id: string, status: 'active' | 'idle' | 'stopped', queue: string,
  processedCount: number, failedCount: number,
  lastActivityAt: string, startedAt: string
}
```

## Queue Health (health.ts)

```typescript
const result = await checkQueueHealth({
  maxPendingWarning: 1000,    maxPendingCritical: 5000,
  maxFailedWarning: 10,       maxFailedCritical: 100,
  maxJobAgeWarning: 3600,     maxJobAgeCritical: 86400,    // seconds
  maxErrorRateWarning: 0.1,   maxErrorRateCritical: 0.5,
  queues?: ['default', 'emails']  // filter to specific queues
})
// result: { status: 'healthy'|'degraded'|'unhealthy', queues, workers, metrics, alerts }
```

- Queries `jobs` and `failed_jobs` tables directly
- Groups by queue name, calculates pending/processing/delayed/failed counts
- Oldest job age calculated from `created_at`
- Error rate = totalFailed / totalJobs
- Worker statuses from `getWorkerTracker().getAll()`
- Metrics from `getGlobalMetrics()`
- Returns real `TrackedWorker` data even if DB query fails

```typescript
const healthy = await isQueueHealthy()  // returns boolean
const handler = createHealthCheckHandler()  // HTTP handler (200/207/503)
```

## Failed Job Notifications (notifications.ts)

```typescript
configureFailedJobNotifications({
  channels: ['email', 'slack', 'discord', 'webhook', 'log'],
  email: { to: ['admin@example.com'], from?: string, subject?: string },
  slack: { webhookUrl: '...', channel?: '#alerts', username?: 'Queue Monitor', iconEmoji?: ':warning:' },
  discord: { webhookUrl: '...', username?: 'Queue Monitor', avatarUrl?: string },
  webhook: { url: '...', headers?: Record<string,string>, secret?: 'hmac-key' },
  rateLimit: 100,        // max per hour
  batch: true,           // batch notifications
  batchInterval: 60000,  // ms (default 60s)
  filter: (job) => job.queue !== 'low-priority',
})
```

- **Email**: uses `@stacksjs/email` (`mail.send()`) with HTML table format
- **Slack**: sends Block Kit payload (header + sections, max 10 jobs per message)
- **Discord**: sends embeds (red color, max 10 per message)
- **Webhook**: JSON payload with HMAC SHA-256 signature in `X-Signature` header (via `crypto.subtle`)
- **Log**: writes to application log via `@stacksjs/logging`
- Rate limiter resets every **3,600,000ms** (1 hour)
- Batch: accumulates jobs, flushes on interval via `setTimeout`

```typescript
const notifier = getFailedJobNotifier()  // global singleton
await notifyJobFailed(jobInfo)           // uses global notifier
```

## Queue Testing (testing.ts)

```typescript
import { fake, restore, runJob as runTestJob, expectJobToFail } from '@stacksjs/queue'

const fakeQueue = fake()  // sets global FakeQueue singleton

// Dispatch goes to fake queue (not real driver)
await job('SendEmail', data).dispatch()
await SendWelcomeEmail.dispatch(data)

// Assertions (throw on failure)
fakeQueue.assertDispatched('SendEmail')
fakeQueue.assertDispatched('SendEmail', (j) => j.data.to === 'test@example.com')
fakeQueue.assertNotDispatched('ProcessPayment')
fakeQueue.assertDispatchedTimes('SendEmail', 3)
fakeQueue.assertNothingDispatched()
fakeQueue.assertPushed('Reminder')
fakeQueue.assertPushedWithDelay('Reminder', 3600)
fakeQueue.assertPushedOn('emails', 'SendEmail')

// Run job synchronously for testing
const result = await runTestJob({ handle: async (data) => 'ok' }, testData)

// Assert job failure
const error = await expectJobToFail(BadJob, data, /expected error/)
// or: await expectJobToFail(BadJob, data, 'substring match')

restore()  // clears FakeQueue singleton, re-enables real queue
```

### QueueTester Class
```typescript
const tester = createQueueTester()  // auto-calls fake()
tester.dispatch('Job', data).assertDispatched('Job').reset()
tester.cleanup()  // calls restore()
```

### FakeQueue Internals
- `dispatchedJobs[]` -- recorded dispatches
- `pushedJobs[]` -- recorded delayed pushes
- `processedJobs[]` -- simulated processing results
- `failedJobs[]` -- simulated failures

## Redis Driver (drivers/redis.ts)

Wraps `bun-queue`'s `Queue` class with Stacks-compatible API.

```typescript
const queue = new RedisQueue<T>('emails', redisConfig)
await queue.add(data, options)          // delay/attempts/priority/timeout/backoff
queue.process(concurrency, handler)     // start processing (one-time call)
await queue.getJob(jobId)
await queue.getJobs('waiting' | 'active' | 'completed' | 'failed' | 'delayed')
await queue.getJobCounts()              // { waiting, active, completed, failed, delayed }
await queue.removeJob(jobId)
await queue.pause() / queue.resume()
await queue.empty() / queue.close()
await queue.getMetrics()
await queue.ping()                      // health check
await queue.scheduleCron({ cron, data, tz?, name? })
await queue.unscheduleCron(jobId)
await queue.getDeadLetterJobs()
await queue.republishDeadLetterJob(jobId)
await queue.clearDeadLetterQueue()
await queue.bulkRemove(jobIds): number
await queue.getClusterInfo()
queue.isLeader(): boolean               // for horizontal scaling
queue.getQueue(): BunQueue<T>           // underlying bun-queue instance
queue.on(event, handler)                // subscribe to bun-queue events
```

### StacksQueueManager
```typescript
const manager = new StacksQueueManager(connectionConfigs)
manager.queue('emails')     // get or create RedisQueue by name
manager.setDefaultConnection('high-priority')
await manager.closeAll()
```

### RedisQueue Events
`jobAdded`, `jobCompleted`, `jobFailed`, `jobProgress`, `jobActive`, `jobStalled`, `jobDelayed`, `ready`, `error`

### bun-queue Re-exports
`batch`, `chain`, `dispatch`, `dispatchAfter`, `dispatchSync`, `getQueueManager`, `setQueueManager`, `QueueManager`

## Creating a Job

```typescript
// app/Jobs/SendWelcomeEmail.ts
import { Job } from '@stacksjs/queue'

export default new Job({
  name: 'SendWelcomeEmail',
  description: 'Send welcome email to new user',
  queue: 'emails',
  tries: 3,
  backoff: [10, 30, 60],
  timeout: 30,

  async handle(payload: { email: string; name: string }) {
    console.log(`Sending to ${payload.email}`)
    return { sent: true }
  }
})
```

### Dispatching
```typescript
import SendWelcomeEmail from '~/app/Jobs/SendWelcomeEmail'

await SendWelcomeEmail.dispatch({ email, name })
await SendWelcomeEmail.dispatchIf(isNewUser, { email, name })
await SendWelcomeEmail.dispatchUnless(isDuplicate, { email, name })
await SendWelcomeEmail.dispatchAfter(60, { email, name })  // 60s delay
await SendWelcomeEmail.dispatchNow({ email, name })        // bypass queue
```

## config/queue.ts
```typescript
{
  default: 'sync',  // 'sync' | 'database' | 'redis' | 'sqs' | 'memory'
  connections: {
    sync: { driver: 'sync' },
    database: { driver: 'database', table: 'jobs', queue: 'default', retryAfter: 90 },
    redis: {
      driver: 'redis',
      redis: { url, host: 'localhost', port: 6379, password, db: 0 },
      prefix: 'stacks:queue',
      concurrency: 5,
      logLevel: 'info',
      distributedLock: true,
      stalledJobCheckInterval: 30000,
      maxStalledJobRetries: 3,
      limiter: { max: 100, duration: 1000 },  // if QUEUE_RATE_LIMIT_ENABLED
      metrics: { enabled: false, collectInterval: 10000 },
      defaultDeadLetterOptions: { enabled: true, maxRetries: 3, queueSuffix: '-dead-letter' },
      horizontalScaling: { enabled, maxWorkersPerInstance, jobsPerWorker, leaderElection: { heartbeatInterval: 5000, leaderTimeout: 15000 } },
      defaultJobOptions: { attempts: 3, removeOnComplete: true, removeOnFail: false, backoff: { type: 'exponential', delay: 1000 } }
    },
    sqs: { driver: 'sqs', key, secret, prefix, suffix, queue: 'default', region: 'us-east-1' },
    memory: { driver: 'memory', maxSize: 10000 }
  },
  failed: { driver: 'database', table: 'failed_jobs', prefix: 'stacks:failed' },
  batching: { driver: 'redis', prefix: 'stacks:batches' },
  worker: { concurrency: 5, shutdownTimeout: 30000 }
}
```

## Gotchas
- Default driver is `sync` -- jobs run immediately in the same process (no background processing)
- Database driver polls every 1 second, refreshes queue list every 10 seconds
- Atomic claim prevents race conditions: SELECT + UPDATE WHERE reserved_at IS NULL (CAS pattern)
- Backoff supports: fixed number, array of delays (indexed by attempt), or BackoffConfig object with strategy
- Job batches store callbacks in-memory (`Map`) -- callbacks only work in the dispatching process, not across restarts
- Redis driver wraps `bun-queue` -- uses `bun-queue` Queue class for actual queue management
- Failed job notifications use HMAC SHA-256 (via Web Crypto API) for webhook signatures
- Health check queries `jobs` and `failed_jobs` tables directly for real counts
- Rate limiter for notifications resets hourly (3,600,000ms)
- Testing: `fake()` sets global singleton, `restore()` clears it -- affects ALL code in the process
- Queue events use a custom `QueueEvents` class (Map + Set), not mitt
- Metrics track last 1000 completions and 100 errors in sliding windows
- Worker ID format: `worker-{pid}-{timestamp}`
- The `QUEUE_DRIVER` env var controls which driver is used (reads via `@stacksjs/env`)
- `dispatchAfter()` on sync driver uses `setTimeout` to delay then executes immediately
- Failed jobs table: `uuid`, `connection` ('database'), `queue`, `payload`, `exception` (stack trace), `failed_at`
- `process.on('unhandledRejection')` and `process.on('uncaughtException')` are set at module load in worker.ts
