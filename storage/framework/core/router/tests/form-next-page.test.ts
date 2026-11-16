/**
 * stacksjs/stacks#3312 follow-up - where a browser form goes once it worked.
 * #3312 sent it back to its own page. A checkout step goes on to the next
 * one, and the storefront wrote that by hand in every step:
 *
 *   if (accept.includes('text/html') && !xhr) return response.redirect('/checkout/payment')
 *
 * which ignored what the browser said it was fetching and `apiResponse`, and
 * in the add-to-cart action followed a `redirect` field to any site at all.
 * `next` on the action says it once, and only ever names this application.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Action } from '@stacksjs/actions'
import { config, FORM_FLASH_COOKIE, openFormFlash } from '@stacksjs/config'
import { createStacksRouter, refuse } from '../src'

const KEY = 'base64:form-next-page-test-key'
const app = config.app as { key?: string }
let keyBefore: string | undefined
beforeAll(() => {
  keyBefore = app.key
  app.key = KEY
})
afterAll(() => {
  app.key = keyBefore
})

function router(options: Record<string, unknown>, handle: (req: any) => unknown = () => ({ ok: true, order_id: 42 })) {
  const stacks = createStacksRouter()
  stacks.post('/api/checkout/place', new Action({ name: 'PlaceOrder', skipCsrf: true, ...options, handle } as any) as any)
  return stacks
}

function form(headers: Record<string, string> = {}, body = 'redirect=%2Fcart'): Request {
  return new Request('http://localhost/api/checkout/place', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'origin': 'http://localhost',
      'referer': 'http://localhost/checkout/payment',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-dest': 'document',
      ...headers,
    },
    body,
  })
}

const asScript = { 'accept': '*/*', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' }

describe('a browser form whose action names the next page', () => {
  it('goes there, and a script is answered as before', async () => {
    const stacks = router({ next: '/orders/thanks' })
    const res = await stacks.bunRouter.handleRequest(form())
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/orders/thanks')
    expect(res.headers.get('set-cookie')).toBeNull()

    const script = await stacks.bunRouter.handleRequest(form(asScript))
    expect(script.status).toBe(200)
    expect(await script.json()).toEqual({ ok: true, order_id: 42 })
  })

  it('is told by a function what the outcome was', async () => {
    const res = await router({ next: (result: { order_id: number }) => `/orders/${result.order_id}` }).bunRouter.handleRequest(form())
    expect(res.headers.get('location')).toBe('/orders/42')
  })

  it('carries the notice to that page, and to that page only', async () => {
    const res = await router({ next: '/checkout/shipping', notice: 'Email saved.' }).bunRouter.handleRequest(form())
    expect(res.headers.get('location')).toBe('/checkout/shipping')
    const sealed = res.headers.get('set-cookie')!.slice(FORM_FLASH_COOKIE.length + 1).split(';')[0]!
    expect(openFormFlash(sealed, KEY, '/checkout/shipping')!.notice).toBe('Email saved.')
    expect(openFormFlash(sealed, KEY, '/checkout/payment')).toBeNull()
  })

  it('goes there even with no page of its own to go back to', async () => {
    const res = await router({ next: '/orders/thanks' }).bunRouter.handleRequest(form({ referer: '' }))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/orders/thanks')
  })

  it('keeps the cookies the action set', async () => {
    const res = await router({ next: '/cart' }, (req) => {
      req.cookies.set('stacks_cart', 'token.signature', { path: '/', httpOnly: true })
      return { ok: true }
    }).bunRouter.handleRequest(form())
    expect(res.status).toBe(303)
    expect(res.headers.getSetCookie().some(cookie => cookie.startsWith('stacks_cart=token.signature'))).toBe(true)
  })

  it('still sends a refusal back to the form\'s own page', async () => {
    const res = await router({ next: '/orders/thanks' }, () => refuse('Your cart is empty.', { status: 400 })).bunRouter.handleRequest(form())
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/checkout/payment')
  })

  it('is JSON for every caller when the action says so', async () => {
    const res = await router({ next: '/orders/thanks', apiResponse: true }).bunRouter.handleRequest(form())
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })
})

describe('a next page that is not this application\'s', () => {
  it('is not followed when a function answers with one', async () => {
    for (const unsafe of ['https://evil.example/', '//evil.example/x', '/\\evil.example', ' /cart', 'javascript:alert(1)', 'cart']) {
      const res = await router({ next: (_result: unknown, request: any) => String(request.get('redirect')) }).bunRouter.handleRequest(form({}, `redirect=${encodeURIComponent(unsafe)}`))
      expect(res.status, unsafe).toBe(303)
      // Back to the form's own page instead.
      expect(res.headers.get('location'), unsafe).toBe('/checkout/payment')
    }
    // A path of this application, taken from the request, is followed.
    const local = await router({ next: (_result: unknown, request: any) => String(request.get('redirect')) }).bunRouter.handleRequest(form({}, 'redirect=%2Fproducts%2Fbowl%3Fadded%3D1'))
    expect(local.headers.get('location')).toBe('/products/bowl?added=1')
  })

  it('is an error where the route is registered, when it is written as a string', () => {
    expect(() => router({ next: 'https://evil.example/' })).toThrow(/not a path of this application/)
    expect(() => router({ next: '//evil.example' })).toThrow(/not a path of this application/)
  })
})
