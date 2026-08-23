/**
 * Typed routes, driven through a real server.
 *
 * The claim this makes is about the runtime half: an action registered by
 * import takes the SAME path through the router as one registered by name -
 * validation, `authorize`, `before`, result formatting, CSRF flags, the lot -
 * so the typed form is additive rather than a second dispatch path that will
 * drift. The compile-time half is asserted in `tests/typed-router.test-d.ts`,
 * which is checked by `bun run typecheck`; types alone would not catch a route
 * that lies about its own response, and a live request alone would not catch a
 * client call site that expects the wrong shape.
 */

import { Action } from '@stacksjs/actions'
import { schema } from '@stacksjs/validation'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { createStacksRouter } from '../src/stacks-router'
import { createTypedRouter } from '../src/typed-router'

const ListProjects = new Action({
  name: 'ListProjects',
  handle() {
    return { projects: [{ id: 1, name: 'apollo' }] }
  },
})

const ShowProject = new Action({
  name: 'ShowProject',
  handle(request: any) {
    return { id: Number(request.params.id), name: 'apollo' }
  },
})

const StoreProject = new Action({
  name: 'StoreProject',
  validations: {
    name: { rule: schema.string().min(2) },
    budget: { rule: schema.number() },
  },
  skipCsrf: true,
  handle(request: any) {
    return { id: 7, name: request.get('name'), budget: request.get('budget') }
  },
})

const GuardedProject = new Action({
  name: 'GuardedProject',
  authorize() {
    return false
  },
  handle() {
    return { reached: true }
  },
})

let server: any = null
let port = 0

beforeAll(async () => {
  const router = createStacksRouter()

  createTypedRouter(router)
    .get('/typed/projects', ListProjects)
    .get('/typed/projects/{id}', ShowProject)
    .post('/typed/projects', StoreProject)
    .get('/typed/guarded', GuardedProject, { name: 'typed.guarded' })

  server = await router.serve({ port: 0, hostname: '127.0.0.1' })
  port = Number(server?.port ?? server?.server?.port ?? 0)
})

afterAll(() => {
  server?.stop?.()
})

function call(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${path}`, init)
}

describe('createTypedRouter', () => {
  it('serves an action registered by import', async () => {
    expect(await (await call('/typed/projects')).json()).toEqual({ projects: [{ id: 1, name: 'apollo' }] })
  })

  it('passes path params through unchanged', async () => {
    expect(await (await call('/typed/projects/42')).json()).toEqual({ id: 42, name: 'apollo' })
  })

  it('runs the action validations', async () => {
    const answer = await call('/typed/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'apollo', budget: 1200 }),
    })

    expect(answer.status).toBe(200)
    expect(await answer.json()).toEqual({ id: 7, name: 'apollo', budget: 1200 })
  })

  it('rejects a body the validations do not accept', async () => {
    const answer = await call('/typed/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'a', budget: 'not-a-number' }),
    })

    expect(answer.status).toBe(422)
  })

  it('honours skipCsrf declared on the action, with no token in sight', async () => {
    // Without the flag being read at registration this POST would come back
    // 403 — which is the whole reason the string form prefetches its action.
    const answer = await call('/typed/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'apollo', budget: 1 }),
    })

    expect(answer.status).not.toBe(403)
  })

  it('runs the action lifecycle: a false authorize is a 403', async () => {
    expect((await call('/typed/guarded')).status).toBe(403)
  })

  it('applies per-route options', async () => {
    const { listRegisteredRoutes } = await import('../src/stacks-router')
    const guarded = listRegisteredRoutes().find(r => r.path === '/typed/guarded')

    expect(guarded?.name).toBe('typed.guarded')
  })

  it('reports the action itself, so the OpenAPI generator has a schema to read', async () => {
    const { listRegisteredRoutes } = await import('../src/stacks-router')
    const stored = listRegisteredRoutes().find(r => r.path === '/typed/projects' && r.method === 'POST')

    expect(stored?.action).toBe(StoreProject as any)
    expect(Object.keys((stored?.action as any)?.validations ?? {})).toEqual(['name', 'budget'])
  })
})
