import type { DaemonStatus } from '@stacksjs/actions/daemon/server'
import type { RegisteredProject } from '@stacksjs/path'
import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'

interface TrayServices {
  status: () => Promise<DaemonStatus | null>
  projects: () => RegisteredProject[]
  start: () => Promise<unknown>
  dashboard: (project: RegisteredProject) => Promise<void>
  review: (project: RegisteredProject) => Promise<void>
  quit: () => void
}

export function traySnapshot(status: DaemonStatus | null, projects: RegisteredProject[]) {
  const approvals = new Map(status?.generation?.approvals?.map(({ path, files }) => [path, files]))
  const failures = new Map(status?.generation?.failures?.map(({ path, error }) => [path, error]))
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
    })),
  }
}

export function createTrayApi(token: string, services: TrayServices) {
  const authorization = Buffer.from(`Bearer ${token}`)
  const json = (body: unknown, status = 200) => Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  })
  return async (request: Request, origin: string): Promise<Response> => {
    const requestOrigin = request.headers.get('origin')
    const supplied = Buffer.from(request.headers.get('authorization') ?? '')
    if ((requestOrigin !== null && requestOrigin !== origin) || supplied.length !== authorization.length
      || !timingSafeEqual(supplied, authorization))
      return json({ error: 'This request did not come from the Buddy menu bar.' }, 403)

    const path = new URL(request.url).pathname
    try {
      if (path === '/api/status' && request.method === 'GET')
        return json(traySnapshot(await services.status(), services.projects()))
      if (path !== '/api/action' || request.method !== 'POST')
        return json({ error: 'Unknown Buddy tray endpoint.' }, 404)
      if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json')
        return json({ error: 'Send a JSON request.' }, 415)

      const input = await request.json().catch(() => null) as { action?: unknown, project?: unknown } | null
      if (input?.action === 'start') {
        await services.start()
      }
      else if (input?.action === 'quit') {
        services.quit()
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
