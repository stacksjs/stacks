/**
 * stacksjs/stacks#3312 - a browser form that worked was answered with the
 * action's JSON. Revoking a token from a settings page left the person on
 *
 *   {"id":107,"revoked_at":"2026-11-16T11:33:52.401Z","already_revoked":false}
 *
 * which says nothing a person can read: from that page "revoked" and "broken"
 * look the same. The router now sends the browser back to the page with the
 * action's own words for it to show, the counterpart of #3309 for a refusal.
 * A caller that asked for data gets the body exactly as before.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Action } from '@stacksjs/actions'
import { config, createRequestContext, FORM_FLASH_COOKIE, openFormFlash } from '@stacksjs/config'
import { createStacksRouter, response } from '../src'

const KEY = 'base64:form-success-test-key'
const app = config.app as { key?: string }
let keyBefore: string | undefined
beforeAll(() => {
  keyBefore = app.key
  app.key = KEY
})
afterAll(() => {
  app.key = keyBefore
})

const REVOKED = { id: 107, revoked_at: '2026-11-16T11:33:52.401Z', already_revoked: false }

function router(options: Partial<ConstructorParameters<typeof Action>[0]> & { handle?: (req: any) => unknown } = {}) {
  const action = new Action({
    name: 'TokenRevoke',
    skipCsrf: true,
    notice: 'Token revoked',
    ...options,
    async handle(req: any) {
      return options.handle ? options.handle(req) : REVOKED
    },
  } as any)
  const stacks = createStacksRouter()
  stacks.post('/api/user/tokens/revoke', action as any)
  return stacks
}

/** A form posted by a browser from `/settings/tokens`, as a browser sends one. */
function form(headers: Record<string, string> = {}, body = 'id=107'): Request {
  return new Request('http://localhost/api/user/tokens/revoke', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'origin': 'http://localhost',
      'referer': 'http://localhost/settings/tokens?tab=api',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-dest': 'document',
      ...headers,
    },
    body,
  })
}

function flashOf(res: Response): string {
  const set = res.headers.get('set-cookie') ?? ''
  expect(set.startsWith(`${FORM_FLASH_COOKIE}=`)).toBe(true)
  return set.slice(FORM_FLASH_COOKIE.length + 1, set.indexOf(';'))
}

describe('a browser form that worked', () => {
  it('is sent back to its page with the action\'s words, not shown the JSON', async () => {
    const res = await router().bunRouter.handleRequest(form())

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/settings/tokens?tab=api')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).toBe('')

    const flash = openFormFlash(flashOf(res), KEY, '/settings/tokens')!
    expect(flash.notice).toBe('Token revoked')
    expect(flash.errors).toEqual({})
    // A form that worked is drawn fresh: nothing it posted is sent back.
    expect(flash.old).toEqual({})
  })

  it('is what the page reads back, and only that page', async () => {
    const res = await router().bunRouter.handleRequest(form())
    const cookie = { [FORM_FLASH_COOKIE]: flashOf(res) }
    const page = createRequestContext(() => ({ path: '/settings/tokens', cookies: cookie }), () => KEY)
    expect(page.notice()).toBe('Token revoked')
    expect(page.hasErrors()).toBe(false)

    expect(createRequestContext(() => ({ path: '/settings/profile', cookies: cookie }), () => KEY).notice()).toBe('')
    expect(createRequestContext(() => ({ path: '/settings/tokens', cookies: {} }), () => KEY).notice()).toBe('')
  })

  it('says what the action decided from the outcome', async () => {
    const notice = (result: typeof REVOKED) => result.already_revoked ? 'That token was already revoked' : 'Token revoked'
    const again = await router({ notice, handle: () => ({ ...REVOKED, already_revoked: true }) } as any).bunRouter.handleRequest(form())
    expect(openFormFlash(flashOf(again), KEY, '/settings/tokens')!.notice).toBe('That token was already revoked')
  })

  it('goes back and says nothing when the action has nothing to say', async () => {
    // A POST that only reads, such as listing a repository's secrets.
    for (const notice of [undefined, '', '   ', () => null, () => '']) {
      const res = await router({ notice } as any).bunRouter.handleRequest(form())
      expect(res.status).toBe(303)
      expect(res.headers.get('location')).toBe('/settings/tokens?tab=api')
      // No cookie at all, so the page draws no empty message.
      expect(res.headers.get('set-cookie')).toBeNull()
    }
  })

  it('treats a JSON response the action built, and an empty answer, as data too', async () => {
    for (const handle of [
      () => response.json(REVOKED),
      () => Response.json(REVOKED, { status: 201 }),
      () => null,
      () => 'revoked',
      () => new Response(null, { status: 204 }),
    ]) {
      const res = await router({ handle } as any).bunRouter.handleRequest(form())
      expect(res.status).toBe(303)
      expect(openFormFlash(flashOf(res), KEY, '/settings/tokens')!.notice).toBe('Token revoked')
    }
  })

  it('marks the cookie secure when the form came over https', async () => {
    const res = await router().bunRouter.handleRequest(form({ 'x-forwarded-proto': 'https', 'origin': 'https://app.example.com', 'referer': 'https://app.example.com/settings/tokens' }))
    expect(res.status).toBe(303)
    expect(res.headers.get('set-cookie')).toContain('; Secure')
  })
})

