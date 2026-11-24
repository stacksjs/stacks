import type { FSWatcher } from 'node:fs'
import { existsSync, readdirSync, watch } from 'node:fs'
import process from 'node:process'
import { join } from 'node:path'
import { clearProjectService, defaultsPath, projectPath, readProjectService, storagePath } from '@stacksjs/path'
import { serveAppRestart } from './app-session-control'
import { runningDashboardInstance, waitForDashboardRestart } from './dashboard-restart'

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

export async function runDashboardSupervisor(entry: string, args: string[]): Promise<number> {
  const watchers: FSWatcher[] = []
  let child: ReturnType<typeof Bun.spawn> | null = null
  let generation = 0
  let restarting: Promise<void> | undefined
  let settingsRestart: Promise<void> | undefined
  let closeRestartControl: (() => void) | undefined
  const shutdown = new AbortController()
  let stopping = false
  let restartTimer: ReturnType<typeof setTimeout> | undefined
  let settled = false
  let restartPort: number | undefined
  const root = projectPath()

  return new Promise<number>((resolve) => {
    const finish = (code: number) => {
      if (settled)
        return
      settled = true
      shutdown.abort()
      closeRestartControl?.()
      if (restartTimer)
        clearTimeout(restartTimer)
      for (const watcher of watchers)
        watcher.close()
      // The worker records the dashboard under this process's pid, so the
      // record outlives a worker restart and ends here, with the supervisor.
      clearProjectService(projectPath(), 'dashboard')
      process.off('SIGINT', stop)
      process.off('SIGTERM', stop)
      process.off('SIGUSR2', restartFromSettings)
      resolve(code)
    }

    const startChild = () => {
      const currentGeneration = ++generation
      child = Bun.spawn([process.execPath, ...process.execArgv, entry, ...args], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ...(restartPort === undefined ? {} : { PORT_ADMIN: String(restartPort), STACKS_DASHBOARD_RESTART_PORT: String(restartPort) }),
          STACKS_DASHBOARD_WORKER: '1',
          STACKS_DASHBOARD_SUPERVISOR_PID: String(process.pid),
        },
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit',
      })
      void child.exited.then((code) => {
        if (!stopping && currentGeneration === generation)
          finish(code)
      })
    }

    const restart = (): Promise<void> => {
      if (stopping)
        return Promise.resolve()
      restarting ??= (async () => {
        const service = readProjectService(root, 'dashboard')
        if (service?.pid === process.pid)
          restartPort = service.port
        const previous = child
        generation++
        if (previous) {
          previous.kill('SIGTERM')
          await previous.exited
        }
        if (!stopping)
          startChild()
      })().finally(() => { restarting = undefined })
      return restarting
    }

    async function restartReadyDashboard(): Promise<void> {
      const previous = readProjectService(root, 'dashboard')
      if (previous?.pid !== process.pid || !previous.restartInstance
        || await runningDashboardInstance(previous.port) !== previous.restartInstance)
        throw new Error('This dashboard is still starting. Try again when it is ready.')

      if (restartTimer)
        clearTimeout(restartTimer)
      await restart()
      await waitForDashboardRestart(root, previous, shutdown.signal)
    }

    const scheduleRestart = () => {
      if (restartTimer)
        clearTimeout(restartTimer)
      restartTimer = setTimeout(() => {
        console.log('\n  Backend source changed. Restarting the dashboard server.\n')
        if (!settingsRestart)
          void restart().catch(error => console.error('Dashboard restart failed:', error))
      }, 100)
    }

    function restartFromSettings(): void {
      if (restartTimer)
        clearTimeout(restartTimer)
      void restart().catch(error => console.error('Dashboard restart failed:', error))
    }

    function stop(): void {
      if (stopping)
        return
      stopping = true
      generation++
      if (restartTimer)
        clearTimeout(restartTimer)
      const running = child
      if (!running) {
        finish(0)
        return
      }
      running.kill('SIGTERM')
      void running.exited.then(() => finish(0))
    }

    startChild()
    try {
      closeRestartControl = serveAppRestart(root, 'dashboard', () => {
        settingsRestart ??= restartReadyDashboard().finally(() => { settingsRestart = undefined })
        return settingsRestart
      })
    }
    catch (error) {
      console.warn('Could not register the dashboard restart endpoint:', error)
    }
    for (const root of dashboardBackendWatchRoots()) {
      try {
        const watcher = watch(root, { recursive: true }, (_event, filename) => {
          if (!filename || isDashboardBackendSource(String(filename)))
            scheduleRestart()
        })
        watchers.push(watcher)
      }
      catch (error) {
        console.warn(`[dashboard] Could not watch backend source root ${root}:`, error)
      }
    }

    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
    if (process.platform !== 'win32')
      process.on('SIGUSR2', restartFromSettings)
  })
}
