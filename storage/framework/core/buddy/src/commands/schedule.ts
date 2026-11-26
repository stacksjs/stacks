import type { CLI, ScheduleOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'
import { resultFailed } from '../result'

export function schedule(buddy: CLI): void {
  const descriptions = {
    project: 'Target a specific project',
    schedule: 'Run the scheduler',
    verbose: 'Enable verbose output',
    list: 'List all registered scheduled tasks with their next run time',
    status: 'Show currently-held overlap locks (this-process only)',
    runOne: 'Run one registered scheduled task immediately',
    inProcess: 'Run a background task in this process instead of spawning it (how the scheduler starts one)',
    enable: 'Resume a paused scheduled task',
    disable: 'Pause a scheduled task without editing source',
  }

  buddy
    .command('schedule:github:deploy <name>', 'Deploy an AWS EventBridge schedule for a GitHub Actions workflow')
    .option('--repo <repo>', 'GitHub repository in owner/name form')
    .option('--workflow <workflow>', 'GitHub workflow filename or ID')
    .option('--ref <ref>', 'GitHub branch or tag', { default: 'main' })
    .option('--expression <expression>', 'AWS schedule expression', { default: 'rate(15 minutes)' })
    .option('--region <region>', 'AWS region (defaults to AWS_REGION or us-east-1)')
    .option('--profile <profile>', 'AWS credential profile')
    .option('--record-schedule', 'Pass the event timestamp to the workflow_dispatch scheduled_at input')
    .option('--token-stdin', 'Read a repository-scoped GitHub Actions write token from stdin')
    .option('--expires-on <date>', 'New token expiry date (YYYY-MM-DD). Rearms existing expiry reminders')
    .option('--dry-run', 'Print the CloudFormation template without accessing AWS or stdin')
    .action(async (name: string, options: {
      repo?: string
      workflow?: string
      ref: string
      expression: string
      region?: string
      profile?: string
      recordSchedule?: boolean
      tokenStdin?: boolean
      expiresOn?: string
      dryRun?: boolean
    }) => {
      try {
        const workflow = {
          name,
          repository: options.repo ?? '',
          workflow: options.workflow ?? '',
          ref: options.ref,
          expression: options.expression,
          recordSchedule: options.recordSchedule === true,
          tokenExpiresOn: options.expiresOn,
        }
        if (options.dryRun) {
          const { workflowScheduleTemplate } = await import('../github-workflow-schedule')
          const { validateWorkflowTokenExpiry } = await import('../github-workflow-alerts')
          if (options.expiresOn !== undefined)
            validateWorkflowTokenExpiry(options.expiresOn)
          console.log(workflowScheduleTemplate(workflow))
          return
        }

        const { AWSCloudFormationClient } = await import('@stacksjs/ts-cloud')
        const region = options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
        const client = new AWSCloudFormationClient(region, options.profile)
        const token = options.tokenStdin ? (await Bun.stdin.text()).trim() : ''
        if (options.tokenStdin && !token)
          throw new Error('Pipe a GitHub fine-grained token into this command with --token-stdin')
        const { deployWorkflowSchedule } = await import('../github-workflow-deploy')
        console.log(await deployWorkflowSchedule(client, workflow, token))
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[schedule:github:deploy] ${message.replace(/github_pat_[a-z0-9_]+/gi, '[redacted]')}`)
        process.exitCode = ExitCode.FatalError
      }
    })

  buddy
    .command('schedule:github:status <name>', 'Show the CloudFormation status of a GitHub workflow schedule')
    .option('--region <region>', 'AWS region (defaults to AWS_REGION or us-east-1)')
    .option('--profile <profile>', 'AWS credential profile')
    .action(async (name: string, options: { region?: string, profile?: string }) => {
      try {
        const { AWSCloudFormationClient } = await import('@stacksjs/ts-cloud')
        const region = options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
        const client = new AWSCloudFormationClient(region, options.profile)
        const result = await client.describeStacks({ stackName: `stacks-${name}-schedule` })
        const stack = result.Stacks?.[0]
        if (!stack)
          throw new Error(`Schedule ${name} was not found`)
        console.log(JSON.stringify({ name, status: stack.StackStatus, outputs: stack.Outputs }, null, 2))
      }
      catch (error) {
        console.error(`[schedule:github:status] ${error instanceof Error ? error.message : String(error)}`)
        process.exitCode = ExitCode.FatalError
      }
    })

  buddy
    .command('schedule:github:alerts <name>', 'Deploy token expiry reminders and AWS dispatch alarms for a GitHub workflow schedule')
    .option('--expires-on <date>', 'GitHub token expiration date in YYYY-MM-DD format')
    .option('--from <email>', 'Verified SES sender')
    .option('--to <email>', 'Email address for expiry reminders and dispatch alarms')
    .option('--heartbeat-minutes <minutes>', 'Alert after this many minutes without a successful dispatch', { default: '40' })
    .option('--region <region>', 'AWS region (defaults to AWS_REGION or us-east-1)')
    .option('--profile <profile>', 'AWS credential profile')
    .option('--dry-run', 'Print the CloudFormation template without accessing AWS')
    .action(async (name: string, options: {
      expiresOn?: string
      from?: string
      to?: string
      heartbeatMinutes: string
      region?: string
      profile?: string
      dryRun?: boolean
    }) => {
      try {
        const { workflowAlertsTemplate } = await import('../github-workflow-alerts')
        const templateBody = workflowAlertsTemplate({
          name,
          expiresOn: options.expiresOn ?? '',
          from: options.from ?? '',
          to: options.to ?? '',
          heartbeatMinutes: Number(options.heartbeatMinutes),
        })
        if (options.dryRun) {
          console.log(templateBody)
          return
        }
        const { AWSCloudFormationClient } = await import('@stacksjs/ts-cloud')
        const region = options.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
        const client = new AWSCloudFormationClient(region, options.profile)
        const schedule = await client.describeStacks({ stackName: `stacks-${name}-schedule` })
        if (!schedule.Stacks?.[0]?.Outputs?.some(output => output.OutputKey === 'RuleName' && output.OutputValue === name))
          throw new Error(`Buddy's EventBridge rule ${name} was not found`)
        const stackName = `stacks-${name}-schedule-alerts`
        const current = await client.describeStacks({ stackName }).then(result => result.Stacks?.[0], (error) => {
          if (error instanceof Error && error.message.includes('does not exist'))
            return undefined
          throw error
        })
        const settings = { stackName, templateBody, capabilities: ['CAPABILITY_IAM'] }
        if (current)
          await client.updateStack(settings)
        else
          await client.createStack({ ...settings, onFailure: 'ROLLBACK' })
        console.log(`CloudFormation deployment started for ${stackName}.`)
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('No updates are to be performed')) {
          console.log('The workflow alerts are already up to date.')
          return
        }
        console.error(`[schedule:github:alerts] ${message}`)
        process.exitCode = ExitCode.FatalError
      }
    })

  buddy
    .command('schedule:run', descriptions.schedule)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: ScheduleOptions) => {
      log.debug('Running `buddy schedule:run` ...', options)

      const perf = await intro('buddy schedule:run')
      const result = await runAction(Action.ScheduleRun, options)

      if (resultFailed(result)) {
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
    .option('--json', 'Print a machine-readable schedule registry', { default: false })
    .action(async (options: { json?: boolean }) => {
      try {
        const { runScheduler, Schedule } = await import('@stacksjs/scheduler')
        await runScheduler()
        await Promise.resolve()
        const jobs = Schedule.listJobs()

        if (options.json) {
          console.log(`STACKS_SCHEDULE_JSON=${JSON.stringify({ jobs, locks: Schedule.listLocks() })}`)
          await Schedule.gracefulShutdown()
          process.exit(ExitCode.Success)
        }

        if (jobs.length === 0) {
          log.info('No scheduled tasks registered.')
          await Schedule.gracefulShutdown()
          process.exit(ExitCode.Success)
        }

        // Print as a simple aligned table; CLI table renderer
        // would add a dep, this is enough for operators.
        const nameWidth = Math.max(4, ...jobs.map(j => j.name.length))
        const patternWidth = Math.max(7, ...jobs.map(j => (j.pattern ?? '').length))
        log.info(`${'NAME'.padEnd(nameWidth)}  ${'PATTERN'.padEnd(patternWidth)}  STATUS  TIMEZONE                   NEXT RUN (UTC)            LAST RUN (UTC)`)
        for (const j of jobs) {
          const next = j.nextRun ? j.nextRun.toISOString() : '-'
          const last = j.lastRun ? `${j.lastRun.startedAt} ${j.lastRun.status}${j.lastRun.error ? `: ${j.lastRun.error.slice(0, 80)}` : ''}` : 'never'
          log.info(`${j.name.padEnd(nameWidth)}  ${(j.pattern ?? '').padEnd(patternWidth)}  ${(j.enabled ? 'active' : 'paused').padEnd(6)}  ${(j.timezone ?? 'UTC').padEnd(25)}  ${next.padEnd(24)}  ${last}`)
        }
        await Schedule.gracefulShutdown()
        process.exit(ExitCode.Success)
      }
      catch (err) {
        await log.error(`[schedule:list] failed: ${err instanceof Error ? err.message : String(err)}`)
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
    .option('--json', 'Print machine-readable scheduler status', { default: false })
    .action(async (options: { json?: boolean }) => {
      try {
        const { Schedule } = await import('@stacksjs/scheduler')
        const held = Schedule.listLocks()
        if (options.json) {
          console.log(`STACKS_SCHEDULE_STATUS_JSON=${JSON.stringify({ locks: held })}`)
          process.exit(ExitCode.Success)
        }
        if (held.length === 0) {
          log.info('No in-process scheduler locks held.')
        }
        else {
          log.info(`Held locks (${held.length}):`)
          for (const name of held)
            log.info(`  • ${name}`)
        }
        await log.flush()
        process.exit(ExitCode.Success)
      }
      catch (err) {
        await log.error(`[schedule:status] failed: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('schedule:run-one <name>', descriptions.runOne)
    .option('--in-process', descriptions.inProcess)
    .action(async (name: string, options: { inProcess?: boolean } = {}) => {
      try {
        // Runs the job in this process, so it needs the same boot as the
        // scheduler entry (actions/src/schedule/run.ts): without it the
        // events the job dispatches reach no listener.
        const { injectGlobalAutoImports } = await import('@stacksjs/server')
        await injectGlobalAutoImports()
        const { runScheduler, Schedule } = await import('@stacksjs/scheduler')
        await runScheduler()
        await Promise.resolve()
        await Schedule.runNow(name, { inProcess: options.inProcess === true })
        await Schedule.gracefulShutdown()
        log.success(`Scheduled task ${name} completed.`)
        await log.flush()
        process.exit(ExitCode.Success)
      }
      catch (err) {
        await log.error(`[schedule:run-one] failed: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(ExitCode.FatalError)
      }
    })

  for (const [command, enabled, description] of [
    ['schedule:enable', true, descriptions.enable],
    ['schedule:disable', false, descriptions.disable],
  ] as const) {
    buddy
      .command(`${command} <name>`, description)
      .action(async (name: string) => {
        try {
          const { runScheduler, Schedule } = await import('@stacksjs/scheduler')
          await runScheduler()
          await Promise.resolve()
          const exists = Schedule.listJobs().some(job => job.name === name)
          await Schedule.gracefulShutdown()
          if (!exists)
            throw new Error(`Scheduled task "${name}" was not found.`)
          Schedule.setEnabled(name, enabled)
          log.success(`Scheduled task ${name} ${enabled ? 'resumed' : 'paused'}.`)
          await log.flush()
          process.exit(ExitCode.Success)
        }
        catch (err) {
          await log.error(`[${command}] failed: ${err instanceof Error ? err.message : String(err)}`)
          process.exit(ExitCode.FatalError)
        }
      })
  }
}
