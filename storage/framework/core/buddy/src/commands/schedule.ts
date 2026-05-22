import type { CLI, ScheduleOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function schedule(buddy: CLI): void {
  const descriptions = {
    project: 'Target a specific project',
    schedule: 'Run the scheduler',
    verbose: 'Enable verbose output',
    list: 'List all registered scheduled tasks with their next run time',
    status: 'Show currently-held overlap locks (this-process only)',
  }

  buddy
    .command('schedule:run', descriptions.schedule)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: ScheduleOptions) => {
      log.debug('Running `buddy schedule:run` ...', options)

      const perf = await intro('buddy schedule:run')
      const result = await runAction(Action.ScheduleRun, options)

      if (result.isErr) {
        await outro(
          'While running the schedule:run command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      process.exit(ExitCode.Success)
    })

  // `schedule:list` (stacksjs/stacks#1877 S-1) — operator-facing
  // introspection. Loads `routes/scheduler.ts` (the convention for
  // declaring tasks) so the registry is populated, then prints
  // every job's name + pattern + timezone + next-run time as a
  // simple table. Doesn't actually run anything.
  buddy
    .command('schedule:list', descriptions.list)
    .action(async () => {
      try {
        // Importing the scheduler module side-evaluates the user's
        // routes/scheduler.ts which registers tasks. Without that
        // import the static `Schedule.jobs` map is empty.
        await import(`${process.cwd()}/routes/scheduler.ts`).catch(() => {
          log.warn('[schedule:list] no routes/scheduler.ts found — registry will be empty unless tasks were registered elsewhere')
        })
        const { Schedule } = await import('@stacksjs/scheduler')
        const jobs = Schedule.listJobs()

        if (jobs.length === 0) {
          log.info('No scheduled tasks registered.')
          process.exit(ExitCode.Success)
        }

        // Print as a simple aligned table; CLI table renderer
        // would add a dep, this is enough for operators.
        const nameWidth = Math.max(4, ...jobs.map(j => j.name.length))
        const patternWidth = Math.max(7, ...jobs.map(j => (j.pattern ?? '').length))
        log.info(`${'NAME'.padEnd(nameWidth)}  ${'PATTERN'.padEnd(patternWidth)}  TIMEZONE                   NEXT RUN (UTC)`)
        for (const j of jobs) {
          const next = j.nextRun ? j.nextRun.toISOString() : '—'
          log.info(`${j.name.padEnd(nameWidth)}  ${(j.pattern ?? '').padEnd(patternWidth)}  ${(j.timezone ?? 'UTC').padEnd(25)}  ${next}`)
        }
        process.exit(ExitCode.Success)
      }
      catch (err) {
        log.error(`[schedule:list] failed: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  // `schedule:status` (stacksjs/stacks#1877 S-1) — show currently
  // held in-process overlap locks. Useful for diagnosing "task
  // never runs" / "task seems stuck" without code review.
  // Cluster-wide lock state lives in the DB advisory locks and
  // is NOT visible from this command — those auto-release on
  // session close, so a stuck task's lock disappears when the
  // worker process dies.
  buddy
    .command('schedule:status', descriptions.status)
    .action(async () => {
      try {
        const { Schedule } = await import('@stacksjs/scheduler')
        const held = Schedule.listLocks()
        if (held.length === 0) {
          log.info('No in-process scheduler locks held.')
        }
        else {
          log.info(`Held locks (${held.length}):`)
          for (const name of held)
            log.info(`  • ${name}`)
        }
        process.exit(ExitCode.Success)
      }
      catch (err) {
        log.error(`[schedule:status] failed: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(ExitCode.FatalError)
      }
    })
}
