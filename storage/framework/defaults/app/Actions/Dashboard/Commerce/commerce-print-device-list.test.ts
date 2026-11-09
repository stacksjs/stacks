import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import { readPrintDevices } from './commerce-print-device-list'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The print devices against each dialect's real engine
 * (stacksjs/stacks#3218), over 520 of them: the page used to read the newest
 * 500.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const ROWS = 520
const STATUSES = ['online', 'offline', 'warning'] as const

/** 40 locations, the oldest device's among them only once. */
const DEVICES = Array.from({ length: ROWS }, (_, index) => {
  const id = index + 1
  return {
    id,
    name: `Printer ${id}`,
    mac: `00:1B:44:11:${String(Math.floor(id / 256)).padStart(2, '0')}:${(id % 256).toString(16).padStart(2, '0')}`,
    location: id === 1 ? 'Basement' : `Floor ${id % 39}`,
    terminal: `T${id % 7}`,
    status: STATUSES[id % 3]!,
    prints: id * 3,
  }
})

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  const columns = 9
  await run(`CREATE TABLE print_devices (id ${pk}, name ${text}, mac_address ${text}, location ${text}, terminal ${text}, status ${text}, last_ping ${time}, print_count INTEGER, created_at ${time})`)
  await run(
    `INSERT INTO print_devices (id, name, mac_address, location, terminal, status, last_ping, print_count, created_at) VALUES ${DEVICES.map((_, i) => `(${Array.from({ length: columns }, (_, c) => p(i * columns + c + 1)).join(', ')})`).join(', ')}`,
    DEVICES.flatMap(device => [
      device.id, device.name, device.mac, device.location, device.terminal, device.status,
      '2026-11-08 10:00:00', device.prints, '2026-11-01 09:00:00',
    ]),
  )
}

async function exercise(runner: CommerceSqlRunner) {
  const { records, summary } = await readPrintDevices(runner)

  // Every device, newest first, the oldest included.
  expect(records.map(record => record.id)).toEqual(DEVICES.map(device => String(device.id)).reverse())
  expect(records.at(-1)).toMatchObject({ id: '1', name: 'Printer 1', location: 'Basement', terminal: 'T1', status: 'offline', printCount: 3 })

  expect(summary).toEqual({
    total: ROWS,
    online: DEVICES.filter(device => device.status === 'online').length,
    offline: DEVICES.filter(device => device.status === 'offline').length,
    warning: DEVICES.filter(device => device.status === 'warning').length,
    locations: 40,
    totalPrints: DEVICES.reduce((sum, device) => sum + device.prints, 0),
  })
}

describe('readPrintDevices on SQLite', () => {
  test('every print device, newest first, with the summary of all of them', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) })
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readPrintDevices on ${dialect}: every print device, newest first, with the summary of all of them`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Print device list tests require a local disposable database server')

    const name = `stacks_print_devices_${crypto.randomUUID().replaceAll('-', '')}`
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    const admin = new SQL({ url: url.href, database: decodeURIComponent(url.pathname.slice(1)) || undefined })
    await admin.unsafe(`CREATE DATABASE ${quoted}`)
    const scoped = new URL(url.href)
    scoped.pathname = `/${name}`
    // Explicit database wins over inherited PGDATABASE / MYSQL_DATABASE in CI.
    const database = new SQL({ url: scoped.href, database: name })

    try {
      await setUp(async (sql, values = []) => await database.unsafe(sql, values), dialect)
      await exercise({ unsafe: (sql, values = []) => ({ execute: async () => await database.unsafe(sql, values) }) })
    }
    finally {
      await database.close()
      try { await admin.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`) }
      finally { await admin.close() }
    }
  }, 60_000)
}
