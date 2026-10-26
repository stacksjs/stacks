import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

/**
 * A write carries only the fields the request sent (stacksjs/stacks#3010).
 *
 * bun-query-builder binds an explicit `undefined` as NULL and leaves an absent
 * key to the column default, as its docs say. These actions used to copy every
 * field with `request.get()`, so a field the caller never mentioned reached the
 * query as `undefined`: an edit erased the stored value and a create lost the
 * default. On PostgreSQL that erased a customer's phone and total spent, and
 * the NULL total then failed the whole customer list.
 *
 * Env is pinned before any import: the first config load anywhere in the
 * process decides which database file every later query uses.
 */
const dir = mkdtempSync(join(tmpdir(), 'stacks-partial-writes-'))
const dbFile = join(dir, 'partial-writes.sqlite')
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = dbFile

const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')

// The actions name their model as a server global, which only a booted app defines.
;(globalThis as any).Customer ??= {}

const { configureOrm } = await import('bun-query-builder')

const actions = '../../storage/framework/defaults/app/Actions/Commerce'
const { default: CustomerStoreAction } = await import(`${actions}/CustomerStoreAction`)
const { default: CustomerUpdateAction } = await import(`${actions}/CustomerUpdateAction`)
const { default: PaymentUpdateAction } = await import(`${actions}/PaymentUpdateAction`)

const cms = '../../storage/framework/defaults/app/Actions/Cms'
const { default: AuthorUpdateAction } = await import(`${cms}/AuthorUpdateAction`)
const { default: CategorizableUpdateAction } = await import(`${cms}/CategorizableUpdateAction`)
const { default: PostUpdateAction } = await import(`${cms}/PostUpdateAction`)
const { default: TaggableUpdateAction } = await import(`${cms}/TaggableUpdateAction`)

/** The slice of a request these actions read, with the router's semantics. */
function request(params: Record<string, unknown>, input: Record<string, unknown>): any {
  return {
    getParam: (key: string) => params[key],
    get: (key: string, fallback?: unknown) => input[key] !== undefined ? input[key] : fallback,
    only: (keys: string[]) => Object.fromEntries(keys.filter(key => key in input).map(key => [key, input[key]])),
    validate: async () => {},
  }
}

async function json(result: unknown): Promise<any> {
  return result instanceof Response ? await result.json() : result
}

const run = (sql: string, ...params: unknown[]) => (db as any).unsafe(sql, params).execute()
const one = async (sql: string, ...params: unknown[]) => ((await (db as any).unsafe(sql, params).execute()) as any[])[0]

