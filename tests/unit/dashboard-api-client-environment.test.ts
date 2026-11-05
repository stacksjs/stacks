import { describe, expect, it } from 'bun:test'

/**
 * The dashboard API client is for the browser.
 *
 * `resolveApiBaseUrl()` returns the relative `/api` when there is no
 * `window.location` and no injected `__STACKS_API_URL__`, which is right for a
 * browser bundle (stacksjs/stacks#2421) and unusable by `fetch` off the DOM:
 * there is no origin to resolve it against.
 *
 * Before stacksjs/stacks#2944 each verb built its headers, read the auth token,
 * serialised its body and then died on `TypeError: fetch() URL is invalid`,
 * which surfaced as a stack in a dev server log while the page still returned
 * 200. That is how a dashboard template calling `post()` by accident during
 * server-side rendering went unnoticed. It also only failed to send by
 * accident: with `__STACKS_API_URL__` set for a split-origin deployment the URL
 * is absolute and the same mistake issues a real mutating request mid-render.
 */

const VERBS = ['get', 'post', 'put', 'patch', 'del'] as const

describe('the dashboard API client, called where it cannot send', () => {
  it.each(VERBS)('%s refuses by name instead of reaching fetch', async (verb) => {
    const api = await import('../../storage/framework/defaults/functions/api')
    const call = api[verb] as (endpoint: string, body?: unknown) => Promise<unknown>

    // This test file runs off the DOM, which is exactly the condition.
    await expect(call('/posts', { title: 'x' })).rejects.toThrow(api.DashboardApiEnvironmentError)
  })

  it('names the endpoint and what the base URL resolved to', async () => {
    const api = await import('../../storage/framework/defaults/functions/api')

    // The stack is several frames of template machinery deep by the time this
    // surfaces, so the message has to carry what the stack does not.
    await expect(api.post('/posts')).rejects.toThrow(/cannot request "\/posts" here/)
    await expect(api.post('/posts')).rejects.toThrow(/absolute base URL/)
  })

  it('does not reject when the base URL is absolute', async () => {
    // The control. Without it, every assertion above is satisfied by a client
    // that refuses unconditionally, which would break the browser.
    const browser = { __STACKS_API_URL__: 'http://127.0.0.1:1', ...{} }
    Object.assign(globalThis, browser)
    try {
      // A fresh module instance, so the module-scope `baseUrl` is recomputed.
      const fresh = await import(`../../storage/framework/defaults/functions/api?absolute=${Date.now()}`)
      // Port 1 refuses the connection, so this fails at the socket rather than
      // at URL construction. Either way it is NOT the environment error.
      await expect(fresh.post('/posts')).rejects.not.toThrow(fresh.DashboardApiEnvironmentError)
    }
    finally {
      delete (globalThis as Record<string, unknown>).__STACKS_API_URL__
    }
  })
})

describe('the dashboard API client, writing from a signed-in browser', () => {
  // stacksjs/stacks#3197: a write that rides the session cookie must carry the
  // CSRF token, or the server answers 403 before the action runs.
  async function sentHeaders(verb: typeof VERBS[number]): Promise<Headers> {
    const seen: Headers[] = []
    const realFetch = globalThis.fetch
    const scope = globalThis as Record<string, unknown>
    const hadDocument = 'document' in scope
    const realDocument = scope.document
    scope.__STACKS_API_URL__ = 'http://127.0.0.1:1'
    scope.document = { cookie: 'theme=dark; X-CSRF-Token=token-from-the-cookie' }
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      seen.push(new Headers(init?.headers))
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
    try {
      const fresh = await import(`../../storage/framework/defaults/functions/api?csrf=${verb}-${Date.now()}`)
      await (fresh[verb] as (endpoint: string, body?: unknown) => Promise<unknown>)('/posts', { title: 'x' })
    }
    finally {
      globalThis.fetch = realFetch
      delete scope.__STACKS_API_URL__
      if (hadDocument)
        scope.document = realDocument
      else
        delete scope.document
    }
    expect(seen).toHaveLength(1)
    return seen[0]!
  }

  it.each(['post', 'put', 'patch', 'del'] as const)('%s sends the CSRF token from the cookie', async (verb) => {
    expect((await sentHeaders(verb)).get('X-CSRF-Token')).toBe('token-from-the-cookie')
  })

  it('get does not, since a read is not checked', async () => {
    // The control: a client that attached the token to everything would pass
    // the writes above for the wrong reason.
    expect((await sentHeaders('get')).get('X-CSRF-Token')).toBeNull()
  })
})
