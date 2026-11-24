import process from 'node:process'
import { isProjectRoot, readProjectService } from '@stacksjs/path'
import { daemonStatus, openProjectDashboard, stopProjectDashboard } from '../daemon/client'
import { restartAppSession, runningAppSessions } from './app-session-control'
import { dashboardPendingHeader, dashboardReadyHeader, dashboardReadyPath } from './dashboard-proxy'

/** A dashboard must be supervised or owned by the Buddy daemon to be restarted. */
export function canRestartDashboard(root: string): boolean {
  const service = isProjectRoot(root) ? readProjectService(root, 'dashboard') : null
  return Boolean(service && (service.restartInstance || service.idleExitMs))
}

async function runningInstance(port: number): Promise<string | null> {
  const response = await fetch(`http://127.0.0.1:${port}${dashboardReadyPath}`, {
    method: 'HEAD',
    redirect: 'error',
    signal: AbortSignal.timeout(800),
  }).catch(() => null)
  if (!response?.ok || response.headers.get(dashboardPendingHeader) === '1')
    return null
  return response.headers.get(dashboardReadyHeader)
}

export async function restartProjectDashboard(root: string): Promise<void> {
  const service = isProjectRoot(root) ? readProjectService(root, 'dashboard') : null
  if (!service)
    throw new Error('This dashboard has already stopped.')

  // A current supervisor reloads its own worker, preserving the launch mode,
  // environment, port, and the terminal that owns a foreground dashboard.
  if (service.restartInstance) {
    if (await runningInstance(service.port) !== service.restartInstance)
      throw new Error('This dashboard is still starting. Try again when it is ready.')

    process.kill(service.pid, 'SIGUSR2')
    const deadline = Date.now() + 120_000
    while (Date.now() < deadline) {
      const next = readProjectService(root, 'dashboard')
      if (!next)
        throw new Error('The dashboard stopped before it could restart.')
      if (next.restartInstance !== service.restartInstance) {
        const ready = await runningInstance(next.port)
        if (ready && ready !== service.restartInstance && (!next.restartInstance || ready === next.restartInstance))
          return
      }
      await Bun.sleep(200)
    }
    throw new Error('The dashboard restarted but has not finished starting.')
  }

  // Older backgrounds cannot handle a restart signal. Only Buddy's daemon
  // can stop its own dashboard and start it again through the updated CLI.
  const daemon = await daemonStatus()
  if (!daemon?.dashboards.some(dashboard => dashboard.path === root) || !await stopProjectDashboard(root))
    throw new Error('This dashboard was started outside Buddy’s managed lifecycle.')
  await openProjectDashboard(root)
}

export function canRestartUpdatedProject(root: string): boolean {
  return isProjectRoot(root) && (canRestartDashboard(root) || runningAppSessions(root).length > 0)
}

export async function restartUpdatedProject(root: string): Promise<void> {
  if (!isProjectRoot(root))
    throw new Error('Buddy could not find the updated project.')

  const sessions = runningAppSessions(root)
  const dashboard = canRestartDashboard(root)
  if (!sessions.length && !dashboard)
    throw new Error('The running app services and dashboard have already stopped.')

  // Keep the Settings connection available while the app services restart.
  const results = await Promise.allSettled(sessions.map(restartAppSession))
  if (dashboard)
    results.push(...await Promise.allSettled([restartProjectDashboard(root)]))

  const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason instanceof Error ? result.reason.message : String(result.reason)] : [])
  if (errors.length)
    throw new Error(errors.join(' '))
}
