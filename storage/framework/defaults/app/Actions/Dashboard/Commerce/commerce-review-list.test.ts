import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { ReviewListQuery } from './commerce-review-list'
import { parseReviewListQuery, readReviewPage } from './commerce-review-list'
import type { CommerceSqlRunner } from './commerce-sql'

/**
 * The Reviews list against each dialect's real engine (stacksjs/stacks#3218),
 * with the flags as each dialect stores booleans, and products and customers
 * past the 500 the page used to read.
 */
type Dialect = 'sqlite' | 'postgres' | 'mysql'

const NOW = new Date('2026-11-06T12:00:00.000Z')
const ROWS = 600
const PRODUCT_NAMES: Record<number, string> = { 1: 'Coffee Beans', 2: 'apron', 3: 'Mug', 4: 'Unreviewed', 600: 'zebra Tea' }
const CUSTOMER_NAMES: Record<number, string> = { 5: 'zoe', 6: 'Adam', 599: 'mia' }
const productName = (id: number) => PRODUCT_NAMES[id] ?? `Product ${id}`
const customerName = (id: number) => CUSTOMER_NAMES[id] ?? `Customer ${id}`

/** 30 reviews, one an hour back from NOW; 20 and 21 share a creation time. */
const REVIEWS = Array.from({ length: 30 }, (_, index) => {
  const id = index + 1
  return {
    id,
    product_id: id === 29 ? null : [1, 2, 3, 600][id % 4]!,
    customer_id: [5, 6, 599, null][id % 4] ?? null,
    rating: id % 7 === 0 ? null : (id % 5) + 1,
    title: id === 11 ? 'Great_100% value' : id === 12 ? 'Great 1000 value' : `Review ${id}`,
    content: id === 17 ? 'Smells LIKE roses' : `Words for review ${id}`,
    is_approved: id % 2 === 0,
    is_featured: id % 5 === 0,
    is_verified_purchase: id % 3 === 0,
    helpful_votes: (id * 7) % 10,
    unhelpful_votes: id % 3,
    hoursAgo: id === 21 ? 20 : id,
  }
})
type Review = typeof REVIEWS[number]

const ids = (reviews: Review[]) => reviews.map(review => String(review.id))
const newestFirst = (a: Review, b: Review) => a.hoursAgo - b.hoursAgo || b.id - a.id

function query(overrides: Partial<ReviewListQuery> = {}): ReviewListQuery {
  return { search: '', product: '', rating: '', moderation: '', sort: 'created', direction: 'desc', page: 1, perPage: 10, ...overrides }
}

async function setUp(run: (sql: string, values?: unknown[]) => Promise<unknown>, dialect: Dialect) {
  const pk = dialect === 'postgres' ? 'BIGINT PRIMARY KEY' : 'INTEGER PRIMARY KEY'
  const text = dialect === 'mysql' ? 'VARCHAR(255)' : 'TEXT'
  const flag = dialect === 'postgres' ? 'BOOLEAN' : dialect === 'mysql' ? 'TINYINT(1)' : 'INTEGER'
  const time = dialect === 'sqlite' ? 'TEXT' : dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP'
  const p = (index: number) => dialect === 'postgres' ? `$${index}` : '?'
  await run(`CREATE TABLE products (id ${pk}, name ${text})`)
  await run(`CREATE TABLE customers (id ${pk}, name ${text}, email ${text})`)
  await run(`CREATE TABLE reviews (id ${pk}, rating INTEGER NULL, title ${text} NULL, content ${text} NULL, is_verified_purchase ${flag}, is_approved ${flag}, is_featured ${flag}, helpful_votes INTEGER, unhelpful_votes INTEGER, product_id INTEGER NULL, customer_id INTEGER NULL, created_at ${time})`)
  const all = Array.from({ length: ROWS }, (_, i) => i + 1)
  await run(`INSERT INTO products (id, name) VALUES ${all.map((_, i) => `(${p(2 * i + 1)}, ${p(2 * i + 2)})`).join(', ')}`, all.flatMap(id => [id, productName(id)]))
  await run(`INSERT INTO customers (id, name, email) VALUES ${all.map((_, i) => `(${p(3 * i + 1)}, ${p(3 * i + 2)}, ${p(3 * i + 3)})`).join(', ')}`, all.flatMap(id => [id, customerName(id), `customer${id}@shop.test`]))
  const bool = (value: boolean) => dialect === 'postgres' ? value : (value ? 1 : 0)
  for (const review of REVIEWS) {
    await run(
      `INSERT INTO reviews (id, rating, title, content, is_verified_purchase, is_approved, is_featured, helpful_votes, unhelpful_votes, product_id, customer_id, created_at) VALUES (${Array.from({ length: 12 }, (_, i) => p(i + 1)).join(', ')})`,
      [
        review.id, review.rating, review.title, review.content, bool(review.is_verified_purchase), bool(review.is_approved),
        bool(review.is_featured), review.helpful_votes, review.unhelpful_votes, review.product_id, review.customer_id,
        new Date(NOW.getTime() - review.hoursAgo * 3_600_000).toISOString().slice(0, 19).replace('T', ' '),
      ],
    )
  }
}

