import type { ProjectService } from '@stacksjs/path'
import { basename } from 'node:path'
import { DASHBOARD_IDLE_EXIT_MS, DASHBOARD_PORT_BASE } from './paths'

/**
 * Runs the dashboards of the projects on this machine, one process each.
 *
 * A dashboard cannot be re-pointed at another project: its config, database
 * connection, routes and model globals are all bound when the process starts.
 * Showing another project therefore means a process started in that project,
 * and somebody has to start it, remember it and stop it. That is this class.
 *
 * It starts one only when asked, and never a second for the same project: a
 * dashboard that is already up is reused whoever started it, because every
 * dashboard records itself in its own project (`readProjectService`). It does
 * not watch them. Each one counts its own idle time and exits, and the only
 * thing this holds per dashboard is the promise that resolves when it does.
 */

/** A started dashboard, reduced to what the supervisor needs of it. */
export interface DashboardProcess {
  pid: number
  exited: Promise<number | null>
  /** Signal the dashboard and everything it started. */
  kill: (signal?: NodeJS.Signals) => void
}

export interface DashboardLaunch {
  root: string
  port: number
  env: Record<string, string>
}

export interface DashboardSnapshot {
  name: string
  path: string
  url: string
  port: number
  pid: number
  state: 'starting' | 'ready'
  startedAt: string
}

export interface OpenedDashboard {
  url: string
  port: number
  /** False when it was already running. */
  started: boolean
}

/** A refusal the caller should show as it is, with the status it maps to. */
export class DashboardError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'DashboardError'
  }
}

export interface SupervisorOptions {
  isProject: (root: string) => boolean
  /** Whether the project can start a dashboard at all (it has its own `buddy`). */
  canLaunch: (root: string) => boolean
  launch: (launch: DashboardLaunch) => DashboardProcess
  readService: (root: string) => ProjectService | null
  reservePort: (root: string, base: number) => number | null
  portIsFree: (port: number) => Promise<boolean>
  portAnswers: (port: number) => Promise<boolean>
  dashboardBooting?: (port: number) => Promise<boolean>
  /** The end of what the dashboard printed, for an error worth reading. */
  logTail: (root: string) => string
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  startupTimeoutMs?: number
  pollMs?: number
  idleExitMs?: number
  /** Called whenever a dashboard starts or stops. */
  onChange?: () => void
}

interface Running {
  root: string
  process: DashboardProcess
  port: number
  url: string
  ready: boolean
  startedAt: number
  exited: boolean
}

export class DashboardSupervisor {
  private readonly running = new Map<string, Running>()
  private readonly opening = new Map<string, Promise<OpenedDashboard>>()
  private readonly sleep: (ms: number) => Promise<void>
  private readonly now: () => number
  private readonly startupTimeoutMs: number
  private readonly pollMs: number
  private readonly idleExitMs: number

  constructor(private readonly options: SupervisorOptions) {
    this.sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
    this.now = options.now ?? Date.now
    this.startupTimeoutMs = options.startupTimeoutMs ?? 120_000
    this.pollMs = options.pollMs ?? 150
    this.idleExitMs = options.idleExitMs ?? DASHBOARD_IDLE_EXIT_MS
  }

  /** How many dashboards this supervisor started and still holds. */
  get size(): number {
    return this.running.size
  }

  /**
   * Make a project's dashboard reachable and say where.
   *
   * Two callers asking for the same project at once share one start: a
   * double click on the switcher must not race two servers onto one port.
   */
  open(root: string): Promise<OpenedDashboard> {
    const pending = this.opening.get(root)
    if (pending)
      return pending

    const opening = this.ensure(root).finally(() => this.opening.delete(root))
    this.opening.set(root, opening)
    return opening
  }

