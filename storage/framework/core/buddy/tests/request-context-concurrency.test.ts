/**
 * Every visitor sees their own cart, however many requests are in flight.
 *
 * `requestContext` used to answer from process-wide globals: stx's
 * `__stxServeContext` mirror, and globals each server's `onRequest` set. A
 * global holds whichever request assigned it last, so a server script that
 * read it after an `await`, or from a layout, which stx renders after the
 * page, read the request that had most recently started rendering. The
 * storefront layout reads the cart cookie to badge the header. Before the
 * fix, this test's concurrent case found another visitor's cart count in the
 * badge on 349 and 350 of 400 responses from `buddy serve` over two runs, and
 * on 343 and 350 from `buddy dev`. The page's own lines were right on all of
 * them: it read the cookie before its first `await`, which is also why one
 * request at a time looked fine.
 *
 * This boots each view server from source, as `buddy serve` and `buddy dev`
 * start it, against a scratch SQLite database holding one cart per visitor,
 * and sends every visitor's cookie at once. The cart page and the header
 * badge must both be that visitor's.
 *
 * `STACKS_SERVE_ENTRY` swaps the `buddy serve` entry for another file, which
 * is how the same check runs against the bundle `config/cloud.ts` builds for a
 * deploy (`storage/framework/runtime/production/serve.js`).
 */
import type { Subprocess } from 'bun'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { cartCookie as signedCart } from '../../../defaults/app/Storefront/CartCookie'

const root = resolve(import.meta.dir, '../../../../..')

const CARTS = 40
const REQUESTS = 400
const IN_FLIGHT = 16

/** The servers' APP_KEY, which the storefront actions sign the cart cookie with. */
const APP_KEY = 'base64:cmVxdWVzdC1jb250ZXh0LWNvbmN1cnJlbmN5LXRlc3Q='

/** The cookie visitor `index` sends: signed, as the storefront actions write it. */
function cartCookie(index: number): string {
  const previous = process.env.APP_KEY
  process.env.APP_KEY = APP_KEY
  try {
    return `stacks_cart=${signedCart.sign(`cart-token-${index}`)}`
  }
  finally {
    if (previous === undefined)
      delete process.env.APP_KEY
    else
      process.env.APP_KEY = previous
  }
}

/**
 * One active cart per visitor, each with a line and a count no other has.
 *
 * Closed before the server starts. The servers put it in WAL mode as they
 * boot, so the pages read a WAL database with no other connection of this
 * test holding it open (app/Storefront/StorefrontDatabase.ts).
 */
function seed(file: string): void {
  // The columns these pages query, which no migration creates: see
  // tests/unit/storefront-cart-cookie.test.ts.
  const db = new Database(file, { create: true })
  db.exec(`
    CREATE TABLE carts (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT, total_items REAL, session_token TEXT);
    CREATE TABLE cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, cart_id INTEGER, quantity REAL, unit_price REAL, total_price REAL,
      product_name TEXT, product_sku TEXT, product_image TEXT
    );
    CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, weight_grams INTEGER);
  `)
  const cart = db.query('INSERT INTO carts (status, total_items, session_token) VALUES (\'active\', ?1, ?2) RETURNING id')
  const line = db.query('INSERT INTO cart_items (cart_id, quantity, unit_price, total_price, product_name, product_sku) VALUES (?1, ?2, 3, ?3, ?4, ?5)')
  for (let index = 0; index < CARTS; index++) {
    const { id } = cart.get(index + 1, `cart-token-${index}`) as { id: number }
    line.run(id, index + 1, 3 * (index + 1), `Bowl number ${index}`, `bowl-${index}`)
  }
  db.close()
}

/** A port nothing is listening on right now. */
function freePort(): number {
  const probe = Bun.serve({ port: 0, fetch: () => new Response() })
  const port = probe.port!
  probe.stop(true)
  return port
}

/** What a `/cart` response shows: the lines listed, and the header badge. */
function readCart(html: string): { lines: number[], badge: number | null } {
  const lines = [...new Set([...html.matchAll(/Bowl number (\d+)/g)].map(match => Number(match[1])))]
  const badge = /data-stx-cart-count[^>]*>\s*(\d+)\s*</.exec(html)
  return { lines, badge: badge ? Number(badge[1]) : null }
}

interface ServerUnderTest {
  name: string
  entry: string
  env: Record<string, string>
}

const servers: ServerUnderTest[] = [
  {
    name: 'buddy serve',
    entry: process.env.STACKS_SERVE_ENTRY || 'storage/framework/core/buddy/src/serve-entry.ts',
    env: { APP_ENV: 'production', NODE_ENV: 'production' },
  },
  {
    name: 'buddy dev',
    entry: 'storage/framework/core/actions/src/dev/views.ts',
    env: { APP_ENV: 'development', NODE_ENV: 'development' },
  },
]

for (const server of servers) {
  describe(`${server.name}: requestContext under concurrent requests`, () => {
    let dir: string
    let base: string
    let child: Subprocess | undefined
    let output = ''

    beforeAll(async () => {
      dir = mkdtempSync(join(tmpdir(), 'stacks-request-context-'))
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
          APP_URL: base,
          APP_KEY,
          APP_MAINTENANCE: 'false',
          APP_COMING_SOON: 'false',
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

      // Up once it renders the page. The first render compiles everything it
      // touches, which is most of the wait.
      const deadline = Date.now() + 170_000
      while (Date.now() < deadline) {
        if (child.exitCode !== null)
          throw new Error(`${server.name} exited with ${child.exitCode}:\n${output.slice(-4000)}`)
        try {
          const response = await fetch(`${base}/cart`)
          if (response.status === 200) {
            await response.text()
            return
          }
        }
        catch {}
        await Bun.sleep(250)
      }
      throw new Error(`${server.name} did not render /cart in time:\n${output.slice(-4000)}`)
    }, 180_000)

    afterAll(async () => {
      if (child) {
        child.kill()
        await child.exited
      }
      rmSync(dir, { recursive: true, force: true })
    })

    it('renders each visitor\'s own cart, one visitor at a time', async () => {
      // The baseline the concurrent run is measured against: without it, a
      // page that listed nothing for anyone would pass below.
      for (const index of [0, 7, CARTS - 1]) {
        const html = await (await fetch(`${base}/cart`, { headers: { cookie: cartCookie(index) } })).text()
        expect(readCart(html)).toEqual({ lines: [index], badge: index + 1 })
      }

      // No cookie, the bare token a lookup would match, and a forged
      // signature: none of them is anyone's cart.
      for (const cookie of ['', 'stacks_cart=cart-token-7', `stacks_cart=cart-token-7.${'A'.repeat(22)}`]) {
        const html = await (await fetch(`${base}/cart`, { headers: { cookie } })).text()
        expect(readCart(html)).toEqual({ lines: [], badge: 0 })
      }
    })

    it('renders each visitor\'s own cart with many in flight', async () => {
      const wrong: string[] = []
      let next = 0

      await Promise.all(Array.from({ length: IN_FLIGHT }, async () => {
        while (next < REQUESTS) {
          const index = next++ % CARTS
          const html = await (await fetch(`${base}/cart`, { headers: { cookie: cartCookie(index) } })).text()
          const seen = readCart(html)
          if (seen.lines.length !== 1 || seen.lines[0] !== index || seen.badge !== index + 1)
            wrong.push(`visitor ${index} saw lines ${JSON.stringify(seen.lines)} and badge ${seen.badge}`)
        }
      }))

      expect(wrong).toEqual([])
    }, 120_000)
  })
}
