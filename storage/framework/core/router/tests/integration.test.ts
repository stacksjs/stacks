import { describe, expect, test } from 'bun:test'
import { createStacksRouter, url, validateActionInput } from '../src/stacks-router'

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
  test('health() registers /api/health route', () => {
    // Mounted under /api so a userland `health/` page can still own
    // `/health` (see stacks-router.ts:1743-1746).
    const router = createStacksRouter()
    router.health()
    const found = router.routes.some(r => r.path === '/api/health' && r.method === 'GET')
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

// ---------------------------------------------------------------------------
// Path/query param type coercion for declarative validations
//
// Regression coverage for stacksjs/stacks#1865 — `validations:
// { id: { rule: schema.number().positive() } }` on a path-param
// previously 422'd every request because path values arrive as
// strings (`'1'`) and `NumberValidator` is a strict `typeof === 'number'`
// check. `getRequestInput` now coerces string path/query values
// when the corresponding rule expects a non-string primitive
// (`number` or `boolean`). Body fields are untouched (already typed
// by the JSON parser).
//
// We test `validateActionInput` directly rather than registering a
// full Action+route fixture because the router's action-resolution
// path imports from disk (`cachedImport(fullPath)`), and disk-resident
// fixtures would either pollute the project's action search paths or
// require a per-test cleanup harness. The coercion logic lives inside
// `getRequestInput`, which `validateActionInput` calls — testing the
// caller covers both.
// ---------------------------------------------------------------------------
describe('path-param coercion (stacksjs/stacks#1865)', () => {
  // Minimal stand-in for ts-validation's number/boolean shapes —
  // the framework's `validateActionInput` only looks at `rule.name`
  // and `rule.validate`, so we replicate just that contract here
  // to avoid pulling the full @stacksjs/validation surface into
  // this test file.
  function numberRule(predicate: (n: number) => boolean = () => true) {
    return {
      name: 'number',
      validate: (value: unknown) => ({
        valid: typeof value === 'number' && !Number.isNaN(value) && predicate(value),
        errors: typeof value !== 'number' || Number.isNaN(value)
          ? [{ message: 'Must be a number' }]
          : !predicate(value) ? [{ message: 'Predicate failed' }] : [],
      }),
    }
  }

  function booleanRule() {
    return {
      name: 'boolean',
      validate: (value: unknown) => ({
        valid: typeof value === 'boolean',
        errors: typeof value === 'boolean' ? [] : [{ message: 'Must be a boolean' }],
      }),
    }
  }

  // Build a synthetic EnhancedRequest the same way bun-router does
  // after a match: `req.params` is set on the original Request object
  // (it's a regular property assignment, not part of the WHATWG type).
  function makeRequest(url: string, params?: Record<string, string>, init?: RequestInit) {
    const req = new Request(url, init) as Request & { params?: Record<string, string> }
    if (params) req.params = params
    return req as any
  }

  test('numeric path param "1" coerces to 1 and passes schema.number().positive()', async () => {
    const req = makeRequest('http://localhost/judges/1/follow', { id: '1' }, { method: 'POST' })
    const result = await validateActionInput(req, {
      id: { rule: numberRule(n => n > 0), message: 'Invalid judge id.' },
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
  })

  test('non-numeric path param "abc" stays a string so validator emits an error', async () => {
    const req = makeRequest('http://localhost/judges/abc/follow', { id: 'abc' }, { method: 'POST' })
    const result = await validateActionInput(req, {
      id: { rule: numberRule(n => n > 0), message: 'Invalid judge id.' },
    })
    expect(result.valid).toBe(false)
    expect(result.errors.id?.[0]).toBe('Invalid judge id.')
  })

  test('boolean query "?active=true" coerces to true under schema.boolean()', async () => {
    const req = makeRequest('http://localhost/search?active=true')
    const result = await validateActionInput(req, {
      active: { rule: booleanRule(), message: 'Invalid active flag.' },
    })
    expect(result.valid).toBe(true)
  })

  test('boolean query "?active=false" coerces to false under schema.boolean()', async () => {
    const req = makeRequest('http://localhost/search?active=false')
    const result = await validateActionInput(req, {
      active: { rule: booleanRule(), message: 'Invalid active flag.' },
    })
    expect(result.valid).toBe(true)
  })

  test('garbage numeric path "12abc" fails — Number("12abc") is NaN, value stays a string', async () => {
    const req = makeRequest('http://localhost/judges/12abc/follow', { id: '12abc' }, { method: 'POST' })
    const result = await validateActionInput(req, {
      id: { rule: numberRule(n => n > 0), message: 'Invalid judge id.' },
    })
    expect(result.valid).toBe(false)
  })

  test('non-canonical boolean "?active=yes" stays a string and fails', async () => {
    const req = makeRequest('http://localhost/search?active=yes')
    const result = await validateActionInput(req, {
      active: { rule: booleanRule(), message: 'Invalid active flag.' },
    })
    expect(result.valid).toBe(false)
  })
})
