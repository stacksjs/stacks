# Jobs & Queues

Stacks provides a powerful job queue system for handling background tasks, built on [bun-queue](https://github.com/stacksjs/bun-queue). Process emails, notifications, reports, and other time-consuming tasks asynchronously.

## Overview

The job system helps you:

- **Defer work** - Process tasks in the background
- **Handle failures** - Automatic retries with backoff
- **Scale processing** - Run multiple workers
- **Monitor progress** - Track job status and failures

## Quick Start

### Dispatching Jobs

```typescript
import { dispatch } from '@stacksjs/queue'

// Dispatch a job
await dispatch('send-email', {
  to: 'user@example.com',
  subject: 'Welcome!',
  template: 'welcome',
})

// Using job classes
await job('SendWelcomeEmail').dispatch({ userId: 1 })
```

### Creating Jobs

Create job files in `app/Jobs/`:

```typescript
// app/Jobs/SendWelcomeEmail.ts
import { Job } from '@stacksjs/queue'
import { mail } from '@stacksjs/email'

export default class SendWelcomeEmail extends Job {
  // Queue name
  queue = 'emails'

  // Retry attempts
  tries = 3

  // Seconds between retries
  backoff = 60

  // Maximum execution time (seconds)
  timeout = 120

  async handle(data: { userId: number }) {
    const user = await User.find(data.userId)

    await mail.send({
      to: user.email,
      subject: 'Welcome to our app!',
      template: 'emails/welcome',
      data: { name: user.name },
    })
  }

  // Called when all retries fail
  async failed(error: Error, data: { userId: number }) {
    console.error(`Failed to send welcome email to user ${data.userId}:`, error)
    await notifyAdmin('Welcome email failed', { userId: data.userId, error })
  }
}
```

## Dispatch Methods

### Basic Dispatch

```typescript
import { dispatch, dispatchSync } from '@stacksjs/queue'

// Queue the job (async processing)
await dispatch('process-order', { orderId: 123 })

// Execute immediately (sync)
await dispatchSync('process-order', { orderId: 123 })
```

### Conditional Dispatch

```typescript
import { dispatchIf, dispatchUnless } from '@stacksjs/queue'

// Dispatch only if condition is true
await dispatchIf(
  user.wantsNotifications,
  'send-notification',
  { userId: user.id }
)

// Dispatch unless condition is true
await dispatchUnless(
  user.optedOut,
  'send-marketing',
  { userId: user.id }
)
```

### Delayed Dispatch

```typescript
import { dispatchAfter } from '@stacksjs/queue'

// Dispatch after 60 seconds
await dispatchAfter(60, 'send-reminder', { userId: 1 })

// Dispatch at specific time
await dispatchAfter(
  new Date('2024-12-25T00:00:00Z'),
  'send-christmas-promo',
  { userId: 1 }
)
```

### Job Chains

Execute jobs in sequence:

```typescript
import { chain } from '@stacksjs/queue'

await chain()
  .add('validate-order', { orderId: 1 })
  .add('process-payment', { orderId: 1 })
  .add('send-confirmation', { orderId: 1 })
  .add('notify-warehouse', { orderId: 1 })
  .dispatch()
```

If any job fails, the chain stops.

### Batch Processing

Process jobs in parallel:

```typescript
import { batch } from '@stacksjs/queue'

const result = await batch([
  { job: 'process-user', data: { userId: 1 } },
  { job: 'process-user', data: { userId: 2 } },
  { job: 'process-user', data: { userId: 3 } },
])
  .allowFailures()  // Continue even if some fail
  .onSuccess(() => console.log('All completed'))
  .onFailure((failed) => console.log(`${failed.length} failed`))
  .dispatch()

console.log(`Successful: ${result.successful}`)
console.log(`Failed: ${result.failed}`)
```

## Job Configuration

### Retry Settings

```typescript
export default class UnreliableJob extends Job {
  // Number of retry attempts
  tries = 5

  // Seconds between retries (fixed)
  backoff = 60

  // Or exponential backoff (array of delays)
  backoff = [60, 300, 900, 3600]  // 1min, 5min, 15min, 1hr

  // Or use backoff strategy
  backoffStrategy = 'exponential'  // 'linear' | 'exponential'
}
```

### Timeouts

```typescript
export default class LongRunningJob extends Job {
  // Maximum execution time in seconds
  timeout = 300  // 5 minutes

  async handle(data: any) {
    await veryLongProcess()
  }

  // Called if job times out
  async timedOut(data: any) {
    await cleanup(data)
    await notifyTimeout(data)
  }
}
```

### Unique Jobs

Prevent duplicate jobs:

```typescript
import { UniqueJobMiddleware } from '@stacksjs/queue'

export default class ProcessOrder extends Job {
  middleware = [
    new UniqueJobMiddleware({
      key: (data) => `order:${data.orderId}`,
      ttl: 3600,  // Unique for 1 hour
    })
  ]
}
```

### Rate Limiting

```typescript
import { RateLimitMiddleware } from '@stacksjs/queue'

export default class SendNotification extends Job {
  middleware = [
    new RateLimitMiddleware({
      key: 'notifications',
      maxAttempts: 100,
      decayMinutes: 1,  // 100 per minute
    })
  ]
}
```

## Running Workers

### CLI Commands

```bash
# Start queue worker
buddy queue:work

# Specify queue
buddy queue:work --queue=emails

# Multiple queues with priority (left = highest)
buddy queue:work --queue=high,default,low

# Limit jobs processed
buddy queue:work --max-jobs=100

# Stop when empty
buddy queue:work --stop-when-empty
```

### Programmatic Workers

```typescript
import { QueueWorker, WorkerManager } from '@stacksjs/queue'

// Single worker
const worker = new QueueWorker({
  queues: ['default', 'emails'],
  concurrency: 5,
  maxJobs: 1000,
})

await worker.start()

// Multiple workers with manager
const manager = new WorkerManager()
manager.addWorker('default', { concurrency: 3 })
manager.addWorker('emails', { concurrency: 2 })
manager.addWorker('reports', { concurrency: 1 })

await manager.start()

// Graceful shutdown
process.on('SIGTERM', async () => {
  await manager.stop()
  process.exit(0)
})
```

## Failed Jobs

### Handling Failures

```typescript
export default class ImportData extends Job {
  tries = 3

  async handle(data: { fileId: number }) {
    const file = await Storage.get(data.fileId)
    await processFile(file)
  }

  async failed(error: Error, data: { fileId: number }) {
    // Log the failure
    console.error('Import failed:', error)

    // Notify admins
    await slack.send({
      channel: '#alerts',
      text: `Data import failed for file ${data.fileId}: ${error.message}`,
    })

    // Mark file as failed
    await File.update(data.fileId, { status: 'failed' })
  }
}
```

### Managing Failed Jobs

```typescript
import { FailedJobManager, retryFailedJob, executeFailedJobs } from '@stacksjs/queue'

const manager = new FailedJobManager()

// List failed jobs
const failedJobs = await manager.all()

// Retry a specific job
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
import { configureFailedJobNotifications } from '@stacksjs/queue'

configureFailedJobNotifications({
  channels: ['email', 'slack'],
  email: {
    to: 'admin@example.com',
  },
  slack: {
    webhook: process.env.SLACK_WEBHOOK_URL,
  },
})
```

## Scheduling Jobs

Schedule recurring jobs with cron expressions:

```typescript
// app/Jobs/DailyReport.ts
export default class DailyReport extends Job {
  // Run at 8am every day
  schedule = '0 8 * * *'

  async handle() {
    const report = await generateDailyReport()
    await sendReportEmail(report)
  }
}
```

### Starting the Scheduler

```bash
buddy queue:schedule
```

Or programmatically:

```typescript
import { startScheduler, stopScheduler, getSchedulerStatus } from '@stacksjs/queue'

await startScheduler()

// Check status
const status = getSchedulerStatus()
console.log(status.running)
console.log(status.nextRunTimes)

// Manually trigger a scheduled job
await triggerJob('daily-report')

// Stop scheduler
await stopScheduler()
```

## Queue Events

Listen for job events:

```typescript
import { onQueueEvent } from '@stacksjs/queue'

onQueueEvent('job:dispatched', (payload) => {
  console.log(`Job dispatched: ${payload.jobName}`)
})

onQueueEvent('job:started', (payload) => {
  console.log(`Job started: ${payload.jobId}`)
})

onQueueEvent('job:completed', (payload) => {
  console.log(`Job completed: ${payload.jobId} in ${payload.duration}ms`)
})

onQueueEvent('job:failed', (payload) => {
  console.error(`Job failed: ${payload.jobId}`, payload.error)
})

onQueueEvent('job:retrying', (payload) => {
  console.log(`Retrying job: ${payload.jobId}, attempt ${payload.attempt}`)
})
```

## Health Checks

Monitor queue health:

```typescript
import { checkQueueHealth, isQueueHealthy } from '@stacksjs/queue'

// Detailed health check
const health = await checkQueueHealth()
console.log(health.status)   // 'healthy' | 'degraded' | 'unhealthy'
console.log(health.queues)   // Per-queue status
console.log(health.workers)  // Worker status

// Simple boolean check
if (!await isQueueHealthy()) {
  await alertOps('Queue system unhealthy')
}
```

## Testing Jobs

```typescript
import { describe, expect, it } from 'bun:test'
import { fake, getFakeQueue, restore, runTestJob } from '@stacksjs/queue'

describe('SendWelcomeEmail', () => {
  it('dispatches email job', async () => {
    // Fake the queue (jobs won't actually process)
    fake()

    // Dispatch job
    await dispatch('SendWelcomeEmail', { userId: 1 })

    // Assert job was dispatched
    const fakeQueue = getFakeQueue()
    expect(fakeQueue.hasDispatched('SendWelcomeEmail')).toBe(true)

    // Check job data
    const jobs = fakeQueue.dispatched('SendWelcomeEmail')
    expect(jobs[0].data).toEqual({ userId: 1 })

    // Restore real queue
    restore()
  })

  it('handles job execution', async () => {
    // Actually run the job in test
    const result = await runTestJob('SendWelcomeEmail', { userId: 1 })

    expect(result.success).toBe(true)
  })
})
```

## Best Practices

### DO

- **Keep jobs small** - One responsibility per job
- **Make jobs idempotent** - Safe to retry multiple times
- **Set appropriate timeouts** - Prevent hung jobs
- **Handle failures gracefully** - Implement `failed()` method
- **Use unique constraints** - Prevent duplicate processing

### DON'T

- **Don't process user input directly** - Validate in the web request
- **Don't store sensitive data** - Use IDs and fetch fresh data
- **Don't use too many retries** - 3-5 is usually sufficient
- **Don't ignore failures** - Set up notifications

## Related Resources

- **[Queue Package](/packages/queue)** - Full API reference
- **[Scheduler Package](/packages/scheduler)** - Cron scheduling
- **[Error Handling](/basics/error-handling)** - Handling job failures
- **[Logging](/basics/logging)** - Logging job activity
