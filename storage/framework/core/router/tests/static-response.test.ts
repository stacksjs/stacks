import { describe, expect, it } from 'bun:test'
import { createStacksRouter } from '../src'

describe('static responses', () => {
  it('serves final response bytes without entering the request pipeline', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    let middlewareCalls = 0

    router.use(async (_request, next) => {
      middlewareCalls++
      const response = await next()
      response.headers.set('x-global-middleware', 'applied')
      return response
    })
    router.staticResponse('POST', '/ready', new Response('ready', {
      status: 201,
      headers: {
        'content-length': '5',
        'content-type': 'text/plain',
        'x-final': 'yes',
      },
    }))

    const server = await router.serve({ port: 0, hostname: '127.0.0.1' })

    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/ready`, {
        method: 'POST',
        headers: { 'accept-encoding': 'gzip' },
      })

      expect(response.status).toBe(201)
      expect(await response.text()).toBe('ready')
      expect(response.headers.get('x-final')).toBe('yes')
      expect(response.headers.get('x-global-middleware')).toBeNull()
      expect(response.headers.get('x-request-id')).toBeNull()
      expect(response.headers.get('x-content-type-options')).toBeNull()
      expect(response.headers.get('access-control-allow-origin')).toBeNull()
      expect(response.headers.get('content-encoding')).toBeNull()
      expect(response.headers.get('set-cookie')).toBeNull()
      expect(middlewareCalls).toBe(0)

      const wrongMethod = await fetch(`http://127.0.0.1:${server.port}/ready`)
      expect(wrongMethod.status).toBe(405)
      expect(middlewareCalls).toBe(1)
    }
    finally {
      server.stop()
    }
  })

  it('rejects group behavior that the static response would bypass', () => {
    const middlewareRouter = createStacksRouter({ autoDiscoverRoutes: false })

    expect(() => middlewareRouter.group({ middleware: 'auth' }, () => {
      middlewareRouter.staticResponse('GET', '/guarded', new Response('no'))
    })).toThrow('cannot be registered inside a group with middleware')

    const apiRouter = createStacksRouter({ autoDiscoverRoutes: false })
    expect(() => apiRouter.group({ apiResponse: true }, () => {
      apiRouter.staticResponse('GET', '/forced-json', new Response('no'))
    })).toThrow('cannot be registered inside a group with apiResponse')
  })

  it('keeps the first static response registered for a method and path', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.staticResponse('GET', '/first-wins', new Response('first'))
    router.staticResponse('GET', '/first-wins', new Response('second'))
    const server = await router.serve({ port: 0, hostname: '127.0.0.1' })

    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/first-wins`)
      expect(await response.text()).toBe('first')
    }
    finally {
      server.stop()
    }
  })
})
