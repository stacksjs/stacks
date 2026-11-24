import type { ProjectService } from '@stacksjs/path'
import process from 'node:process'
import { isProcessAlive, isProjectRoot, readProjectService } from '@stacksjs/path'
import { daemonStatus, openProjectDashboard, stopProjectDashboard } from '../daemon/client'
import { findRestartControl, restartAppSession, runningAppSessions } from './app-session-control'
import { dashboardPendingHeader, dashboardReadyHeader, dashboardReadyPath } from './dashboard-proxy'

/** A dashboard must be supervised or owned by the Buddy daemon to be restarted. */
export function canRestartDashboard(root: string): boolean {
  const service = isProjectRoot(root) ? readProjectService(root, 'dashboard') : null
  return Boolean(service && (service.idleExitMs
    || (service.restartInstance && (process.platform !== 'win32' || findRestartControl(root, 'dashboard', service.pid)))))
}

export async function runningDashboardInstance(port: number): Promise<string | null> {
  const response = await fetch(`http://127.0.0.1:${port}${dashboardReadyPath}`, {
    method: 'HEAD',
    redirect: 'error',
    headers: { connection: 'close' },
    signal: AbortSignal.timeout(800),
  }).catch(() => null)
  if (!response?.ok || response.headers.get(dashboardPendingHeader) === '1')
    return null
  return response.headers.get(dashboardReadyHeader)
}

/** The supervisor can stay alive while no worker has a published service record. */
export async function waitForDashboardRestart(root: string, previous: ProjectService, signal?: AbortSignal): Promise<void> {
  const deadline = Date.now() + 115_000
  while (Date.now() < deadline) {
    signal?.throwIfAborted()
    const next = readProjectService(root, 'dashboard')
    if (!isProcessAlive(previous.pid) || (next && next.pid !== previous.pid))
      throw new Error('The dashboard stopped before it could restart.')
    if (next?.restartInstance && next.restartInstance !== previous.restartInstance
      && await runningDashboardInstance(next.port) === next.restartInstance)
      return
    await Bun.sleep(100)
  }
  throw new Error('The dashboard restarted but has not finished starting.')
}

export async function restartProjectDashboard(root: string): Promise<void> {
  const service = isProjectRoot(root) ? readProjectService(root, 'dashboard') : null
  if (!service)
    throw new Error('This dashboard has already stopped.')

  const control = service.restartInstance ? findRestartControl(root, 'dashboard', service.pid) : null
  if (control) {
    await restartAppSession(control)
    return
  }

  // A supervisor predating the restart endpoint still handles this signal.
  if (service.restartInstance && process.platform !== 'win32') {
    if (await runningDashboardInstance(service.port) !== service.restartInstance)
      throw new Error('This dashboard is still starting. Try again when it is ready.')

    process.kill(service.pid, 'SIGUSR2')
    await waitForDashboardRestart(root, service)
    return
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
