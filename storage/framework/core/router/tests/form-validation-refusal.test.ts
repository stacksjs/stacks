/**
 * stacksjs/stacks#3309 - a browser form that failed an action's `validations`
 * was answered with the 422 body. In a tab that is a page of JSON:
 *
 *   {"success":false,"message":"Validation failed","errors":{"repository_ids":["Repository ids must be an array"]}}
 *
 * with the back button as the only way out and everything typed gone. The
 * rules run before `handle()`, so no action could turn the refusal into a
 * page. The router now does: a browser is sent back to the page the form was
 * on, with the messages and what it posted in a signed cookie that page reads
 * once. A caller that asked for data gets the 422 body exactly as before.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Action } from '@stacksjs/actions'
import { config, createRequestContext, FORM_FLASH_COOKIE, openFormFlash } from '@stacksjs/config'
import { schema } from '@stacksjs/validation/runtime'
import { createStacksRouter } from '../src/stacks-router'

const KEY = 'base64:form-refusal-test-key'
const app = config.app as { key?: string }
let keyBefore: string | undefined
beforeAll(() => {
  keyBefore = app.key
  app.key = KEY
})
afterAll(() => {
  app.key = keyBefore
})

function router(handle: (req: any) => unknown = () => ({ ok: true })) {
  const action = new Action({
    name: 'TokenStore',
    skipCsrf: true,
    validations: {
      name: { rule: schema.string().min(3).required() },
      repository_ids: { rule: schema.array() },
      password: { rule: schema.string() },
    },
    async handle(req: any) {
      return handle(req)
    },
  })
  const stacks = createStacksRouter()
  stacks.post('/api/user/tokens', action as any)
  return stacks
}

/** A form posted by a browser from `/settings/tokens`, as a browser sends one. */
function form(fields: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/user/tokens', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'origin': 'http://localhost',
      'referer': 'http://localhost/settings/tokens?tab=api',
      // What a browser sends with a form on the same origin. No page can set it.
      'sec-fetch-site': 'same-origin',
      ...headers,
    },
    body: fields,
  })
}

/** The cookie a response sets, as the next request would send it back. */
function flashOf(res: Response): string {
  const set = res.headers.get('set-cookie') ?? ''
  expect(set.startsWith(`${FORM_FLASH_COOKIE}=`)).toBe(true)
  return set.slice(FORM_FLASH_COOKIE.length + 1, set.indexOf(';'))
}

describe('a browser form that fails validation', () => {
  it('is sent back to the page it was posted from, not answered with JSON', async () => {
    const res = await router().bunRouter.handleRequest(form('name=ab&repository_ids=3&repository_ids=7&password=hunter22'))

    expect(res.status).toBe(303)
    // The path and query of the page, for the browser to resolve: never the
    // router's own idea of its host, which behind a proxy is the upstream's.
    expect(res.headers.get('location')).toBe('/settings/tokens?tab=api')
    expect(res.headers.get('content-type') ?? '').not.toContain('json')
    expect(await res.text()).toBe('')

    const cookie = res.headers.get('set-cookie')!
    expect(cookie).toContain('; Path=/; Max-Age=120; HttpOnly; SameSite=Lax')
    expect(cookie).not.toContain('Secure')
  })

  it('carries the messages by field and what was posted, and never a password', async () => {
    const res = await router().bunRouter.handleRequest(form('name=ab&repository_ids=3&repository_ids=7&password=hunter22&note=keep+this'))
    const flash = openFormFlash(flashOf(res), KEY, '/settings/tokens')!

    expect(Object.keys(flash.errors)).toEqual(['name'])
    expect(flash.errors.name![0]).toMatch(/^Name /)
    expect(flash.old).toEqual({ name: 'ab', repository_ids: ['3', '7'], note: 'keep this' })
    expect(JSON.stringify(flash)).not.toContain('hunter22')
    // For that page and no other, and not for long.
    expect(openFormFlash(flashOf(res), KEY, '/settings/profile')).toBeNull()
    expect(openFormFlash(flashOf(res), KEY, '/settings/tokens', Date.now() + 121_000)).toBeNull()
    expect(openFormFlash(flashOf(res), 'another key', '/settings/tokens')).toBeNull()
  })

  it('is what the page reads back, once it is asked for', async () => {
    const res = await router().bunRouter.handleRequest(form('name=ab&repository_ids=3'))
    const page = createRequestContext(() => ({ path: '/settings/tokens', cookies: { [FORM_FLASH_COOKIE]: flashOf(res) } }), () => KEY)

    expect(page.hasErrors()).toBe(true)
    expect(page.error('name')).toMatch(/^Name /)
    expect(page.error('repository_ids')).toBe('')
    expect(page.old('name')).toBe('ab')
    expect(page.old('missing', 'as it was')).toBe('as it was')
    expect(page.oldValues('repository_ids')).toEqual(['3'])

    // A page that was not refused draws nothing, with or without a cookie.
    const fresh = createRequestContext(() => ({ path: '/settings/tokens', cookies: {} }), () => KEY)
    expect([fresh.hasErrors(), fresh.errors(), fresh.error('name'), fresh.old('name', 'saved'), fresh.oldValues('name')]).toEqual([false, {}, '', 'saved', []])
    const elsewhere = createRequestContext(() => ({ path: '/settings/profile', cookies: { [FORM_FLASH_COOKIE]: flashOf(res) } }), () => KEY)
    expect(elsewhere.hasErrors()).toBe(false)
  })

  it('sends back a browser too old to say where the form was, when the page is this host\'s', async () => {
    const res = await router().bunRouter.handleRequest(form('name=ab', { 'sec-fetch-site': '' }))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/settings/tokens?tab=api')
    // Behind a proxy the request names the upstream; the host it was made for is forwarded.
    const proxied = await router().bunRouter.handleRequest(form('name=ab', { 'sec-fetch-site': '', 'x-forwarded-host': 'app.example.com', 'origin': 'https://app.example.com', 'referer': 'https://app.example.com/settings/tokens' }))
    expect(proxied.status).toBe(303)
    expect(proxied.headers.get('location')).toBe('/settings/tokens')
  })

  it('marks the cookie secure when the form came over https', async () => {
    const res = await router().bunRouter.handleRequest(form('name=ab', { 'x-forwarded-proto': 'https', 'origin': 'https://app.example.com', 'referer': 'https://app.example.com/settings/tokens' }))
    expect(res.status).toBe(303)
    expect(res.headers.get('set-cookie')).toContain('; Secure')
  })

  it('reaches the handler when the form is right, as before', async () => {
    let seen: unknown
    const res = await router((req) => { seen = req.getValidated(); return { ok: true } }).bunRouter.handleRequest(form('name=Deploy+key&repository_ids=3&repository_ids=7'))
    // Back to the page, and with nothing to say: the action declares no
    // notice (stacksjs/stacks#3312).
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/settings/tokens?tab=api')
    expect(seen).toEqual({ name: 'Deploy key', repository_ids: ['3', '7'] })
    expect(res.headers.get('set-cookie') ?? '').not.toContain(FORM_FLASH_COOKIE)
  })
})

