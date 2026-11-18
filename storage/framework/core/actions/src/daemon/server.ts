import type { DashboardLaunch, DashboardProcess, DashboardSnapshot, OpenedDashboard } from './supervisor'
import { accessSync, chmodSync, closeSync, constants, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'
import { isProcessAlive, isProjectRoot, projectCliEntry, readProjectService, registerProject, reserveProjectPort } from '@stacksjs/path'
import { machineEnvironment } from './environment'
import { portAnswers, portIsFree } from './net'
import { DAEMON_IDLE_EXIT_MS, DAEMON_PROTOCOL, daemonDir, daemonSocket, daemonStateFile, dashboardLogFile } from './paths'
import { DashboardError, DashboardSupervisor } from './supervisor'

/**
 * `buddy` in the background: one small process for the whole machine.
 *
 * It exists so that a project's dashboard can be opened without that project
 * having a terminal: the dashboard's project switcher, `buddy dashboard` and
 * the menu-bar app all ask it for a project's dashboard, and it starts the one
 * that is not running yet and answers with where it is.
 *
 * What it costs while nothing is happening is the point of its design:
 *
 * - It loads the path helpers and nothing else. No CLI, no config, no ORM, no
 *   project: it never imports a project's code, it starts that project's own
 *   `buddy` in a process of its own.
 * - It polls nothing. It is woken by a request on its socket or by a
 *   dashboard exiting, and between those it has no timer running but the one
 *   that ends it.
 * - It does not outstay its use. Dashboards it started stop themselves when
 *   nobody has looked at them for a while, and with none left the daemon stops
 *   too. The next thing that needs it starts it again in a fraction of a
 *   second, so there is no login item and nothing to remember to quit.
 *
 * Its door is a unix socket in the user's own `~/.stacks`, not a port: no web
 * page can reach it, and no other user on the machine can open it.
 */

/** How long a request to open a dashboard waits before answering `starting`. */
const OPEN_ANSWER_WAIT_MS = 2_000

export interface DaemonState {
  pid: number
  protocol: number
  startedAt: string
}

export interface DaemonStatus extends DaemonState {
  dashboards: DashboardSnapshot[]
}

function log(message: string): void {
  // stdout is the daemon's log file; see `startDaemon` in ./client.
  // eslint-disable-next-line no-console
  console.log(`${new Date().toISOString()} ${message}`)
}

/**
 * Take the single-instance lock by creating the state file. An existing file
 * whose process is gone is a daemon that was killed, and is replaced.
 */
function acquireLock(state: DaemonState): boolean {
  const file = daemonStateFile()
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx' })
      return true
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
        throw error
    }

    let holder: number | undefined
    try {
      holder = (JSON.parse(readFileSync(file, 'utf8')) as DaemonState).pid
    }
    catch {
      // Unreadable: written by something that crashed halfway.
    }
    if (holder !== undefined && holder !== state.pid && isProcessAlive(holder))
      return false

    rmSync(file, { force: true })
  }

  return false
}

function isExecutable(file: string): boolean {
  try {
    accessSync(file, constants.X_OK)
    return true
  }
  catch {
    return false
  }
}

function logFileFor(root: string): string {
  return dashboardLogFile(registerProject(root)?.id ?? basename(root))
}

/**
 * Start a project's dashboard through that project's own `buddy`, so it runs
 * on the framework version the project pins.
 *
 * In its own process group, because `buddy dev:dashboard` is a small tree (the
 * CLI, the dashboard's supervisor, its worker) and stopping it means stopping
 * all three.
 */
function launchDashboard({ root, env }: DashboardLaunch): DashboardProcess {
  const logFile = logFileFor(root)
  mkdirSync(dirname(logFile), { recursive: true })
  const output = openSync(logFile, 'w')

  try {
    const child = Bun.spawn([join(root, 'buddy'), 'dev:dashboard'], {
      cwd: root,
      // The machine's variables only. The daemon's own module path belongs to
      // the project that started it, and this is a different project.
      env: { ...machineEnvironment(), ...env },
      stdin: 'ignore',
      stdout: output,
      stderr: output,
      detached: true,
    })

    return {
      pid: child.pid,
      exited: child.exited,
      kill: (signal = 'SIGTERM') => {
        try {
          process.kill(-child.pid, signal)
        }
        catch {
          // The group is already gone.
        }
      },
    }
  }
  finally {
    closeSync(output)
  }
}

function logTail(root: string, lines = 25): string {
  try {
    return readFileSync(logFileFor(root), 'utf8').trimEnd().split('\n').slice(-lines).join('\n')
  }
  catch {
    return ''
  }
}

export interface DaemonOptions {
  /** Stop after this long with no dashboard running and no request. 0 keeps it up. */
  idleExitMs?: number
  /** How long a dashboard it started may sit unused before stopping itself. */
  dashboardIdleExitMs?: number
}

/**
 * Run the daemon until it is told to stop or has nothing left to do. Returns
 * at once, having done nothing, when another daemon already holds the lock.
 */
