import { beforeEach, describe, expect, test } from 'bun:test'
import { path as p } from '@stacksjs/path'
import { clearMiddlewareCache, createStacksRouter, listRegisteredRoutes, shouldUseNativeRoutesByDefault, url } from '../src/stacks-router'

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
    router.resource('posts', 'Actions/Blog/Blog')
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
    router.resource('tags', 'Actions/Blog/Blog', { only: ['index', 'show'] })
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
    router.resource('comments', 'Actions/Blog/Blog', { except: ['destroy'] })
    const routes = router.bunRouter.routes
    const paths = routes.map((r: any) => `${r.method}:${r.path}`)
    expect(paths).toContain('GET:/comments')
    expect(paths).toContain('POST:/comments')
    expect(paths).toContain('GET:/comments/:id')
    expect(paths).toContain('PUT:/comments/:id')
    expect(paths).not.toContain('DELETE:/comments/:id')
  })

  /*
   * The composed handler PATH, not just the route count.
   *
   * This test used to assert `routes.length >= 5` with a comment saying handler
   * resolution was covered at the integration level. It was not covered
   * anywhere - a string handler is resolved lazily, when the route is first
   * hit, so five registered routes pointing at five nonexistent files looked
   * exactly like five working ones. `resource()` composed a bare
   * `'PostIndexAction'`, which the resolver's generic branch looks for at
   * `app/PostIndexAction.ts`, while `buddy make:crud` writes to
   * `app/Actions/` - so the scaffolded, documented happy path 500'd on first
   * request for the life of the feature.
   */
  test('resource() composes handler paths under Actions/', () => {
    const router = createStacksRouter()
    router.resource('resource_paths', 'Actions/Blog/Blog')

    const handlers = listRegisteredRoutes()
      .filter(r => r.path.startsWith('/resource_paths'))
      .map(r => r.handler)

    expect(handlers).toContain('Actions/Blog/BlogIndexAction')
    expect(handlers).toContain('Actions/Blog/BlogStoreAction')
    expect(handlers).toContain('Actions/Blog/BlogShowAction')
    expect(handlers).toContain('Actions/Blog/BlogUpdateAction')
    expect(handlers).toContain('Actions/Blog/BlogDestroyAction')
  })

  test('resource() adds the Actions/ prefix to a bare base', () => {
    const router = createStacksRouter()
    router.resource('bare_base', 'Blog/Blog')

    const handlers = listRegisteredRoutes()
      .filter(r => r.path.startsWith('/bare_base'))
      .map(r => r.handler)

    // Not 'Blog/BlogIndexAction', which resolves to app/Blog/BlogIndexAction.ts.
    expect(handlers).toContain('Actions/Blog/BlogIndexAction')
  })

  test('resource() strips a trailing Action from the base', () => {
    const router = createStacksRouter()
    router.resource('stripped', 'Actions/Blog/BlogAction')

    const handlers = listRegisteredRoutes()
      .filter(r => r.path.startsWith('/stripped'))
      .map(r => r.handler)

    expect(handlers).toContain('Actions/Blog/BlogIndexAction')
    expect(handlers).not.toContain('Actions/Blog/BlogActionIndexAction')
  })

  /*
   * The composed paths name files that are really there. Pins the router's
   * naming convention to the one `buddy make:crud` writes, which is the pair
   * that had silently drifted apart.
   */
  test('the composed paths resolve to real action files', async () => {
    const router = createStacksRouter()
    // A BARE base, the form `buddy make:crud` tells you to write. This is the
    // one that resolved to `app/Blog/BlogIndexAction.ts` and 500'd.
    router.resource('real_files', 'Blog/Blog')

    const handlers = listRegisteredRoutes()
      .filter(r => r.path.startsWith('/real_files'))
      .map(r => r.handler)
      .filter((h): h is string => typeof h === 'string')

    expect(handlers.length).toBe(5)

    for (const handler of handlers) {
      const file = p.storagePath(`framework/defaults/app/${handler}.ts`)
      expect(await Bun.file(file).exists()).toBe(true)
    }
  })

  test('resource() returns the router for chaining', () => {
    const router = createStacksRouter()
    const result = router.resource('items', 'Actions/Blog/Blog')
    expect(result).toBe(router)
  })
})

// ============================================================================
// Health route
// ============================================================================

describe('createStacksRouter - health()', () => {
  test('health() registers a GET /api/health route', () => {
    // Mounted under /api so a userland `resources/views/health/index.stx`
    // page can still own `/health` without colliding with the framework's
    // liveness probe (see stacks-router.ts:1743-1746).
    const router = createStacksRouter()
    router.health()
    const routes = router.bunRouter.routes
    expect(routes.some((r: any) => r.method === 'GET' && r.path === '/api/health')).toBe(true)
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

describe('production native route default', () => {
  test('accepts static, parameter, and trailing wildcard routes', () => {
    const router = createStacksRouter()
    router.get('/health', () => ({ ok: true }))
    router.get('/users/{id}', () => ({ ok: true }))
    router.get('/assets/*', () => ({ ok: true }))

    expect(shouldUseNativeRoutesByDefault(router.routes)).toBe(true)
  })

  test.each([
    { label: 'mixed parameter', mutate: (route: any) => { route.path = '/users/user-{id}' } },
    { label: 'constraint', mutate: (route: any) => { route.constraints = { id: '\\d+' } } },
    { label: 'domain', mutate: (route: any) => { route.domain = 'admin.example.com' } },
    { label: 'explicit opt-out', mutate: (route: any) => { route.nativeDispatch = false } },
  ])('keeps the whole table on the established matcher for a $label route', ({ mutate }) => {
    const router = createStacksRouter()
    router.get('/users/{id}', () => ({ ok: true }))
    mutate(router.routes[0])

    expect(shouldUseNativeRoutesByDefault(router.routes)).toBe(false)
  })

  test('does not enable native matching for an empty table', () => {
    expect(shouldUseNativeRoutesByDefault([])).toBe(false)
  })
})
