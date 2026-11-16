import { describe, expect, test } from 'bun:test'
import { createStacksRouter, listRegisteredRoutes } from '../src/stacks-router'

const ok = (): Response => new Response('ok')

describe('route.monitor()', () => {
  test('is reported with the route, and absent where it was not said', () => {
    const router = createStacksRouter()
    router.get('/monitor-opt/plain', ok)
    router.get('/monitor-opt/off', ok).monitor(false)
    router.get('/monitor-opt/posts/{id}', ok).middleware('auth').monitor({ path: '/monitor-opt/posts/1', expect: [401] })

    const routes = Object.fromEntries(listRegisteredRoutes().filter(r => r.path.startsWith('/monitor-opt/')).map(r => [r.path, r.monitor]))
    expect(routes['/monitor-opt/plain']).toBeUndefined()
    expect(routes['/monitor-opt/off']).toBe(false)
    expect(routes['/monitor-opt/posts/{id}']).toEqual({ path: '/monitor-opt/posts/1', expect: [401] })
  })

  test('refuses a value that is not false or an object, and a path with no slash', () => {
    const router = createStacksRouter()
    expect(() => router.get('/monitor-opt/bad-1', ok).monitor(true as never)).toThrow('.monitor()')
    expect(() => router.get('/monitor-opt/bad-2', ok).monitor({ path: 'posts/1' })).toThrow('path must start with a slash')
  })
})
