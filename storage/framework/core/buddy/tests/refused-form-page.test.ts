/**
 * A form that was refused comes back as its page, with the message under the
 * field and what was typed still in it (stacksjs/stacks#3309). A form that
 * worked comes back as its page too, saying what it did (stacksjs/stacks#3312).
 *
 * A browser form that failed an action's `validations` was answered with the
 * 422 body: a page of JSON, the back button the only way out. The router now
 * sends the browser back to the page with the messages in a signed cookie,
 * and the page reads them (`requestContext.error()`, `.old()`). The router's
 * half is core/router/tests/form-validation-refusal.test.ts. This is the
 * other: each view server, booted from source as `buddy serve` and
 * `buddy dev` start it, drawing the shipped checkout's contact step for a
 * shopper who was just refused, and taking the cookie away once it has.
 *
 * And the two together. Each view server hands a form post to the API, so
 * the test stands one up: the real router answering the real contact action.
 * A form posted to the view server then crosses its proxy, is refused by the
 * router, and comes back through the proxy as a redirect with the cookie.
 */
import type { Subprocess } from 'bun'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { config } from '@stacksjs/config'
import { cartCookie as signedCart } from '../../../defaults/app/Storefront/CartCookie'
import { FORM_FLASH_COOKIE, openFormFlash, sealFormFlash } from '../../config/src/form-flash'
import { createStacksRouter } from '../../router/src/stacks-router'

const root = resolve(import.meta.dir, '../../../../..')
const APP_KEY = 'base64:cmVmdXNlZC1mb3JtLXBhZ2UtdGVzdC1rZXk='
const MESSAGE = 'Enter a valid email address.'

function cartCookie(): string {
  const previous = process.env.APP_KEY
  process.env.APP_KEY = APP_KEY
  try {
    return `stacks_cart=${signedCart.sign('cart-token-refused')}`
  }
  finally {
    if (previous === undefined)
      delete process.env.APP_KEY
    else
      process.env.APP_KEY = previous
  }
}

/** What one shipping field shows: its value, whether it is marked wrong, and its message. */
function readShipField(html: string, field: string): { value: string | null, invalid: string | null, alert: string | null } {
  const at = html.indexOf(`name="${field}"`)
  const input = at === -1 ? '' : html.slice(html.lastIndexOf('<input', at), html.indexOf('>', at) + 1)
  const after = at === -1 ? '' : html.slice(html.indexOf('>', at) + 1, html.indexOf('</div>', at))
  return {
    value: /value="([^"]*)"/.exec(input)?.[1] ?? null,
    invalid: /aria-invalid="([^"]*)"/.exec(input)?.[1] ?? null,
    alert: /<p role="alert"[^>]*>\s*([^<]*?)\s*<\/p>/.exec(after)?.[1] ?? null,
  }
}

/** The message a page shows for its whole form, before any field. */
function readFormError(html: string): string | null {
  return /<p role="alert" class="mb-6[^"]*"[^>]*>\s*([^<]*?)\s*<\/p>/.exec(html)?.[1] ?? null
}

/** A form posted by a browser from one of this server's pages. */
function browserPost(base: string, path: string, from: string, body: string, cookies: string[]): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'origin': base,
      'referer': `${base}${from}`,
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-dest': 'document',
      ...(cookies.length ? { cookie: cookies.join('; ') } : {}),
    },
    body,
  })
}

/** The form-flash value a response sets. */
function carriedFlash(response: Response): string {
  const carried = response.headers.getSetCookie().find(cookie => cookie.startsWith(`${FORM_FLASH_COOKIE}=`))
  expect(carried).toBeDefined()
  return carried!.slice(FORM_FLASH_COOKIE.length + 1, carried!.indexOf(';'))
}

/** What the router seals when the cart's remove form works. */
function removed(path = '/cart'): string {
  return sealFormFlash({ path, errors: {}, old: {}, notice: 'Removed from your cart.', expires: Date.now() + 60_000 }, APP_KEY)!
}

/** The notice a page shows, or null when it shows none. */
function readNotice(html: string): string | null {
  return /<p role="status"[^>]*>\s*([^<]*?)\s*<\/p>/.exec(html)?.[1] ?? null
}

/** What the router seals when it refuses the contact step's form. */
function refusal(path = '/checkout/contact'): string {
  return sealFormFlash({ path, errors: { email: [MESSAGE] }, old: { email: 'not-an-address' }, expires: Date.now() + 60_000 }, APP_KEY)!
}