describe('an answer the action built for the person', () => {
  it('is left alone: a page, a redirect, an error, a download, a stream', async () => {
    const answers: Array<[() => unknown, number]> = [
      // A new API token: a secret shown once must not travel in a redirect.
      [() => new Response('<p>Your new token: <code>sk_live_once</code></p>', { headers: { 'content-type': 'text/html; charset=utf-8' } }), 200],
      [() => response.redirect('/settings/tokens/created'), 302],
      [() => response.json({ error: 'Token not found' }, { status: 404 }), 404],
      [() => new Response('id,name\n1,deploy', { headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="tokens.csv"' } }), 200],
      [() => new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('chunk')); controller.close() } }), 200],
    ]
    for (const [handle, status] of answers) {
      const res = await router({ handle } as any).bunRouter.handleRequest(form())
      expect(res.status).toBe(status)
      expect(res.headers.get('location')).not.toBe('/settings/tokens?tab=api')
      expect(res.headers.get('set-cookie') ?? '').not.toContain(FORM_FLASH_COOKIE)
    }
  })

  it('is JSON for every caller when the action says so', async () => {
    const res = await router({ apiResponse: true } as any).bunRouter.handleRequest(form())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(REVOKED)
  })
})

describe('a caller that asked for data', () => {
  it('gets the body, exactly as it did, and never the notice', async () => {
    for (const request of [
      new Request('http://localhost/api/user/tokens/revoke', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 107 }) }),
      form({ accept: '*/*', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' }),
      form({ 'accept': 'application/json', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' }),
      // A script asking for HTML is still a script, not a page.
      form({ 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' }),
      new Request('http://localhost/api/user/tokens/revoke', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'id=107' }),
    ]) {
      const res = await router().bunRouter.handleRequest(request)
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
      expect(res.headers.get('set-cookie') ?? '').not.toContain(FORM_FLASH_COOKIE)
      expect(await res.json()).toEqual(REVOKED)
    }
  })

  it('is answered the same on a GET a browser navigated to', async () => {
    const stacks = createStacksRouter()
    stacks.get('/api/user/tokens', new Action({ name: 'TokenIndex', notice: 'Listed', handle: () => [REVOKED] }) as any)
    const res = await stacks.bunRouter.handleRequest(new Request('http://localhost/api/user/tokens', { headers: { 'accept': 'text/html', 'sec-fetch-dest': 'document', 'referer': 'http://localhost/settings' } }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([REVOKED])
  })
})

describe('a browser with no page to go back to', () => {
  it('is shown the notice on a page of its own, escaped, and never sent to another site', async () => {
    for (const headers of [
      { referer: '' },
      { 'sec-fetch-site': 'cross-site', 'origin': 'https://evil.example', 'referer': 'https://evil.example/settings/tokens' },
      { referer: 'http://localhost//evil.example/settings/tokens' },
    ]) {
      const res = await router({ notice: 'Token <b>revoked</b>' } as any).bunRouter.handleRequest(form(headers))
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
      expect(res.headers.get('content-type')).toContain('text/html')
      const html = await res.text()
      expect(html).toContain('Token &lt;b&gt;revoked&lt;/b&gt;')
      expect(html).not.toContain('already_revoked')
    }
  })

  it('keeps the body when the action had nothing to say', async () => {
    const res = await router({ notice: undefined } as any).bunRouter.handleRequest(form({ referer: '' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(REVOKED)
  })

  it('is shown the notice on a page when there is no key to sign it with', async () => {
    app.key = ''
    try {
      const res = await router().bunRouter.handleRequest(form())
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/html')
      expect(await res.text()).toContain('Token revoked')
    }
    finally {
      app.key = KEY
    }
  })
})
