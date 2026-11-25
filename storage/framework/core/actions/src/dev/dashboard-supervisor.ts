import type { OwnedProcess } from '@stacksjs/cli/owned-process'
import type { FSWatcher } from 'node:fs'
import { existsSync, readdirSync, watch } from 'node:fs'
import process from 'node:process'
import { join } from 'node:path'
import { spawnOwnedProcess } from '@stacksjs/cli/owned-process'
import { createServeRelay, reserveRelayWorkerPort, retireRelayWorker } from '@stacksjs/cli/serve-relay'
import { clearProjectService, defaultsPath, projectPath, recordProjectService, storagePath } from '@stacksjs/path'
import { serveAppRestart } from './app-session-control'
import { openDashboardNativeWindow } from './dashboard-native'
import { createIdleExit } from './dashboard-projects'
import { dashboardHttpsAnswers, startDashboardReverseProxy } from './dashboard-proxy'
import { runningDashboardInstance } from './dashboard-restart'
import { findAvailablePort } from './dashboard-utils'
import { frontendBuildId } from './frontend-hmr'

const BACKEND_SOURCE_RE = /\.(?:[cm]?[jt]sx?|json)$/i
const DECLARATION_RE = /\.d\.[cm]?ts$/i

export function isDashboardBackendSource(filename: string): boolean {
  return BACKEND_SOURCE_RE.test(filename) && !DECLARATION_RE.test(filename)
}

export function dashboardBackendWatchRoots(): string[] {
  const coreRoot = storagePath('framework/core')
  const coreSources = existsSync(coreRoot)
    ? readdirSync(coreRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => join(coreRoot, entry.name, 'src'))
        .filter(existsSync)
    : []

  return [
    projectPath('app'),
    projectPath('routes'),
    projectPath('config'),
    projectPath('resources/functions'),
    defaultsPath('app'),
    defaultsPath('routes'),
    defaultsPath('resources/functions'),
    ...coreSources,
  ].filter(existsSync)
}

interface DashboardReadiness {
  instance: string
  domain: string | null
  url: string
}

type DashboardRelay = ReturnType<typeof createServeRelay>

interface DashboardWorker {
  child: OwnedProcess
  target: ReturnType<DashboardRelay['createTarget']>
  ready: Promise<DashboardReadiness>
}

