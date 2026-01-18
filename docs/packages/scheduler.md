# Scheduler Package

A powerful task scheduling system for running recurring jobs, commands, and actions with cron-like syntax, timezone support, and overlapping prevention.

## Installation

```bash
bun add @stacksjs/scheduler
```

## Basic Usage

```typescript
import { schedule } from '@stacksjs/scheduler'

// Schedule a job to run every minute
schedule.job('ProcessNewsletter').everyMinute()

// Schedule an action
schedule.action('CleanupTempFiles').daily()

// Schedule a command
schedule.command('db:backup').dailyAt('02:00')
```

## Scheduling Methods

### Job Scheduling

Schedule jobs defined in `app/Jobs/`:

```typescript
import { schedule } from '@stacksjs/scheduler'

// Basic job scheduling
schedule.job('SendDailyReport').daily()

// Job with custom timing
schedule.job('ProcessPayments')
  .everyFiveMinutes()
  .setTimeZone('America/New_York')

// Job with error handling
schedule.job('SyncInventory')
  .hourly()
  .withErrorHandler((error) => {
    console.error('Sync failed:', error)
    // Send notification
  })
```

### Action Scheduling

Schedule actions defined in `app/Actions/`:

```typescript
// Schedule an action
schedule.action('CleanupExpiredTokens').daily()

// Action with specific time
schedule.action('GenerateSitemap').dailyAt('04:00')

// Action with timezone
schedule.action('SendMarketingEmails')
  .weekdays()
  .at('09:00')
  .setTimeZone('America/Los_Angeles')
```

### Command Scheduling

Schedule shell commands:

```typescript
// Run a shell command
schedule.command('npm run build').daily()

// Run database backup
schedule.command('pg_dump mydb > backup.sql').dailyAt('03:00')

// Run with specific working directory
schedule.command('bun run seed').weekly()
```

## Frequency Options

### Every X Minutes/Hours

```typescript
// Every second
schedule.job('PingHealth').everySecond()

// Every minute
schedule.job('CheckQueue').everyMinute()

// Every two minutes
schedule.job('ProcessWebhooks').everyTwoMinutes()

// Every five minutes
schedule.job('SyncCache').everyFiveMinutes()

// Every ten minutes
schedule.job('UpdateStats').everyTenMinutes()

// Every thirty minutes
schedule.job('RefreshTokens').everyThirtyMinutes()

// Every hour
schedule.job('CleanupLogs').everyHour()
// Or use alias
schedule.job('CleanupLogs').hourly()

// Every day
schedule.job('DailyReport').everyDay()
// Or use alias
schedule.job('DailyReport').daily()
```

### Specific Times

```typescript
// Daily at specific time
schedule.job('Backup').at('02:30') // 2:30 AM daily

// Weekly
schedule.job('WeeklyReport').weekly() // Sunday at midnight

// Monthly
schedule.job('MonthlyInvoices').monthly() // 1st of month at midnight

// Yearly
schedule.job('AnnualCleanup').yearly()
// Or use alias
schedule.job('AnnualCleanup').annually()
```

### Day-Based Scheduling

```typescript
// Specific days of week (0 = Sunday, 6 = Saturday)
schedule.job('WeekdayTask').onDays([1, 2, 3, 4, 5]) // Monday to Friday
```

## Scheduling Options

### Timezone

```typescript
// Set timezone for schedule
schedule.job('EmailDigest')
  .daily()
  .at('09:00')
  .setTimeZone('Europe/London')

// Common timezones:
// 'America/New_York', 'America/Los_Angeles', 'America/Chicago'
// 'Europe/London', 'Europe/Paris', 'Europe/Berlin'
// 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney'
```

### Error Handling

```typescript
schedule.job('CriticalTask')
  .hourly()
  .withErrorHandler((error) => {
    // Log error
    console.error('Task failed:', error)

    // Send notification
    notify.slack(`Critical task failed: ${error.message}`)

    // You can rethrow to mark as failed
    throw error
  })
```