async function exercise(runner: CommerceSqlRunner, dialect: Dialect) {
  const read = (overrides: Partial<ReviewListQuery> = {}) => readReviewPage(query(overrides), runner, dialect)
  const all = async (overrides: Partial<ReviewListQuery> = {}) => (await read({ perPage: 100, ...overrides })).records.map(record => record.id)

  // The summary counts every review, whatever the page is filtered to.
  const filtered = await read({ moderation: 'featured' })
  const rated = REVIEWS.flatMap(review => review.rating === null ? [] : [review.rating])
  expect(filtered.summary).toEqual({
    total: REVIEWS.length,
    approved: REVIEWS.filter(review => review.is_approved).length,
    pending: REVIEWS.filter(review => !review.is_approved).length,
    featured: REVIEWS.filter(review => review.is_featured).length,
    verified: REVIEWS.filter(review => review.is_verified_purchase).length,
    averageRating: Math.round(rated.reduce((sum, rating) => sum + rating, 0) / rated.length * 10) / 10,
  })
  expect(filtered.total).toBe(REVIEWS.filter(review => review.is_featured).length)

  // The product choices are the reviewed products, by name ignoring case.
  expect(filtered.products).toEqual([
    { id: '2', label: 'apron' },
    { id: '1', label: 'Coffee Beans' },
    { id: '3', label: 'Mug' },
    { id: '600', label: 'zebra Tea' },
  ])

  // Filters.
  const matching = (keep: (review: Review) => boolean) => ids(REVIEWS.filter(keep).sort(newestFirst))
  expect(await all({ product: '600' })).toEqual(matching(review => review.product_id === 600))
  expect(await all({ rating: '5' })).toEqual(matching(review => review.rating === 5))
  expect(await all({ rating: 'none' })).toEqual(matching(review => review.rating === null))
  expect(await all({ moderation: 'approved' })).toEqual(matching(review => review.is_approved))
  expect(await all({ moderation: 'pending' })).toEqual(matching(review => !review.is_approved))
  expect(await all({ moderation: 'verified' })).toEqual(matching(review => review.is_verified_purchase))
  expect(await all({ product: '1', moderation: 'approved' })).toEqual(matching(review => review.product_id === 1 && review.is_approved))

  // Search: customer name and email, product name, title with a literal %, content, ignoring case.
  expect(await all({ search: 'ZOE' })).toEqual(matching(review => review.customer_id === 5))
  expect(await all({ search: 'customer599@' })).toEqual(matching(review => review.customer_id === 599))
  expect(await all({ search: 'ZEBRA' })).toEqual(matching(review => review.product_id === 600))
  expect(await all({ search: '100%' })).toEqual(['11'])
  expect(await all({ search: 'like roses' })).toEqual(['17'])

  // Newest first, the id breaking the tie between 20 and 21, stable across pages.
  const newest = [...REVIEWS].sort(newestFirst)
  const pages = [await read({ page: 1 }), await read({ page: 2 }), await read({ page: 3 })]
  expect(pages.flatMap(result => result.records.map(record => record.id))).toEqual(ids(newest))
  expect((await read({ page: 9 })).page).toBe(3)

  // Sorts: unrated last either way; ties newest first.
  const unrated = REVIEWS.filter(review => review.rating === null).sort(newestFirst)
  const ratedReviews = REVIEWS.filter(review => review.rating !== null)
  expect(await all({ sort: 'rating', direction: 'desc' })).toEqual(ids([...[...ratedReviews].sort((a, b) => b.rating! - a.rating! || newestFirst(a, b)), ...unrated]))
  expect(await all({ sort: 'rating', direction: 'asc' })).toEqual(ids([...[...ratedReviews].sort((a, b) => a.rating! - b.rating! || newestFirst(a, b)), ...unrated]))
  expect(await all({ sort: 'helpful', direction: 'desc' })).toEqual(ids([...REVIEWS].sort((a, b) => b.helpful_votes - a.helpful_votes || newestFirst(a, b))))
  const customerKey = (review: Review) => review.customer_id === null ? '' : customerName(review.customer_id).toLowerCase()
  expect(await all({ sort: 'customer', direction: 'asc' })).toEqual(ids([...REVIEWS].sort((a, b) => customerKey(a).localeCompare(customerKey(b)) || newestFirst(a, b))))
  const productKey = (review: Review) => review.product_id === null ? '' : productName(review.product_id).toLowerCase()
  expect(await all({ sort: 'product', direction: 'asc' })).toEqual(ids([...REVIEWS].sort((a, b) => productKey(a).localeCompare(productKey(b)) || newestFirst(a, b))))
  expect(await all({ sort: 'approved', direction: 'desc' })).toEqual(ids([...REVIEWS].sort((a, b) => Number(b.is_approved) - Number(a.is_approved) || newestFirst(a, b))))

  // Products and customers past the 500th, read by the ids the page references.
  const records = (await read({ perPage: 100 })).records
  expect(records.find(record => record.productId === '600')).toMatchObject({ productName: 'zebra Tea' })
  expect(records.find(record => record.customerId === '599')).toMatchObject({ customerName: 'mia', customerEmail: 'customer599@shop.test' })
  expect(records.find(record => record.id === '29')).toMatchObject({ productId: '', productName: '' })
}

