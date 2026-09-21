/**
 * The storefront pages find the cart the shopper's signed cookie names, and
 * say so in the log when they cannot read it.
 *
 * The cart, the three checkout steps and the storefront header each look the
 * shopper's cart up by the `stacks_cart` cookie. The storefront actions write
 * that cookie HMAC-signed, as the token, a dot and the signature
 * (`writeCartCookie` in app/Storefront/CartCookie.ts), and these pages looked
 * up the whole value, so they matched no cart a shopper had. They now verify
 * the cookie the way the actions do and look up the token, and refuse an
 * unsigned or tampered value outright.
 *
 * Every way their database read could fail used to render an empty cart
 * without a word in any log (app/Storefront/StorefrontDatabase.ts lists them).
 * The cases below that break the read check both halves: the page still
 * degrades to its empty cart, and a warning names the page and the reason.
 *
 * This runs each page's own `<script server>` block through
 * `extractVariables`, the call stx serve makes, with `requestContext`
 * installed by the factory both servers use, and checks what the page ends up
 * holding. core/buddy/tests/request-context-concurrency.test.ts renders the
 * same pages through the real servers.
 */
import type { StacksRequestContext } from '../../storage/framework/core/config/src/request-context'
import { Database } from 'bun:sqlite'
import { afterAll, afterEach, beforeAll, describe, expect, it, spyOn } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { extractVariables } from '@stacksjs/stx'
import { installRequestContext } from '../../storage/framework/core/config/src/request-context'
import { cartCookie } from '../../storage/framework/defaults/app/Storefront/CartCookie'

const resources = new URL('../../storage/framework/defaults/resources/', import.meta.url).pathname
const TOKEN = 'storefront-test-token'
const PAGES = ['views/cart.stx', 'views/checkout/contact.stx', 'views/checkout/shipping.stx', 'views/checkout/payment.stx']

let dir: string
let cookies: Record<string, string> = {}
const saved: Record<string, string | undefined> = {}
let previousContext: StacksRequestContext | undefined

/** Set an env var for the rest of the file, restored in afterAll. */
function setEnv(name: string, value: string | undefined): void {
  if (!(name in saved))
    saved[name] = process.env[name]
  if (value === undefined)
    delete process.env[name]
  else
    process.env[name] = value
}

/**
 * A database holding one active cart with one line, under `TOKEN`.
 *
 * `columns: 'pages'` has the columns these pages query. `'migrated'` has no
 * `carts.session_token`, as the `carts` table database/migrations creates
 * has none (nor `checkout_step`, `email` or the shipping columns).
 */
function database(name: string, columns: 'pages' | 'migrated'): string {
  const file = join(dir, `${name}.sqlite`)
  const db = new Database(file, { create: true })
  const sessionColumn = columns === 'pages' ? ', session_token TEXT' : ''
  db.exec(`
    CREATE TABLE carts (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT, total_items REAL${sessionColumn});
    CREATE TABLE cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, cart_id INTEGER, quantity REAL, unit_price REAL, total_price REAL,
      product_name TEXT, product_sku TEXT, product_image TEXT
    );
    CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, weight_grams INTEGER);
    INSERT INTO cart_items (cart_id, quantity, unit_price, total_price, product_name, product_sku)
      VALUES (1, 2, 12.5, 25, 'Test Bowl', 'test-bowl');
    INSERT INTO products (slug, weight_grams) VALUES ('test-bowl', 350);
  `)
  if (columns === 'pages')
    db.run(`INSERT INTO carts (status, total_items, session_token) VALUES ('active', 2, ?1)`, [TOKEN])
  else
    db.run(`INSERT INTO carts (status, total_items) VALUES ('active', 2)`)
  db.close()
  return file
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'stacks-storefront-cart-'))
  setEnv('APP_KEY', 'base64:c3RvcmVmcm9udC1jYXJ0LWNvb2tpZS10ZXN0')
  setEnv('DB_CONNECTION', 'sqlite')
  setEnv('DB_DATABASE_PATH', database('storefront', 'pages'))

  previousContext = (globalThis as { requestContext?: StacksRequestContext }).requestContext
  installRequestContext(() => ({ cookies }))
})

afterEach(() => {
  setEnv('DB_CONNECTION', 'sqlite')
  setEnv('DB_DATABASE_PATH', join(dir, 'storefront.sqlite'))
})