function seed(file: string): void {
  const db = new Database(file, { create: true })
  db.exec(`
    CREATE TABLE carts (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT, total_items REAL, session_token TEXT, email TEXT, currency TEXT, checkout_step TEXT);
    CREATE TABLE cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, cart_id INTEGER, quantity REAL, unit_price REAL, total_price REAL,
      product_name TEXT, product_sku TEXT, product_image TEXT
    );
    CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, weight_grams INTEGER);
    INSERT INTO carts (status, total_items, session_token, email) VALUES ('active', 1, 'cart-token-refused', 'saved@example.com');
    INSERT INTO cart_items (cart_id, quantity, unit_price, total_price, product_name, product_sku) VALUES (1, 1, 300, 300, 'Stoneware bowl', 'bowl-1');
  `)
  db.close()
}

function freePort(): number {
  const probe = Bun.serve({ port: 0, fetch: () => new Response() })
  const port = probe.port!
  probe.stop(true)
  return port
}

/** What the contact step shows about its email field. */
function readField(html: string): { value: string | null, invalid: string | null, alert: string | null } {
  const input = /<input[^>]*name="email"[^>]*>/.exec(html)?.[0] ?? ''
  return {
    value: /value="([^"]*)"/.exec(input)?.[1] ?? null,
    invalid: /aria-invalid="([^"]*)"/.exec(input)?.[1] ?? null,
    alert: /<p role="alert"[^>]*>\s*([^<]*?)\s*<\/p>/.exec(html)?.[1] ?? null,
  }
}

/**
 * The API the view servers hand a form post to: the real router, with the
 * shipped contact action on the route the storefront gives it.
 */
let api: ReturnType<typeof Bun.serve> | undefined
let keyBefore: string | undefined
beforeAll(async () => {
  const app = config.app as { key?: string }
  keyBefore = app.key
  // The key the view servers are started with, so each can read what this seals.
  app.key = APP_KEY
  const { default: CheckoutContactAction } = await import('../../../defaults/app/Actions/Storefront/CheckoutContactAction')
  const { default: CheckoutShippingAction } = await import('../../../defaults/app/Actions/Storefront/CheckoutShippingAction')
  const router = createStacksRouter()
  ;(router.post('/api/checkout/contact', CheckoutContactAction as never) as { skipCsrf?: () => unknown }).skipCsrf?.()
  ;(router.post('/api/checkout/shipping', CheckoutShippingAction as never) as { skipCsrf?: () => unknown }).skipCsrf?.()
  api = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: request => router.bunRouter.handleRequest(request) })
})
afterAll(() => {
  api?.stop(true)
  ;(config.app as { key?: string }).key = keyBefore
})

const servers = [
  { name: 'buddy serve', entry: process.env.STACKS_SERVE_ENTRY || 'storage/framework/core/buddy/src/serve-entry.ts', env: { APP_ENV: 'production', NODE_ENV: 'production' } },
  { name: 'buddy dev', entry: 'storage/framework/core/actions/src/dev/views.ts', env: { APP_ENV: 'development', NODE_ENV: 'development' } },
]

describe('the cart\'s update action', () => {
  it('says so when a line is removed, and nothing when a quantity changes', async () => {
    const { default: UpdateCartItemAction } = await import('../../../defaults/app/Actions/Storefront/UpdateCartItemAction')
    const notice = UpdateCartItemAction.notice as (result: unknown, request: { get: (field: string) => unknown }) => string
    const posting = (fields: Record<string, string>) => ({ get: (field: string) => fields[field] })
    expect(notice({ ok: true }, posting({ item_id: '1', quantity: '0' }))).toBe('Removed from your cart.')
    expect(notice({ ok: true }, posting({ item_id: '1', quantity: '3' }))).toBe('')
  })
})