  private async ensure(root: string): Promise<OpenedDashboard> {
    if (!this.options.isProject(root))
      throw new DashboardError(404, `${root} is not a Stacks project.`)

    // Up already, by anyone's hand: a terminal's `buddy dev:dashboard` counts.
    const service = this.options.readService(root)
    if (service) {
      if (await this.answersWithin(service.port, 10_000))
        return { url: service.url, port: service.port, started: false }

      throw new DashboardError(504, `The dashboard for ${basename(root)} is running (pid ${service.pid}) but is not answering at ${service.url}.`)
    }

    // One this supervisor started on a framework release that does not record
    // itself yet. Its port is known because it was handed to it.
    const held = this.running.get(root)
    if (held?.ready)
      return { url: held.url, port: held.port, started: false }

    if (!this.options.canLaunch(root))
      throw new DashboardError(409, `${basename(root)} has nothing installed yet, so there is no dashboard to start. Install its dependencies first: buddy install --project ${basename(root)}`)

    return this.start(root)
  }

  private async start(root: string): Promise<OpenedDashboard> {
    let port = this.options.reservePort(root, DASHBOARD_PORT_BASE) ?? DASHBOARD_PORT_BASE
    // The reservation keeps other projects off this port, not other programs.
    for (let attempt = 0; attempt < 100 && !(await this.options.portIsFree(port)); attempt++)
      port++

    const dashboard: Running = {
      root,
      port,
      url: `http://localhost:${port}`,
      ready: false,
      startedAt: this.now(),
      exited: false,
      process: this.options.launch({
        root,
        port,
        env: {
          PORT_ADMIN: String(port),
          // A background launch can publish into a shared proxy without
          // opening its own native window or prompting for administrator access.
          STACKS_NO_NATIVE: '1',
          STACKS_DASHBOARD_BACKGROUND: '1',
          STACKS_DASHBOARD_IDLE_EXIT_MS: String(this.idleExitMs),
        },
      }),
    }

    this.running.set(root, dashboard)
    this.options.onChange?.()
    void dashboard.process.exited.then(() => {
      dashboard.exited = true
      if (this.running.get(root) === dashboard)
        this.running.delete(root)
      this.options.onChange?.()
    })

    const deadline = this.now() + this.startupTimeoutMs
    while (this.now() < deadline) {
      if (dashboard.exited)
        throw new DashboardError(502, `The dashboard for ${basename(root)} stopped before it was ready.${this.tail(root)}`)

      // Its own record is the better answer: it carries the port it really
      // bound. A release without one is ready once its port answers.
      let service = this.options.readService(root)
      if (service || (await this.options.portAnswers(port) && !await this.options.dashboardBooting?.(port))) {
        service ??= this.options.readService(root)
        dashboard.port = service?.port ?? port
        dashboard.url = service?.url ?? dashboard.url
        dashboard.ready = true
        return { url: dashboard.url, port: dashboard.port, started: true }
      }

      await this.sleep(this.pollMs)
    }

    dashboard.process.kill('SIGTERM')
    throw new DashboardError(504, `The dashboard for ${basename(root)} did not come up within ${Math.round(this.startupTimeoutMs / 1000)}s.${this.tail(root)}`)
  }

  private tail(root: string): string {
    const tail = this.options.logTail(root).trim()
    return tail ? `\n\n${tail}` : ''
  }

  private async answersWithin(port: number, ms: number): Promise<boolean> {
    const deadline = this.now() + ms
    do {
      if (await this.options.portAnswers(port))
        return true
      await this.sleep(this.pollMs)
    } while (this.now() < deadline)

    return false
  }

  /**
   * Stop a dashboard this supervisor started. One started elsewhere is
   * somebody's terminal session and is left alone: false is returned.
   */
  async stop(root: string, graceMs = 5_000): Promise<boolean> {
    const dashboard = this.running.get(root)
    if (!dashboard)
      return false

    dashboard.process.kill('SIGTERM')
    const stopped = await Promise.race([
      dashboard.process.exited.then(() => true),
      this.sleep(graceMs).then(() => false),
    ])
    if (!stopped) {
      dashboard.process.kill('SIGKILL')
      await dashboard.process.exited
    }

    return true
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.running.keys()].map(root => this.stop(root)))
  }

  list(): DashboardSnapshot[] {
    return [...this.running.values()].map(dashboard => ({
      name: basename(dashboard.root),
      path: dashboard.root,
      url: dashboard.url,
      port: dashboard.port,
      pid: dashboard.process.pid,
      state: dashboard.ready ? 'ready' as const : 'starting' as const,
      startedAt: new Date(dashboard.startedAt).toISOString(),
    }))
  }
}