describe('a caller that asked for data', () => {
  const refused = { success: false, message: 'Validation failed' }

  it('gets the 422 body, exactly as it did', async () => {
    for (const request of [
      // fetch() with a JSON body.
      new Request('http://localhost/api/user/tokens', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'ab' }) }),
      // fetch() posting a form: `Accept` is `*/*`.
      form('name=ab', { accept: '*/*' }),
      form('name=ab', { accept: 'application/json' }),
      // A client that sends no Accept at all.
      new Request('http://localhost/api/user/tokens', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'name=ab' }),
    ]) {
      const res = await router().bunRouter.handleRequest(request)
      expect(res.status).toBe(422)
      expect(res.headers.get('location')).toBeNull()
      expect(res.headers.get('set-cookie') ?? '').not.toContain(FORM_FLASH_COOKIE)
      const body = await res.json() as Record<string, any>
      expect(body).toMatchObject(refused)
      expect(Object.keys(body.errors)).toEqual(['name'])
    }
  })
})

describe('a browser with no page to go back to', () => {
  it('is told what was wrong on a page, not in JSON, and is not sent to another site', async () => {
    for (const headers of [
      // No Referer: a strict referrer policy, or a privacy extension.
      { referer: '' },
      // A form on another site posting here. It must not choose a page of
      // this application for the visitor to land on.
      { 'sec-fetch-site': 'cross-site', 'origin': 'https://evil.example', 'referer': 'https://evil.example/settings/tokens' },
      // A sibling subdomain: the cookie would not reach its page.
      { 'sec-fetch-site': 'same-site', 'origin': 'http://app.localhost', 'referer': 'http://app.localhost/settings/tokens' },
      // A browser too old to say where the form was, held to its Origin...
      { 'sec-fetch-site': '', 'origin': 'https://evil.example', 'referer': 'http://localhost/settings/tokens' },
      // ...and to the host this request was made for.
      { 'sec-fetch-site': '', 'origin': '', 'referer': 'https://evil.example/settings/tokens' },
      { 'sec-fetch-site': '', 'origin': 'https://evil.example', 'referer': 'https://evil.example/settings/tokens' },
      // A path that begins with two slashes. Sent as a Location, a browser
      // reads it as another host.
      { referer: 'http://localhost//evil.example/settings/tokens' },
    ]) {
      const res = await router().bunRouter.handleRequest(form('name=ab', headers))
      expect(res.status).toBe(422)
      expect(res.headers.get('location')).toBeNull()
      expect(res.headers.get('content-type')).toContain('text/html')
      const html = await res.text()
      expect(html).toContain('This form could not be submitted')
      expect(html).toMatch(/<li>Name [^<]+<\/li>/)
      expect(html).not.toContain('"errors"')
    }
  })

  it('escapes what it prints', async () => {
    const stacks = createStacksRouter()
    stacks.post('/api/echo', new Action({
      name: 'Echo',
      skipCsrf: true,
      validations: { title: { rule: { validate: (value: unknown) => ({ valid: false, errors: [{ message: `Title cannot be ${value}` }] }) } as any } },
      async handle() { return {} },
    }) as any)
    const res = await stacks.bunRouter.handleRequest(new Request('http://localhost/api/echo', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'accept': 'text/html' },
      body: `title=${encodeURIComponent('<script>alert(1)</script>')}`,
    }))
    const html = await res.text()
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('is told on a page when there is no application key to sign the cookie with', async () => {
    app.key = ''
    try {
      const res = await router().bunRouter.handleRequest(form('name=ab'))
      expect(res.status).toBe(422)
      expect(res.headers.get('content-type')).toContain('text/html')
      expect(res.headers.get('set-cookie') ?? '').not.toContain(FORM_FLASH_COOKIE)
    }
    finally {
      app.key = KEY
    }
  })
})

