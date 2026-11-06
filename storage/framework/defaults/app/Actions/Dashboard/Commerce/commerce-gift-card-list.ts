import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import { containsPattern, countOf, LIST_PAGE_SIZES, pageWithin, queryText } from '../Content/content-list'
import { commerceCurrency, commerceIdentifier, commerceValue, referencedIds } from './commerce-record'
import type { CommerceSqlRunner } from './commerce-sql'
import { asText, binder, idPlaceholders, sqlRows } from './commerce-sql'
import type { GiftCardCurrencySummary, GiftCardRecord, GiftCardStatus, GiftCardSummary } from './gift-card-records'
import { normalizeGiftCardRecord } from './gift-card-records'

/**
 * One page of gift cards, searched, filtered, sorted and counted by the
 * database, with the summary of every card (stacksjs/stacks#3218).
 *
 * The Gift Cards page used to read the newest 500 cards and do all of that in
 * the browser, so a card past the 500th could not be found and the summary
 * counted those 500. The record check read the first 500 customers, so a card
 * belonging to a later customer failed the whole page.
 */
export const GIFT_CARD_SORTS = ['created', 'id', 'code', 'recipient', 'balance', 'status', 'delivery', 'expiry'] as const
export type GiftCardSort = typeof GIFT_CARD_SORTS[number]

export const GIFT_CARD_STATUSES: readonly GiftCardStatus[] = ['ACTIVE', 'USED', 'EXPIRED', 'DEACTIVATED']

export interface GiftCardListQuery {
  search: string
  /** '' for any. */
  status: '' | GiftCardStatus
  /** '' for any. */
  enabled: '' | 'enabled' | 'disabled'
  /** '' for any. */
  delivery: '' | 'digital' | 'physical'
  sort: GiftCardSort
  direction: 'asc' | 'desc'
  page: number
  perPage: number
}

export function parseGiftCardListQuery(read: QueryReader): GiftCardListQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 25 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const sort = queryText(read, 'sort') || 'created'
  if (!(GIFT_CARD_SORTS as readonly string[]).includes(sort))
    return { error: `sort must be one of ${GIFT_CARD_SORTS.join(', ')}.` }

  const directionText = queryText(read, 'direction').toLowerCase()
  const direction = directionText === '' ? (sort === 'created' || sort === 'balance' ? 'desc' : 'asc') : directionText
  if (direction !== 'asc' && direction !== 'desc')
    return { error: 'direction must be asc or desc.' }

  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  const status = queryText(read, 'status')
  if (status && !(GIFT_CARD_STATUSES as readonly string[]).includes(status))
    return { error: `status must be one of ${GIFT_CARD_STATUSES.join(', ')}.` }

  const enabled = queryText(read, 'enabled')
  if (enabled && enabled !== 'enabled' && enabled !== 'disabled')
    return { error: 'enabled must be enabled or disabled.' }

  const delivery = queryText(read, 'delivery')
  if (delivery && delivery !== 'digital' && delivery !== 'physical')
    return { error: 'delivery must be digital or physical.' }

  return {
    search,
    status: status as GiftCardListQuery['status'],
    enabled: enabled as GiftCardListQuery['enabled'],
    delivery: delivery as GiftCardListQuery['delivery'],
    sort: sort as GiftCardSort,
    direction,
    page,
    perPage,
  }
}

/**
 * "This flag is set", the same on every dialect: SQLite and MySQL store 0 and
 * 1, and PostgreSQL a boolean, which the cast reads as 0 or 1.
 */
function isSet(column: string, dialect: QueryBuilderDialect): string {
  return dialect === 'postgres' ? `CAST(${column} AS INTEGER) = 1` : `${column} = 1`
}

function sortExpression(sort: GiftCardSort, dialect: QueryBuilderDialect): string {
  switch (sort) {
    case 'id': return 'id'
    case 'code': return 'LOWER(code)'
    case 'recipient': return `LOWER(COALESCE(recipient_name, ''))`
    case 'balance': return 'current_balance'
    case 'status': return asText('status', dialect)
    case 'delivery': return `CASE WHEN ${isSet('is_digital', dialect)} THEN 1 ELSE 0 END`
    case 'expiry': return 'expiry_date'
    default: return 'created_at'
  }
}

