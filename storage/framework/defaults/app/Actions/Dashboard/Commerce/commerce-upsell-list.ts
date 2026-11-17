import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { randomUUIDv7 } from 'bun'
import { db, getDatabaseDialect, mutationCount } from '@stacksjs/database/runtime'
import { formatDate } from '@stacksjs/orm'
import type { QueryReader } from '../Content/content-list'
import { containsPattern, countOf, LIST_PAGE_SIZES, pageWithin, queryText } from '../Content/content-list'
import { commerceIdentifier, commerceValue } from './commerce-record'
import type { CommerceSqlRunner } from './commerce-sql'
import { asText, binder, idPlaceholders, isTrue, sqlRows } from './commerce-sql'
import type { UpsellOfferRecord, UpsellResponseRecord, UpsellState, UpsellStats, UpsellSummary, UpsellWritePayload } from './upsell-offer-records'
import { emptyUpsellStats, emptyUpsellSummary, normalizeUpsellOfferRecord, parseIdList, statsFrom, UPSELL_STATES, upsellWriteData } from './upsell-offer-records'

/**
 * The Upsells page: post-purchase offers, one page at a time, each with the
 * funnel its responses add up to, and the totals across every offer. Reads
 * are plain SQL, like the other commerce lists, so they run the same on
 * SQLite, PostgreSQL and MySQL.
 */
export const UPSELL_SORTS = ['newest', 'name', 'priority', 'revenue'] as const
export type UpsellSort = typeof UPSELL_SORTS[number]

export interface UpsellListQuery {
  search: string
  /** '' for any. */
  state: '' | UpsellState
  sort: UpsellSort
  direction: 'asc' | 'desc'
  page: number
  perPage: number
}

export function parseUpsellListQuery(read: QueryReader): UpsellListQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 25 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const sort = queryText(read, 'sort') || 'priority'
  if (!(UPSELL_SORTS as readonly string[]).includes(sort))
    return { error: `sort must be one of ${UPSELL_SORTS.join(', ')}.` }

  const directionText = queryText(read, 'direction').toLowerCase()
  const direction = directionText === '' ? (sort === 'name' ? 'asc' : 'desc') : directionText
  if (direction !== 'asc' && direction !== 'desc')
    return { error: 'direction must be asc or desc.' }

  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  const state = queryText(read, 'state')
  if (state && !(UPSELL_STATES as readonly string[]).includes(state))
    return { error: `state must be one of ${UPSELL_STATES.join(', ')}.` }

  return { search, state: state as UpsellListQuery['state'], sort: sort as UpsellSort, direction, page, perPage }
}

function filter(query: Pick<UpsellListQuery, 'search' | 'state'>, dialect: QueryBuilderDialect, nowValue: string): { where: string, values: unknown[] } {
  const { bind, values } = binder(dialect)
  const clauses: string[] = []
  const enabled = `(o.is_active IS NULL OR ${isTrue('o.is_active', dialect)})`
  if (query.state === 'disabled')
    clauses.push(`NOT ${enabled}`)
  if (query.state === 'scheduled')
    clauses.push(`${enabled} AND o.starts_at IS NOT NULL AND o.starts_at > ${bind(nowValue)}`)
  if (query.state === 'ended')
    clauses.push(`${enabled} AND (o.starts_at IS NULL OR o.starts_at <= ${bind(nowValue)}) AND o.ends_at IS NOT NULL AND o.ends_at < ${bind(nowValue)}`)
  if (query.state === 'running')
    clauses.push(`${enabled} AND (o.starts_at IS NULL OR o.starts_at <= ${bind(nowValue)}) AND (o.ends_at IS NULL OR o.ends_at >= ${bind(nowValue)})`)
  if (query.search) {
    const pattern = containsPattern(query.search)
    clauses.push(`(${['o.name', `COALESCE(o.headline, '')`, `COALESCE(o.message, '')`].map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')})`)
  }
  return { where: clauses.length ? ` WHERE ${clauses.map(c => `(${c})`).join(' AND ')}` : '', values }
}