for (const server of servers) {
  describe(`${server.name}: a refused form's page`, () => {
    let dir: string
    let base: string
    let child: Subprocess | undefined
    let output = ''

    beforeAll(async () => {
      dir = mkdtempSync(join(tmpdir(), 'stacks-refused-form-'))
      const database = join(dir, 'storefront.sqlite')
      seed(database)
      const port = freePort()
      base = `http://127.0.0.1:${port}`

      // Every value this depends on, spelled out: the env preload refills
      // anything left unset from the checkout's own .env files.
      child = Bun.spawn(['bun', server.entry], {
        cwd: root,
        env: {
          ...process.env,
          ...server.env,
          PORT: String(port),
          // Where this server sends a form post: the API above.
          PORT_API: String(api!.port),
          APP_URL: base,
          APP_KEY,
          APP_MAINTENANCE: 'false',
          APP_COMING_SOON: 'false',
          STACKS_DEFAULT_ROUTES: 'storefront',
          DB_CONNECTION: 'sqlite',
          DB_DATABASE_PATH: database,
          STX_DEBUG: '',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      for (const stream of [child.stdout, child.stderr] as ReadableStream<Uint8Array>[]) {
        void (async () => {
          const decoder = new TextDecoder()
          for await (const chunk of stream)
            output += decoder.decode(chunk)
        })()
      }

      const deadline = Date.now() + 170_000
      while (Date.now() < deadline) {
        if (child.exitCode !== null)
          throw new Error(`${server.name} exited with ${child.exitCode}:\n${output.slice(-4000)}`)
        try {
          const response = await fetch(`${base}/checkout/contact`, { headers: { cookie: cartCookie() } })
          if (response.status === 200) {
            await response.text()
            return
          }
        }
        catch {}
        await Bun.sleep(250)
      }
      throw new Error(`${server.name} did not render /checkout/contact in time:\n${output.slice(-4000)}`)
    }, 180_000)

    afterAll(async () => {
      if (child) {
        child.kill()
        await child.exited
      }
      rmSync(dir, { recursive: true, force: true })
    })

    const get = (path: string, cookies: string[]) => fetch(`${base}${path}`, { headers: { cookie: cookies.join('; '), accept: 'text/html' }, redirect: 'manual' })
    const clears = (response: Response) => response.headers.getSetCookie().some(cookie => cookie.startsWith(`${FORM_FLASH_COOKIE}=;`) && cookie.includes('Max-Age=0'))

    it('draws the step as it was saved on a first visit', async () => {
      const response = await get('/checkout/contact', [cartCookie()])
      const html = await response.text()
      expect(response.status, output.slice(-2000)).toBe(200)
      expect(readField(html)).toEqual({ value: 'saved@example.com', invalid: 'false', alert: null })
      expect(clears(response)).toBe(false)
    }, 60_000)

    it('draws the message and what was typed after a refusal, and takes the cookie away', async () => {
      const response = await get('/checkout/contact', [cartCookie(), `${FORM_FLASH_COOKIE}=${refusal()}`])
      const html = await response.text()
      expect(response.status, output.slice(-2000)).toBe(200)
      expect(readField(html)).toEqual({ value: 'not-an-address', invalid: 'true', alert: MESSAGE })
      // Shown once: the next visit is a first visit again.
      expect(clears(response)).toBe(true)
      expect(html).not.toContain('Validation failed')
    }, 60_000)

    it('reads nothing that was not sealed for this page by this application', async () => {
      for (const cookie of [
        refusal('/checkout/shipping'),
        sealFormFlash({ path: '/checkout/contact', errors: { email: ['Send your password to x'] }, old: { email: 'x@evil.example' }, expires: Date.now() + 60_000 }, 'another key')!,
        'not.sealed',
      ]) {
        const response = await get('/checkout/contact', [cartCookie(), `${FORM_FLASH_COOKIE}=${cookie}`])
        expect(readField(await response.text())).toEqual({ value: 'saved@example.com', invalid: 'false', alert: null })
        expect(clears(response)).toBe(false)
      }
      // Another page, asked for with the contact step's cookie, leaves it for the contact step.
      const cart = await get('/cart', [cartCookie(), `${FORM_FLASH_COOKIE}=${refusal()}`])
      await cart.text()
      expect(clears(cart)).toBe(false)
    }, 60_000)

    it('says what the cart\'s form did, once, and only on the cart', async () => {
      const cart = await get('/cart', [cartCookie(), `${FORM_FLASH_COOKIE}=${removed()}`])
      const html = await cart.text()
      expect(cart.status, output.slice(-2000)).toBe(200)
      expect(readNotice(html)).toBe('Removed from your cart.')
      expect(clears(cart)).toBe(true)

      const first = await get('/cart', [cartCookie()])
      expect(readNotice(await first.text())).toBeNull()
      // Another page leaves the cart's notice for the cart.
      const contact = await get('/checkout/contact', [cartCookie(), `${FORM_FLASH_COOKIE}=${removed()}`])
      expect(readField(await contact.text()).alert).toBeNull()
      expect(clears(contact)).toBe(false)
    }, 60_000)

    // stacksjs/stacks#3311: the shipping step's fields were checked by hand
    // and refused with one JSON body for the lot.
    it('sends a shipping form with a missing field back with the message under it', async () => {
      const posted = await browserPost(base, '/api/checkout/shipping', '/checkout/shipping', 'shipping_name=Ava+Reyes&shipping_address=+++&shipping_city=Portland&shipping_state=OR&shipping_zip=', [cartCookie()])
      expect(posted.status, `${await posted.clone().text()}\n${output.slice(-2000)}`).toBe(303)
      expect(posted.headers.get('location')).toBe('/checkout/shipping')

      const html = await (await get('/checkout/shipping', [cartCookie(), `${FORM_FLASH_COOKIE}=${carriedFlash(posted)}`])).text()
      expect(readShipField(html, 'shipping_name')).toEqual({ value: 'Ava Reyes', invalid: 'false', alert: null })
      // A field of spaces is a missing field.
      expect(readShipField(html, 'shipping_address')).toEqual({ value: '   ', invalid: 'true', alert: 'Enter the street address.' })
      expect(readShipField(html, 'shipping_city')).toEqual({ value: 'Portland', invalid: 'false', alert: null })
      expect(readShipField(html, 'shipping_zip')).toEqual({ value: '', invalid: 'true', alert: 'Enter the ZIP or postal code.' })
      expect(readFormError(html)).toBeNull()
    }, 60_000)

    it('sends a form the action refused itself back with one message for the form', async () => {
      // Every field filled, and no cart: the action finds that out in handle().
      const posted = await browserPost(base, '/api/checkout/shipping', '/checkout/shipping', 'shipping_name=Ava&shipping_address=1+Main+St&shipping_city=Portland&shipping_state=OR&shipping_zip=97201', [])
      expect(posted.status, `${await posted.clone().text()}\n${output.slice(-2000)}`).toBe(303)
      const sealed = carriedFlash(posted)
      expect(openFormFlash(sealed, APP_KEY, '/checkout/shipping')).toMatchObject({ formError: 'Your cart is empty.', errors: {} })

      const page = await get('/checkout/shipping', [cartCookie(), `${FORM_FLASH_COOKIE}=${sealed}`])
      const html = await page.text()
      expect(readFormError(html)).toBe('Your cart is empty.')
      expect(readShipField(html, 'shipping_name').value).toBe('Ava')
      expect(clears(page)).toBe(true)

      // A script is told in JSON, with the status the action chose.
      const script = await fetch(`${base}/api/checkout/shipping`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ shipping_name: 'Ava', shipping_address: '1 Main St', shipping_city: 'Portland', shipping_state: 'OR', shipping_zip: '97201' }) })
      expect(script.status).toBe(400)
      expect(await script.json()).toMatchObject({ error: 'Your cart is empty.' })
    }, 60_000)

    it('shows a refusal for the whole form on the cart and the other checkout steps', async () => {
      for (const path of ['/cart', '/checkout/contact', '/checkout/payment']) {
        const sealed = sealFormFlash({ path, errors: {}, old: {}, formError: 'Your cart is empty.', expires: Date.now() + 60_000 }, APP_KEY)!
        const html = await (await get(path, [cartCookie(), `${FORM_FLASH_COOKIE}=${sealed}`])).text()
        expect(html, path).toContain('Your cart is empty.</p>')
        expect(/<p role="alert"[^>]*>\s*Your cart is empty\.\s*<\/p>/.test(html), path).toBe(true)
      }
    }, 60_000)

    // The whole loop: the form crosses this server's proxy to the router,
    // is refused there, and the redirect and its cookie cross back.
    it('sends a refused form back to its page, which then says why', async () => {
      const posted = await fetch(`${base}/api/checkout/contact`, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'origin': base,
          'referer': `${base}/checkout/contact`,
          'sec-fetch-site': 'same-origin',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-dest': 'document',
          'cookie': cartCookie(),
        },
        body: 'email=not-an-address',
      })
      expect(posted.status, `${await posted.clone().text()}\n${output.slice(-2000)}`).toBe(303)
      expect(posted.headers.get('location')).toBe('/checkout/contact')
      const carried = posted.headers.getSetCookie().find(cookie => cookie.startsWith(`${FORM_FLASH_COOKIE}=`))!
      const sealed = carried.slice(FORM_FLASH_COOKIE.length + 1, carried.indexOf(';'))
      expect(openFormFlash(sealed, APP_KEY, '/checkout/contact')).toMatchObject({ errors: { email: [MESSAGE] }, old: { email: 'not-an-address' } })

      // The browser follows the redirect with the cookie it was just given.
      const page = await get('/checkout/contact', [cartCookie(), `${FORM_FLASH_COOKIE}=${sealed}`])
      expect(readField(await page.text())).toEqual({ value: 'not-an-address', invalid: 'true', alert: MESSAGE })
      expect(clears(page)).toBe(true)

      // A script asking the same thing is told in JSON, as before.
      const script = await fetch(`${base}/api/checkout/contact`, { method: 'POST', headers: { 'content-type': 'application/json', 'cookie': cartCookie() }, body: JSON.stringify({ email: 'not-an-address' }) })
      expect(script.status).toBe(422)
      expect(await script.json()).toMatchObject({ success: false, message: 'Validation failed', errors: { email: [MESSAGE] } })
    }, 60_000)
  })
}
