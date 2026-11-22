import type { DaemonStatus } from '@stacksjs/actions/daemon/server'
import type { RegisteredProject } from '@stacksjs/path'
import type { createTrayPantry } from './pantry'
import type { createSystemSampler } from './system'
import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'

interface TrayServices {
  status: () => Promise<DaemonStatus | null>
  projects: () => RegisteredProject[]
  start: () => Promise<unknown>
  dashboard: (project: RegisteredProject) => Promise<void>
  review: (project: RegisteredProject) => Promise<void>
  quit: () => void
  system: ReturnType<typeof createSystemSampler>
  pantry: ReturnType<typeof createTrayPantry>
}

export function traySnapshot(status: DaemonStatus | null, projects: RegisteredProject[]) {
  const approvals = new Map(status?.generation?.approvals?.map(({ path, files }) => [path, files]))
  const failures = new Map(status?.generation?.failures?.map(({ path, error }) => [path, error]))
  const dashboards = new Map(status?.dashboards.map(({ path, state }) => [path, state]))
  return {
    online: status !== null,
    watched: status?.generation?.watched ?? 0,
    running: status?.generation?.running != null,
    failed: failures.size,
    projects: projects.map(({ id, name, path }) => ({
      id,
      name,
      path,
      pending: approvals.get(path) ?? 0,
      issue: failures.get(path) ?? '',
      dashboard: dashboards.get(path) ?? 'stopped',
    })),
  }
}

export function createTrayApi(token: string, services: TrayServices, documentOrigin: string) {
  const authorization = Buffer.from(`Bearer ${token}`)
  const json = (body: unknown, status = 200) => Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': documentOrigin,
    },
  })
  return async (request: Request, origin: string): Promise<Response> => {
    const requestOrigin = request.headers.get('origin')
    const path = new URL(request.url).pathname
    if (requestOrigin === documentOrigin && request.method === 'OPTIONS' && path.startsWith('/api/')) {
      return new Response(null, { status: 204, headers: {
        'Access-Control-Allow-Origin': documentOrigin,
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Max-Age': '600',
      } })
    }
    const supplied = Buffer.from(request.headers.get('authorization') ?? '')
    if ((requestOrigin !== null && requestOrigin !== origin && requestOrigin !== documentOrigin) || supplied.length !== authorization.length
      || !timingSafeEqual(supplied, authorization))
      return json({ error: 'This request did not come from the Buddy menu bar.' }, 403)

    const url = new URL(request.url)
    try {
      if (request.method === 'GET') {
        if (path === '/api/status') {
          const [status, system] = await Promise.all([services.status(), services.system()])
          return json({ ...traySnapshot(status, services.projects()), system })
        }
        if (path === '/api/pantry')
          return json(await services.pantry.status())
        if (path === '/api/pantry/jobs')
          return json(await services.pantry.jobs())
        if (path === '/api/pantry/catalog') {
          const query = url.searchParams.get('q')?.trim() ?? ''
          return json(query.length >= 2 && query.length <= 100 ? services.pantry.catalog(query) : [])
        }
      }
      if (path !== '/api/action' || request.method !== 'POST')
        return json({ error: 'Unknown Buddy tray endpoint.' }, 404)
      if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json')
        return json({ error: 'Send a JSON request.' }, 415)

      const input = await request.json().catch(() => null) as { action?: unknown, project?: unknown, code?: unknown, domain?: unknown, requestId?: unknown } | null
      if (input?.action === 'start') {
        await services.start()
      }
      else if (input?.action === 'quit') {
        services.quit()
      }
      else if (input?.action === 'pantry:pair') {
        if (typeof input.code !== 'string' || !/^\d{8}$/.test(input.code))
          return json({ error: 'Enter Pantry’s eight-digit pairing code.' }, 400)
        await services.pantry.pair(input.code)
      }
      else if (input?.action === 'pantry:disconnect') {
        await services.pantry.disconnect()
      }
      else if (input?.action === 'pantry:install' || input?.action === 'pantry:uninstall') {
        if (typeof input.domain !== 'string' || !/^[a-z0-9][a-z0-9._/-]{0,199}$/i.test(input.domain)
          || typeof input.requestId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.requestId))
          return json({ error: 'Select a Pantry package and try again.' }, 400)
        const operation = input.action === 'pantry:install' ? 'install' : 'uninstall'
        return json(await services.pantry.change(operation, input.domain, input.requestId), 202)
      }
      else if (input?.action === 'dashboard' || input?.action === 'review') {
        const project = services.projects().find(({ id }) => id === input.project)
        if (!project)
          return json({ error: 'This project is no longer registered with Buddy.' }, 404)

        if (input.action === 'review') {
          const pending = (await services.status())?.generation?.approvals
          if (!pending?.some(approval => approval.path === project.path && approval.files > 0))
            return json({ error: 'This project has no changes awaiting review.' }, 409)
          await services.review(project)
        }
        else {
          await services.dashboard(project)
        }
      }
      else {
        return json({ error: 'Unknown Buddy tray action.' }, 400)
      }
      return json({ ok: true })
    }
    catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Buddy could not complete this action.' }, 500)
    }
  }
}
