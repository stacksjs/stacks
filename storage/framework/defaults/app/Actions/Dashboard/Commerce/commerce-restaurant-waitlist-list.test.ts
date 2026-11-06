import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { RestaurantWaitlistListQuery } from './commerce-restaurant-waitlist-list'
import { parseRestaurantWaitlistListQuery, readRestaurantWaitlistPage } from './commerce-restaurant-waitlist-list'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The restaurant waitlist against each dialect's real engine
 * (stacksjs/stacks#3218), with status and table preference as real enums, and
 * customers past the 500 the page used to read.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const NOW = new Date('2026-11-06T12:00:00.000Z')
const CUSTOMERS = 600
const STATUSES = ['waiting', 'seated', 'cancelled', 'no_show'] as const
const PREFERENCES = ['indoor', 'bar', 'booth', 'no_preference'] as const
const NAMES = ['ann', 'Ben', 'cat', 'Dan', 'eve']

/** 26 parties, one an hour back from NOW; 14 and 15 share a creation time. */
const PARTIES = Array.from({ length: 26 }, (_, index) => {
  const id = index + 1
  return {
    id,
    name: id === 9 ? 'Table_100% Crew' : id === 10 ? 'Table 1000 Crew' : NAMES[id % NAMES.length]!,
    email: `guest${id}@diner.test`,
    phone: id === 21 ? '+1 555 0121' : null,
    party_size: (id * 3) % 7 + 1,
    table_preference: PREFERENCES[id % PREFERENCES.length]!,
    status: STATUSES[id % STATUSES.length]!,
    quoted_wait_time: (id * 5) % 45,
    check_in_minutes: (id * 11) % 90,
    customer_id: id % 5 === 0 ? 599 : null,
    hoursAgo: id === 15 ? 14 : id,
  }
})
type Party = typeof PARTIES[number]

const ids = (parties: Party[]) => parties.map(party => String(party.id))
const newestFirst = (a: Party, b: Party) => a.hoursAgo - b.hoursAgo || b.id - a.id

function query(overrides: Partial<RestaurantWaitlistListQuery> = {}): RestaurantWaitlistListQuery {
  return { search: '', status: '', preference: '', sort: 'created', direction: 'desc', page: 1, perPage: 10, ...overrides }
}

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  const enumOf = (values: readonly string[]) => values.map(value => `'${value}'`).join(', ')
  let statusType = text
  let preferenceType = text
  if (dialect === 'postgres') {
    // Declared out of alphabetical order, so a sort that forgets the text cast shows.
    await run(`CREATE TYPE party_status AS ENUM (${enumOf(STATUSES)})`)
    await run(`CREATE TYPE party_preference AS ENUM (${enumOf(PREFERENCES)})`)
    statusType = 'party_status'
    preferenceType = 'party_preference'
  }
  if (dialect === 'mysql') {
    statusType = `ENUM(${enumOf(STATUSES)})`
    preferenceType = `ENUM(${enumOf(PREFERENCES)})`
  }
  await run(`CREATE TABLE customers (id ${pk})`)
  await run(`CREATE TABLE waitlist_restaurants (id ${pk}, name ${text}, email ${text}, phone ${text} NULL, party_size INTEGER, check_in_time ${time}, table_preference ${preferenceType}, status ${statusType}, quoted_wait_time INTEGER, actual_wait_time INTEGER NULL, queue_position INTEGER NULL, customer_id INTEGER NULL, created_at ${time})`)
  const all = Array.from({ length: CUSTOMERS }, (_, i) => i + 1)
  await run(`INSERT INTO customers (id) VALUES ${all.map((_, i) => `(${p(i + 1)})`).join(', ')}`, all)
  const stamp = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ')
  for (const party of PARTIES) {
    await run(
      `INSERT INTO waitlist_restaurants (id, name, email, phone, party_size, check_in_time, table_preference, status, quoted_wait_time, customer_id, created_at) VALUES (${Array.from({ length: 11 }, (_, i) => p(i + 1)).join(', ')})`,
      [
        party.id, party.name, party.email, party.phone, party.party_size,
        stamp(new Date(NOW.getTime() - party.check_in_minutes * 60_000)), party.table_preference, party.status,
        party.quoted_wait_time, party.customer_id, stamp(new Date(NOW.getTime() - party.hoursAgo * 3_600_000)),
      ],
    )
  }
}