export async function runDashboardSupervisor(entry: string, args: string[]): Promise<number> {
  const root = projectPath()
  const preferredPort = process.env.PORT_ADMIN === '0' ? 0 : Number(process.env.PORT_ADMIN) || 3002
  const idleMs = Number(process.env.STACKS_DASHBOARD_IDLE_EXIT_MS) || 0
  const grace = Number(process.env.SHUTDOWN_GRACE_MS)
  const drainMs = Number.isFinite(grace) && grace > 0 ? grace : 15_000
  const verboseIndex = args.indexOf('--verbose')
  const verbose = verboseIndex !== -1 && args[verboseIndex + 1] !== 'false'
  const shutdown = new AbortController()
  const hmrSession = crypto.randomUUID()
  const { promise: finished, resolve: finish } = Promise.withResolvers<number>()
  const workers = new Set<DashboardWorker>()
  const watchers: FSWatcher[] = []
  let active: DashboardWorker | undefined
  let browserUrl: string | undefined
  let instance: string | undefined
  let nativeWindow: ReturnType<typeof Bun.spawn> | undefined
  let closeRestart: (() => void) | undefined
  let idle: ReturnType<typeof createIdleExit> | undefined
  let restarting: Promise<void> | undefined
  let restartTimer: ReturnType<typeof setTimeout> | undefined
  const relay = createServeRelay('127.0.0.1', preferredPort ? await findAvailablePort(preferredPort) : 0, () => idle?.touch())
  let publicPort: number

  function publish(readyInstance: string, url: string): void {
    recordProjectService(root, {
      name: 'dashboard',
      pid: process.pid,
      port: publicPort,
      url,
      startedAt: new Date().toISOString(),
      restartInstance: readyInstance,
      ...(idleMs > 0 ? { idleExitMs: idleMs } : {}),
    })
  }

  async function startWorker(): Promise<DashboardWorker> {
    const port = await reserveRelayWorkerPort()
    shutdown.signal.throwIfAborted()
    const workerInstance = crypto.randomUUID()
    const { promise: announced, resolve: announce } = Promise.withResolvers<DashboardReadiness>()
    let exited = false
    let target: DashboardWorker['target'] | undefined
    const child = spawnOwnedProcess([process.execPath, ...process.execArgv, entry, ...args], {
      cwd: root,
      env: {
        ...process.env,
        STACKS_DASHBOARD_WORKER: '1',
        STACKS_DASHBOARD_SUPERVISOR_PID: String(process.pid),
        STACKS_DASHBOARD_PUBLIC_PORT: String(publicPort),
        STACKS_DASHBOARD_PUBLIC_URL: browserUrl,
        STACKS_DASHBOARD_INSTANCE: workerInstance,
        STACKS_SERVE_RELAY_PORT: String(port),
        STX_BUILD_ID: process.env.STX_BUILD_ID || frontendBuildId(entry, hmrSession, {
          serve: process.env.BUN_PLUGIN_STX_SRC,
          stx: process.env.STX_SRC,
        }),
      },
      stdin: 'ignore',
      stdout: 'inherit',
      stderr: 'inherit',
      stopGraceMs: 0,
      ipc(message) {
        target?.onMessage(message)
        if (message && typeof message === 'object' && 'type' in message && message.type === 'stacks:dashboard-ready'
          && 'instance' in message && message.instance === workerInstance
          && 'url' in message && typeof message.url === 'string'
          && 'domain' in message && (message.domain === null || typeof message.domain === 'string'))
          announce({ instance: workerInstance, domain: message.domain, url: message.url })
      },
    })
    const ready = announced.then(async (announcement) => {
      const deadline = Date.now() + 10_000
      while (!exited && !shutdown.signal.aborted && Date.now() < deadline) {
        if (await runningDashboardInstance(port) === workerInstance)
          return announcement
        await Bun.sleep(50)
      }
      throw new Error('The dashboard replacement did not answer its readiness check.')
    })
    void ready.catch(() => {})
    const worker = { child, target: target = relay.createTarget(port, child.send), ready }
    workers.add(worker)
    void child.exited.then(({ code }) => {
      exited = true
      worker.target.close()
      workers.delete(worker)
      if (active === worker)
        stop(code)
    }, (error: unknown) => {
      exited = true
      worker.target.close()
      if (active === worker) {
        console.error('Dashboard worker failed:', error)
        stop(1)
      }
    })
    return worker
  }

  async function promote(worker: DashboardWorker): Promise<DashboardReadiness> {
    const signal = AbortSignal.any([shutdown.signal, AbortSignal.timeout(90_000)])
    const wait = new AbortController()
    try {
      const ready = await Promise.race([
        worker.ready,
        worker.child.exited.then(({ code }) => { throw new Error(`The dashboard worker exited before it was ready (status ${code}).`) }),
        new Promise<never>((_, reject) => {
          const abort = () => reject(new Error('The dashboard worker did not become ready.'))
          if (signal.aborted)
            abort()
          else
            signal.addEventListener('abort', abort, { once: true, signal: wait.signal })
        }),
      ])
      shutdown.signal.throwIfAborted()
      const url = browserUrl ?? ready.url
      publish(ready.instance, url)
      relay.promote(worker.target)
      active = worker
      instance = ready.instance
      browserUrl = url
      worker.child.send({ type: 'stacks:dashboard-url', url })
      return ready
    }
    finally {
      wait.abort()
    }
  }

  function restart(): Promise<void> {
    if (restartTimer)
      clearTimeout(restartTimer)
    restarting ??= (async () => {
      shutdown.signal.throwIfAborted()
      const previous = active!
      idle?.stop()
      const candidate = await startWorker()
      try {
        await promote(candidate)
      }
      catch (error) {
        await candidate.child.stop()
        throw error
      }
      // Retire the previous worker in the background. New source edits and
      // Restart Now can promote another worker while old requests finish.
      previous.child.send({ type: 'stacks:dashboard-hmr-reconnect' })
      void retireRelayWorker(previous.child, previous.target, drainMs).catch(error => console.error('Dashboard worker drain failed:', error))
    })().finally(() => {
      restarting = undefined
      if (!shutdown.signal.aborted)
        idle = createIdleExit(idleMs, stop)
    })
    return restarting
  }

  function scheduleRestart(): void {
    if (restarting || shutdown.signal.aborted)
      return
    if (restartTimer)
      clearTimeout(restartTimer)
    restartTimer = setTimeout(restartFromSignal, 100)
  }

  function restartFromSignal(): void {
    void restart().catch(error => console.error('Dashboard restart failed:', error))
  }

  function handleSignal(): void {
    stop()
  }

  function stop(code = 0): void {
    shutdown.abort()
    finish(code)
  }

  process.once('SIGINT', handleSignal)
  process.once('SIGTERM', handleSignal)
  try {
    publicPort = await relay.listening
    const initial = await startWorker()
    const ready = await promote(initial)
    idle = createIdleExit(idleMs, stop)
    try {
      closeRestart = serveAppRestart(root, 'dashboard', restart)
    }
    catch (error) {
      console.warn('Could not register the dashboard restart endpoint:', error)
    }
    if (process.platform !== 'win32')
      process.on('SIGUSR2', restartFromSignal)

    for (const path of dashboardBackendWatchRoots()) {
      try {
        watchers.push(watch(path, { recursive: true }, (_event, filename) => {
          if (!filename || isDashboardBackendSource(String(filename)))
            scheduleRestart()
        }))
      }
      catch (error) {
        console.warn(`[dashboard] Could not watch backend source root ${path}:`, error)
      }
    }

    const localUrl = `http://127.0.0.1:${publicPort}`
    void startDashboardReverseProxy({ domain: ready.domain, address: `127.0.0.1:${publicPort}`, pid: process.pid, verbose }).then(async (started) => {
      const current = instance
      if (!started || !ready.domain || !current || !await dashboardHttpsAnswers(ready.domain, current) || shutdown.signal.aborted)
        return
      const url = `https://${ready.domain}`
      publish(instance!, url)
      browserUrl = url
      active?.child.send({ type: 'stacks:dashboard-url', url })
      console.log(`  Dashboard available at ${url}`)
    }).catch(error => console.warn('Could not publish the dashboard HTTPS address:', error))

    void openDashboardNativeWindow(localUrl, verbose).then(async (app) => {
      if (!app)
        return
      if (shutdown.signal.aborted) {
        app.kill()
        await app.exited
        return
      }
      nativeWindow = app
      const code = await app.exited
      if (code === 0)
        stop()
      else if (!shutdown.signal.aborted)
        console.warn(`Native dashboard window exited with code ${code}. The dashboard is at ${browserUrl}.`)
    }).catch(error => console.warn('Could not open the native dashboard window:', error))

    return await finished
  }
  catch (error) {
    if (shutdown.signal.aborted)
      return await finished
    console.error('Could not start the dashboard:', error)
    return 1
  }
  finally {
    shutdown.abort()
    closeRestart?.()
    idle?.stop()
    if (restartTimer)
      clearTimeout(restartTimer)
    relay.stop()
    for (const watcher of watchers)
      watcher.close()
    nativeWindow?.kill()
    await Promise.allSettled([...workers].map(async (worker) => {
      worker.target.close()
      await worker.child.stop()
    }))
    await nativeWindow?.exited
    clearProjectService(root, 'dashboard')
    process.off('SIGINT', handleSignal)
    process.off('SIGTERM', handleSignal)
    process.off('SIGUSR2', restartFromSignal)
  }
}