describe('actions write only the fields the request sent', () => {
  let release: () => void

  beforeAll(async () => {
    release = await acquireDbConfigLock()
    await ensureDatabaseConfigLoaded()
    initializeDbConfig({
      app: { env: 'testing' },
      database: {
        default: 'sqlite',
        connections: { sqlite: { database: dbFile, prefix: '' }, mysql: {}, postgres: {} },
      },
    })
    // `Author.find()` goes through the ORM, which keeps its own connection
    // and loads its models after boot.
    configureOrm({ database: dbFile })
    await (await import('@stacksjs/orm')).ormReady

    await run(`CREATE TABLE customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, name TEXT NOT NULL, email TEXT NOT NULL,
      phone TEXT, total_spent INTEGER DEFAULT 0, last_order TEXT, status TEXT NOT NULL,
      avatar TEXT NOT NULL, user_id INTEGER, created_at TEXT, updated_at TEXT
    )`)
    await run(`CREATE TABLE payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, customer_id INTEGER, amount INTEGER,
      method TEXT, status TEXT, currency TEXT DEFAULT 'USD', reference_number TEXT, card_last_four TEXT,
      card_brand TEXT, billing_email TEXT, transaction_id TEXT, payment_provider TEXT,
      refund_amount INTEGER, notes TEXT, uuid TEXT, created_at TEXT, updated_at TEXT
    )`)
    await run(`CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, author_id INTEGER, title TEXT NOT NULL, excerpt TEXT,
      content TEXT, status TEXT, poster TEXT, views INTEGER DEFAULT 0, published_at TEXT,
      created_at TEXT, updated_at TEXT
    )`)
    await run(`CREATE TABLE categorizables (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT, description TEXT,
      categorizable_type TEXT, is_active INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT
    )`)
    await run(`CREATE TABLE taggables (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT, description TEXT,
      is_active INTEGER DEFAULT 1, taggable_id INTEGER, taggable_type TEXT, created_at TEXT, updated_at TEXT
    )`)
    await run(`CREATE TABLE authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, name TEXT, email TEXT, user_id INTEGER,
      created_at TEXT, updated_at TEXT
    )`)
  })

  afterAll(() => {
    release?.()
    rmSync(dir, { recursive: true, force: true })
  })

  it('keeps the column default for a customer created without a total', async () => {
    const created = await json(await CustomerStoreAction.handle(request({}, {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      status: 'Active',
      avatar: 'https://example.com/ada.png',
    })))

    const row = await one(`SELECT total_spent, phone FROM customers WHERE id = ?`, created.id)
    // The raw value: Number(null) is 0, which is how this once passed while NULL was stored.
    expect(row.total_spent).toBe(0)
    expect(row.phone).toBeNull()
  })

  it('leaves a customer\'s phone and total alone when an edit does not send them', async () => {
    await run(`INSERT INTO customers (name, email, phone, total_spent, status, avatar)
      VALUES ('Jordan Rogers', 'jordan@example.com', '1-324-760-8881', 235837, 'Active', 'https://example.com/j.png')`)
    const { id } = await one(`SELECT id FROM customers WHERE email = 'jordan@example.com'`)

    const result = await CustomerUpdateAction.handle(request({ id: String(id) }, {
      name: 'Jordan R.',
      email: 'jordan@example.com',
      status: 'Active',
      avatar: 'https://example.com/j.png',
    }))
    expect(result instanceof Response ? result.status : 200).toBe(200)

    const row = await one(`SELECT name, phone, total_spent FROM customers WHERE id = ?`, id)
    expect(row).toMatchObject({ name: 'Jordan R.', phone: '1-324-760-8881' })
    expect(row.total_spent).toBe(235837)
  })

  it('still clears a customer\'s phone the request sets to null', async () => {
    const { id } = await one(`SELECT id FROM customers WHERE email = 'jordan@example.com'`)
    await CustomerUpdateAction.handle(request({ id: String(id) }, {
      name: 'Jordan R.',
      email: 'jordan@example.com',
      phone: null,
      status: 'Active',
      avatar: 'https://example.com/j.png',
    }))

    const row = await one(`SELECT phone, total_spent FROM customers WHERE id = ?`, id)
    expect(row.phone).toBeNull()
    expect(row.total_spent).toBe(235837)
  })

  it('changes only the payment fields an edit sends', async () => {
    await run(`INSERT INTO payments (order_id, customer_id, amount, method, status, currency, card_brand, notes)
      VALUES (7, 3, 4200, 'card', 'pending', 'EUR', 'visa', 'Paid at the counter')`)
    const { id } = await one(`SELECT id FROM payments WHERE order_id = 7`)

    const result = await PaymentUpdateAction.handle(request({ id: String(id) }, { status: 'completed' }))
    expect(result instanceof Response ? result.status : 200).toBe(200)

    const row = await one(`SELECT * FROM payments WHERE id = ?`, id)
    expect(row).toMatchObject({ status: 'completed', method: 'card', currency: 'EUR', card_brand: 'visa', notes: 'Paid at the counter' })
    expect(row.amount).toBe(4200)
    expect(row.order_id).toBe(7)
  })

  it('changes only the post fields an edit sends', async () => {
    await run(`INSERT INTO posts (title, excerpt, content, status, poster)
      VALUES ('Spring menu', 'What is new', 'The long version', 'draft', 'https://example.com/p.png')`)
    const { id } = await one(`SELECT id FROM posts WHERE title = 'Spring menu'`)

    await PostUpdateAction.handle(request({ id: String(id) }, { status: 'published' }))

    const row = await one(`SELECT * FROM posts WHERE id = ?`, id)
    expect(row).toMatchObject({
      title: 'Spring menu',
      excerpt: 'What is new',
      content: 'The long version',
      status: 'published',
      poster: 'https://example.com/p.png',
    })
  })

  it('changes only the category and tag fields an edit sends', async () => {
    await run(`INSERT INTO categorizables (name, slug, description, categorizable_type) VALUES ('Shoes', 'shoes', 'Footwear', 'products')`)
    await run(`INSERT INTO taggables (name, slug, description, taggable_type) VALUES ('Sale', 'sale', 'Marked down', 'products')`)
    const category = await one(`SELECT id FROM categorizables WHERE slug = 'shoes'`)
    const tag = await one(`SELECT id FROM taggables WHERE slug = 'sale'`)

    await CategorizableUpdateAction.handle(request({ id: String(category.id) }, { description: 'Boots and trainers' }))
    await TaggableUpdateAction.handle(request({ id: String(tag.id) }, { description: 'Cut prices' }))

    expect(await one(`SELECT name, slug, description FROM categorizables WHERE id = ?`, category.id))
      .toEqual({ name: 'Shoes', slug: 'shoes', description: 'Boots and trainers' })
    expect(await one(`SELECT name, slug, description FROM taggables WHERE id = ?`, tag.id))
      .toEqual({ name: 'Sale', slug: 'sale', description: 'Cut prices' })
  })

  it('changes only the author fields an edit sends', async () => {
    await run(`INSERT INTO authors (name, email) VALUES ('Grace Hopper', 'grace@example.com')`)
    const { id } = await one(`SELECT id FROM authors WHERE email = 'grace@example.com'`)

    await AuthorUpdateAction.handle(request({ id: String(id) }, { name: 'Rear Admiral Hopper' }))

    expect(await one(`SELECT name, email FROM authors WHERE id = ?`, id))
      .toEqual({ name: 'Rear Admiral Hopper', email: 'grace@example.com' })
  })
})