/**
 * Revenue per offer, for sorting by it in SQL. The status is compared as text:
 * PostgreSQL may keep it as an enum.
 */
function revenueSql(dialect: QueryBuilderDialect): string {
  return `(SELECT COALESCE(SUM(r.amount), 0) FROM post_purchase_offer_responses r WHERE r.post_purchase_offer_id = o.id AND ${asText('r.status', dialect)} = 'accepted')`
}

function orderBy(query: Pick<UpsellListQuery, 'sort' | 'direction'>, dialect: QueryBuilderDialect): string {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  switch (query.sort) {
    case 'name': return ` ORDER BY LOWER(o.name) ${direction}, o.id ${direction}`
    case 'revenue': return ` ORDER BY ${revenueSql(dialect)} ${direction}, LOWER(o.name) ASC, o.id ${direction}`
    // Ties by age, oldest first: the offer that would show first does.
    case 'priority': return ` ORDER BY COALESCE(o.priority, 0) ${direction}, o.id ASC`
    default: return ` ORDER BY o.id ${direction}`
  }
}

/** Product names by id, for the offers' products and triggers. */
async function productNames(ids: number[], run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<Map<number, string>> {
  if (ids.length === 0)
    return new Map()
  const rows = await run.unsafe(`SELECT id, name FROM products WHERE id IN (${idPlaceholders(ids, dialect)})`, ids).execute()
  return new Map(sqlRows(rows).map(row => [Number(row.id), String(row.name ?? `Product ${row.id}`)]))
}

/** The funnel of each offer, from its responses grouped by status. */
async function statsByOffer(offerIds: number[], run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<Map<number, UpsellStats>> {
  const out = new Map<number, UpsellStats>()
  if (offerIds.length === 0)
    return out
  const rows = await run.unsafe(
    `SELECT post_purchase_offer_id AS offer_id, ${asText('status', dialect)} AS status, COUNT(*) AS row_count, SUM(COALESCE(amount, 0)) AS amount_total, SUM(COALESCE(quantity, 0)) AS unit_total
    FROM post_purchase_offer_responses WHERE post_purchase_offer_id IN (${idPlaceholders(offerIds, dialect)})
    GROUP BY post_purchase_offer_id, ${asText('status', dialect)}`,
    offerIds,
  ).execute()
  const groups = new Map<number, Array<{ status: string, rows: number, amount: number, units: number }>>()
  for (const row of sqlRows(rows)) {
    const id = Number(row.offer_id)
    const list = groups.get(id) ?? []
    list.push({ status: String(row.status), rows: countOf(row.row_count), amount: countOf(row.amount_total), units: countOf(row.unit_total) })
    groups.set(id, list)
  }
  for (const id of offerIds)
    out.set(id, statsFrom(groups.get(id) ?? []))
  return out
}

async function recordsFor(rows: Array<Record<string, unknown>>, nowValue: string, run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<UpsellOfferRecord[]> {
  if (rows.length === 0)
    return []
  const ids = rows.map(row => Number(row.id))
  const productIds = [...new Set(rows.flatMap(row => [...parseIdList(row.product_ids), ...parseIdList(row.trigger_product_ids)]))]
  const [names, stats] = await Promise.all([productNames(productIds, run, dialect), statsByOffer(ids, run, dialect)])
  return rows.map(row => normalizeUpsellOfferRecord(row, nowValue, names, stats.get(Number(row.id)) ?? emptyUpsellStats()))
}

async function summarize(run: CommerceSqlRunner, dialect: QueryBuilderDialect, nowValue: string): Promise<UpsellSummary> {
  const status = asText('status', dialect)
  const { bind, values } = binder(dialect)
  const enabled = `(is_active IS NULL OR ${isTrue('is_active', dialect)})`
  const running = `${enabled} AND (starts_at IS NULL OR starts_at <= ${bind(nowValue)}) AND (ends_at IS NULL OR ends_at >= ${bind(nowValue)})`
  const [offers, funnel, top] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count, SUM(CASE WHEN ${running} THEN 1 ELSE 0 END) AS running_count FROM post_purchase_offers`, values).execute(),
    run.unsafe(`SELECT COUNT(*) AS view_count, SUM(CASE WHEN ${status} = 'accepted' THEN 1 ELSE 0 END) AS accepted_count, SUM(CASE WHEN ${status} = 'declined' THEN 1 ELSE 0 END) AS declined_count, SUM(CASE WHEN ${status} = 'accepted' THEN COALESCE(amount, 0) ELSE 0 END) AS revenue_total, SUM(CASE WHEN ${status} = 'accepted' THEN COALESCE(quantity, 0) ELSE 0 END) AS unit_total FROM post_purchase_offer_responses`).execute(),
    run.unsafe(`SELECT o.id, o.name, ${revenueSql(dialect)} AS revenue_total, (SELECT COUNT(*) FROM post_purchase_offer_responses r WHERE r.post_purchase_offer_id = o.id) AS view_count, (SELECT COUNT(*) FROM post_purchase_offer_responses r WHERE r.post_purchase_offer_id = o.id AND ${asText('r.status', dialect)} = 'accepted') AS accepted_count FROM post_purchase_offers o ORDER BY revenue_total DESC, LOWER(o.name) ASC, o.id ASC LIMIT 5`).execute(),
  ])
  const o = sqlRows(offers)[0] ?? {}
  const f = sqlRows(funnel)[0] ?? {}
  const summary = emptyUpsellSummary()
  summary.total = countOf(o.total_count)
  summary.running = countOf(o.running_count)
  summary.views = countOf(f.view_count)
  summary.accepted = countOf(f.accepted_count)
  summary.declined = countOf(f.declined_count)
  summary.revenue = countOf(f.revenue_total)
  summary.units = countOf(f.unit_total)
  summary.conversionRate = summary.views ? summary.accepted / summary.views : 0
  summary.top = sqlRows(top)
    .filter(row => countOf(row.revenue_total) > 0)
    .map((row) => {
      const views = countOf(row.view_count)
      return {
        id: commerceIdentifier(commerceValue(row, 'id'), 'PostPurchaseOffer'),
        name: String(row.name ?? ''),
        revenue: countOf(row.revenue_total),
        conversionRate: views ? countOf(row.accepted_count) / views : 0,
      }
    })
  return summary
}

export interface UpsellPage {
  records: UpsellOfferRecord[]
  total: number
  page: number
  summary: UpsellSummary
}

export async function readUpsellPage(
  query: UpsellListQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
  now: Date = new Date(),
): Promise<UpsellPage> {
  const nowValue = formatDate(now)
  const { where, values } = filter(query, dialect, nowValue)
  const [counted, summary] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count FROM post_purchase_offers o${where}`, values).execute(),
    summarize(run, dialect, nowValue),
  ])
  const total = countOf(sqlRows(counted)[0]?.total_count)
  const page = pageWithin(query.page, total, query.perPage)
  const rows = await run.unsafe(
    `SELECT o.* FROM post_purchase_offers o${where}${orderBy(query, dialect)} LIMIT ${query.perPage} OFFSET ${(page - 1) * query.perPage}`,
    values,
  ).execute()
  return { records: await recordsFor(sqlRows(rows), nowValue, run, dialect), total, page, summary }
}

