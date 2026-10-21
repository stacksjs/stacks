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
