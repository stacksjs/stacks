import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { GiftCardListQuery } from './commerce-gift-card-list'
import { giftCardsCsv, parseGiftCardListQuery, readGiftCardPage, readGiftCardsForExport } from './commerce-gift-card-list'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The Gift Cards list against each dialect's real engine (stacksjs/stacks#3218),
 * with status as a real enum and the flags as each dialect stores booleans.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const NOW = new Date('2026-11-06T12:00:00.000Z')
const STATUSES = ['ACTIVE', 'USED', 'EXPIRED', 'DEACTIVATED'] as const
const NAMES = ['alice', 'Bob', 'carol', 'Dave', 'erin', 'Frank', 'gina']
const CUSTOMERS = 600

/** 26 cards, one an hour back from NOW; 11 and 12 share a creation time. */
const CARDS = Array.from({ length: 26 }, (_, index) => {
  const id = index + 1
  const status = STATUSES[id % STATUSES.length]!
  const initial = 5000 + id * 100
  return {
    id,
    code: id === 9 ? 'SALE_100%' : id === 10 ? 'GC-1000' : `GC-${String(id).padStart(3, '0')}`,
    initial_balance: initial,
    current_balance: status === 'USED' || id === 4 ? 0 : initial - (id % 3) * 250,
    currency: id % 6 === 0 ? 'usd' : id % 2 === 0 ? 'USD' : 'EUR',
    status,
    purchaser_id: id === 21 ? 'PURCH-XYZ' : null,
    recipient_email: id === 13 ? null : `r${id}@example.com`,
    recipient_name: id === 13 ? null : NAMES[id % NAMES.length]!,
    is_digital: id % 2 === 0,
    is_reloadable: id % 5 === 0,
    is_active: id % 3 !== 0,
    expiry_days: id % 4 === 1 ? null : (id * 7) % 26,
    customer_id: id === 1 ? CUSTOMERS : id === 2 ? 3 : null,
    hoursAgo: id === 12 ? 11 : id,
  }
})
type Card = typeof CARDS[number]

const ids = (cards: Card[]) => cards.map(card => String(card.id))
const byCode = (a: Card, b: Card) => a.code.toLowerCase().localeCompare(b.code.toLowerCase())

function query(overrides: Partial<GiftCardListQuery> = {}): GiftCardListQuery {
  return { search: '', status: '', enabled: '', delivery: '', sort: 'created', direction: 'desc', page: 1, perPage: 10, ...overrides }
}

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const flag = dialect === 'postgres' ? 'BOOLEAN' : dialect === 'mysql' ? 'TINYINT(1)' : 'INTEGER'
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP'
  let statusType = text
  if (dialect === 'postgres') {
    await run(`CREATE TYPE gift_card_status AS ENUM (${STATUSES.map(s => `'${s}'`).join(', ')})`)
    statusType = 'gift_card_status'
  }
  if (dialect === 'mysql')
    statusType = `ENUM(${STATUSES.map(s => `'${s}'`).join(', ')})`
  await run(`CREATE TABLE customers (id ${pk})`)
  await run(`CREATE TABLE gift_cards (id ${pk}, code ${text}, initial_balance INTEGER, current_balance INTEGER, currency ${text}, status ${statusType}, purchaser_id ${text} NULL, recipient_email ${text} NULL, recipient_name ${text} NULL, personal_message ${text} NULL, is_digital ${flag}, is_reloadable ${flag}, is_active ${flag}, expiry_date ${time} NULL, last_used_date ${time} NULL, template_id ${text} NULL, customer_id INTEGER NULL, created_at ${time})`)
  const p = (count: number) => Array.from({ length: count }, (_, i) => dialect === 'postgres' ? `$${i + 1}` : '?').join(', ')
  // Past the 500 customers the page used to read for its record check.
  const customerIds = Array.from({ length: CUSTOMERS }, (_, i) => i + 1)
  await run(`INSERT INTO customers (id) VALUES ${customerIds.map((_, i) => `(${dialect === 'postgres' ? `$${i + 1}` : '?'})`).join(', ')}`, customerIds)
  const stamp = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ')
  const bool = (value: boolean) => dialect === 'postgres' ? value : (value ? 1 : 0)
  for (const card of CARDS) {
    await run(
      `INSERT INTO gift_cards (id, code, initial_balance, current_balance, currency, status, purchaser_id, recipient_email, recipient_name, is_digital, is_reloadable, is_active, expiry_date, customer_id, created_at) VALUES (${p(15)})`,
      [
        card.id, card.code, card.initial_balance, card.current_balance, card.currency, card.status, card.purchaser_id,
        card.recipient_email, card.recipient_name, bool(card.is_digital), bool(card.is_reloadable), bool(card.is_active),
        card.expiry_days === null ? null : stamp(new Date(NOW.getTime() + card.expiry_days * 86_400_000)),
        card.customer_id, stamp(new Date(NOW.getTime() - card.hoursAgo * 3_600_000)),
      ],
    )
  }
}

