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

const actions = '../../storage/framework/defaults/app/Actions/Commerce'
const { default: CustomerStoreAction } = await import(`${actions}/CustomerStoreAction`)
const { default: CustomerUpdateAction } = await import(`${actions}/CustomerUpdateAction`)
const { default: PaymentUpdateAction } = await import(`${actions}/PaymentUpdateAction`)

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
})