/** One offer with its funnel and its most recent responses, newest first. */
export async function readUpsellDetail(
  id: number,
  limit = 25,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
  now: Date = new Date(),
): Promise<{ record: UpsellOfferRecord, responses: UpsellResponseRecord[] } | null> {
  const nowValue = formatDate(now)
  const offerParam = idPlaceholders([id], dialect)
  const rows = sqlRows(await run.unsafe(`SELECT * FROM post_purchase_offers WHERE id = ${offerParam}`, [id]).execute())
  if (rows.length === 0)
    return null
  const [record] = await recordsFor(rows, nowValue, run, dialect)
  const responses = sqlRows(await run.unsafe(
    `SELECT r.*, p.name AS product_name FROM post_purchase_offer_responses r LEFT JOIN products p ON p.id = r.product_id WHERE r.post_purchase_offer_id = ${offerParam} ORDER BY r.id DESC LIMIT ${Math.max(1, Math.min(100, limit))}`,
    [id],
  ).execute())
  return {
    record: record!,
    responses: responses.map(row => ({
      id: String(row.id),
      orderId: String(row.order_id ?? ''),
      status: String(row.status) as UpsellResponseRecord['status'],
      productId: String(row.product_id ?? ''),
      productLabel: row.product_name ? String(row.product_name) : `Deleted product #${row.product_id}`,
      variantId: row.variant_id == null ? '' : String(row.variant_id),
      quantity: row.quantity == null ? null : Number(row.quantity),
      unitPrice: row.unit_price == null ? null : Number(row.unit_price),
      compareAtPrice: row.compare_at_price == null ? null : Number(row.compare_at_price),
      amount: row.amount == null ? null : Number(row.amount),
      currency: String(row.currency ?? ''),
      failureReason: String(row.failure_reason ?? ''),
      respondedAt: String(row.responded_at ?? ''),
      createdAt: String(row.created_at ?? ''),
    })),
  }
}