async function exercise(runner: CommerceSqlRunner, dialect: Dialect) {
  const read = (overrides: Partial<GiftCardListQuery> = {}) => readGiftCardPage(query(overrides), runner, dialect)
  const all = (overrides: Partial<GiftCardListQuery> = {}) => read({ perPage: 100, ...overrides })

  // The summary counts every card, whatever the page is filtered to.
  const filtered = await read({ status: 'USED' })
  const summary = filtered.summary
  expect(summary.total).toBe(CARDS.length)
  expect(summary.available).toBe(CARDS.filter(card => card.status === 'ACTIVE' && card.is_active && card.current_balance > 0).length)
  expect(summary.enabled).toBe(CARDS.filter(card => card.is_active).length)
  expect(summary.digital).toBe(CARDS.filter(card => card.is_digital).length)
  expect(summary.reloadable).toBe(CARDS.filter(card => card.is_reloadable).length)
  for (const status of STATUSES)
    expect(summary.statuses[status]).toBe(CARDS.filter(card => card.status === status).length)
  const inCurrency = (currency: string) => CARDS.filter(card => card.currency.toUpperCase() === currency)
  expect(summary.currencies.map(entry => entry.currency)).toEqual(['EUR', 'USD'])
  for (const entry of summary.currencies) {
    const cards = inCurrency(entry.currency)
    expect(entry.cards).toBe(cards.length)
    expect(entry.initialBalance).toBe(cards.reduce((sum, card) => sum + card.initial_balance, 0))
    expect(entry.currentBalance).toBe(cards.reduce((sum, card) => sum + card.current_balance, 0))
    expect(entry.redeemedBalance).toBe(cards.reduce((sum, card) => sum + Math.max(0, card.initial_balance - card.current_balance), 0))
  }
  expect(filtered.total).toBe(CARDS.filter(card => card.status === 'USED').length)

  // Filters, alone and together.
  expect((await read({ enabled: 'enabled' })).total).toBe(CARDS.filter(card => card.is_active).length)
  expect((await read({ enabled: 'disabled' })).total).toBe(CARDS.filter(card => !card.is_active).length)
  expect((await read({ delivery: 'digital' })).total).toBe(CARDS.filter(card => card.is_digital).length)
  expect((await read({ delivery: 'physical' })).total).toBe(CARDS.filter(card => !card.is_digital).length)
  expect(ids((await all({ status: 'ACTIVE', enabled: 'enabled', delivery: 'digital', sort: 'id', direction: 'asc' })).records.map(record => CARDS[Number(record.id) - 1]!)))
    .toEqual(ids(CARDS.filter(card => card.status === 'ACTIVE' && card.is_active && card.is_digital)))

  // Search ignores case, treats % literally, and reaches the purchaser.
  expect((await read({ search: '100%' })).records.map(record => record.id)).toEqual(['9'])
  expect((await read({ search: 'purch-xyz' })).records.map(record => record.id)).toEqual(['21'])
  expect((await read({ search: 'EXAMPLE.COM' })).total).toBe(CARDS.length - 1)
  expect((await read({ search: 'bob' })).total).toBe(CARDS.filter(card => card.recipient_name === 'Bob').length)

  // Newest first, the id breaking the tie between 11 and 12, stable across pages.
  const newest = [...CARDS].sort((a, b) => a.hoursAgo - b.hoursAgo || b.id - a.id)
  const pages = [await read({ page: 1 }), await read({ page: 2 }), await read({ page: 3 })]
  expect(pages.flatMap(result => result.records.map(record => record.id))).toEqual(ids(newest))
  expect(pages[0]!.total).toBe(CARDS.length)
  expect((await read({ page: 9 })).page).toBe(3)

  // Sorts, with ties read by code.
  const sorted = async (sort: GiftCardListQuery['sort'], direction: 'asc' | 'desc') =>
    (await all({ sort, direction })).records.map(record => record.id)
  expect(await sorted('code', 'asc')).toEqual(ids([...CARDS].sort(byCode)))
  expect(await sorted('balance', 'desc')).toEqual(ids([...CARDS].sort((a, b) => b.current_balance - a.current_balance || byCode(a, b))))
  const recipient = (card: Card) => (card.recipient_name ?? '').toLowerCase()
  expect(await sorted('recipient', 'asc')).toEqual(ids([...CARDS].sort((a, b) => recipient(a).localeCompare(recipient(b)) || byCode(a, b))))
  // Cards without an expiry come last in both directions.
  const dated = CARDS.filter(card => card.expiry_days !== null)
  const undated = [...CARDS.filter(card => card.expiry_days === null)].sort(byCode)
  expect(await sorted('expiry', 'asc')).toEqual(ids([...[...dated].sort((a, b) => a.expiry_days! - b.expiry_days! || byCode(a, b)), ...undated]))
  expect(await sorted('expiry', 'desc')).toEqual(ids([...[...dated].sort((a, b) => b.expiry_days! - a.expiry_days! || byCode(a, b)), ...undated]))

  // A card's customer is checked against exactly the customers it references.
  const first = (await all({ sort: 'id', direction: 'asc' })).records
  expect(first[0]!.customerId).toBe(String(CUSTOMERS))
  expect(first[1]!.customerId).toBe('3')
  expect(first[0]!.currency).toBe('EUR')
  expect(first[5]!.currency).toBe('USD')

  // The export holds every match across batches, in order.
  const exported = await readGiftCardsForExport({ search: '', status: '', enabled: '', delivery: '', sort: 'created', direction: 'desc' }, runner, dialect, 4)
  expect(exported.map(record => record.id)).toEqual(ids(newest))
}

