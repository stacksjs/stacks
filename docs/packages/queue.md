# Queue Package

A powerful job queue system built on bun-queue, providing job dispatching, workers, failed job management, and scheduling capabilities.

## Installation

```bash
bun add @stacksjs/queue
```

## Basic Usage

```typescript
import { dispatch, Job, Queue, Worker } from '@stacksjs/queue'

// Dispatch a job
await dispatch('send-email', { to: 'user@example.com', subject: 'Welcome' })

// Or use file-based jobs
await job('SendWelcomeEmail').dispatch({ userId: 1 })
```

## Defining Jobs

### File-Based Jobs

Create jobs in `app/Jobs/`:

```typescript
// app/Jobs/SendWelcomeEmail.ts
import { Job } from '@stacksjs/queue'

export default class SendWelcomeEmail extends Job {
  // Job configuration
  queue = 'emails'
  tries = 3
  backoff = 60 // seconds
  timeout = 120 // seconds

  async handle(data: { userId: number }) {
    const user = await User.find(data.userId)
    await sendEmail({
      to: user.email,
      template: 'welcome',
      data: { name: user.name }
    })
  }

  async failed(error: Error, data: any) {
    // Handle failure after all retries exhausted
    await logFailure('SendWelcomeEmail', error, data)
  }
}
```

### Inline Jobs

```typescript
import { dispatch, JobBase } from '@stacksjs/queue'

// Simple inline job
await dispatch('process-order', {
  orderId: 123,
  handler: async (data) => {
    await processOrder(data.orderId)
  }
})

// Using JobBase
class ProcessPayment extends JobBase {
  queue = 'payments'
  tries = 5

  async handle(data: { paymentId: number }) {
    await processPayment(data.paymentId)
  }
}

await dispatch(new ProcessPayment(), { paymentId: 456 })
```

## Dispatching Jobs

### Basic Dispatch

```typescript
import { dispatch, dispatchSync } from '@stacksjs/queue'

// Async dispatch (queued)
await dispatch('job-name', { key: 'value' })

// Sync dispatch (immediate)
await dispatchSync('job-name', { key: 'value' })
```

### Conditional Dispatch

```typescript
import { dispatchIf, dispatchUnless } from '@stacksjs/queue'

// Dispatch only if condition is true
await dispatchIf(user.isActive, 'send-notification', { userId: user.id })

// Dispatch unless condition is true
await dispatchUnless(user.optedOut, 'send-marketing', { userId: user.id })
```

### Delayed Dispatch

```typescript
import { dispatchAfter } from '@stacksjs/queue'

// Dispatch after 60 seconds
await dispatchAfter(60, 'reminder-email', { userId: 1 })

// Dispatch at specific time
await dispatchAfter(new Date('2024-12-25'), 'christmas-promo', {})
```

### Job Chains

```typescript
import { dispatchChain, chain } from '@stacksjs/queue'

// Execute jobs in sequence
await dispatchChain([
  { job: 'validate-order', data: { orderId: 1 } },
  { job: 'process-payment', data: { orderId: 1 } },
  { job: 'send-confirmation', data: { orderId: 1 } }
])

// Using chain helper
await chain()
  .add('step-1', { data: 'a' })
  .add('step-2', { data: 'b' })
  .add('step-3', { data: 'c' })
  .dispatch()
```

### Batch Processing

```typescript
import { batch } from '@stacksjs/queue'

// Process jobs in batch
const result = await batch([
  { job: 'process-user', data: { userId: 1 } },
  { job: 'process-user', data: { userId: 2 } },
  { job: 'process-user', data: { userId: 3 } }
])
  .allowFailures() // Continue even if some fail
  .onSuccess(() => console.log('All succeeded'))
  .onFailure(() => console.log('Some failed'))
  .dispatch()

console.log(result.successful) // Number of successful jobs
console.log(result.failed)     // Number of failed jobs
```

## Queue Workers

### Starting Workers

```bash
# Start queue worker
buddy queue:work

# Specify queue
buddy queue:work --queue=emails

# Multiple queues with priority
buddy queue:work --queue=high,default,low

# Limit number of jobs
buddy queue:work --max-jobs=100

# Stop after idle
buddy queue:work --stop-when-empty
```

### Programmatic Workers

```typescript
import { Worker, QueueWorker, WorkerManager } from '@stacksjs/queue'

// Start a worker
const worker = new QueueWorker({
  queues: ['default', 'emails'],
  concurrency: 5,
  maxJobs: 1000
})

await worker.start()

// Worker manager for multiple workers
const manager = new WorkerManager()
manager.addWorker('default', { concurrency: 3 })
manager.addWorker('emails', { concurrency: 2 })
await manager.start()

// Graceful shutdown
process.on('SIGTERM', async () => {
  await manager.stop()
})
```

### Worker Functions

```typescript
import {
  startProcessor,
  stopProcessor,
  isWorkerRunning,
  getActiveJobCount
} from '@stacksjs/queue'

// Start processing
await startProcessor({
  queues: ['default'],
  concurrency: 5
})

// Check status
const running = isWorkerRunning()
const activeJobs = getActiveJobCount()

// Stop processing
await stopProcessor()
```

