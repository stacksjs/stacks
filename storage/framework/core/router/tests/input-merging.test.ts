import { describe, expect, it } from 'bun:test'
import { createStacksRouter, validateActionInput } from '../src/stacks-router'

/**
 * The input a handler reads is the input that was validated, and a key is
 * only ever a key.
 *
 * Validation merged route params BEFORE the body (body won) while
 * `req.get()` / `all()` merged them after (params won): `PATCH /items/abc`
 * with `{ "id": 5 }` validated `id` as 5 and handed the handler 'abc'.
 *
 * Both merged with `Object.assign` onto `{}`, and `JSON.parse` keeps a
 * `"__proto__"` key as an own property that `Object.assign` then writes
 * through the prototype setter: `{"__proto__":{"isAdmin":true}}` made
 * `req.get('isAdmin')` true while `all()` and `keys()` listed nothing, and
 * `has('constructor')` was true on every request.
 */

const numberRule = {
  name: 'number',
  validate: (value: unknown) => ({
    valid: typeof value === 'number',
    errors: typeof value === 'number' ? [] : [{ message: 'Must be a number' }],
  }),
}

describe('input precedence', () => {
  it('validates the route param the handler will read, not a body field of the same name', async () => {
    const req = new Request('http://localhost/items/abc', { method: 'PATCH' }) as any
    req.params = { id: 'abc' }
    req.jsonBody = { id: 5 }

    const result = await validateActionInput(req, { id: { rule: numberRule } })

    expect(result.valid).toBe(false)
  })

  it.each([false, true])('reads route params over body fields in get() and all() (nativeRoutes=%s)', async (nativeRoutes) => {
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    router.patch(`/precedence-${nativeRoutes}/{id}`, (req: any) => ({ get: req.get('id'), all: req.all().id }))
    const server = await router.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes })
    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/precedence-${nativeRoutes}/abc`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 5 }),
      })
      expect(await response.json()).toEqual({ get: 'abc', all: 'abc' })
    }
    finally {
      server.stop()
    }
  })
})

describe('input keys', () => {
  it.each([false, true])('a "__proto__" body key is a key, not the input\'s prototype (nativeRoutes=%s)', async (nativeRoutes) => {
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    router.post(`/proto-${nativeRoutes}`, (req: any) => ({
      isAdmin: req.get('isAdmin') ?? null,
      only: req.only(['isAdmin']),
      hasConstructor: req.has('constructor'),
      constructor: typeof req.input('constructor'),
      keys: req.keys(),
    }))
    const server = await router.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes })
    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/proto-${nativeRoutes}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"name":"x","__proto__":{"isAdmin":true}}',
      })
      expect(await response.json()).toEqual({
        isAdmin: null,
        only: {},
        hasConstructor: false,
        constructor: 'undefined',
        keys: ['name', '__proto__'],
      })
    }
    finally {
      server.stop()
    }
  })
})
