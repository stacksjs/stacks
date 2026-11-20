import type { CLI } from '@stacksjs/types'
import { existsSync, readFileSync } from 'node:fs'
import process from 'node:process'
import { bold, dim, green, onUnknownSubcommand } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

/**
 * `buddy daemon` - buddy in the background.
 *
 * One small process for the whole machine that starts a project's dashboard
 * when something asks for it (see `@stacksjs/actions/daemon/server`). Nobody
 * has to run these commands for that to work: whatever needs the daemon starts
 * it, and it stops itself once it has nothing to look after. They are here to
 * see what it is doing and to stop it now.
 */

function uptime(since: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(since)) / 60_000))
  if (minutes < 1)
    return 'just now'
  if (minutes < 60)
    return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/** Resident memory of a process in megabytes, or null where `ps` cannot say. */
function memoryMb(pid: number): number | null {
  const result = Bun.spawnSync(['ps', '-o', 'rss=', '-p', String(pid)], { stdout: 'pipe', stderr: 'ignore' })
  const kilobytes = Number(result.stdout.toString().trim())
  return result.exitCode === 0 && kilobytes > 0 ? Math.round(kilobytes / 1024) : null
}

export function daemon(buddy: CLI): void {
  const descriptions = {
    status: 'Show whether buddy is running in the background and what it is running',
    start: 'Start buddy in the background',
    stop: 'Stop background generation and the dashboards buddy started',
    restart: 'Restart the background buddy',
    logs: 'Print the background buddy\'s log',
    json: 'Print the status as JSON',
  }

  async function status(options: { json?: boolean }): Promise<void> {
    const { daemonStatus } = await import('@stacksjs/actions/daemon/client')
    const running = await daemonStatus()

    if (options.json) {
      process.stdout.write(`${JSON.stringify(running, null, 2)}\n`)
      return
    }

    if (!running) {
      console.log(`buddy is not running in the background. ${dim('It starts when something needs it: buddy dashboard')}`)
      return
    }

    const memory = memoryMb(running.pid)
    console.log(`${green('●')} buddy is running in the background ${dim(`(pid ${running.pid}, up ${uptime(running.startedAt)}${memory ? `, ${memory} MB` : ''})`)}`)

    if (running.generation) {
      const { watched, queued, running: active, failures } = running.generation
      console.log(`  Generation  ${watched} watched, ${queued} queued${active ? `, running for ${active}` : ''}`)
      for (const failure of failures)
        console.log(`  ${failure.path}  ${failure.error}`)
    }

    if (running.dashboards.length === 0) {
      console.log(dim('  No dashboards running.'))
      return
    }

    const width = Math.max(...running.dashboards.map(dashboard => dashboard.name.length))
    for (const dashboard of running.dashboards) {
      const state = dashboard.state === 'ready' ? dashboard.url : dim('starting')
      console.log(`  ${bold(dashboard.name.padEnd(width))}  ${state}  ${dim(`up ${uptime(dashboard.startedAt)}`)}`)
    }
  }

  for (const name of ['daemon', 'daemon:status']) {
    buddy
      .command(name, descriptions.status)
      .option('--json', descriptions.json, { default: false })
      .action(async (options: { json?: boolean }) => {
        await status(options)
        process.exit(ExitCode.Success)
      })
  }

  buddy
    .command('daemon:start', descriptions.start)
    .action(async () => {
      const { startDaemon } = await import('@stacksjs/actions/daemon/client')
      const { status: running, started } = await startDaemon()
      console.log(started
        ? `${green('●')} buddy is now running in the background ${dim(`(pid ${running.pid})`)}`
        : `buddy is already running in the background ${dim(`(pid ${running.pid})`)}`)
      process.exit(ExitCode.Success)
    })

  buddy
    .command('daemon:stop', descriptions.stop)
    .action(async () => {
      const { stopDaemon } = await import('@stacksjs/actions/daemon/client')
      console.log(await stopDaemon() ? 'Stopped the background buddy.' : 'buddy was not running in the background.')
      process.exit(ExitCode.Success)
    })

  buddy
    .command('daemon:restart', descriptions.restart)
    .action(async () => {
      const { startDaemon, stopDaemon } = await import('@stacksjs/actions/daemon/client')
      await stopDaemon()
      const { status: running } = await startDaemon()
      console.log(`${green('●')} buddy is running in the background ${dim(`(pid ${running.pid})`)}`)
      process.exit(ExitCode.Success)
    })

  buddy
    .command('daemon:logs', descriptions.logs)
    .option('--lines <count>', 'How many lines from the end to print', { default: 50 })
    .action(async (options: { lines?: number | string }) => {
      const { daemonLogFile } = await import('@stacksjs/actions/daemon/paths')
      const file = daemonLogFile()
      if (!existsSync(file)) {
        console.log('The background buddy has not written a log yet.')
        process.exit(ExitCode.Success)
      }

      const lines = readFileSync(file, 'utf8').trimEnd().split('\n')
      process.stdout.write(`${lines.slice(-(Number(options.lines) || 50)).join('\n')}\n`)
      process.exit(ExitCode.Success)
    })

  onUnknownSubcommand(buddy, 'daemon')
}