## Failed Jobs

### Managing Failed Jobs

```typescript
import {
  FailedJobManager,
  executeFailedJobs,
  retryFailedJob
} from '@stacksjs/queue'

// Get failed jobs
const manager = new FailedJobManager()
const failedJobs = await manager.all()

// Retry a specific failed job
await retryFailedJob(failedJobId)

// Retry all failed jobs
await executeFailedJobs()

// Delete a failed job
await manager.delete(failedJobId)

// Clear all failed jobs
await manager.flush()
```

### Failed Job Notifications

```typescript
import {
  configureFailedJobNotifications,
  FailedJobNotifier,
  notifyJobFailed
} from '@stacksjs/queue'

// Configure notifications
configureFailedJobNotifications({
  channels: ['email', 'slack'],
  email: {
    to: 'admin@example.com'
  },
  slack: {
    webhook: 'https://hooks.slack.com/...'
  }
})

// Get notifier instance
const notifier = getFailedJobNotifier()

// Manual notification
await notifyJobFailed({
  job: 'SendEmail',
  error: new Error('SMTP connection failed'),
  data: { to: 'user@test.com' },
  attempts: 3
})
```

## Middleware

### Built-in Middleware

```typescript
import {
  middleware,
  RateLimitMiddleware,
  UniqueJobMiddleware,
  ThrottleMiddleware,
  WithoutOverlappingMiddleware,
  SkipIfMiddleware,
  FailureMiddleware
} from '@stacksjs/queue'

// Rate limiting
export default class SendNotification extends Job {
  middleware = [
    new RateLimitMiddleware({
      key: 'notifications',
      maxAttempts: 100,
      decayMinutes: 1
    })
  ]
}

// Unique jobs (prevent duplicates)
export default class ProcessOrder extends Job {
  middleware = [
    new UniqueJobMiddleware({
      key: (data) => `order:${data.orderId}`,
      ttl: 3600
    })
  ]
}

// Throttle
export default class SendEmail extends Job {
  middleware = [
    new ThrottleMiddleware({
      maxAttempts: 10,
      seconds: 60
    })
  ]
}

// Prevent overlapping
export default class GenerateReport extends Job {
  middleware = [
    new WithoutOverlappingMiddleware({
      key: 'report-generation',
      releaseAfter: 300
    })
  ]
}

// Skip if condition
export default class SyncData extends Job {
  middleware = [
    new SkipIfMiddleware(async (data) => {
      return await isMaintenanceMode()
    })
  ]
}
```

## Priority Queues

```typescript
import { PriorityQueue } from '@stacksjs/queue'

const queue = new PriorityQueue('orders')

// Add with priority (higher = more important)
await queue.add({ orderId: 1 }, { priority: 10 }) // High priority
await queue.add({ orderId: 2 }, { priority: 5 })  // Normal
await queue.add({ orderId: 3 }, { priority: 1 })  // Low priority

// Jobs are processed in priority order
```

## Dead Letter Queue

```typescript
import { DeadLetterQueue } from '@stacksjs/queue'

const dlq = new DeadLetterQueue({
  maxRetries: 3,
  retentionDays: 7
})

// Failed jobs automatically move to DLQ
// Review and reprocess
const deadJobs = await dlq.list()
await dlq.retry(deadJobId)
await dlq.discard(deadJobId)
```

## Queue Events

```typescript
import {
  QueueEvents,
  onQueueEvent,
  OnQueueEvent,
  emitQueueEvent,
  QueueMetrics
} from '@stacksjs/queue'

// Listen to events
onQueueEvent('job:completed', (payload) => {
  console.log(`Job ${payload.jobId} completed`)
})

onQueueEvent('job:failed', (payload) => {
  console.log(`Job ${payload.jobId} failed: ${payload.error}`)
})

// Available events
// - job:dispatched
// - job:started
// - job:completed
// - job:failed
// - job:retrying
// - worker:started
// - worker:stopped

// Get metrics
const metrics = new QueueMetrics()
console.log(await metrics.getJobStats())
console.log(await metrics.getQueueDepth('default'))
```

## Health Checks

```typescript
import {
  checkQueueHealth,
  isQueueHealthy,
  createHealthCheckHandler
} from '@stacksjs/queue'

// Check health
const health = await checkQueueHealth()
console.log(health.status)  // 'healthy' | 'degraded' | 'unhealthy'
console.log(health.queues)  // Queue-specific status
console.log(health.workers) // Worker status

// Simple boolean check
const healthy = await isQueueHealthy()

// Create HTTP handler for health endpoint
const handler = createHealthCheckHandler()
// Returns Response with health status JSON
```

## Job Scheduling