afterAll(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined)
      delete process.env[name]
    else
      process.env[name] = value
  }

  const scope = globalThis as { requestContext?: StacksRequestContext }
  if (previousContext === undefined)
    delete scope.requestContext
  else
    scope.requestContext = previousContext

  rmSync(dir, { recursive: true, force: true })
})

/**
 * What a page's server script leaves in its render context, and what it
 * warned about on the way (stx's own warnings and the storefront's).
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
    return { context, warnings: warn.mock.calls.map(call => String(call[0])).filter(message => /^\[(?:stx|storefront)\]/.test(message)) }
  }
  finally {
    warn.mockRestore()
  }
}

const signed = () => ({ stacks_cart: cartCookie.sign(TOKEN) })
const tampered = () => ({ stacks_cart: `${TOKEN}.${'A'.repeat(22)}` })

describe('the storefront pages read the signed cart cookie', () => {
  for (const page of PAGES) {
    it(`${page} lists the cart a signed cookie names`, async () => {
      const { context, warnings } = await render(page, signed())

      expect(warnings).toEqual([])
      expect(context.token).toBe(TOKEN)
      expect(context.items.map((item: { name: string }) => item.name)).toEqual(['Test Bowl'])
    })

    it(`${page} shows no cart for an unsigned, tampered or missing cookie`, async () => {
      // The unsigned value is the token itself, the one a lookup would match.
      for (const cookie of [{ stacks_cart: TOKEN }, tampered(), {}]) {
        const { context, warnings } = await render(page, cookie)

        expect(warnings).toEqual([])
        expect(context.token).toBeNull()
        expect(context.items).toEqual([])
      }
    })
  }

  it('the storefront header counts the items in the cart a signed cookie names', async () => {
    expect((await render('layouts/storefront.stx', signed())).context.cartCount).toBe(2)
    for (const cookie of [{ stacks_cart: TOKEN }, tampered(), {}])
      expect((await render('layouts/storefront.stx', cookie)).context.cartCount).toBe(0)
  })
})

describe('the storefront pages say why they cannot read the cart', () => {
  it('names the page and the missing column on the schema the migrations create', async () => {
    const file = database('migrated', 'migrated')
    setEnv('DB_DATABASE_PATH', file)

    for (const page of [...PAGES, 'layouts/storefront.stx']) {
      const { context, warnings } = await render(page, signed())
      expect(context.items ?? []).toEqual([])
      expect(context.cartCount ?? 0).toBe(0)
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain(`[storefront] ${page} shows no cart`)
      expect(warnings[0]).toContain(file)
      expect(warnings[0]).toContain('session_token')
    }
  })

  it('warns once per process for the same failure, not once per request', async () => {
    const file = database('migrated-twice', 'migrated')
    setEnv('DB_DATABASE_PATH', file)

    expect((await render('views/cart.stx', signed())).warnings).toHaveLength(1)
    expect((await render('views/cart.stx', signed())).warnings).toEqual([])
  })

  it('says so when the database file is missing, and does not create it', async () => {
    const file = join(dir, 'missing.sqlite')
    setEnv('DB_DATABASE_PATH', file)

    const { context, warnings } = await render('views/cart.stx', signed())
    expect(context.items).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain(file)
    expect(existsSync(file)).toBe(false)
  })

  it('says so when the app does not use SQLite, instead of reading a file that is not its database', async () => {
    setEnv('DB_CONNECTION', 'postgres')

    const { context, warnings } = await render('views/checkout/contact.stx', signed())
    expect(context.items).toEqual([])
    expect(warnings).toEqual([
      '[storefront] views/checkout/contact.stx shows no cart: it reads carts from SQLite, and DB_CONNECTION is postgres.',
    ])
  })
})

describe('the storefront pages read a WAL-mode database', () => {
  it('lists the cart when no -shm file exists yet', async () => {
    // The framework's query builder puts the database in WAL mode. A
    // read-only connection to one with no -shm file beside it failed with
    // "unable to open database file", which rendered an empty cart. This
    // closes the WAL database with its -wal and -shm files gone, the state a
    // page meets when nothing else has read it.
    const file = database('wal', 'pages')
    const writer = new Database(file)
    writer.run('PRAGMA journal_mode = WAL')
    writer.close()
    expect(existsSync(`${file}-shm`)).toBe(false)
    setEnv('DB_DATABASE_PATH', file)

    const { context, warnings } = await render('views/cart.stx', signed())
    expect(warnings).toEqual([])
    expect(context.items.map((item: { name: string }) => item.name)).toEqual(['Test Bowl'])
  })
})