### Max Runs

```typescript
// Limit number of executions
schedule.job('OneTimeSetup')
  .everyMinute()
  .withMaxRuns(1) // Only run once

// Run 10 times then stop
schedule.job('LimitedTask')
  .hourly()
  .withMaxRuns(10)
```

### Protection (Overlapping Prevention)

```typescript
// Prevent overlapping runs
schedule.job('LongRunningTask')
  .everyMinute()
  .withProtection()

// With callback when protected
schedule.job('LongRunningTask')
  .everyMinute()
  .withProtection((job) => {
    console.log('Job still running, skipping this run')
  })
```

### Naming

```typescript
// Give schedule a name for identification
schedule.job('ProcessEmails')
  .everyFiveMinutes()
  .withName('email-processor')
```

### Context

```typescript
// Pass context to scheduled task
schedule.job('ProcessBatch')
  .hourly()
  .withContext({
    batchSize: 100,
    retryCount: 3
  })
```

### Interval

```typescript
// Custom interval in seconds
schedule.job('CustomInterval')
  .everyMinute()
  .withInterval(45) // Every 45 seconds
```

### Date Range

```typescript
// Run only between specific dates
schedule.job('CampaignTask')
  .daily()
  .between('2024-01-01', '2024-12-31')

// Run starting from a date
schedule.job('NewFeature')
  .hourly()
  .between(new Date(), new Date('2025-01-01'))
```

## Schedule Helpers

### Get Next Run Time

```typescript
import { sendAt } from '@stacksjs/scheduler'

// Get next run time for a cron pattern
const nextRun = sendAt('0 9 * * *') // Next 9 AM
console.log(nextRun) // Date object
```

### Get Timeout Until Next Run

```typescript
import { timeout } from '@stacksjs/scheduler'

// Get milliseconds until next run
const ms = timeout('0 9 * * *')
console.log(`Next run in ${ms}ms`)
```

## Graceful Shutdown

```typescript
import { schedule, Schedule } from '@stacksjs/scheduler'

// Set up signal handlers
process.on('SIGINT', async () => {
  await Schedule.gracefulShutdown()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await Schedule.gracefulShutdown()
  process.exit(0)
})
```

## Running the Scheduler

### CLI

```bash
# Start the scheduler
buddy schedule:run

# Start with verbose output
buddy schedule:run -v

# Run specific scheduled task immediately
buddy schedule:test SendDailyReport
```

### Programmatic

```typescript
import { runScheduler } from '@stacksjs/scheduler'

// Start the scheduler
await runScheduler()
```

## Cron Expression Reference

The scheduler uses standard cron expressions:

```
┌───────────── second (0 - 59) (optional)
│ ┌───────────── minute (0 - 59)
│ │ ┌───────────── hour (0 - 23)
│ │ │ ┌───────────── day of month (1 - 31)
│ │ │ │ ┌───────────── month (1 - 12)
│ │ │ │ │ ┌───────────── day of week (0 - 6) (Sunday = 0)
│ │ │ │ │ │
* * * * * *
```

Common patterns:
- `* * * * *` - Every minute
- `*/5 * * * *` - Every 5 minutes
- `0 * * * *` - Every hour
- `0 0 * * *` - Daily at midnight
- `0 0 * * 0` - Weekly on Sunday
- `0 0 1 * *` - Monthly on 1st
- `0 9 * * 1-5` - Weekdays at 9 AM

## Job Definition Example

Define jobs in `app/Jobs/`:

```typescript
// app/Jobs/SendDailyReport.ts
export default {
  // Job name
  name: 'SendDailyReport',

  // Description
  description: 'Send daily analytics report',

  // Handle method
  async handle(payload?: any) {
    const report = await generateReport()
    await sendEmail({
      to: 'team@example.com',
      subject: 'Daily Report',
      body: report
    })
  },

  // Retry configuration
  tries: 3,
  backoff: [60, 300, 600], // Retry delays in seconds

  // Timeout (seconds)
  timeout: 120,

  // Queue name (if using queue driver)
  queue: 'reports'
}
```

