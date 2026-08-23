/**
 * The typed client against a real server.
 *
 * Types alone cannot catch a route that lies about its own response, so this
 * boots the router, points the client at it, and checks that what arrives
 * matches what the type promised. `typed-router.test-d.ts` is the other half:
 * it checks the promise itself, at compile time.
 */

import { Action } from '@stacksjs/actions'
import { schema } from '@stacksjs/validation'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { createTypedClient, TypedClientError } from '@stacksjs/bun-router'
import { createStacksRouter } from '../src/stacks-router'
import { createTypedRouter } from '../src/typed-router'

const IndexAction = new Action({
  name: 'ClientIndex',
  handle() {
    return { projects: [{ id: 1, name: 'apollo' }] }
  },
})

const ShowAction = new Action({
  name: 'ClientShow',
  handle(request: any) {
    return { id: Number(request.params.id), name: 'apollo', archived: false }
  },
})

const SearchAction = new Action({
  name: 'ClientSearch',
  handle(request: any) {
    return { q: request.query.q ?? null, page: request.query.page ?? null }
  },
})

const StoreAction = new Action({
  name: 'ClientStore',
  validations: {
    name: { rule: schema.string().min(2) },
    budget: { rule: schema.number() },
  },
  skipCsrf: true,
  handle(request: any) {
    return { id: 9, name: request.get('name'), budget: request.get('budget') }
  },
})

const DestroyAction = new Action({
  name: 'ClientDestroy',
  skipCsrf: true,
  handle() {
    return null
  },
})

const EchoParamAction = new Action({
  name: 'ClientEchoParam',
  handle(request: any) {
    return { id: request.params.id }
  },
})

const EchoHeaderAction = new Action({
  name: 'ClientEchoHeader',
  handle(request: any) {
    return { token: request.headers.get('x-bench-token') }
  },
})

let server: any = null
let port = 0
let client: ReturnType<typeof createTypedClient<typeof api>>
let api: any

beforeAll(async () => {
  const router = createStacksRouter()

  api = createTypedRouter(router)
    .get('/client/projects', IndexAction)
    .get('/client/projects/{id}', ShowAction)
    .get('/client/search', SearchAction)
    .post('/client/projects', StoreAction)
    .delete('/client/projects/{id}', DestroyAction)
    .get('/client/whoami', EchoHeaderAction)
    .get('/client/echo/{id}', EchoParamAction)

  server = await router.serve({ port: 0, hostname: '127.0.0.1' })
  port = Number(server?.port ?? server?.server?.port ?? 0)

  client = createTypedClient({ baseUrl: `http://127.0.0.1:${port}` })
})

afterAll(() => {
  server?.stop?.()
})

describe('createTypedClient', () => {
  it('returns the shape the action returned', async () => {
    expect(await client.get('/client/projects')).toEqual({ projects: [{ id: 1, name: 'apollo' }] })
  })

  it('substitutes brace-form path params', async () => {
    expect(await client.get('/client/projects/{id}', { params: { id: '42' } }))
      .toEqual({ id: 42, name: 'apollo', archived: false })
  })

  it('percent-encodes a param rather than letting it address another route', async () => {
    // Left raw, the slashes in this value would make it a different path
    // entirely. Encoded, it stays one segment and arrives at the action whole.
    expect(await client.get('/client/echo/{id}', { params: { id: '7/../1' } }))
      .toEqual({ id: '7/../1' })
  })

  it('appends query parameters', async () => {
    expect(await client.get('/client/search', { query: { q: 'apollo', page: 2 } }))
      .toEqual({ q: 'apollo', page: '2' })
  })

  it('drops undefined query values instead of sending the string "undefined"', async () => {
    expect(await client.get('/client/search', { query: { q: 'apollo', page: undefined } }))
      .toEqual({ q: 'apollo', page: null })
  })

  it('sends a JSON body and returns the action result', async () => {
    expect(await client.post('/client/projects', { name: 'apollo', budget: 1200 }))
      .toEqual({ id: 9, name: 'apollo', budget: 1200 })
  })

  it('throws a TypedClientError carrying the status and the parsed body', async () => {
    // Deliberately past the type, which is the point: the client cannot stop a
    // server from refusing a request, only describe the refusal well.
    const attempt = client.post('/client/projects', { name: 'a', budget: 'nope' } as any)

    await expect(attempt).rejects.toBeInstanceOf(TypedClientError)
    await attempt.catch((error: TypedClientError) => {
      expect(error.status).toBe(422)
      expect(error.body).toBeTruthy()
    })
  })

  it('hands a 204 back as undefined rather than choking on an empty body', async () => {
    expect(await client.delete('/client/projects/{id}', { params: { id: '1' } })).toBeUndefined()
  })

  it('sends the base headers, re-read per request', async () => {
    let token = 'first'
    const rotating = createTypedClient<typeof api>({
      baseUrl: `http://127.0.0.1:${port}`,
      headers: () => ({ 'x-bench-token': token }),
    })

    expect(await rotating.get('/client/whoami')).toEqual({ token: 'first' })
    token = 'second'
    expect(await rotating.get('/client/whoami')).toEqual({ token: 'second' })
  })

  it('routes a refusal through onError when one is configured', async () => {
    const forgiving = createTypedClient<typeof api>({
      baseUrl: `http://127.0.0.1:${port}`,
      onError: error => ({ failed: error.status }),
    })

    expect(await forgiving.post('/client/projects', { name: 'a', budget: 'nope' } as any))
      .toEqual({ failed: 422 } as any)
  })
})