export function giftCardFilter(query: Pick<GiftCardListQuery, 'search' | 'status' | 'enabled' | 'delivery'>, dialect: QueryBuilderDialect): { where: string, values: unknown[] } {
  const { bind, values } = binder(dialect)
  const clauses: string[] = []
  if (query.status)
    // A text comparison: PostgreSQL keeps the status as an enum.
    clauses.push(`${asText('status', dialect)} = ${bind(query.status)}`)
  if (query.enabled === 'enabled')
    clauses.push(isSet('is_active', dialect))
  if (query.enabled === 'disabled')
    clauses.push(`NOT (${isSet('is_active', dialect)})`)
  if (query.delivery === 'digital')
    clauses.push(isSet('is_digital', dialect))
  if (query.delivery === 'physical')
    clauses.push(`NOT (${isSet('is_digital', dialect)})`)
  if (query.search) {
    const pattern = containsPattern(query.search)
    const columns = [
      'code',
      `COALESCE(recipient_name, '')`,
      `COALESCE(recipient_email, '')`,
      `COALESCE(purchaser_id, '')`,
      'currency',
    ]
    clauses.push(`(${columns.map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')})`)
  }
  return { where: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '', values }
}

function orderBy(query: Pick<GiftCardListQuery, 'sort' | 'direction'>, dialect: QueryBuilderDialect): string {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  // Cards without an expiry come last either way: each dialect puts NULL at
  // a different end of the order.
  const undated = query.sort === 'expiry' ? 'CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END ASC, ' : ''
  // Ties read by code, as the page sorted them, except the newest-first order,
  // which the page broke by id; the id breaks every remaining tie, so pages
  // never repeat or skip a card.
  const byCode = ['created', 'code', 'id'].includes(query.sort) ? '' : ', LOWER(code) ASC'
  return ` ORDER BY ${undated}${sortExpression(query.sort, dialect)} ${direction}${byCode}, id ${direction}`
}

