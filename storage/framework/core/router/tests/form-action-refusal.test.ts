/**
 * stacksjs/stacks#3311 - a refusal an action writes itself. `validations`
 * refuse a field before `handle()` runs; "your cart is empty" is only known
 * once it has. Actions wrote it as `response.json({ error }, 400)`, and a
 * browser form posting there was shown that JSON. `refuse()` answers a caller
 * that asked for data with that same body, and a browser form with its page.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Action } from '@stacksjs/actions'
import { config, createRequestContext, FORM_FLASH_COOKIE, openFormFlash } from '@stacksjs/config'
import { createStacksRouter, refuse } from '../src'

const KEY = 'base64:form-action-refusal-test-key'
const app = config.app as { key?: string }
let keyBefore: string | undefined
beforeAll(() => {
  keyBefore = app.key
  app.key = KEY
})
afterAll(() => {
  app.key = keyBefore
})

function router(options: Record<string, unknown> = {}, answer: () => unknown = () => refuse('Your cart is empty.', { status: 400 })) {
  const stacks = createStacksRouter()
  stacks.post('/api/checkout/shipping', new Action({
    name: 'CheckoutShipping',
    skipCsrf: true,
    ...options,
    async handle() {
      return answer()
    },
  } as any) as any)
  return stacks
}

function form(headers: Record<string, string> = {}, body = 'name=Ava&address=1+Main+St&card_number=4242424242424242'): Request {
  return new Request('http://localhost/api/checkout/shipping', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'origin': 'http://localhost',
      'referer': 'http://localhost/checkout/shipping',
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

describe('refuse() to a caller that asked for data', () => {
  // The error answer carries the framework's `request_id` beside it, as the
  // hand-written ones did.
  it('is the body actions wrote by hand, with the status they chose', async () => {
    const res = await router().bunRouter.handleRequest(new Request('http://localhost/api/checkout/shipping', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Your cart is empty.' })
    expect(res.headers.get('set-cookie')).toBeNull()

    const script = await router().bunRouter.handleRequest(form({ 'accept': '*/*', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' }))
    expect(script.status).toBe(400)
    expect(await script.json()).toMatchObject({ error: 'Your cart is empty.' })
  })

  it('names the field, when it is about one', async () => {
    const res = await router({}, () => refuse('That postcode is not one we deliver to.', { field: 'postcode' })).bunRouter.handleRequest(new Request('http://localhost/api/checkout/shipping', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'That postcode is not one we deliver to.', errors: { postcode: ['That postcode is not one we deliver to.'] } })
  })

  it('needs an error status', () => {
    expect(() => refuse('Fine', { status: 200 })).toThrow(RangeError)
  })
})

describe('refuse() to a browser form', () => {
  it('goes back to the page with the message for the whole form and what was posted', async () => {
    const res = await router().bunRouter.handleRequest(form())
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/checkout/shipping')

    const flash = openFormFlash(flashOf(res), KEY, '/checkout/shipping')!
    expect(flash.formError).toBe('Your cart is empty.')
    expect(flash.errors).toEqual({})
    // What was typed comes back, and a card number never does.
    expect(flash.old).toEqual({ name: 'Ava', address: '1 Main St' })

    const page = createRequestContext(() => ({ path: '/checkout/shipping', cookies: { [FORM_FLASH_COOKIE]: flashOf(res) } }), () => KEY)
    expect(page.formError()).toBe('Your cart is empty.')
    expect(page.hasErrors()).toBe(true)
    expect(page.old('name')).toBe('Ava')
    expect(createRequestContext(() => ({ path: '/checkout/shipping', cookies: {} }), () => KEY).formError()).toBe('')
  })

  it('puts a message about one field under that field', async () => {
    const res = await router({}, () => refuse('That postcode is not one we deliver to.', { field: 'postcode' })).bunRouter.handleRequest(form())
    const flash = openFormFlash(flashOf(res), KEY, '/checkout/shipping')!
    expect(flash.errors).toEqual({ postcode: ['That postcode is not one we deliver to.'] })
    expect(flash.formError).toBeUndefined()
  })

  it('works from authorize and before, which stop the action with their own answer', async () => {
    for (const hook of ['authorize', 'before']) {
      let handled = false
      const stacks = createStacksRouter()
      stacks.post('/api/checkout/shipping', new Action({
        name: 'CheckoutShipping',
        skipCsrf: true,
        [hook]: () => refuse('Sign in to check out.', { status: 403 }),
        async handle() {
          handled = true
          return {}
        },
      } as any) as any)
      const res = await stacks.bunRouter.handleRequest(form())
      expect(res.status).toBe(303)
      expect(openFormFlash(flashOf(res), KEY, '/checkout/shipping')!.formError).toBe('Sign in to check out.')
      expect(handled).toBe(false)
      const api = await stacks.bunRouter.handleRequest(new Request('http://localhost/api/checkout/shipping', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }))
      expect(api.status).toBe(403)
      expect(await api.json()).toMatchObject({ error: 'Sign in to check out.' })
    }
  })

  it('leaves a hook\'s own response alone when it is not a refusal', async () => {
    const stacks = createStacksRouter()
    stacks.post('/api/checkout/shipping', new Action({ name: 'X', skipCsrf: true, before: () => Response.json({ held: true }), handle: () => ({}) } as any) as any)
    const res = await stacks.bunRouter.handleRequest(form())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ held: true })
  })

  it('is told on a page, with the status chosen, when there is no page to go back to', async () => {
    for (const headers of [{ referer: '' }, { 'sec-fetch-site': 'cross-site', 'origin': 'https://evil.example', 'referer': 'https://evil.example/checkout/shipping' }]) {
      const res = await router().bunRouter.handleRequest(form(headers))
      expect(res.status).toBe(400)
      expect(res.headers.get('location')).toBeNull()
      expect(res.headers.get('content-type')).toContain('text/html')
      const html = await res.text()
      expect(html).toContain('<li>Your cart is empty.</li>')
      expect(html).not.toContain('"error"')
    }
  })

  it('is JSON for every caller when the action says so', async () => {
    const res = await router({ apiResponse: true }).bunRouter.handleRequest(form())
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Your cart is empty.' })
  })
})
