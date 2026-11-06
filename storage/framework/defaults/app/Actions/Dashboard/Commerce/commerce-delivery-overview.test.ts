import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import { formatDeliveryDuration } from './commerce-delivery'
import { readDeliveryOverview } from './commerce-delivery-overview'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The delivery overview against each dialect's real engine
 * (stacksjs/stacks#3218), over 520 couriers, routes and zones: the overview
 * used to read the first 500 of each by id.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const NOW = new Date('2026-11-06T12:00:00.000Z')
const HOUR = 3_600_000
const ROWS = 520
const COURIER_STATUSES = ['active', 'on_delivery', 'on_break'] as const
const ZONE_STATUSES = ['active', 'inactive', 'draft'] as const

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')

/** Routes active in the last day, past the 500th and in every stored format; the rest are old. */
const RECENT: Record<number, { lastActive: string, hoursAgo: number, courierId: number | null }> = {
  2: { lastActive: String(NOW.getTime() - 2 * HOUR), hoursAgo: 2, courierId: 1 },
  503: { lastActive: String(Math.floor((NOW.getTime() - 3 * HOUR) / 1000)), hoursAgo: 3, courierId: null },
  505: { lastActive: String(NOW.getTime() - 1 * HOUR), hoursAgo: 1, courierId: 515 },
  507: { lastActive: iso(NOW.getTime() - 5 * HOUR), hoursAgo: 5, courierId: null },
  510: { lastActive: String(NOW.getTime() - 4 * HOUR), hoursAgo: 4, courierId: 516 },
  515: { lastActive: String(NOW.getTime() - 6 * HOUR), hoursAgo: 6, courierId: null },
}
/** Kept out: 30 hours ago as ISO text (inside the superset, outside the day), and one in the future. */
const STALE: Record<number, string> = {
  512: iso(NOW.getTime() - 30 * HOUR),
  513: String(NOW.getTime() + HOUR),
}

const METHODS = [
  { id: 1, name: 'Zoom Freight', status: 'active' },
  { id: 2, name: 'economy', status: 'draft' },
  { id: 3, name: 'Air', status: 'active' },
  { id: 4, name: 'Bike', status: 'inactive' },
  { id: 5, name: 'courier Plus', status: 'active' },
  { id: 6, name: 'Drone', status: 'draft' },
  { id: 7, name: 'Barge', status: 'inactive' },
]

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  const rows = (count: number, columns: number) => Array.from({ length: count }, (_, i) => `(${Array.from({ length: columns }, (_, c) => p(i * columns + c + 1)).join(', ')})`).join(', ')
  let courierStatus = text
  let zoneStatus = text
  if (dialect === 'postgres') {
    await run(`CREATE TYPE courier_status AS ENUM ('active', 'on_delivery', 'on_break', 'offline')`)
    await run(`CREATE TYPE zone_status AS ENUM ('active', 'inactive', 'draft')`)
    courierStatus = 'courier_status'
    zoneStatus = 'zone_status'
  }
  if (dialect === 'mysql') {
    courierStatus = `ENUM('active', 'on_delivery', 'on_break', 'offline')`
    zoneStatus = `ENUM('active', 'inactive', 'draft')`
  }
  await run(`CREATE TABLE couriers (id ${pk}, name ${text}, vehicle_number ${text}, status ${courierStatus})`)
  await run(`CREATE TABLE delivery_routes (id ${pk}, courier_id INTEGER NULL, courier ${text}, vehicle ${text}, stops INTEGER, delivery_time INTEGER, total_distance INTEGER, last_active ${text})`)
  await run(`CREATE TABLE shipping_methods (id ${pk}, name ${text}, status ${zoneStatus}, base_rate INTEGER, free_shipping INTEGER NULL)`)
  await run(`CREATE TABLE shipping_zones (id ${pk}, name ${text}, status ${zoneStatus}, countries ${text}, regions ${text})`)

  const ids = Array.from({ length: ROWS }, (_, i) => i + 1)
  await run(`INSERT INTO couriers (id, name, vehicle_number, status) VALUES ${rows(ROWS, 4)}`, ids.flatMap(id => [id, `Courier ${id}`, `VAN-${id}`, COURIER_STATUSES[id % 3]!]))
  const old = String(NOW.getTime() - 40 * 24 * HOUR)
  await run(
    `INSERT INTO delivery_routes (id, courier_id, courier, vehicle, stops, delivery_time, total_distance, last_active) VALUES ${rows(ROWS, 8)}`,
    ids.flatMap(id => [id, RECENT[id]?.courierId ?? null, `Recorded ${id}`, `Truck ${id}`, id % 9, 30 + id % 120, id % 50, RECENT[id]?.lastActive ?? STALE[id] ?? old]),
  )
  await run(`INSERT INTO shipping_methods (id, name, status, base_rate, free_shipping) VALUES ${rows(METHODS.length, 5)}`, METHODS.flatMap(method => [method.id, method.name, method.status, 1000 + method.id, null]))
  await run(`INSERT INTO shipping_zones (id, name, status, countries, regions) VALUES ${rows(ROWS, 5)}`, ids.flatMap(id => [id, `Zone ${String(id).padStart(3, '0')}`, ZONE_STATUSES[id % 3]!, id % 2 === 0 ? 'US, CA' : '["GB"]', 'North']))
}