/** Gift cards turned into records, against exactly the customers they reference. */
async function recordsFor(cards: Array<Record<string, unknown>>, run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<GiftCardRecord[]> {
  if (cards.length === 0)
    return []
  const customerIds = referencedIds(cards, 'customer_id')
  const customers = customerIds.length > 0
    ? await run.unsafe(`SELECT id FROM customers WHERE id IN (${idPlaceholders(customerIds, dialect)})`, customerIds).execute()
    : []
  const known = new Set(sqlRows(customers).map(row => commerceIdentifier(commerceValue(row, 'id'), 'Customer')))
  return cards.map(card => normalizeGiftCardRecord(card, known))
}

/** The summary cards and breakdowns, over every gift card as before. */
async function summarize(run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<GiftCardSummary> {
  const status = asText('status', dialect)
  const count = (condition: string) => `SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END)`
  const [totals, byStatus, byCurrency] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count, ${count(`${status} = 'ACTIVE' AND ${isSet('is_active', dialect)} AND current_balance > 0`)} AS available_count, ${count(isSet('is_active', dialect))} AS enabled_count, ${count(isSet('is_digital', dialect))} AS digital_count, ${count(isSet('is_reloadable', dialect))} AS reloadable_count FROM gift_cards`).execute(),
    run.unsafe(`SELECT ${status} AS value, COUNT(*) AS item_count FROM gift_cards GROUP BY ${status}`).execute(),
    run.unsafe('SELECT currency, COUNT(*) AS item_count, SUM(initial_balance) AS initial_total, SUM(current_balance) AS current_total, SUM(CASE WHEN initial_balance > current_balance THEN initial_balance - current_balance ELSE 0 END) AS redeemed_total FROM gift_cards GROUP BY currency').execute(),
  ])
  const row = sqlRows(totals)[0] ?? {}

  const statuses: Record<GiftCardStatus, number> = { ACTIVE: 0, USED: 0, EXPIRED: 0, DEACTIVATED: 0 }
  for (const entry of sqlRows(byStatus)) {
    const key = String(entry.value ?? '') as GiftCardStatus
    if (key in statuses)
      statuses[key] += countOf(entry.item_count)
  }

  const currencies = new Map<string, GiftCardCurrencySummary>()
  for (const entry of sqlRows(byCurrency)) {
    // Normalized as the records are, so "usd" and "USD" are one currency.
    const currency = commerceCurrency(entry.currency, 'Gift card summary')
    const current = currencies.get(currency) ?? { currency, cards: 0, initialBalance: 0, currentBalance: 0, redeemedBalance: 0 }
    current.cards += countOf(entry.item_count)
    current.initialBalance += countOf(entry.initial_total)
    current.currentBalance += countOf(entry.current_total)
    current.redeemedBalance += countOf(entry.redeemed_total)
    currencies.set(currency, current)
  }

  return {
    total: countOf(row.total_count),
    available: countOf(row.available_count),
    enabled: countOf(row.enabled_count),
    digital: countOf(row.digital_count),
    reloadable: countOf(row.reloadable_count),
    statuses,
    currencies: [...currencies.values()].sort((left, right) => left.currency.localeCompare(right.currency)),
  }
}

export interface GiftCardPage {
  records: GiftCardRecord[]
  total: number
  page: number
  summary: GiftCardSummary
}

export async function readGiftCardPage(
  query: GiftCardListQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<GiftCardPage> {
  const { where, values } = giftCardFilter(query, dialect)
  const [counted, summary] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count FROM gift_cards${where}`, values).execute(),
    summarize(run, dialect),
  ])
  const total = countOf(sqlRows(counted)[0]?.total_count)
  const page = pageWithin(query.page, total, query.perPage)
  const cards = await run.unsafe(
    `SELECT * FROM gift_cards${where}${orderBy(query, dialect)} LIMIT ${query.perPage} OFFSET ${(page - 1) * query.perPage}`,
    values,
  ).execute()
  return { records: await recordsFor(sqlRows(cards), run, dialect), total, page, summary }
}

/** Every gift card matching the query, in its order, for the CSV export, a batch at a time. */
export async function readGiftCardsForExport(
  query: Omit<GiftCardListQuery, 'page' | 'perPage'>,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
  batchSize: number = 500,
): Promise<GiftCardRecord[]> {
  const { where, values } = giftCardFilter(query, dialect)
  const records: GiftCardRecord[] = []
  for (let offset = 0; ; offset += batchSize) {
    const batch = sqlRows(await run.unsafe(
      `SELECT * FROM gift_cards${where}${orderBy(query, dialect)} LIMIT ${batchSize} OFFSET ${offset}`,
      values,
    ).execute())
    records.push(...await recordsFor(batch, run, dialect))
    if (batch.length < batchSize)
      return records
  }
}

const CSV_HEADER = ['Code', 'Recipient', 'Email', 'Status', 'Availability', 'Delivery', 'Reloading', 'Currency', 'Initial balance', 'Current balance', 'Expiry date', 'Last used date']

/** The CSV "Export filtered" downloads: the page's columns, for every matching card. */
export function giftCardsCsv(records: GiftCardRecord[], minor: (amount: number, currency: string) => string): string {
  const escape = (value: string): string => `"${value.replaceAll('"', '""')}"`
  const lines = records.map(record => [
    record.code,
    record.recipientName,
    record.recipientEmail,
    record.status,
    record.isActive ? 'Enabled' : 'Disabled',
    record.isDigital ? 'Digital' : 'Physical',
    record.isReloadable ? 'Reloadable' : 'Single use',
    record.currency,
    minor(record.initialBalance, record.currency),
    minor(record.currentBalance, record.currency),
    record.expiryDate,
    record.lastUsedDate,
  ])
  return `﻿${[CSV_HEADER, ...lines].map(row => row.map(escape).join(',')).join('\n')}`
}
