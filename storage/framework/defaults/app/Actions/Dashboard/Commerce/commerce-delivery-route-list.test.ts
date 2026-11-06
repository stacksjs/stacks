import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { DeliveryRouteListQuery } from './commerce-delivery-route-list'
import { parseDeliveryRouteListQuery, readDeliveryRoutePage } from './commerce-delivery-route-list'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The Delivery Routes list against each dialect's real engine
 * (stacksjs/stacks#3218), over 520 routes and couriers: the page used to read
 * the 500 most recently active routes.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const NOW = new Date('2026-11-06T12:00:00.000Z')
const MINUTE = 60_000
const ROWS = 520

/** Route n was last active 7n minutes ago; every 50th is stored as Unix seconds. */
const ROUTES = Array.from({ length: ROWS }, (_, index) => {
  const id = index + 1
  const at = NOW.getTime() - id * 7 * MINUTE
  return {
    id,
    at,
    lastActive: id % 50 === 0 ? String(Math.floor(at / 1000)) : String(at),
    courierId: id % 4 === 0 ? 500 + (id % 20) + 1 : null,
    courier: `Recorded ${id}`,
    vehicle: id === 9 ? 'Van_100%' : id === 10 ? 'Van 1000' : `Truck ${String(id).padStart(3, '0')}`,
    stops: id % 6,
    time: 20 + id % 40,
    distance: id % 30,
  }
})
type Route = typeof ROUTES[number]

const ids = (routes: Route[]) => routes.map(route => String(route.id))
const recentFirst = (a: Route, b: Route) => b.at - a.at || b.id - a.id
const courierName = (route: Route) => (route.courierId ? `Courier ${route.courierId}` : route.courier).toLowerCase()

function query(overrides: Partial<DeliveryRouteListQuery> = {}): DeliveryRouteListQuery {
  return { search: '', sort: 'active', direction: 'desc', page: 1, perPage: 10, ...overrides }
}

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  const rows = (count: number, columns: number) => Array.from({ length: count }, (_, i) => `(${Array.from({ length: columns }, (_, c) => p(i * columns + c + 1)).join(', ')})`).join(', ')
  let status = text
  if (dialect === 'postgres') {
    await run(`CREATE TYPE courier_status AS ENUM ('active', 'on_delivery', 'on_break', 'offline')`)
    status = 'courier_status'
  }
  if (dialect === 'mysql')
    status = `ENUM('active', 'on_delivery', 'on_break', 'offline')`
  await run(`CREATE TABLE couriers (id ${pk}, name ${text}, vehicle_number ${text}, status ${status})`)
  await run(`CREATE TABLE delivery_routes (id ${pk}, courier_id INTEGER NULL, courier ${text}, vehicle ${text}, stops INTEGER, delivery_time INTEGER, total_distance INTEGER, last_active ${text}, created_at ${text}, updated_at ${text} NULL, uuid ${text} NULL)`)
  const all = Array.from({ length: ROWS }, (_, i) => i + 1)
  await run(`INSERT INTO couriers (id, name, vehicle_number, status) VALUES ${rows(ROWS, 4)}`, all.flatMap(id => [id, `Courier ${id}`, `VAN-${id}`, 'active']))
  await run(
    `INSERT INTO delivery_routes (id, courier_id, courier, vehicle, stops, delivery_time, total_distance, last_active, created_at) VALUES ${rows(ROWS, 9)}`,
    ROUTES.flatMap(route => [route.id, route.courierId, route.courier, route.vehicle, route.stops, route.time, route.distance, route.lastActive, '2026-11-01T00:00:00.000Z']),
  )
}

