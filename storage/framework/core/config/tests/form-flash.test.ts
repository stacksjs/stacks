/**
 * What a refused form carries back to its page (stacksjs/stacks#3309): the
 * cookie's own rules, apart from the router that writes it and the page that
 * reads it. See core/router/tests/form-validation-refusal.test.ts for those.
 */
import { describe, expect, it } from 'bun:test'
import { clearShownFormFlash, expiredFormFlashCookie, flashableField, flashableInput, FORM_FLASH_COOKIE, FORM_FLASH_MAX_BYTES, formFlashCookie, openFormFlash, sealFormFlash } from '../src/form-flash'

const KEY = 'base64:form-flash-test-key'
const later = Date.now() + 60_000
const flash = (over: Partial<Parameters<typeof sealFormFlash>[0]> = {}) => ({ path: '/settings/tokens', errors: { name: ['Name is required'] }, old: { name: '' }, expires: later, ...over })

describe('what may be sent back to a form', () => {
  it('never a password, a token or a card, however the field is spelled', () => {
    for (const field of ['password', 'current_password', 'passwordConfirmation', 'new-password', '_token', 'csrf_token', 'apiKey', 'api_key', 'private_key', 'client_secret', 'card_number', 'cardNumber', 'cvv', 'cvc', 'security_code', 'otp', 'pin', 'ssn', 'access_key', 'credentials', 'signature', ''])
      expect(flashableField(field), field).toBe(false)
    // Words that only look like one of those are sent back...
    for (const field of ['name', 'email', 'repository_ids', 'shipping_zip', 'pinned', 'keyboard', 'passport_country', 'postal_code', 'coupon_code', 'description'])
      expect(flashableField(field), field).toBe(true)
    // ...unless a whole word of the name is one: typed again, not risked.
    expect(flashableField('tokens_per_minute')).toBe(false)
  })

  it('text, numbers, yes or no and lists of those, and nothing else', () => {
    expect(flashableInput({
      name: 'Ava',
      age: 41,
      subscribed: true,
      ids: ['3', 7],
      password: 'hunter22',
      avatar: new File(['x'], 'a.png'),
      nested: { a: 1 },
      mixed: ['a', { b: 1 }],
      nothing: null,
      missing: undefined,
    })).toEqual({ name: 'Ava', age: '41', subscribed: 'true', ids: ['3', '7'] })
  })
})

describe('the sealed value', () => {
  it('opens for the page it names, and for nothing else', () => {
    const sealed = sealFormFlash(flash({ old: { name: 'ab', ids: ['3', '7'] } }), KEY)!
    expect(sealed).toMatch(/^[\w-]+\.[\w-]+$/)
    expect(openFormFlash(sealed, KEY, '/settings/tokens')).toEqual({ path: '/settings/tokens', errors: { name: ['Name is required'] }, old: { name: 'ab', ids: ['3', '7'] }, expires: later })
    // The same page, however its address ends.
    expect(openFormFlash(sealed, KEY, '/settings/tokens/')).not.toBeNull()
    for (const refused of [
      openFormFlash(sealed, KEY, '/settings/profile'),
      openFormFlash(sealed, KEY, '/settings/tokens', later + 1),
      openFormFlash(sealed, 'another key', '/settings/tokens'),
      openFormFlash(sealed, '', '/settings/tokens'),
      openFormFlash('', KEY, '/settings/tokens'),
      openFormFlash(undefined, KEY, '/settings/tokens'),
      openFormFlash('no-signature', KEY, '/settings/tokens'),
    ])
      expect(refused).toBeNull()
  })

  it('is refused when one character of it is changed', () => {
    const sealed = sealFormFlash(flash(), KEY)!
    const mark = sealed.lastIndexOf('.')
    const body = Buffer.from(sealed.slice(0, mark), 'base64url').toString('utf8').replace('Name is required', 'Send your password to x')
    const forged = `${Buffer.from(body, 'utf8').toString('base64url')}${sealed.slice(mark)}`
    expect(openFormFlash(forged, KEY, '/settings/tokens')).toBeNull()
    expect(openFormFlash(`${sealed.slice(0, -1)}${sealed.endsWith('A') ? 'B' : 'A'}`, KEY, '/settings/tokens')).toBeNull()
  })

  it('is refused when what it holds is not the shape it should be', () => {
    const sign = (value: unknown) => {
      const real = sealFormFlash(flash(), KEY)!
      // Sealed by the application itself, so only the shape is in question.
      const body = Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
      const { createHmac } = require('node:crypto') as typeof import('node:crypto')
      void real
      return `${body}.${createHmac('sha256', KEY).update(`stacks-form-flash:${body}`).digest('base64url')}`
    }
    expect(openFormFlash(sign({ path: '/a', errors: { name: ['ok'] }, old: {}, expires: later }), KEY, '/a')).not.toBeNull()
    for (const wrong of [
      { path: '/a', errors: { name: 'not a list' }, old: {}, expires: later },
      { path: '/a', errors: { name: [1] }, old: {}, expires: later },
      { path: '/a', errors: {}, old: { name: { nested: true } }, expires: later },
      { path: '/a', errors: {}, old: {}, expires: 'soon' },
      { errors: {}, old: {}, expires: later },
      'text',
      null,
    ])
      expect(openFormFlash(sign(wrong), KEY, '/a')).toBeNull()
  })

  it('is not made without an application key', () => {
    expect(sealFormFlash(flash(), '')).toBeNull()
    expect(sealFormFlash(flash(), undefined)).toBeNull()
  })

  it('always fits a cookie: what was typed goes first, longest first, and the messages stay', () => {
    const essay = 'x'.repeat(5000)
    const sealed = sealFormFlash(flash({ old: { name: 'Ava', bio: essay, city: 'Lisbon' } }), KEY)!
    expect(sealed.length).toBeLessThanOrEqual(FORM_FLASH_MAX_BYTES)
    const opened = openFormFlash(sealed, KEY, '/settings/tokens')!
    expect(opened.errors).toEqual({ name: ['Name is required'] })
    expect(opened.old).toEqual({ name: 'Ava', city: 'Lisbon' })

    // More messages than fit: one a field, then as many fields as fit.
    const many = Object.fromEntries(Array.from({ length: 80 }, (_, index) => [`field_${index}`, ['This one is wrong in a long and particular way that takes a sentence to say', 'and in a second way']]))
    const crowded = sealFormFlash(flash({ errors: many, old: { a: essay } }), KEY)!
    expect(crowded.length).toBeLessThanOrEqual(FORM_FLASH_MAX_BYTES)
    const kept = openFormFlash(crowded, KEY, '/settings/tokens')!
    expect(kept.old).toEqual({})
    expect(Object.keys(kept.errors).length).toBeGreaterThan(10)
    expect(Object.values(kept.errors).every(messages => messages.length === 1)).toBe(true)
    expect(Object.keys(kept.errors)[0]).toBe('field_0')
  })
})

