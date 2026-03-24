import { describe, expect, test } from 'bun:test'
import { createStacksRouter, url } from '../src/stacks-router'

// ---------------------------------------------------------------------------
// createStacksRouter - basic instantiation
// ---------------------------------------------------------------------------
describe('createStacksRouter', () => {
  test('creates a router instance', () => {
    const router = createStacksRouter()
    expect(router).toBeDefined()
    expect(router.bunRouter).toBeDefined()
  })

  test('router starts with empty routes', () => {
    const router = createStacksRouter()
    expect(router.routes).toBeInstanceOf(Array)
  })
})

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------
describe('Route registration', () => {
  test('registering a GET route adds it to routes', () => {
    const router = createStacksRouter()
    const handler = () => new Response('ok')
    router.get('/users', handler)
    const found = router.routes.some(r => r.path === '/users' && r.method === 'GET')
    expect(found).toBe(true)
  })

  test('registering a POST route adds it to routes', () => {
    const router = createStacksRouter()
    const handler = () => new Response('created')
    router.post('/users', handler)
    const found = router.routes.some(r => r.path === '/users' && r.method === 'POST')
    expect(found).toBe(true)
  })

  test('registering a PUT route adds it to routes', () => {
    const router = createStacksRouter()
    const handler = () => new Response('updated')
    router.put('/users/:id', handler)
    const found = router.routes.some(r => r.path === '/users/:id' && r.method === 'PUT')
    expect(found).toBe(true)
  })

  test('registering a DELETE route adds it to routes', () => {
    const router = createStacksRouter()
    const handler = () => new Response('deleted')
    router.delete('/users/:id', handler)
    const found = router.routes.some(r => r.path === '/users/:id' && r.method === 'DELETE')
    expect(found).toBe(true)
  })

  test('registering a PATCH route adds it to routes', () => {
    const router = createStacksRouter()
    const handler = () => new Response('patched')
    router.patch('/items/:id', handler)
    const found = router.routes.some(r => r.path === '/items/:id' && r.method === 'PATCH')
    expect(found).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Group prefixing
// ---------------------------------------------------------------------------
describe('Group prefixing', () => {
  test('group with prefix prepends to route paths', () => {
    const router = createStacksRouter()
    const handler = () => new Response('ok')
    router.group({ prefix: '/api' }, () => {
      router.get('/items', handler)
    })
    const found = router.routes.some(r => r.path === '/api/items')
    expect(found).toBe(true)
  })

  test('nested groups stack prefixes', () => {
    const router = createStacksRouter()
    const handler = () => new Response('ok')
    router.group({ prefix: '/api' }, () => {
      router.group({ prefix: '/v1' }, () => {
        router.get('/tasks', handler)
      })
    })
    const found = router.routes.some(r => r.path === '/api/v1/tasks')
    expect(found).toBe(true)
  })

  test('routes outside group do not have prefix', () => {
    const router = createStacksRouter()
    const handler = () => new Response('ok')
    router.group({ prefix: '/api' }, () => {
      router.get('/inside', handler)
    })
    router.get('/outside', handler)
    const insideFound = router.routes.some(r => r.path === '/api/inside')
    const outsideFound = router.routes.some(r => r.path === '/outside')
    expect(insideFound).toBe(true)
    expect(outsideFound).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Resource routes
// ---------------------------------------------------------------------------
describe('Resource routes', () => {
  test('resource registers all 5 CRUD routes', () => {
    const router = createStacksRouter()
    router.resource('posts', 'PostAction')

    const routes = router.routes
    const paths = routes.map(r => `${r.method}:${r.path}`)

    expect(paths).toContain('GET:/posts')
    expect(paths).toContain('POST:/posts')
    expect(paths).toContain('GET:/posts/:id')
    expect(paths).toContain('PUT:/posts/:id')
    expect(paths).toContain('DELETE:/posts/:id')
  })

  test('resource with only option limits routes', () => {
    const router = createStacksRouter()
    router.resource('comments', 'CommentAction', { only: ['index', 'show'] })

    const routes = router.routes
    const paths = routes.map(r => `${r.method}:${r.path}`)

    expect(paths).toContain('GET:/comments')
    expect(paths).toContain('GET:/comments/:id')
    expect(paths).not.toContain('POST:/comments')
    expect(paths).not.toContain('PUT:/comments/:id')
    expect(paths).not.toContain('DELETE:/comments/:id')
  })

  test('resource with except option excludes routes', () => {
    const router = createStacksRouter()
    router.resource('tags', 'TagAction', { except: ['destroy'] })

    const routes = router.routes
    const paths = routes.map(r => `${r.method}:${r.path}`)

    expect(paths).toContain('GET:/tags')
    expect(paths).toContain('POST:/tags')
    expect(paths).toContain('GET:/tags/:id')
    expect(paths).toContain('PUT:/tags/:id')
    expect(paths).not.toContain('DELETE:/tags/:id')
  })
})

// ---------------------------------------------------------------------------
// Middleware registration via chainable route
// ---------------------------------------------------------------------------
describe('Middleware chaining', () => {
  test('middleware() returns chainable route without crashing', () => {
    const router = createStacksRouter()
    const handler = () => new Response('ok')
    const chainable = router.get('/protected', handler)
    const result = chainable.middleware('auth')
    expect(result).toBeDefined()
    expect(typeof result.middleware).toBe('function')
  })

  test('chaining multiple middleware calls does not throw', () => {
    const router = createStacksRouter()
    const handler = () => new Response('ok')
    const chainable = router.get('/admin', handler)
    expect(() => chainable.middleware('auth').middleware('verified')).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Named routes
// ---------------------------------------------------------------------------
describe('Named routes', () => {
  test('name() registers a named route that url() can resolve', () => {
    const router = createStacksRouter()
    const handler = () => new Response('ok')
    router.get('/api/email/unsubscribe', handler).name('email.unsubscribe')
    const result = url('email.unsubscribe', { token: 'abc123' })
    expect(result).toContain('/api/email/unsubscribe')
    expect(result).toContain('token=abc123')
  })
})

// ---------------------------------------------------------------------------
// Health check route
// ---------------------------------------------------------------------------
describe('Health check', () => {
  test('health() registers /health route', () => {
    const router = createStacksRouter()
    router.health()
    const found = router.routes.some(r => r.path === '/health' && r.method === 'GET')
    expect(found).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// handleRequest with a function handler
// ---------------------------------------------------------------------------
describe('handleRequest', () => {
  test('resolves a function handler and returns response', async () => {
    const router = createStacksRouter()
    router.get('/ping', () => new Response('pong'))
    const req = new Request('http://localhost/ping')
    const res = await router.handleRequest(req)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toBe('pong')
  })
})
