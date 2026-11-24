import type { ProjectService } from '@stacksjs/path'
import process from 'node:process'
import { clearProjectService, listProjectServiceInstances, recordProjectService } from '@stacksjs/path'

const loopback = '127.0.0.1'
const restartPath = '/restart'

export function runningAppDevSessions(root: string): ProjectService[] {
  return runningSessions(root, 'dev')
}

export function runningAppSessions(root: string): ProjectService[] {
  return [...runningAppDevSessions(root), ...runningSessions(root, 'serve')]
}

function runningSessions(root: string, serviceName: 'dev' | 'serve'): ProjectService[] {
  return listProjectServiceInstances(root, serviceName).filter(service =>
    Number.isInteger(service.port) && service.port > 0 && service.port <= 65535
    && typeof service.controlToken === 'string' && /^[\da-f-]{36}$/.test(service.controlToken),
  )
}

export function serveAppRestart(root: string, serviceName: 'dev' | 'serve', restart: () => Promise<void>): () => void {
  const token = crypto.randomUUID()
  const name = `${serviceName}-${process.pid}`
  const server = Bun.serve({
    hostname: loopback,
    port: 0,
    idleTimeout: 0,
    async fetch(request, server) {
      if (request.method !== 'POST' || new URL(request.url).pathname !== restartPath)
        return new Response(null, { status: 404 })
      if (request.headers.has('origin') || request.headers.get('host') !== `${loopback}:${server.port}`
        || request.headers.get('authorization') !== `Bearer ${token}`)
        return new Response(null, { status: 403 })

      try {
        await restart()
        return new Response(null, { status: 204 })
      }
      catch (error) {
        return new Response(error instanceof Error ? error.message : 'Could not restart the app services.', { status: 503 })
      }
    },
  })
  try {
    recordProjectService(root, {
      name,
      pid: process.pid,
      port: server.port!,
      url: server.url.origin,
      startedAt: new Date().toISOString(),
      controlToken: token,
    })
  }
  catch (error) {
    void server.stop(true)
    throw error
  }
  return () => {
    clearProjectService(root, name)
    void server.stop(true)
  }
}

export async function restartAppSession(service: ProjectService): Promise<void> {
  const response = await fetch(`http://${loopback}:${service.port}${restartPath}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${service.controlToken}` },
    signal: AbortSignal.timeout(120_000),
    redirect: 'error',
  }).catch(() => null)
  if (!response)
    throw new Error('Buddy could not reach the app session or it did not finish restarting.')
  if (response.status !== 204)
    throw new Error(response.status === 503 ? await response.text() : 'Buddy could not restart the app session.')
}