describe('`request.validate()` inside a handler', () => {
  it('sends a browser back the same way', async () => {
    const stacks = createStacksRouter()
    stacks.post('/api/profile', new Action({
      name: 'ProfileUpdate',
      skipCsrf: true,
      async handle(req: any) {
        await req.validate({ email: { rule: schema.string().email().required() } })
        return { ok: true }
      },
    }) as any)
    const send = (headers: Record<string, string>) => stacks.bunRouter.handleRequest(new Request('http://localhost/api/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
      body: 'email=not-an-email&display=Ava',
    }))

    const browser = await send({ 'accept': 'text/html', 'sec-fetch-site': 'same-origin', 'origin': 'http://localhost', 'referer': 'http://localhost/settings/profile' })
    expect(browser.status).toBe(303)
    expect(browser.headers.get('location')).toBe('/settings/profile')
    const flash = openFormFlash(flashOf(browser), KEY, '/settings/profile')!
    expect(Object.keys(flash.errors)).toEqual(['email'])
    expect(flash.old).toEqual({ email: 'not-an-email', display: 'Ava' })

    const client = await send({ accept: 'application/json' })
    expect(client.status).toBe(422)
    expect(Object.keys((await client.json() as any).errors)).toEqual(['email'])
  })
})

describe('a list posted by a form', () => {
  it('is a list when it has one item, and when it has none', async () => {
    let seen: any
    const stacks = router((req) => { seen = req.getValidated(); return { ok: true } })
    // Two occurrences arrive as an array, one as a string: the rule asked for
    // an array and refused every list of one.
    expect((await stacks.bunRouter.handleRequest(form('name=Deploy+key&repository_ids=3'))).status).toBe(303)
    expect(seen.repository_ids).toEqual(['3'])
    expect((await stacks.bunRouter.handleRequest(form('name=Deploy+key&repository_ids='))).status).toBe(303)
    expect(seen.repository_ids).toEqual([])
    // A value is not split on commas: it may hold one.
    expect((await stacks.bunRouter.handleRequest(form('name=Deploy+key&repository_ids=3%2C7'))).status).toBe(303)
    expect(seen.repository_ids).toEqual(['3,7'])
  })

  it('takes a ticked checkbox as true', async () => {
    // A checkbox with no `value` sends `on`, which a boolean rule refused,
    // so no plain checkbox could ever satisfy one (stacksjs/stacks#3311).
    let seen: any
    const stacks = createStacksRouter()
    stacks.post('/api/settings', new Action({
      name: 'Settings',
      skipCsrf: true,
      validations: { notify: { rule: schema.boolean() } },
      async handle(req: any) {
        seen = req.getValidated()
        return { ok: true }
      },
    }) as any)
    const send = (body: string) => stacks.bunRouter.handleRequest(new Request('http://localhost/api/settings', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'accept': 'application/json' }, body }))
    expect((await send('notify=on')).status).toBe(200)
    expect(seen).toEqual({ notify: true })
    expect((await send('notify=0')).status).toBe(200)
    expect(seen).toEqual({ notify: false })
    // Anything else is still not a yes or a no.
    expect((await send('notify=maybe')).status).toBe(422)
  })

  it('is left alone when it came as JSON', async () => {
    const res = await router().bunRouter.handleRequest(new Request('http://localhost/api/user/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Deploy key', repository_ids: '3' }),
    }))
    // A JSON client said a string where a list was asked for. That is refused.
    expect(res.status).toBe(422)
    expect(Object.keys((await res.json() as any).errors)).toEqual(['repository_ids'])
  })
})
