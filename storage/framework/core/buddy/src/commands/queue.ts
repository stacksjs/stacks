import type { CLI, CliQueueOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
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
  }

  buddy
    .command('queue:work', 'Start processing jobs on the queue')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-q, --queue [queue]', descriptions.queue, { default: false })
    .option('-c, --connection [connection]', descriptions.connection, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:work` ...', options)

      const perf = await intro('buddy queue:work')
      const result = await runAction(Action.QueueWork, options)

      if (result.isErr()) {
        await outro(
          'While running the queue:work command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      process.exit(ExitCode.Success)
    })

  buddy
    .command('queue:failed', 'List all failed jobs')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-q, --queue [queue]', descriptions.queue, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliQueueOptions) => {
      log.debug('Running `buddy queue:failed` ...', options)

      const perf = await intro('buddy queue:failed')
      const result = await runAction(Action.QueueFailed, options)

      if (result.isErr()) {
        await outro(
          'While running the queue:failed command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
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
      const result = await runAction(Action.QueueRetry, { ...options, id })

      if (result.isErr()) {
        await outro(
          'While running the queue:retry command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
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

      if (result.isErr()) {
        await outro(
          'While running the queue:clear command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      const queueName = options.queue || 'default'
      await outro(`Cleared all jobs from the "${queueName}" queue`, {
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

      if (result.isErr()) {
        await outro(
          'While running the queue:status command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
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

      if (result.isErr()) {
        await outro(
          'While running the queue:flush command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      await outro('Flushed all failed jobs', {
        startTime: perf,
        useSeconds: true,
      })
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

      if (result.isErr()) {
        await outro(
          'While running the queue:table command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      await outro('Jobs table migration created', {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  buddy.on('queue:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