async function exercise(runner: CommerceSqlRunner, dialect: Dialect) {
  const read = (overrides: Partial<DeliveryRouteListQuery> = {}) => readDeliveryRoutePage(query(overrides), runner, dialect, NOW)
  const all = async (overrides: Partial<DeliveryRouteListQuery> = {}) => (await read({ perPage: 100, ...overrides })).records.map(record => String(record.id))

  // The summary counts every route.
  const first = await read({ search: 'van' })
  expect(first.summary).toEqual({
    total: ROWS,
    linked: ROUTES.filter(route => route.courierId).length,
    stops: ROUTES.reduce((sum, route) => sum + route.stops, 0),
    distance: ROUTES.reduce((sum, route) => sum + route.distance, 0),
    active: ROUTES.filter(route => NOW.getTime() - route.at <= 24 * 60 * MINUTE).length,
  })
  expect(first.total).toBe(2)

  // Most recently active first, seconds and milliseconds in one order, stable across pages.
  const recent = [...ROUTES].sort(recentFirst)
  const pages = [await read({ page: 1 }), await read({ page: 2 }), await read({ page: 3 })]
  expect(pages.flatMap(result => result.records.map(record => String(record.id)))).toEqual(ids(recent).slice(0, 30))
  expect((await read({ page: 99, perPage: 100 })).page).toBe(6)
  expect(await all({ direction: 'asc', page: 6 })).toEqual(ids([...ROUTES].sort((a, b) => a.at - b.at || a.id - b.id)).slice(500))

  // Search: a literal %, the linked courier's name, and numbers as text.
  expect(await all({ search: '100%' })).toEqual(['9'])
  const linkedTo505 = ROUTES.filter(route => route.courierId === 505)
  expect(linkedTo505.length).toBeGreaterThan(5)
  expect(await all({ search: 'COURIER 505' })).toEqual(ids(linkedTo505.sort(recentFirst)))

  // Sorts, ties most recently active first.
  expect(await all({ sort: 'stops', direction: 'asc' })).toEqual(ids([...ROUTES].sort((a, b) => a.stops - b.stops || recentFirst(a, b))).slice(0, 100))
  expect(await all({ sort: 'courier', direction: 'asc' })).toEqual(ids([...ROUTES].sort((a, b) => courierName(a).localeCompare(courierName(b)) || recentFirst(a, b))).slice(0, 100))

  // Couriers past the 500th, read by the ids the page references.
  const linked = (await read({ search: 'COURIER 505' })).records[0]!
  expect(linked.courier_record).toMatchObject({ id: 505, name: 'Courier 505', vehicle_number: 'VAN-505' })
}

describe('readDeliveryRoutePage on SQLite', () => {
  test('summary, order, search, sorts, pages and couriers', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readDeliveryRoutePage on ${dialect}: summary, order, search, sorts, pages and couriers`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Delivery route list tests require a local disposable database server')

    const name = `stacks_delivery_routes_${crypto.randomUUID().replaceAll('-', '')}`
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    const admin = new SQL(url.href)
    await admin.unsafe(`CREATE DATABASE ${quoted}`)
    const scoped = new URL(url.href)
    scoped.pathname = `/${name}`
    const database = new SQL(scoped.href)

    try {
      await setUp(async (sql, values = []) => await database.unsafe(sql, values), dialect)
      await exercise({ unsafe: (sql, values = []) => ({ execute: async () => await database.unsafe(sql, values) }) }, dialect)
    }
    finally {
      await database.close()
      try { await admin.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`) }
      finally { await admin.close() }
    }
  }, 60_000)
}

describe('parseDeliveryRouteListQuery', () => {
  const reader = (values: Record<string, unknown>) => (key: string) => values[key] ?? ''

  test('defaults to every route, most recently active first, 25 a page', () => {
    expect(parseDeliveryRouteListQuery(reader({}))).toEqual({ search: '', sort: 'active', direction: 'desc', page: 1, perPage: 25 })
    expect(parseDeliveryRouteListQuery(reader({ sort: 'stops' }))).toHaveProperty('direction', 'asc')
  })

  test('refuses values the page does not offer', () => {
    expect(parseDeliveryRouteListQuery(reader({ sort: 'uuid' }))).toHaveProperty('error')
    expect(parseDeliveryRouteListQuery(reader({ per_page: '500' }))).toHaveProperty('error')
  })
})