```typescript
import {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  triggerJob,
  getRegisteredJobs
} from '@stacksjs/queue'

// Start the scheduler
await startScheduler()

// Check status
const status = getSchedulerStatus()
console.log(status.running)
console.log(status.nextRunTimes)

// Get registered scheduled jobs
const jobs = getRegisteredJobs()

// Manually trigger a scheduled job
await triggerJob('daily-report')

// Stop scheduler
await stopScheduler()
```

## Testing

```typescript
import {
  fake,
  restore,
  QueueTester,
  createQueueTester,
  getFakeQueue,
  isFaked,
  expectJobToFail,
  runTestJob
} from '@stacksjs/queue'

// Fake the queue (jobs aren't actually processed)
fake()

// Dispatch job during test
await dispatch('send-email', { to: 'test@example.com' })

// Get dispatched jobs
const fakeQueue = getFakeQueue()
const jobs = fakeQueue.dispatched('send-email')
expect(jobs).toHaveLength(1)

// Assert job was dispatched
expect(fakeQueue.hasDispatched('send-email')).toBe(true)

// Assert job data
expect(fakeQueue.dispatched('send-email')[0].data).toEqual({
  to: 'test@example.com'
})

// Run job in test (actually execute)
const result = await runTestJob('send-email', { to: 'test@example.com' })

// Test job failure
await expectJobToFail('invalid-job', { data: 'bad' })

// Restore real queue
restore()
```

## Job Discovery

```typescript
import {
  discoverJobs,
  getAllJobs,
  getJob,
  executeJob,
  getScheduledJobs,
  jobRegistry
} from '@stacksjs/queue'

// Discover all jobs in app/Jobs
await discoverJobs()

// Get all discovered jobs
const jobs = getAllJobs()

// Get specific job
const job = getJob('SendWelcomeEmail')

// Execute a job directly
await executeJob('SendWelcomeEmail', { userId: 1 })

// Get only scheduled jobs
const scheduledJobs = getScheduledJobs()
```

## Rate Limiting & Locking

```typescript
import { RateLimiter, DistributedLock } from '@stacksjs/queue'

// Rate limiter
const limiter = new RateLimiter({
  key: 'api-calls',
  maxAttempts: 100,
  decaySeconds: 60
})

if (await limiter.attempt()) {
  // Process request
} else {
  // Rate limited
}

// Distributed lock
const lock = new DistributedLock('resource-key')
if (await lock.acquire(30)) { // 30 second lock
  try {
    await doExclusiveWork()
  } finally {
    await lock.release()
  }
}
```

## Leader Election

```typescript
import { LeaderElection } from '@stacksjs/queue'

// For horizontal scaling
const election = new LeaderElection('worker-leader')

// Only leader processes scheduled jobs
if (await election.isLeader()) {
  await processScheduledJobs()
}
```

## Edge Cases

### Handling Job Timeouts

```typescript
export default class LongRunningJob extends Job {
  timeout = 300 // 5 minutes

  async handle(data: any) {
    // If job exceeds timeout, it's marked as failed
    await veryLongProcess()
  }

  async timedOut(data: any) {
    // Called when job times out
    await cleanup(data)
  }
}
```

### Graceful Shutdown

```typescript
import { gracefulShutdown } from '@stacksjs/queue'

process.on('SIGTERM', async () => {
  // Wait for current jobs to complete
  await gracefulShutdown({
    timeout: 30000, // Max wait time
    force: false    // Don't force-kill jobs
  })
  process.exit(0)
})
```

### Job Retries with Backoff

```typescript
export default class UnreliableJob extends Job {
  tries = 5
  backoff = [60, 300, 900, 3600] // Exponential backoff

  // Or use backoff strategy
  backoffStrategy = 'exponential' // linear, exponential, or custom
}
```

## API Reference

### Dispatch Functions

| Function | Description |
|----------|-------------|
| `dispatch(job, data)` | Dispatch job to queue |
| `dispatchSync(job, data)` | Execute job immediately |
| `dispatchIf(condition, job, data)` | Conditional dispatch |
| `dispatchUnless(condition, job, data)` | Inverse conditional |
| `dispatchAfter(delay, job, data)` | Delayed dispatch |
| `dispatchChain(jobs)` | Sequential jobs |
| `chain()` | Chain builder |
| `batch(jobs)` | Batch processor |

### Worker Methods

| Method | Description |
|--------|-------------|
| `startProcessor(options)` | Start processing |
| `stopProcessor()` | Stop processing |
| `isWorkerRunning()` | Check worker status |
| `getActiveJobCount()` | Get active jobs |

### Failed Job Methods

| Method | Description |
|--------|-------------|
| `executeFailedJobs()` | Retry all failed |
| `retryFailedJob(id)` | Retry specific job |
| `FailedJobManager.all()` | List failed jobs |
| `FailedJobManager.delete(id)` | Delete failed job |
| `FailedJobManager.flush()` | Clear all failed |

### Job Class Properties

| Property | Description |
|----------|-------------|
| `queue` | Queue name |
| `tries` | Max attempts |
| `backoff` | Retry delay (seconds) |
| `timeout` | Max execution time |
| `middleware` | Job middleware array |