describe('readReviewPage on SQLite', () => {
  test('summary, product choices, filters, search, sorts, pages and references', async () => {
    const database = new Database(':memory:')
    await setUp(async (sql, values = []) => database.query(sql).run(...(values as never[])), 'sqlite')
    await exercise({ unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as never[])) }) }, 'sqlite')
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`readReviewPage on ${dialect}: summary, product choices, filters, search, sorts, pages and references`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Review list tests require a local disposable database server')

    const name = `stacks_review_list_${crypto.randomUUID().replaceAll('-', '')}`
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

describe('parseReviewListQuery', () => {
  const reader = (values: Record<string, unknown>) => (key: string) => values[key] ?? ''

  test('defaults to every review, newest first, 25 a page', () => {
    expect(parseReviewListQuery(reader({}))).toEqual({ search: '', product: '', rating: '', moderation: '', sort: 'created', direction: 'desc', page: 1, perPage: 25 })
    expect(parseReviewListQuery(reader({ sort: 'helpful' }))).toHaveProperty('direction', 'desc')
    expect(parseReviewListQuery(reader({ sort: 'customer' }))).toHaveProperty('direction', 'asc')
  })

  test('refuses values the page does not offer', () => {
    expect(parseReviewListQuery(reader({ product: 'abc' }))).toHaveProperty('error')
    expect(parseReviewListQuery(reader({ rating: '6' }))).toHaveProperty('error')
    expect(parseReviewListQuery(reader({ moderation: 'spam' }))).toHaveProperty('error')
    expect(parseReviewListQuery(reader({ sort: 'images' }))).toHaveProperty('error')
  })
})
