import type { FSWatcher } from 'node:fs'
import { existsSync, readdirSync, watch } from 'node:fs'
import process from 'node:process'
import { join } from 'node:path'
import { projectPath, storagePath } from '@stacksjs/path'

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
    storagePath('framework/defaults/app'),
    storagePath('framework/defaults/routes'),
    storagePath('framework/defaults/resources/functions'),
    ...coreSources,
  ].filter(existsSync)
}

export async function runDashboardSupervisor(entry: string, args: string[]): Promise<number> {
  const watchers: FSWatcher[] = []
  let child: ReturnType<typeof Bun.spawn> | null = null
  let generation = 0
  let restarting = false
  let stopping = false
  let restartTimer: ReturnType<typeof setTimeout> | undefined
  let settled = false

  return new Promise<number>((resolve) => {
    const finish = (code: number) => {
      if (settled)
        return
      settled = true
      if (restartTimer)
        clearTimeout(restartTimer)
      for (const watcher of watchers)
        watcher.close()
      process.off('SIGINT', stop)
      process.off('SIGTERM', stop)
      resolve(code)
    }

    const startChild = () => {
      const currentGeneration = ++generation
      child = Bun.spawn([process.execPath, entry, ...args], {
        cwd: process.cwd(),
        env: { ...process.env, STACKS_DASHBOARD_WORKER: '1' },
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit',
      })
      void child.exited.then((code) => {
        if (!stopping && !restarting && currentGeneration === generation)
          finish(code)
      })
    }

    const restart = async () => {
      if (restarting || stopping)
        return
      restarting = true
      const previous = child
      generation++
      if (previous) {
        previous.kill('SIGTERM')
        await previous.exited
      }
      if (!stopping)
        startChild()
      restarting = false
    }

    const scheduleRestart = () => {
      if (restartTimer)
        clearTimeout(restartTimer)
      restartTimer = setTimeout(() => {
        console.log('\n  Backend source changed. Restarting the dashboard server.\n')
        void restart()
      }, 100)
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
  })
}