async function exercise(runner: CommerceSqlRunner, dialect: Dialect) {
  const read = (overrides: Partial<RestaurantWaitlistListQuery> = {}) => readRestaurantWaitlistPage(query(overrides), runner, dialect)
  const all = async (overrides: Partial<RestaurantWaitlistListQuery> = {}) => (await read({ perPage: 100, ...overrides })).records.map(record => record.id)
  const matching = (keep: (party: Party) => boolean) => ids(PARTIES.filter(keep).sort(newestFirst))

  // The summary counts every party, whatever the page is filtered to.
  const filtered = await read({ status: 'cancelled' })
  const waiting = PARTIES.filter(party => party.status === 'waiting')
  const seated = PARTIES.filter(party => party.status === 'seated').length
  expect(filtered.summary).toEqual({
    total: PARTIES.length,
    waiting: waiting.length,
    seated,
    cancelled: PARTIES.filter(party => party.status === 'cancelled').length,
    noShow: PARTIES.filter(party => party.status === 'no_show').length,
    averageQuotedWait: Math.round(waiting.reduce((sum, party) => sum + party.quoted_wait_time, 0) / waiting.length),
    seatingRate: Math.round((seated / PARTIES.length) * 1000) / 10,
  })
  expect(filtered.total).toBe(PARTIES.filter(party => party.status === 'cancelled').length)

  // Filters, alone and together.
  expect(await all({ preference: 'booth' })).toEqual(matching(party => party.table_preference === 'booth'))
  expect(await all({ status: 'waiting', preference: 'no_preference' })).toEqual(matching(party => party.status === 'waiting' && party.table_preference === 'no_preference'))

  // Search: name with a literal %, email, phone, and the enum text, ignoring case.
  expect(await all({ search: '100%' })).toEqual(['9'])
  expect(await all({ search: 'GUEST21@' })).toEqual(['21'])
  expect(await all({ search: '0121' })).toEqual(['21'])
  expect(await all({ search: 'NO_SHOW' })).toEqual(matching(party => party.status === 'no_show'))

  // Newest first, the id breaking the tie between 14 and 15, stable across pages.
  const newest = [...PARTIES].sort(newestFirst)
  const pages = [await read({ page: 1 }), await read({ page: 2 }), await read({ page: 3 })]
  expect(pages.flatMap(result => result.records.map(record => record.id))).toEqual(ids(newest))
  expect((await read({ page: 9 })).page).toBe(3)

  // Sorts, ties newest first. Status and preference sort by name, not enum order.
  const by = (key: (party: Party) => string | number, direction: 1 | -1 = 1) => (a: Party, b: Party) => {
    const left = key(a)
    const right = key(b)
    const order = typeof left === 'number' ? (left - (right as number)) : left.localeCompare(right as string)
    return order * direction || newestFirst(a, b)
  }
  expect(await all({ sort: 'name', direction: 'asc' })).toEqual(ids([...PARTIES].sort(by(party => party.name.toLowerCase()))))
  expect(await all({ sort: 'party', direction: 'desc' })).toEqual(ids([...PARTIES].sort(by(party => party.party_size, -1))))
  expect(await all({ sort: 'quoted', direction: 'asc' })).toEqual(ids([...PARTIES].sort(by(party => party.quoted_wait_time))))
  expect(await all({ sort: 'status', direction: 'asc' })).toEqual(ids([...PARTIES].sort(by(party => party.status))))
  expect(await all({ sort: 'preference', direction: 'asc' })).toEqual(ids([...PARTIES].sort(by(party => party.table_preference))))
  // Latest check-in first: the fewest minutes ago.
  expect(await all({ sort: 'checkin', direction: 'desc' })).toEqual(ids([...PARTIES].sort(by(party => party.check_in_minutes))))

  // A customer past the 500th, read by the ids the page references.
  expect((await read({ perPage: 100 })).records.filter(record => record.customerId === '599').length).toBe(PARTIES.filter(party => party.customer_id === 599).length)
}

describe('readRestaurantWaitlistPage on SQLite', () => {
  test('summary, filters, search, sorts, pages and references', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readRestaurantWaitlistPage on ${dialect}: summary, filters, search, sorts, pages and references`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Restaurant waitlist list tests require a local disposable database server')

    const name = `stacks_restaurant_waitlist_${crypto.randomUUID().replaceAll('-', '')}`
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

describe('parseRestaurantWaitlistListQuery', () => {
  const reader = (values: Record<string, unknown>) => (key: string) => values[key] ?? ''

  test('defaults to every party, newest first, 25 a page', () => {
    expect(parseRestaurantWaitlistListQuery(reader({}))).toEqual({ search: '', status: '', preference: '', sort: 'created', direction: 'desc', page: 1, perPage: 25 })
    expect(parseRestaurantWaitlistListQuery(reader({ sort: 'checkin' }))).toHaveProperty('direction', 'desc')
    expect(parseRestaurantWaitlistListQuery(reader({ sort: 'party' }))).toHaveProperty('direction', 'asc')
  })

  test('refuses values the page does not offer', () => {
    expect(parseRestaurantWaitlistListQuery(reader({ status: 'purchased' }))).toHaveProperty('error')
    expect(parseRestaurantWaitlistListQuery(reader({ preference: 'patio' }))).toHaveProperty('error')
    expect(parseRestaurantWaitlistListQuery(reader({ sort: 'actual_wait_time' }))).toHaveProperty('error')
  })
})
