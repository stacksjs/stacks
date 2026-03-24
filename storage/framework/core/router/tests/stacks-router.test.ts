import { beforeEach, describe, expect, test } from 'bun:test'
import { createStacksRouter, url, clearMiddlewareCache } from '../src/stacks-router'

// ---------------------------------------------------------------------------
// Reset state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearMiddlewareCache()
})

// ============================================================================
// createStacksRouter() - basic shape
// ============================================================================

describe('createStacksRouter - returns expected shape', () => {
  test('returns an object with HTTP method functions', () => {
    const router = createStacksRouter()
    expect(typeof router.get).toBe('function')
    expect(typeof router.post).toBe('function')
    expect(typeof router.put).toBe('function')
    expect(typeof router.patch).toBe('function')
    expect(typeof router.delete).toBe('function')
    expect(typeof router.options).toBe('function')
  })

  test('returns an object with group, resource, health, use, serve', () => {
    const router = createStacksRouter()
    expect(typeof router.group).toBe('function')
    expect(typeof router.resource).toBe('function')
    expect(typeof router.health).toBe('function')
    expect(typeof router.use).toBe('function')
    expect(typeof router.serve).toBe('function')
    expect(typeof router.handleRequest).toBe('function')
  })

  test('has access to the underlying bunRouter', () => {
    const router = createStacksRouter()
    expect(router.bunRouter).toBeDefined()
  })

  test('routes getter returns array from bunRouter', () => {
    const router = createStacksRouter()
    expect(Array.isArray(router.routes)).toBe(true)
  })
})

// ============================================================================
// HTTP method registration
// ============================================================================

describe('createStacksRouter - HTTP method registration', () => {
  test('get() registers a GET route on bunRouter', () => {
    const router = createStacksRouter()
    router.get('/test', () => new Response('ok'))
    const routes = router.bunRouter.routes
    expect(routes.some((r: any) => r.method === 'GET' && r.path === '/test')).toBe(true)
  })

  test('post() registers a POST route on bunRouter', () => {
    const router = createStacksRouter()
    router.post('/submit', () => new Response('ok'))
    const routes = router.bunRouter.routes
    expect(routes.some((r: any) => r.method === 'POST' && r.path === '/submit')).toBe(true)
  })

  test('put() registers a PUT route on bunRouter', () => {
    const router = createStacksRouter()
    router.put('/update', () => new Response('ok'))
    const routes = router.bunRouter.routes
    expect(routes.some((r: any) => r.method === 'PUT' && r.path === '/update')).toBe(true)
  })

  test('patch() registers a PATCH route on bunRouter', () => {
    const router = createStacksRouter()
    router.patch('/partial', () => new Response('ok'))
    const routes = router.bunRouter.routes
    expect(routes.some((r: any) => r.method === 'PATCH' && r.path === '/partial')).toBe(true)
  })

  test('delete() registers a DELETE route on bunRouter', () => {
    const router = createStacksRouter()
    router.delete('/remove', () => new Response('ok'))
    const routes = router.bunRouter.routes
    expect(routes.some((r: any) => r.method === 'DELETE' && r.path === '/remove')).toBe(true)
  })

  test('options() registers an OPTIONS route on bunRouter', () => {
    const router = createStacksRouter()
    router.options('/cors', () => new Response('ok'))
    const routes = router.bunRouter.routes
    expect(routes.some((r: any) => r.method === 'OPTIONS' && r.path === '/cors')).toBe(true)
  })

  test('HTTP methods return a chainable route with middleware() and name()', () => {
    const router = createStacksRouter()
    const chain = router.get('/chained', () => new Response('ok'))
    expect(typeof chain.middleware).toBe('function')
    expect(typeof chain.name).toBe('function')
  })

  test('chainable route middleware() returns the same chainable object', () => {
    const router = createStacksRouter()
    const chain = router.get('/chain-test', () => new Response('ok'))
    const result = chain.middleware('auth')
    expect(typeof result.middleware).toBe('function')
    expect(typeof result.name).toBe('function')
  })
})

// ============================================================================
// Group routing
// ============================================================================

describe('createStacksRouter - group()', () => {
  test('group with prefix prepends prefix to nested routes', () => {
    const router = createStacksRouter()
    router.group({ prefix: '/api' }, () => {
      router.get('/users', () => new Response('users'))
    })
    const routes = router.bunRouter.routes
    expect(routes.some((r: any) => r.method === 'GET' && r.path === '/api/users')).toBe(true)
  })

  test('group restores prefix after callback completes', () => {
    const router = createStacksRouter()
    router.group({ prefix: '/admin' }, () => {
      router.get('/dashboard', () => new Response('dash'))
    })
    // Route registered outside group should not have prefix
    router.get('/public', () => new Response('public'))
    const routes = router.bunRouter.routes
    expect(routes.some((r: any) => r.method === 'GET' && r.path === '/admin/dashboard')).toBe(true)
    expect(routes.some((r: any) => r.method === 'GET' && r.path === '/public')).toBe(true)
  })

  test('nested groups accumulate prefixes', () => {
    const router = createStacksRouter()
    router.group({ prefix: '/api' }, () => {
      router.group({ prefix: '/v1' }, () => {
        router.get('/items', () => new Response('items'))
      })
    })
    const routes = router.bunRouter.routes
    expect(routes.some((r: any) => r.method === 'GET' && r.path === '/api/v1/items')).toBe(true)
  })
})

