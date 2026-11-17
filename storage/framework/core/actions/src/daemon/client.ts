import type { DaemonState, DaemonStatus } from './server'
import type { OpenedDashboard } from './supervisor'
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { extname } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { isProcessAlive } from '@stacksjs/path'
import { machineEnvironment } from './environment'
import { DAEMON_PROTOCOL, daemonDir, daemonLogFile, daemonSocket, daemonStateFile } from './paths'

/**
 * Talking to the background daemon, and starting it when it is not there.
 *
 * Nothing asks a person to start the daemon. Whatever needs it calls
 * `openProjectDashboard`, which brings it up first if it has to: the CLI, the
 * dashboard's own server when the project switcher is used, the menu-bar app.
 */

/** The daemon answered, and the answer was a refusal worth showing. */
export class DaemonError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'DaemonError'
  }
}

/** The running daemon's own account of itself, or null when none is running. */
export function readDaemonState(): DaemonState | null {
  try {
    const state = JSON.parse(readFileSync(daemonStateFile(), 'utf8')) as DaemonState
    return typeof state.pid === 'number' && isProcessAlive(state.pid) ? state : null
  }
  catch {
    return null
  }
}

async function send(path: string, body?: unknown): Promise<{ status: number, payload: Record<string, unknown> | null }> {
  const response = await fetch(`http://buddy${path}`, {
    unix: daemonSocket(),
    method: body === undefined ? 'GET' : 'POST',
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  } as RequestInit)

  return { status: response.status, payload: await response.json().catch(() => null) as Record<string, unknown> | null }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const { status, payload } = await send(path, body)
  if (status < 200 || status >= 300 || payload === null)
    throw new DaemonError(status, typeof payload?.error === 'string' ? payload.error : `The buddy daemon answered ${status}.`)

  return payload as T
}

/** How long a caller waits for a dashboard to come up before giving up on it. */
const OPEN_TIMEOUT_MS = 180_000

/** What the daemon is running, or null when it is not running. */
export async function daemonStatus(): Promise<DaemonStatus | null> {
  if (!readDaemonState())
    return null

  try {
    return await request<DaemonStatus>('/status')
  }
  catch {
    // A pid that is alive but not answering is not a daemon to talk to.
    return null
  }
}

/** `--conditions` as this process was given it, for a child that runs the same source. */
function conditionArgs(execArgv: string[]): string[] {
  const args: string[] = []
  for (let index = 0; index < execArgv.length; index++) {
    const arg = execArgv[index]!
    if (arg === '--conditions' && execArgv[index + 1] !== undefined)
      args.push(arg, execArgv[++index]!)
    else if (arg.startsWith('--conditions='))
      args.push(arg)
  }
  return args
}

async function waitFor<T>(probe: () => Promise<T | null> | T | null, ms: number): Promise<T | null> {
  const deadline = Date.now() + ms
  for (;;) {
    const value = await probe()
    if (value !== null || Date.now() >= deadline)
      return value
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}

/**
 * Make sure a daemon this code can talk to is running.
 *
 * One left over from an older release is replaced: every project carries its
 * own framework version, so the daemon in memory may predate what is asking.
 */
export async function startDaemon(): Promise<{ status: DaemonStatus, started: boolean }> {
  const running = await daemonStatus()
  if (running && running.protocol >= DAEMON_PROTOCOL)
    return { status: running, started: false }

  if (readDaemonState())
    await stopDaemon()

  const socket = daemonSocket()
  // The kernel caps a socket path at about a hundred bytes, and a longer one
  // fails as an unrelated-looking "address" error far from here.
  if (Buffer.byteLength(socket) > 100)
    throw new Error(`The daemon's socket path is too long for the system (${socket}). Set STACKS_HOME to a shorter directory.`)

  mkdirSync(daemonDir(), { recursive: true, mode: 0o700 })
  const entry = fileURLToPath(new URL(`./run${extname(import.meta.url)}`, import.meta.url))
  const output = openSync(daemonLogFile(), 'a')

  try {
    Bun.spawn([process.execPath, ...conditionArgs(process.execArgv), entry], {
      // Not a project directory: Bun reads `bunfig.toml` from where it starts,
      // and a project's preload must not run inside the daemon.
      cwd: daemonDir(),
      env: {
        ...machineEnvironment(),
        // Where this install keeps its modules, which the daemon's own imports
        // need when the framework is installed outside `node_modules`.
        ...(process.env.NODE_PATH ? { NODE_PATH: process.env.NODE_PATH } : {}),
        // Its two timings can be set for a run, which is how they are tested.
        ...(process.env.STACKS_DAEMON_IDLE_EXIT_MS ? { STACKS_DAEMON_IDLE_EXIT_MS: process.env.STACKS_DAEMON_IDLE_EXIT_MS } : {}),
        ...(process.env.STACKS_DASHBOARD_IDLE_EXIT_MS ? { STACKS_DASHBOARD_IDLE_EXIT_MS: process.env.STACKS_DASHBOARD_IDLE_EXIT_MS } : {}),
      },
      stdin: 'ignore',
      stdout: output,
      stderr: output,
      detached: true,
    }).unref()
  }
  finally {
    closeSync(output)
  }

  const status = await waitFor(daemonStatus, 10_000)
  if (!status)
    throw new Error(`The buddy daemon did not start. Its log is at ${daemonLogFile()}.`)

  return { status, started: true }
}

/** Stop the daemon and every dashboard it started. False when none was running. */
export async function stopDaemon(): Promise<boolean> {
  const state = readDaemonState()
  if (!state)
    return false

  try {
    await request('/shutdown', {})
  }
  catch {
    // Not answering: fall back to the signal it handles the same way.
    try {
      process.kill(state.pid, 'SIGTERM')
    }
    catch {
      // Gone between the read and the signal.
    }
  }

  const gone = await waitFor(() => (isProcessAlive(state.pid) ? null : true), 10_000)
  if (!gone) {
    try {
      process.kill(state.pid, 'SIGKILL')
    }
    catch {
      // Gone.
    }
  }

  return true
}

/**
 * Make a project's dashboard reachable and say where it is, starting the
 * daemon and the dashboard as needed.
 */
export async function openProjectDashboard(root: string): Promise<OpenedDashboard> {
  await startDaemon()

  // A dashboard that has to start answers `202 starting` until it is up; the
  // daemon keeps the one start going however often it is asked.
  const deadline = Date.now() + OPEN_TIMEOUT_MS
  for (;;) {
    const { status, payload } = await send('/dashboard/open', { path: root })
    if (status !== 202) {
      if (status < 200 || status >= 300 || payload === null)
        throw new DaemonError(status, typeof payload?.error === 'string' ? payload.error : `The buddy daemon answered ${status}.`)
      return payload as unknown as OpenedDashboard
    }

    if (Date.now() >= deadline)
      throw new DaemonError(504, `The dashboard for ${root} is still starting after ${OPEN_TIMEOUT_MS / 1000}s. Its log is in ${daemonDir('logs')}.`)
    await new Promise(resolve => setTimeout(resolve, 250))
  }
}

/** Stop a dashboard the daemon started. False when it was not the daemon's. */
export async function stopProjectDashboard(root: string): Promise<boolean> {
  if (!readDaemonState())
    return false

  return (await request<{ stopped: boolean }>('/dashboard/stop', { path: root })).stopped
}