describe('the cookie', () => {
  it('is for the whole site, briefly, and out of reach of scripts', () => {
    expect(formFlashCookie('value', false)).toBe(`${FORM_FLASH_COOKIE}=value; Path=/; Max-Age=120; HttpOnly; SameSite=Lax`)
    expect(formFlashCookie('value', true)).toEndWith('; Secure')
    expect(expiredFormFlashCookie(false)).toBe(`${FORM_FLASH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`)
  })

  it('is removed with the page that showed it, and only then', () => {
    const page = () => new Response('<html></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } })
    const asked = (headers: Record<string, string> = {}, method = 'GET', url = 'http://localhost/settings/tokens') => new Request(url, { method, headers })
    const sealed = sealFormFlash(flash(), KEY)!
    const carried = { cookie: `theme=dark; ${FORM_FLASH_COOKIE}=${sealed}; other=1` }

    const shown = clearShownFormFlash(asked(carried), page(), KEY)
    expect(shown.headers.get('set-cookie')).toBe(expiredFormFlashCookie(false))
    expect(clearShownFormFlash(asked(carried, 'GET', 'https://app.example.com/settings/tokens'), page(), KEY).headers.get('set-cookie')).toEndWith('; Secure')
    expect(clearShownFormFlash(asked({ ...carried, 'x-forwarded-proto': 'https' }), page(), KEY).headers.get('set-cookie')).toEndWith('; Secure')

    // No cookie came with the request: nothing to remove.
    expect(clearShownFormFlash(asked(), page(), KEY).headers.get('set-cookie')).toBeNull()
    // Another page, asked for between the refusal and the redirect: it showed nothing.
    expect(clearShownFormFlash(asked(carried, 'GET', 'http://localhost/settings/profile'), page(), KEY).headers.get('set-cookie')).toBeNull()
    // Not the page: a script or an image asked for on the way.
    expect(clearShownFormFlash(asked(carried), new Response('{}', { headers: { 'content-type': 'application/json' } }), KEY).headers.get('set-cookie')).toBeNull()
    expect(clearShownFormFlash(asked(carried, 'POST'), page(), KEY).headers.get('set-cookie')).toBeNull()
    // A cookie this application did not seal is not its to act on.
    expect(clearShownFormFlash(asked({ cookie: `${FORM_FLASH_COOKIE}=forged.value` }), page(), KEY).headers.get('set-cookie')).toBeNull()
    expect(clearShownFormFlash(asked(carried), page(), '').headers.get('set-cookie')).toBeNull()

    // A cookie the page's own response sets is kept beside it.
    const seeded = page()
    seeded.headers.append('set-cookie', 'csrf=abc; Path=/')
    const both = clearShownFormFlash(asked(carried), seeded, KEY).headers.getSetCookie()
    expect(both).toEqual(['csrf=abc; Path=/', expiredFormFlashCookie(false)])
  })

  it('is removed from a response whose headers cannot be changed, by sending it again', async () => {
    const html = new Response('<p>hi</p>', { status: 200, headers: { 'content-type': 'text/html' } })
    Object.defineProperty(html, 'headers', { value: new Proxy(html.headers, { get: (target, key) => key === 'append' ? () => { throw new TypeError('immutable') } : Reflect.get(target, key).bind?.(target) ?? Reflect.get(target, key) }) })
    const sealed = sealFormFlash(flash({ path: '/p' }), KEY)!
    const out = clearShownFormFlash(new Request('http://localhost/p', { headers: { cookie: `${FORM_FLASH_COOKIE}=${sealed}` } }), html, KEY)
    expect(out).not.toBe(html)
    expect(out.headers.get('set-cookie')).toBe(expiredFormFlashCookie(false))
    expect(await out.text()).toBe('<p>hi</p>')
  })
})