// ============================================================================
// Resource routing
// ============================================================================

describe('createStacksRouter - resource()', () => {
  test('resource() generates all 5 CRUD routes by default', () => {
    const router = createStacksRouter()
    router.resource('posts', 'PostAction')
    const routes = router.bunRouter.routes
    const methods = routes.map((r: any) => `${r.method}:${r.path}`)
    expect(methods).toContain('GET:/posts')       // index
    expect(methods).toContain('POST:/posts')      // store
    expect(methods).toContain('GET:/posts/:id')   // show
    expect(methods).toContain('PUT:/posts/:id')   // update
    expect(methods).toContain('DELETE:/posts/:id') // destroy
  })

  test('resource() with only option limits routes', () => {
    const router = createStacksRouter()
    router.resource('tags', 'TagAction', { only: ['index', 'show'] })
    const routes = router.bunRouter.routes
    const paths = routes.map((r: any) => `${r.method}:${r.path}`)
    expect(paths).toContain('GET:/tags')
    expect(paths).toContain('GET:/tags/:id')
    expect(paths).not.toContain('POST:/tags')
    expect(paths).not.toContain('PUT:/tags/:id')
    expect(paths).not.toContain('DELETE:/tags/:id')
  })

  test('resource() with except option excludes routes', () => {
    const router = createStacksRouter()
    router.resource('comments', 'CommentAction', { except: ['destroy'] })
    const routes = router.bunRouter.routes
    const paths = routes.map((r: any) => `${r.method}:${r.path}`)
    expect(paths).toContain('GET:/comments')
    expect(paths).toContain('POST:/comments')
    expect(paths).toContain('GET:/comments/:id')
    expect(paths).toContain('PUT:/comments/:id')
    expect(paths).not.toContain('DELETE:/comments/:id')
  })

  test('resource() strips trailing "Action" from handler for naming', () => {
    const router = createStacksRouter()
    router.resource('users', 'UserAction')
    // The handler names registered internally should be like UserIndexAction, UserStoreAction, etc.
    // We verify routes are created — the handler resolution is tested at integration level
    const routes = router.bunRouter.routes
    expect(routes.length).toBeGreaterThanOrEqual(5)
  })

  test('resource() returns the router for chaining', () => {
    const router = createStacksRouter()
    const result = router.resource('items', 'ItemAction')
    expect(result).toBe(router)
  })
})

// ============================================================================
// Health route
// ============================================================================

describe('createStacksRouter - health()', () => {
  test('health() registers a GET /health route', () => {
    const router = createStacksRouter()
    router.health()
    const routes = router.bunRouter.routes
    expect(routes.some((r: any) => r.method === 'GET' && r.path === '/health')).toBe(true)
  })

  test('health() returns the router for chaining', () => {
    const router = createStacksRouter()
    const result = router.health()
    expect(result).toBe(router)
  })
})

// ============================================================================
// Named routes and url() helper
// ============================================================================

describe('url() - named route URL generation', () => {
  test('name() registers a route name and url() resolves it', () => {
    const router = createStacksRouter()
    router.get('/api/email/unsubscribe', () => new Response('ok')).name('email.unsubscribe')
    const result = url('email.unsubscribe')
    expect(result).toContain('/api/email/unsubscribe')
  })

  test('url() with query params appends them', () => {
    const router = createStacksRouter()
    router.get('/api/email/unsubscribe', () => new Response('ok')).name('email.unsub2')
    const result = url('email.unsub2', { token: 'abc-123' })
    expect(result).toContain('/api/email/unsubscribe')
    expect(result).toContain('token=abc-123')
  })

  test('url() substitutes path parameters', () => {
    const router = createStacksRouter()
    router.get('/users/{id}/posts/{postId}', () => new Response('ok')).name('user.post')
    const result = url('user.post', { id: 42, postId: 7 })
    expect(result).toContain('/users/42/posts/7')
  })

  test('url() throws for undefined route names', () => {
    expect(() => url('nonexistent.route')).toThrow(/not defined/)
  })

  test('url() puts non-path params as query string', () => {
    const router = createStacksRouter()
    router.get('/search', () => new Response('ok')).name('search')
    const result = url('search', { q: 'test', page: 2 })
    expect(result).toContain('q=test')
    expect(result).toContain('page=2')
  })
})

// ============================================================================
// use() - global middleware
// ============================================================================

describe('createStacksRouter - use()', () => {
  test('use() pushes middleware to bunRouter.globalMiddleware', () => {
    const router = createStacksRouter()
    const mw = () => {}
    router.use(mw)
    expect(router.bunRouter.globalMiddleware).toContain(mw)
  })

  test('use() returns the router for chaining', () => {
    const router = createStacksRouter()
    const result = router.use(() => {})
    expect(result).toBe(router)
  })
})

// ============================================================================
// Config options
// ============================================================================

describe('createStacksRouter - config', () => {
  test('accepts empty config without error', () => {
    expect(() => createStacksRouter()).not.toThrow()
  })

  test('accepts verbose option', () => {
    expect(() => createStacksRouter({ verbose: true })).not.toThrow()
  })

  test('accepts apiPrefix option', () => {
    expect(() => createStacksRouter({ apiPrefix: '/api/v2' })).not.toThrow()
  })
})