async function exercise(runner: CommerceSqlRunner, dialect: Dialect) {
  const overview = await readDeliveryOverview('USD', runner, dialect, NOW)
  const active = Object.entries(RECENT).map(([id, route]) => ({ id: Number(id), ...route }))
  const ids = Array.from({ length: ROWS }, (_, i) => i + 1)
  const activeZones = ids.filter(id => ZONE_STATUSES[id % 3] === 'active')
  const couriersIn = (status: string) => ids.filter(id => COURIER_STATUSES[id % 3] === status).length
  const minutes = active.map(route => 30 + route.id % 120)
  const average = Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length)

  expect(overview.stats.map(stat => stat.value)).toEqual([
    String(active.length),
    String(couriersIn('on_delivery')),
    formatDeliveryDuration(average),
    String(activeZones.length),
  ])
  expect(overview.stats[0]!.detail).toBe(`${active.reduce((sum, route) => sum + route.id % 9, 0)} stops active in 24h`)
  expect(overview.stats[1]!.detail).toBe(`${ROWS} couriers total`)
  expect(overview.stats[3]!.detail).toBe(`${activeZones.reduce((sum, id) => sum + (id % 2 === 0 ? 2 : 1), 0)} country assignments`)

  // The five most recently active routes, past the 500th, with their couriers.
  expect(overview.routes.map(route => route.id)).toEqual([...active].sort((a, b) => a.hoursAgo - b.hoursAgo).slice(0, 5).map(route => route.id))
  expect(overview.routes[0]).toMatchObject({ id: 505, courier: 'Courier 515', vehicle: 'VAN-515' })

  expect(overview.couriers).toEqual({
    total: ROWS,
    active: couriersIn('active'),
    onDelivery: couriersIn('on_delivery'),
    onBreak: couriersIn('on_break'),
  })

  // Active first, then by name ignoring case.
  expect(overview.methods.map(method => method.name)).toEqual(['Air', 'courier Plus', 'Zoom Freight', 'Barge', 'Bike'])
  expect(overview.zones.map(zone => zone.name)).toEqual(['Zone 003', 'Zone 006', 'Zone 009', 'Zone 012', 'Zone 015'])
}

describe('readDeliveryOverview on SQLite', () => {
  test('counts every courier, route and zone', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readDeliveryOverview on ${dialect}: counts every courier, route and zone`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Delivery overview tests require a local disposable database server')

    const name = `stacks_delivery_overview_${crypto.randomUUID().replaceAll('-', '')}`
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    const admin = new SQL({ url: url.href, database: decodeURIComponent(url.pathname.slice(1)) || undefined })
    await admin.unsafe(`CREATE DATABASE ${quoted}`)
    const scoped = new URL(url.href)
    scoped.pathname = `/${name}`
    // Explicit database wins over inherited PGDATABASE / MYSQL_DATABASE in CI.
    const database = new SQL({ url: scoped.href, database: name })

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