describe('readGiftCardPage on SQLite', () => {
  test('summary, filters, search, sorts, pages, customers and export', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readGiftCardPage on ${dialect}: summary, filters, search, sorts, pages, customers and export`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Gift card list tests require a local disposable database server')

    const name = `stacks_gift_card_list_${crypto.randomUUID().replaceAll('-', '')}`
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

describe('parseGiftCardListQuery', () => {
  const reader = (values: Record<string, unknown>) => (key: string) => values[key] ?? ''

  test('defaults to every card, newest first, 25 a page', () => {
    expect(parseGiftCardListQuery(reader({}))).toEqual({ search: '', status: '', enabled: '', delivery: '', sort: 'created', direction: 'desc', page: 1, perPage: 25 })
    expect(parseGiftCardListQuery(reader({ sort: 'balance' }))).toHaveProperty('direction', 'desc')
    expect(parseGiftCardListQuery(reader({ sort: 'code' }))).toHaveProperty('direction', 'asc')
  })

  test('refuses values the page does not offer', () => {
    expect(parseGiftCardListQuery(reader({ status: 'active' }))).toHaveProperty('error')
    expect(parseGiftCardListQuery(reader({ enabled: 'yes' }))).toHaveProperty('error')
    expect(parseGiftCardListQuery(reader({ delivery: 'email' }))).toHaveProperty('error')
    expect(parseGiftCardListQuery(reader({ sort: 'personal_message' }))).toHaveProperty('error')
    expect(parseGiftCardListQuery(reader({ per_page: '7' }))).toHaveProperty('error')
  })
})

describe('giftCardsCsv', () => {
  test('writes the page columns with balances in major units', () => {
    const csv = giftCardsCsv([{
      id: '1', code: 'GC-"1"', initialBalance: 5000, currentBalance: 1250, currency: 'USD', status: 'ACTIVE', purchaserId: '',
      recipientEmail: 'a@b.test', recipientName: 'Ann', personalMessage: '', isDigital: true, isReloadable: false, isActive: true,
      expiryDate: '', lastUsedDate: '', templateId: '', customerId: '', createdAt: '2026-11-06T12:00:00.000Z',
    }], (amount, currency) => `${currency} ${(amount / 100).toFixed(2)}`)
    const [header, row] = csv.replace(/^﻿/, '').split('\n')
    expect(header).toBe('"Code","Recipient","Email","Status","Availability","Delivery","Reloading","Currency","Initial balance","Current balance","Expiry date","Last used date"')
    expect(row).toBe('"GC-""1""","Ann","a@b.test","ACTIVE","Enabled","Digital","Single use","USD","USD 50.00","USD 12.50","",""')
  })
})
