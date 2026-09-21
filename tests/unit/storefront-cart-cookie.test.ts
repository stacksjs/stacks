/**
 * The storefront pages read the cart cookie of the request they render.
 *
 * The cart, the three checkout steps and the storefront header each find the
 * shopper's cart by its `stacks_cart` cookie, and none of them did. They read
 * it through a helper handed `request`, which in a server script is the
 * router's ambient proxy. stx serve never enters the router's request scope,
 * so that proxy has no request: under a production build its Cookie header
 * read back null with the cookie set. Four of the five also required the
 * helper from a directory that does not exist, which makes stx drop the whole
 * script. Every one of these pages rendered an empty cart.
 *
 * `requestContext` is what both servers publish for a server script to read
 * the request through, and what these pages used before the helper.
 *
 * A unit test of a cookie parser could not see either fault. This runs each
 * page's own `<script server>` block through `extractVariables`, the call stx
 * serve makes, with `requestContext` installed by the factory both servers
 * use, and checks what the page ends up holding.
 */
import type { StacksRequestContext } from '../../storage/framework/core/config/src/request-context'
import { Database } from 'bun:sqlite'
import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { extractVariables } from '@stacksjs/stx'
import { installRequestContext } from '../../storage/framework/core/config/src/request-context'

const resources = new URL('../../storage/framework/defaults/resources/', import.meta.url).pathname
const TOKEN = 'storefront-test-token'

let dir: string
let previousDbPath: string | undefined
let previousContext: StacksRequestContext | undefined
let cookies: Record<string, string> = {}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'stacks-storefront-cart-'))

  /*
   * The columns these pages query, not the migrated schema. No migration in
   * database/migrations creates carts.session_token, products.slug or
   * products.weight_grams, which is its own problem and not one this test
   * can speak to.
   */
  const db = new Database(join(dir, 'storefront.sqlite'), { create: true })
  db.exec(`
    CREATE TABLE carts (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT, total_items REAL, session_token TEXT);
    CREATE TABLE cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, cart_id INTEGER, quantity REAL, unit_price REAL, total_price REAL,
      product_name TEXT, product_sku TEXT, product_image TEXT
    );
    CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, weight_grams INTEGER);
    INSERT INTO carts (status, total_items, session_token) VALUES ('active', 2, '${TOKEN}');
    INSERT INTO cart_items (cart_id, quantity, unit_price, total_price, product_name, product_sku)
      VALUES (1, 2, 12.5, 25, 'Test Bowl', 'test-bowl');
    INSERT INTO products (slug, weight_grams) VALUES ('test-bowl', 350);
  `)
  db.close()

  previousDbPath = process.env.DB_DATABASE_PATH
  process.env.DB_DATABASE_PATH = join(dir, 'storefront.sqlite')

  previousContext = (globalThis as { requestContext?: StacksRequestContext }).requestContext
  installRequestContext(() => ({ cookies }))
})

afterAll(() => {
  if (previousDbPath === undefined)
    delete process.env.DB_DATABASE_PATH
  else
    process.env.DB_DATABASE_PATH = previousDbPath

  const scope = globalThis as { requestContext?: StacksRequestContext }
  if (previousContext === undefined)
    delete scope.requestContext
  else
    scope.requestContext = previousContext

  rmSync(dir, { recursive: true, force: true })
})

/**
 * What a page's server script leaves in its render context, and anything stx
 * warned about on the way.
 */
async function render(template: string, cookie: Record<string, string>): Promise<{ context: Record<string, any>, warnings: string[] }> {
  const file = join(resources, template)
  const script = /<script server>([\s\S]*?)<\/script>/.exec(readFileSync(file, 'utf-8'))?.[1]
  expect(script).toBeDefined()

  cookies = cookie
  const warn = spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const context: Record<string, any> = { params: {} }
    await extractVariables(script!, context, file)
    return { context, warnings: warn.mock.calls.map(call => String(call[0])).filter(message => message.startsWith('[stx]')) }
  }
  finally {
    warn.mockRestore()
  }
}

describe('the storefront pages read the cart cookie', () => {
  for (const page of ['views/cart.stx', 'views/checkout/contact.stx', 'views/checkout/shipping.stx', 'views/checkout/payment.stx']) {
    it(`${page} lists the cart the cookie names`, async () => {
      const { context, warnings } = await render(page, { stacks_cart: TOKEN })

      expect(warnings).toEqual([])
      expect(context.token).toBe(TOKEN)
      expect(context.items.map((item: { name: string }) => item.name)).toEqual(['Test Bowl'])
    })

    it(`${page} is empty without the cookie`, async () => {
      const { context, warnings } = await render(page, {})

      expect(warnings).toEqual([])
      expect(context.token).toBeNull()
      expect(context.items).toEqual([])
    })
  }

  it('the storefront header counts the items in the cart the cookie names', async () => {
    expect((await render('layouts/storefront.stx', { stacks_cart: TOKEN })).context.cartCount).toBe(2)
    expect((await render('layouts/storefront.stx', {})).context.cartCount).toBe(0)
  })
})
