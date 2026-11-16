/**
 * stacksjs/stacks#3311 - a browser form whose CSRF token is missing or
 * stale (a tab left open past the token's life, a second tab that replaced
 * the cookie) was answered with the 403 body. In a tab that is
 *
 *   {"error":"Forbidden","message":"CSRF token mismatch"}
 *
 * and everything typed is gone. A form from this application's own page now
 * goes back to it with a sentence and what was typed. A script, and a form
 * posted from anywhere else, get the 403 as before.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Action } from '@stacksjs/actions'
import { config, createRequestContext, FORM_FLASH_COOKIE, openFormFlash } from '@stacksjs/config'
import { clearMiddlewareCache, createStacksRouter } from '../src/stacks-router'

const KEY = 'base64:csrf-form-refusal-test-key'
const TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const app = config.app as { key?: string }
let keyBefore: string | undefined
beforeAll(() => {
  keyBefore = app.key
  app.key = KEY
})
afterAll(() => {
  app.key = keyBefore
})
beforeEach(() => {
  clearMiddlewareCache()
})

let handled = 0
function router() {
  handled = 0
  const stacks = createStacksRouter()
  stacks.post('/api/profile', new Action({ name: 'ProfileUpdate', handle: () => { handled++; return { ok: true } } }) as any)
  return stacks
}

function form(headers: Record<string, string> = {}, body = `display_name=Ava&password=hunter22&_token=stale-${TOKEN.slice(6)}`): Request {
  return new Request('http://localhost/api/profile', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'origin': 'http://localhost',
      'referer': 'http://localhost/settings/profile',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-dest': 'document',
      'cookie': `X-CSRF-Token=${TOKEN}`,
      ...headers,
    },
    body,
  })
}

function flashOf(res: Response): string {
  const set = res.headers.getSetCookie().find(cookie => cookie.startsWith(`${FORM_FLASH_COOKIE}=`)) ?? ''
  expect(set).not.toBe('')
  return set.slice(FORM_FLASH_COOKIE.length + 1, set.indexOf(';'))
}

describe('a browser form with a stale CSRF token', () => {
  it('goes back to its page saying so, with what was typed, and the action does not run', async () => {
    const res = await router().handleRequest(form())
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/settings/profile')
    expect(handled).toBe(0)

    const flash = openFormFlash(flashOf(res), KEY, '/settings/profile')!
    expect(flash.formError).toContain('nothing was saved')
    // What was typed comes back; a password, and the stale token, do not.
    expect(flash.old).toEqual({ display_name: 'Ava' })

    const page = createRequestContext(() => ({ path: '/settings/profile', cookies: { [FORM_FLASH_COOKIE]: flashOf(res) } }), () => KEY)
    expect(page.formError()).toContain('send it again')
  })

  it('goes back the same way with no token at all', async () => {
    const res = await router().handleRequest(form({ cookie: '' }, 'display_name=Ava'))
    expect(res.status).toBe(303)
    expect(openFormFlash(flashOf(res), KEY, '/settings/profile')!.formError).toContain('nothing was saved')
  })

  it('reaches the action when the token matches, as before', async () => {
    const res = await router().handleRequest(form({}, `display_name=Ava&_token=${TOKEN}`))
    expect(res.status).toBe(303)
    expect(handled).toBe(1)
    expect(res.headers.getSetCookie().some(cookie => cookie.startsWith(`${FORM_FLASH_COOKIE}=`))).toBe(false)
  })
})

describe('anything else with a stale CSRF token', () => {
  it('is the 403 a script always got', async () => {
    for (const request of [
      new Request('http://localhost/api/profile', { method: 'POST', headers: { 'content-type': 'application/json', 'cookie': `X-CSRF-Token=${TOKEN}`, 'x-csrf-token': 'stale' }, body: '{}' }),
      form({ 'accept': '*/*', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' }),
    ]) {
      const res = await router().handleRequest(request)
      expect(res.status).toBe(403)
      expect(res.headers.get('location')).toBeNull()
      expect((await res.json() as { message: string }).message).toBe('CSRF token mismatch')
    }
    expect(handled).toBe(0)
  })

  it('is never sent back to a page when the form was on another site', async () => {
    // The forged request CSRF exists to stop. It must not choose a page of
    // this application to land on, with its own values filled in.
    for (const headers of [
      { 'sec-fetch-site': 'cross-site', 'origin': 'https://evil.example', 'referer': 'https://evil.example/settings/profile' },
      { 'sec-fetch-site': 'same-site', 'origin': 'http://app.localhost', 'referer': 'http://app.localhost/settings/profile' },
      { referer: '' },
    ]) {
      const res = await router().handleRequest(form(headers))
      expect(res.status).toBe(403)
      expect(res.headers.get('location')).toBeNull()
      expect(res.headers.getSetCookie().some(cookie => cookie.startsWith(`${FORM_FLASH_COOKIE}=`))).toBe(false)
      expect(res.headers.get('content-type')).toContain('text/html')
      expect(await res.text()).toContain('nothing was saved')
    }
    expect(handled).toBe(0)
  })
})