export async function runDaemon(options: DaemonOptions = {}): Promise<void> {
  const idleExitMs = options.idleExitMs ?? (Number(process.env.STACKS_DAEMON_IDLE_EXIT_MS ?? '') || DAEMON_IDLE_EXIT_MS)
  const dashboardIdleExitMs = options.dashboardIdleExitMs ?? (Number(process.env.STACKS_DASHBOARD_IDLE_EXIT_MS ?? '') || undefined)
  const state: DaemonState = { pid: process.pid, protocol: DAEMON_PROTOCOL, startedAt: new Date().toISOString() }

  mkdirSync(daemonDir(), { recursive: true, mode: 0o700 })
  if (!acquireLock(state))
    return

  const socket = daemonSocket()
  rmSync(socket, { force: true })

  let idleTimer: ReturnType<typeof setTimeout> | undefined
  let stopping = false
  let finished: () => void = () => {}
  const done = new Promise<void>((resolve) => {
    finished = resolve
  })

  const supervisor = new DashboardSupervisor({
    isProject: isProjectRoot,
    // The shim alone is not enough: in a fresh clone it is there and has no
    // CLI behind it, and would die printing a path list instead of the fix.
    canLaunch: root => isExecutable(join(root, 'buddy')) && projectCliEntry(root) !== null,
    launch: (launch) => {
      log(`starting the dashboard for ${launch.root} on port ${launch.port}`)
      return launchDashboard(launch)
    },
    readService: root => readProjectService(root, 'dashboard'),
    reservePort: (root, base) => reserveProjectPort(root, 'dashboard', base),
    portIsFree,
    portAnswers,
    logTail,
    idleExitMs: dashboardIdleExitMs,
    onChange: () => restIfIdle(),
  })

  /**
   * (Re)start the one timer the daemon has. It only runs while there is
   * nothing to look after, and it ends the process when it fires.
   */
  function restIfIdle(): void {
    if (idleTimer)
      clearTimeout(idleTimer)
    idleTimer = undefined

    if (stopping || idleExitMs <= 0 || supervisor.size > 0)
      return

    idleTimer = setTimeout(() => {
      if (supervisor.size === 0)
        void shutdown('nothing left to look after')
    }, idleExitMs)
  }

  async function shutdown(reason: string): Promise<void> {
    if (stopping)
      return
    stopping = true
    if (idleTimer)
      clearTimeout(idleTimer)

    log(`stopping: ${reason}`)
    await supervisor.stopAll()
    await server.stop(true)
    rmSync(socket, { force: true })
    // Only this daemon's own lock: a replacement may already hold the file.
    try {
      if ((JSON.parse(readFileSync(daemonStateFile(), 'utf8')) as DaemonState).pid === process.pid)
        rmSync(daemonStateFile(), { force: true })
    }
    catch {
      // Already gone.
    }
    finished()
  }

  /**
   * Starts that are still under way, by project, so a caller that asks again
   * joins the same one and is eventually handed how it ended.
   *
   * Opening a dashboard is answered at once whenever it can be, and with
   * `202 starting` when it cannot: a first start takes longer than a request
   * should stay open (Bun drops one after ten seconds), so the caller asks
   * again until it gets an address or a reason.
   */
  const starts = new Map<string, { done: Promise<void>, result?: OpenedDashboard, error?: unknown }>()

  async function answerOpen(root: string): Promise<Response> {
    let start = starts.get(root)
    if (!start) {
      const entry: { done: Promise<void>, result?: OpenedDashboard, error?: unknown } = { done: Promise.resolve() }
      entry.done = supervisor.open(root).then(
        (result) => { entry.result = result },
        (error) => { entry.error = error },
      )
      starts.set(root, start = entry)
    }

    await Promise.race([start.done, new Promise(resolve => setTimeout(resolve, OPEN_ANSWER_WAIT_MS))])

    if (start.result === undefined && start.error === undefined)
      return Response.json({ starting: true }, { status: 202 })

    // Told once. The next request asks the supervisor afresh, which answers a
    // running dashboard at once and starts one that has since stopped.
    starts.delete(root)
    if (start.error !== undefined)
      throw start.error
    return Response.json(start.result)
  }

  async function projectOf(request: Request): Promise<string> {
    const body = await request.json().catch(() => null) as { path?: unknown } | null
    if (typeof body?.path !== 'string' || !body.path)
      throw new DashboardError(400, 'A project path is required.')
    return body.path
  }

  const server = Bun.serve({
    unix: socket,
    async fetch(request) {
      restIfIdle()
      const { pathname } = new URL(request.url)

      try {
        if (pathname === '/status')
          return Response.json({ ...state, dashboards: supervisor.list() } satisfies DaemonStatus)

        if (request.method !== 'POST')
          return Response.json({ error: 'Not found' }, { status: 404 })

        if (pathname === '/dashboard/open')
          return await answerOpen(await projectOf(request))

        if (pathname === '/dashboard/stop')
          return Response.json({ stopped: await supervisor.stop(await projectOf(request)) })

        if (pathname === '/shutdown') {
          // Answer first: the caller is waiting on this very connection.
          setTimeout(() => void shutdown('asked to stop'), 0)
          return Response.json({ stopping: true })
        }

        return Response.json({ error: 'Not found' }, { status: 404 })
      }
      catch (error) {
        if (error instanceof DashboardError)
          return Response.json({ error: error.message }, { status: error.status })

        log(`request failed: ${(error as Error)?.stack ?? error}`)
        return Response.json({ error: (error as Error)?.message ?? 'The daemon could not do that.' }, { status: 500 })
      }
    },
  })

  chmodSync(socket, 0o600)
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))

  log(`listening on ${socket} (pid ${process.pid})`)
  restIfIdle()
  await done
}
