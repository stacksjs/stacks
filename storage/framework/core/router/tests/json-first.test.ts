/**
 * End-to-end coverage for the "JSON-first by default" behaviour (#1842).
 *
 * Exercises the live router (parseRequestBody → action → formatResult)
 * across every Accept / Content-Type combination called out in the issue's
 * acceptance criteria.
 *
 * Every POST route below chains `.skipCsrf()` because the default-on
 * CSRF gate would otherwise 403 the test request before reaching the
 * handler. CSRF semantics aren't what these tests are exercising.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { clearMiddlewareCache, createStacksRouter } from '../src/stacks-router'

beforeEach(() => {
  clearMiddlewareCache()
})

function jsonReq(path: string, body: unknown, contentType = 'application/json'): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('formatResult — JSON-first', () => {
  test('object return → JSON', async () => {
    const router = createStacksRouter()
    router.get('/obj', () => ({ ok: true }) as any)

    const res = await router.handleRequest(new Request('http://localhost/obj'))
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual({ ok: true })
  })

  test('string return on API-shaped request → JSON-encoded string', async () => {
    const router = createStacksRouter()
    router.get('/str', (() => 'ok') as any)

    // No Accept / no Content-Type → defaults to JSON.
    const res = await router.handleRequest(new Request('http://localhost/str'))
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toBe('ok')
  })

  test('string return on browser-nav request → text/plain', async () => {
    const router = createStacksRouter()
    router.get('/str', (() => 'ok') as any)

    const res = await router.handleRequest(new Request('http://localhost/str', {
      headers: { accept: 'text/html,application/xhtml+xml' },
    }))
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(await res.text()).toBe('ok')
  })

  test('null return on API request → 204 No Content', async () => {
    const router = createStacksRouter()
    router.get('/null', (() => null) as any)

    const res = await router.handleRequest(new Request('http://localhost/null'))
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
  })

  test('undefined return on API request → 204 No Content', async () => {
    const router = createStacksRouter()
    router.get('/u', (() => undefined) as any)

    const res = await router.handleRequest(new Request('http://localhost/u'))
    expect(res.status).toBe(204)
  })

  test('null return on browser-nav request → empty 200', async () => {
    const router = createStacksRouter()
    router.get('/null', (() => null) as any)

    const res = await router.handleRequest(new Request('http://localhost/null', {
      headers: { accept: 'text/html' },
    }))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
  })

  test('Response instance is passed through unchanged', async () => {
    const router = createStacksRouter()
    router.get('/raw', (() => new Response('hi', { status: 418, headers: { 'content-type': 'text/x-coffee' } })) as any)

    const res = await router.handleRequest(new Request('http://localhost/raw'))
    expect(res.status).toBe(418)
    expect(res.headers.get('content-type')).toBe('text/x-coffee')
    expect(await res.text()).toBe('hi')
  })
})

describe('parseRequestBody — JSON variant widening', () => {
  test('application/json populates jsonBody', async () => {
    const router = createStacksRouter()
    let seen: unknown = null
    router.post('/x', ((req: any) => {
      seen = req.jsonBody
      return { received: true }
    }) as any).skipCsrf()

    await router.handleRequest(jsonReq('/x', { a: 1 }))
    expect(seen).toEqual({ a: 1 })
  })

  test('application/json; charset=utf-8 populates jsonBody', async () => {
    const router = createStacksRouter()
    let seen: unknown = null
    router.post('/x', ((req: any) => {
      seen = req.jsonBody
      return { ok: true }
    }) as any).skipCsrf()

    await router.handleRequest(jsonReq('/x', { a: 1 }, 'application/json; charset=utf-8'))
    expect(seen).toEqual({ a: 1 })
  })

  test('application/vnd.api+json populates jsonBody', async () => {
    const router = createStacksRouter()
    let seen: unknown = null
    router.post('/x', ((req: any) => {
      seen = req.jsonBody
      return { ok: true }
    }) as any).skipCsrf()

    await router.handleRequest(jsonReq('/x', { data: { id: '1' } }, 'application/vnd.api+json'))
    expect(seen).toEqual({ data: { id: '1' } })
  })

  test('application/ld+json populates jsonBody', async () => {
    const router = createStacksRouter()
    let seen: unknown = null
    router.post('/x', ((req: any) => {
      seen = req.jsonBody
      return { ok: true }
    }) as any).skipCsrf()

    await router.handleRequest(jsonReq('/x', { '@context': 'x' }, 'application/ld+json'))
    expect(seen).toEqual({ '@context': 'x' })
  })

  test('empty POST body with JSON content-type → jsonBody = {}', async () => {
    const router = createStacksRouter()
    let seen: unknown = 'unset'
    router.post('/x', ((req: any) => {
      seen = req.jsonBody
      return { ok: true }
    }) as any).skipCsrf()

    await router.handleRequest(new Request('http://localhost/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    }))
    expect(seen).toEqual({})
  })

  test('malformed JSON body → 400 with "Invalid JSON body" message (stacksjs/stacks#1859 H-5)', async () => {
    const router = createStacksRouter()
    let actionRan = false
    router.post('/x', ((_req: any) => {
      actionRan = true
      return { ok: true }
    }) as any).skipCsrf()

    const res = await router.handleRequest(jsonReq('/x', '{not valid json'))
    expect(res.status).toBe(400)
    expect(actionRan).toBe(false) // action must NOT run on malformed body
    const body = await res.json() as { message?: string }
    expect(body.message).toMatch(/Invalid JSON body/i)
  })
})

describe('apiResponse: true on route group → force JSON', () => {
  test('string return inside group serializes as JSON even with browser Accept', async () => {
    const router = createStacksRouter()
    router.group({ prefix: '/api', apiResponse: true }, () => {
      router.get('/echo', (() => 'forced') as any)
    })

    const res = await router.handleRequest(new Request('http://localhost/api/echo', {
      headers: { accept: 'text/html,application/xhtml+xml' },
    }))
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toBe('forced')
  })

  test('null return inside force-JSON group → 204 even with HTML Accept', async () => {
    const router = createStacksRouter()
    router.group({ prefix: '/api', apiResponse: true }, () => {
      router.get('/none', (() => null) as any)
    })

    const res = await router.handleRequest(new Request('http://localhost/api/none', {
      headers: { accept: 'text/html' },
    }))
    expect(res.status).toBe(204)
  })

  test('group flag does not leak across sibling groups', async () => {
    const router = createStacksRouter()
    router.group({ prefix: '/api', apiResponse: true }, () => {
      router.get('/a', (() => 'a-forced') as any)
    })
    router.group({ prefix: '/web' }, () => {
      router.get('/b', (() => 'b-plain') as any)
    })

    const a = await router.handleRequest(new Request('http://localhost/api/a', { headers: { accept: 'text/html' } }))
    const b = await router.handleRequest(new Request('http://localhost/web/b', { headers: { accept: 'text/html' } }))

    expect(a.headers.get('content-type')).toContain('application/json')
    expect(b.headers.get('content-type')).toContain('text/plain')
  })
})