export type UpsellSaveResult =
  | { ok: true, record: UpsellOfferRecord }
  | { ok: false, status: 404 | 409 | 422, message: string, errors?: Record<string, string> }

/** Create (id null) or change an offer, checking every product it names exists. */
export async function saveUpsellOffer(id: number | null, payload: UpsellWritePayload, run: any = db, dialect: QueryBuilderDialect = getDatabaseDialect()): Promise<UpsellSaveResult> {
  const checked = upsellWriteData(payload)
  if (!checked.ok)
    return { ok: false, status: 422, message: 'The offer could not be saved.', errors: checked.errors }

  const names = await productNames(checked.productIds, run, dialect)
  const missing = checked.productIds.filter(productId => !names.has(productId))
  if (missing.length > 0)
    return { ok: false, status: 422, message: 'The offer names products that do not exist.', errors: { productIds: `no product with id ${missing.join(', ')}` } }

  const now = formatDate(new Date())
  let offerId = id
  if (id === null) {
    const uuid = randomUUIDv7()
    await run.insertInto('post_purchase_offers').values({ ...checked.data, uuid, created_at: now, updated_at: now }).execute()
    const row = await run.selectFrom('post_purchase_offers').where('uuid', '=', uuid).select(['id']).executeTakeFirst()
    offerId = Number(row?.id)
  }
  else {
    const result = await run.updateTable('post_purchase_offers').set({ ...checked.data, updated_at: now }).where('id', '=', id).executeTakeFirst()
    if (mutationCount(result) === 0)
      return { ok: false, status: 404, message: `Offer ${id} does not exist.` }
  }

  const detail = await readUpsellDetail(Number(offerId), 1, run, dialect)
  if (!detail)
    return { ok: false, status: 404, message: `Offer ${offerId} does not exist.` }
  return { ok: true, record: detail.record }
}

/**
 * Delete an offer nobody has answered yet. Once orders have responded, its
 * responses are the record of what was added to them, so the offer is
 * switched off instead and the refusal says so.
 */
export async function deleteUpsellOffer(id: number, run: any = db): Promise<{ ok: true } | { ok: false, status: 404 | 409, message: string }> {
  const answered = await run.selectFrom('post_purchase_offer_responses').where('post_purchase_offer_id', '=', id).select(['id']).limit(1).executeTakeFirst()
  if (answered)
    return { ok: false, status: 409, message: 'Orders have already responded to this offer, and those records are kept. Switch it off instead.' }
  const result = await run.deleteFrom('post_purchase_offers').where('id', '=', id).executeTakeFirst()
  return mutationCount(result) > 0 ? { ok: true } : { ok: false, status: 404, message: `Offer ${id} does not exist.` }
}
