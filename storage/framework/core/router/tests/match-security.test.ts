import { beforeEach, describe, expect, test } from 'bun:test'
import { clearMiddlewareCache, clearRouteMiddlewareRegistry, createStacksRouter } from '../src/stacks-router'

beforeEach(() => {
  clearMiddlewareCache()
  clearRouteMiddlewareRegistry()
})

describe('match route chains', () => {
  test('applies authentication to every matched method including lowercase input', async () => {
    const router = createStacksRouter()
    router.match(['get', 'post', 'put', 'patch', 'delete'], '/match-auth', () => new Response('secret')).middleware('auth').skipCsrf()
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      const response = await router.handleRequest(new Request('http://localhost/match-auth', { method }))
      expect(response.status).toBe(401)
    }
  })

  test('configures live methods even when the first registration is shadowed', async () => {
    const router = createStacksRouter()
    router.get('/match-shadow', () => new Response('public'))
    router.match(['GET', 'POST'], '/match-shadow', () => new Response('secret')).middleware('auth').skipCsrf()
    expect((await router.handleRequest(new Request('http://localhost/match-shadow'))).status).toBe(200)
    expect((await router.handleRequest(new Request('http://localhost/match-shadow', { method: 'POST' }))).status).toBe(401)
  })

  test('propagates body ownership and CSRF policy to every matched method', async () => {
    const router = createStacksRouter()
    router.match(['POST', 'PUT'], '/match-body', async (request: Request) => new Response(await request.text()))
      .parseBody(false).skipCsrf()
    for (const method of ['POST', 'PUT']) {
      const response = await router.handleRequest(new Request('http://localhost/match-body', {
        method, body: '{invalid JSON', headers: { 'content-type': 'application/json' },
      }))
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('{invalid JSON')
    }
    router.match(['POST', 'PUT'], '/match-csrf', () => new Response('secret')).skipCsrf().requireCsrf()
    for (const method of ['POST', 'PUT']) {
      expect((await router.handleRequest(new Request('http://localhost/match-csrf', { method }))).status).not.toBe(200)
    }
  })
})