## Integration with Queue

Scheduled jobs can be dispatched to the queue:

```typescript
// Schedule job to be queued
schedule.job('ProcessLargeDataset')
  .daily()
  .onQueue('heavy') // Dispatch to 'heavy' queue

// The job will be added to the queue at scheduled time
// and processed by queue workers
```

## Edge Cases

### Handling Missed Runs

```typescript
// If server was down during scheduled time,
// the job runs immediately on startup if within catch-up window
schedule.job('ImportantTask')
  .daily()
  .withCatchUp(true) // Default is false

// Note: Catch-up may cause multiple runs if server was down for days
```

### Long-Running Tasks

```typescript
// For tasks that may exceed schedule interval
schedule.job('SlowTask')
  .everyMinute()
  .withProtection() // Prevents overlapping
  .withTimeout(300000) // 5 minute timeout
```

### Time Zone Edge Cases

```typescript
// Handle daylight saving time
schedule.job('TimeSensitive')
  .dailyAt('02:30')
  .setTimeZone('America/New_York')
// Note: 2:30 AM may not exist or happen twice during DST transitions
```

### Error Recovery

```typescript
schedule.job('FailProne')
  .hourly()
  .withErrorHandler(async (error) => {
    // Log to external service
    await errorTracker.capture(error)

    // Don't rethrow - job is marked as complete
    // Rethrow to trigger retry logic
  })
```

## Configuration

### Environment Variables

```env
# Scheduler settings
SCHEDULE_TIMEZONE=America/New_York
SCHEDULE_LOG_LEVEL=info

# Queue integration
QUEUE_DRIVER=database
```

### Scheduler Configuration

```typescript
// config/scheduler.ts
export default {
  // Default timezone
  timezone: 'UTC',

  // Log scheduled runs
  logging: true,

  // Catch up missed runs
  catchUp: false,

  // Default error handler
  onError: (error, job) => {
    console.error(`Job ${job} failed:`, error)
  }
}
```

## API Reference

### Schedule Methods

| Method | Description |
|--------|-------------|
| `schedule.job(name)` | Schedule a job |
| `schedule.action(name)` | Schedule an action |
| `schedule.command(cmd)` | Schedule a command |

### Frequency Methods

| Method | Description |
|--------|-------------|
| `everySecond()` | Run every second |
| `everyMinute()` | Run every minute |
| `everyTwoMinutes()` | Run every 2 minutes |
| `everyFiveMinutes()` | Run every 5 minutes |
| `everyTenMinutes()` | Run every 10 minutes |
| `everyThirtyMinutes()` | Run every 30 minutes |
| `everyHour()` / `hourly()` | Run every hour |
| `everyDay()` / `daily()` | Run daily at midnight |
| `weekly()` | Run weekly (Sunday) |
| `monthly()` | Run monthly (1st) |
| `yearly()` / `annually()` | Run yearly (Jan 1) |
| `onDays(days[])` | Run on specific days |
| `at(time)` | Run at specific time |

### Option Methods

| Method | Description |
|--------|-------------|
| `setTimeZone(tz)` | Set timezone |
| `withErrorHandler(fn)` | Set error handler |
| `withMaxRuns(n)` | Limit executions |
| `withProtection(fn?)` | Prevent overlapping |
| `withName(name)` | Set schedule name |
| `withContext(ctx)` | Pass context data |
| `withInterval(sec)` | Custom interval |
| `between(start, end)` | Limit to date range |

### Helper Functions

| Function | Description |
|----------|-------------|
| `sendAt(cron)` | Get next run date |
| `timeout(cron)` | Get ms until next run |
| `Schedule.gracefulShutdown()` | Stop all jobs |
