import type { CLI, CliQueueOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, onUnknownSubcommand, outro } from "@stacksjs/cli"
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function queue(buddy: CLI): void {
  const descriptions = {
    project: 'Target a specific project',
    queue: 'Specify queue name',
    verbose: 'Enable verbose output',
    id: 'Job or batch ID',
    all: 'Apply to all items',
    force: 'Force the operation without confirmation',
    connection: 'Queue connection to use',
    concurrency: 'Number of concurrent workers',
  }

  buddy
    .command('queue:work', 'Start processing jobs on the queue')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-q, --queue [queue]', descriptions.queue, { default: false })
    .option('-c, --connection [connection]', descriptions.connection, { default: false })
    .option('--concurrency [concurrency]', descriptions.concurrency, { default: '1' })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions & { concurrency?: string }) => {
      log.debug('Running `buddy queue:work` ...', options)

      // Two-phase shutdown for queue workers. SIGTERM signals
      // `stopProcessor()` to drain in-flight jobs within the grace
      // window (stacksjs/stacks#1872 Q-10 — previously the worker
      // exited immediately and left jobs mid-handle); a follow-up
      // SIGKILL after the timeout prevents a misbehaving job from
      // holding the process forever. Jobs that don't finish in time
      // are released by the next worker's reservation sweep (Q-2).
      const SHUTDOWN_GRACE_MS = 10_000
      let shuttingDown = false
      const cleanup = (signal: NodeJS.Signals) => {
        if (shuttingDown) return
        shuttingDown = true
        log.info(`[queue] Received ${signal}, draining workers (max ${SHUTDOWN_GRACE_MS / 1000}s)…`)
        // Fire the in-process drain in parallel with the kill timer
        // so an unresponsive handler can't out-wait the timeout.
        import('@stacksjs/queue').then(({ stopProcessor }) => stopProcessor({ graceMs: SHUTDOWN_GRACE_MS }))
          .catch(error => log.error('[queue] stopProcessor failed', error))
        setTimeout(() => {
          log.warn('[queue] Drain timeout exceeded — forcing shutdown.')
          process.exit(ExitCode.FatalError)
        }, SHUTDOWN_GRACE_MS).unref()
      }
      process.on('SIGINT', () => cleanup('SIGINT'))
      process.on('SIGTERM', () => cleanup('SIGTERM'))

      const perf = await intro('buddy queue:work')
      const result = await runAction(Action.QueueWork, options)

      if (result.isErr) {
        await outro(
          'While running the queue:work command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:failed', 'List all failed jobs')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-q, --queue [queue]', descriptions.queue, { default: false })
    .option('--since [duration]', 'Only show jobs failed since (e.g. 1h, 30m, 2d)', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:failed` ...', options)

      const perf = await intro('buddy queue:failed')
      const result = await runAction(Action.QueueFailed, options)

      if (result.isErr) {
        await outro(
          'While running the queue:failed command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Listed all failed jobs', {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:retry [id]', 'Retry failed jobs')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-q, --queue [queue]', descriptions.queue, { default: false })
    .option('--all', descriptions.all, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (id: string | undefined, options: CliQueueOptions) => {
      log.debug('Running `buddy queue:retry` ...', options)

      const perf = await intro('buddy queue:retry')
      const result = await runAction(Action.QueueRetry, { ...options, id } as any)

      if (result.isErr) {
        await outro(
          'While running the queue:retry command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      const message = options.all ? 'Retried all failed jobs' : `Retried failed job ${id}`
      await outro(message, {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:clear', 'Clear all jobs from the queue')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-q, --queue [queue]', descriptions.queue, { default: false })
    .option('--force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:clear` ...', options)

      const perf = await intro('buddy queue:clear')
      const result = await runAction(Action.QueueClear, options)

      if (result.isErr) {
        await outro(
          'While running the queue:clear command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      const queueName = options.queue || 'default'
      await outro(`Cleared all jobs from the "${queueName}" queue`, {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:list', 'List queued jobs (flat row view, filterable by queue/status)')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-q, --queue [queue]', descriptions.queue, { default: false })
    .option('--status [status]', 'Filter by pending | reserved | delayed', { default: false })
    .option('--limit [limit]', 'Maximum rows to display (default 50)', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:list` ...', options)

      const perf = await intro('buddy queue:list')
      const result = await runAction(Action.QueueList, options)

      if (result.isErr) {
        await outro(
          'While running the queue:list command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Listed queued jobs', {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:status', 'Display the status of queue workers')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-q, --queue [queue]', descriptions.queue, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:status` ...', options)

      const perf = await intro('buddy queue:status')
      const result = await runAction(Action.QueueStatus, options)

      if (result.isErr) {
        await outro(
          'While running the queue:status command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Queue status displayed', {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:flush', 'Delete all failed jobs')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-q, --queue [queue]', descriptions.queue, { default: false })
    .option('--force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:flush` ...', options)

      const perf = await intro('buddy queue:flush')
      const result = await runAction(Action.QueueFlush, options)

      if (result.isErr) {
        await outro(
          'While running the queue:flush command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Flushed all failed jobs', {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  // ===========================================================================
  // DLQ + poison + circuit-breaker CLI (stacksjs/stacks#1885)
  // ===========================================================================
  buddy
    .command('queue:dlq', 'List dead-letter jobs (jobs that re-failed after retry)')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-q, --queue [queue]', descriptions.queue, { default: false })
    .option('--reason [reason]', 'Filter by reason (repeat-failure | poison-detected | circuit-broken | manual)', { default: false })
    .option('--since [duration]', 'Only show rows dead-lettered since (e.g. 1h, 30m, 2d)', { default: false })
    .option('--limit [limit]', 'Maximum rows to display (default 100)', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:dlq` ...', options)
      const perf = await intro('buddy queue:dlq')
      const result = await runAction(Action.QueueDlq, options)
      if (result.isErr) {
        await outro('While running queue:dlq there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }
      await outro('Listed dead-letter jobs', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:dlq:retry', 'Re-enqueue a dead-letter job back into its queue')
    .option('--id [id]', 'Dead-letter row id to retry', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:dlq:retry` ...', options)
      const perf = await intro('buddy queue:dlq:retry')
      const result = await runAction(Action.QueueDlqRetry, options)
      if (result.isErr) {
        await outro('While running queue:dlq:retry there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }
      await outro('Re-enqueued dead-letter job', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:dlq:purge', 'Delete dead-letter rows older than a retention window')
    .option('--older-than-days [days]', 'Retention window in days (default 30)', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:dlq:purge` ...', options)
      const perf = await intro('buddy queue:dlq:purge')
      const result = await runAction(Action.QueueDlqPurge, options)
      if (result.isErr) {
        await outro('While running queue:dlq:purge there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }
      await outro('Purged dead-letter rows', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:quarantine', 'List quarantined jobs (or --add a manual quarantine)')
    .option('--add [jobName]', 'Manually quarantine a job class', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:quarantine` ...', options)
      const perf = await intro('buddy queue:quarantine')
      const result = await runAction(Action.QueueQuarantine, options)
      if (result.isErr) {
        await outro('While running queue:quarantine there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }
      await outro('queue:quarantine done', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:unquarantine', 'Lift the quarantine on a job class')
    .option('--name [name]', 'Job class name to unquarantine', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:unquarantine` ...', options)
      const perf = await intro('buddy queue:unquarantine')
      const result = await runAction(Action.QueueUnquarantine, options)
      if (result.isErr) {
        await outro('While running queue:unquarantine there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }
      await outro('Unquarantined', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:pause', 'Manually pause a queue (circuit-breaker)')
    .option('--queue [name]', 'Queue name to pause', { default: false })
    .option('--for [seconds]', 'Pause duration in seconds (default 300)', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:pause` ...', options)
      const perf = await intro('buddy queue:pause')
      const result = await runAction(Action.QueuePause, options)
      if (result.isErr) {
        await outro('While running queue:pause there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }
      await outro('Paused queue', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:resume', 'Resume a paused queue (circuit-breaker)')
    .option('--queue [name]', 'Queue name to resume', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:resume` ...', options)
      const perf = await intro('buddy queue:resume')
      const result = await runAction(Action.QueueResume, options)
      if (result.isErr) {
        await outro('While running queue:resume there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }
      await outro('Resumed queue', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:table', 'Create a migration for the jobs database table')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:table` ...', options)

      const perf = await intro('buddy queue:table')
      const result = await runAction(Action.QueueTable, options)

      if (result.isErr) {
        await outro(
          'While running the queue:table command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Jobs table migration created', {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:monitor', 'Monitor queue status in real-time')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-q, --queue [queue]', descriptions.queue, { default: false })
    .option('-i, --interval [interval]', 'Refresh interval in milliseconds', { default: '2000' })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions & { interval?: string }) => {
      log.debug('Running `buddy queue:monitor` ...', options)

      const result = await runAction(Action.QueueMonitor, options)

      if (result.isErr) {
        log.error('While running the queue:monitor command, there was an issue', result.error)
        process.exit(ExitCode.FatalError)
      }

      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:inspect [id]', 'Inspect a specific job')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--failed', 'Inspect a failed job', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (id: string | undefined, options: CliQueueOptions & { failed?: boolean }) => {
      log.debug('Running `buddy queue:inspect` ...', options)

      const perf = await intro('buddy queue:inspect')
      const result = await runAction(Action.QueueInspect, { ...options, id } as any)

      if (result.isErr) {
        await outro(
          'While running the queue:inspect command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Job inspection complete', {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:schedule', 'Start the job scheduler for cron-based jobs')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:schedule` ...', options)

      const result = await runAction(Action.QueueSchedule, options)

      if (result.isErr) {
        log.error('While running the queue:schedule command, there was an issue', result.error)
        process.exit(ExitCode.FatalError)
      }

      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:schedule:list', 'List all scheduled jobs')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:schedule:list` ...', options)

      const perf = await intro('buddy queue:schedule:list')
      const result = await runAction(Action.QueueScheduleList, options)

      if (result.isErr) {
        await outro(
          'While running the queue:schedule:list command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Listed all scheduled jobs', {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  onUnknownSubcommand(buddy, "queue")
}
