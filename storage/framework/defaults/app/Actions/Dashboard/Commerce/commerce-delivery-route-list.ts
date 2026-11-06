import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect } from '@stacksjs/database/runtime'
import type { QueryReader } from '../Content/content-list'
import { containsPattern, countOf, LIST_PAGE_SIZES, pageWithin, queryText } from '../Content/content-list'
import { deliveryTimestamp } from './commerce-delivery'
import { recentRoutes } from './commerce-delivery-overview'
import { referencedIds } from './commerce-record'
import type { CommerceSqlRunner } from './commerce-sql'
import { asText, binder, idPlaceholders, sqlRows } from './commerce-sql'
import type { DeliveryRouteRecord } from './delivery-route-records'
import { indexDeliveryRouteCouriers, normalizeDeliveryRouteRecord } from './delivery-route-records'

/**
 * One page of delivery routes, searched, sorted and counted by the database,
 * with the summary of every route (stacksjs/stacks#3218).
 *
 * The Delivery Routes page used to read the 500 most recently active routes
 * and do all of that in the browser, so an older route could not be found,
 * and its cards (routes, stops, distance, active in 24h) counted those 500.
 */
export const DELIVERY_ROUTE_SORTS = ['active', 'id', 'courier', 'vehicle', 'stops', 'time', 'distance'] as const
export type DeliveryRouteSort = typeof DELIVERY_ROUTE_SORTS[number]

export interface DeliveryRouteListQuery {
  search: string
  sort: DeliveryRouteSort
  direction: 'asc' | 'desc'
  page: number
  perPage: number
}

export interface DeliveryRouteSummary {
  total: number
  /** Routes linked to a courier record. */
  linked: number
  stops: number
  distance: number
  /** Routes active within a day of now. */
  active: number
}

export function parseDeliveryRouteListQuery(read: QueryReader): DeliveryRouteListQuery | { error: string } {
  const pageText = queryText(read, 'page')
  const page = pageText === '' ? 1 : Number(pageText)
  if (!Number.isInteger(page) || page < 1)
    return { error: 'page must be a whole number of 1 or more.' }

  const sizeText = queryText(read, 'per_page')
  const perPage = sizeText === '' ? 25 : Number(sizeText)
  if (!(LIST_PAGE_SIZES as readonly number[]).includes(perPage))
    return { error: `per_page must be one of ${LIST_PAGE_SIZES.join(', ')}.` }

  const sort = queryText(read, 'sort') || 'active'
  if (!(DELIVERY_ROUTE_SORTS as readonly string[]).includes(sort))
    return { error: `sort must be one of ${DELIVERY_ROUTE_SORTS.join(', ')}.` }

  const directionText = queryText(read, 'direction').toLowerCase()
  const direction = directionText === '' ? (sort === 'active' ? 'desc' : 'asc') : directionText
  if (direction !== 'asc' && direction !== 'desc')
    return { error: 'direction must be asc or desc.' }

  const search = queryText(read, 'q')
  if (search.length > 200)
    return { error: 'q must be 200 characters or fewer.' }

  return { search, sort: sort as DeliveryRouteSort, direction, page, perPage }
}

const FROM = ' FROM delivery_routes r LEFT JOIN couriers c ON c.id = r.courier_id'

/**
 * `last_active` in time order. It is text: the model writes Unix milliseconds,
 * and seconds are read too. A ten-digit seconds value and a thirteen-digit
 * millisecond value from different seconds differ in their first ten digits,
 * so the two already compare as text in time order; only values inside one
 * second could tie the wrong way.
 */
function lastActive(dialect: QueryBuilderDialect): string {
  return asText('r.last_active', dialect)
}

function sortExpression(sort: DeliveryRouteSort, dialect: QueryBuilderDialect): string {
  switch (sort) {
    case 'id': return 'r.id'
    case 'courier': return 'LOWER(COALESCE(c.name, r.courier))'
    case 'vehicle': return 'LOWER(r.vehicle)'
    case 'stops': return 'r.stops'
    case 'time': return 'r.delivery_time'
    case 'distance': return 'r.total_distance'
    default: return lastActive(dialect)
  }
}

export function deliveryRouteFilter(query: Pick<DeliveryRouteListQuery, 'search'>, dialect: QueryBuilderDialect): { where: string, values: unknown[] } {
  if (!query.search)
    return { where: '', values: [] }
  const { bind, values } = binder(dialect)
  const pattern = containsPattern(query.search)
  const columns = [
    asText('r.id', dialect),
    'r.courier',
    `COALESCE(c.name, '')`,
    'r.vehicle',
    asText('r.stops', dialect),
    asText('r.delivery_time', dialect),
    asText('r.total_distance', dialect),
  ]
  return { where: ` WHERE (${columns.map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')})`, values }
}

function orderBy(query: Pick<DeliveryRouteListQuery, 'sort' | 'direction'>, dialect: QueryBuilderDialect): string {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
  // Ties read most recently active first; the id breaks every remaining tie,
  // so pages never repeat or skip a route.
  if (query.sort === 'active' || query.sort === 'id')
    return ` ORDER BY ${sortExpression(query.sort, dialect)} ${direction}, r.id ${direction}`
  return ` ORDER BY ${sortExpression(query.sort, dialect)} ${direction}, ${lastActive(dialect)} DESC, r.id DESC`
}

/** Routes turned into records, against exactly the couriers they reference. */
async function recordsFor(routes: Array<Record<string, unknown>>, run: CommerceSqlRunner, dialect: QueryBuilderDialect): Promise<DeliveryRouteRecord[]> {
  if (routes.length === 0)
    return []
  const courierIds = referencedIds(routes, 'courier_id')
  const couriers = courierIds.length > 0
    ? await run.unsafe(`SELECT id, name, vehicle_number, status FROM couriers WHERE id IN (${idPlaceholders(courierIds, dialect)})`, courierIds).execute()
    : []
  const byId = indexDeliveryRouteCouriers(sqlRows(couriers))
  return routes.map(route => normalizeDeliveryRouteRecord(route, byId))
}

/** The summary cards, over every route as before. */
async function summarize(run: CommerceSqlRunner, dialect: QueryBuilderDialect, now: Date): Promise<DeliveryRouteSummary> {
  const recent = recentRoutes(dialect, now)
  const [totals, candidates] = await Promise.all([
    run.unsafe('SELECT COUNT(*) AS total_count, COUNT(courier_id) AS linked_count, SUM(stops) AS stop_total, SUM(total_distance) AS distance_total FROM delivery_routes').execute(),
    run.unsafe(`SELECT id, last_active FROM delivery_routes${recent.where}`, recent.values).execute(),
  ])
  const row = sqlRows(totals)[0] ?? {}
  // recentRoutes is a superset for anything but Unix times; this is the exact cut.
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000
  const active = sqlRows(candidates).filter((route) => {
    const at = deliveryTimestamp(route.last_active, `DeliveryRoute ${route.id}`)
    return at >= cutoff && at <= now.getTime()
  }).length
  return {
    total: countOf(row.total_count),
    linked: countOf(row.linked_count),
    stops: countOf(row.stop_total),
    distance: countOf(row.distance_total),
    active,
  }
}

export interface DeliveryRoutePage {
  records: DeliveryRouteRecord[]
  total: number
  page: number
  summary: DeliveryRouteSummary
}

export async function readDeliveryRoutePage(
  query: DeliveryRouteListQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
  now: Date = new Date(),
): Promise<DeliveryRoutePage> {
  const { where, values } = deliveryRouteFilter(query, dialect)
  const [counted, summary] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count${FROM}${where}`, values).execute(),
    summarize(run, dialect, now),
  ])
  const total = countOf(sqlRows(counted)[0]?.total_count)
  const page = pageWithin(query.page, total, query.perPage)
  const routes = await run.unsafe(
    `SELECT r.*${FROM}${where}${orderBy(query, dialect)} LIMIT ${query.perPage} OFFSET ${(page - 1) * query.perPage}`,
    values,
  ).execute()
  return { records: await recordsFor(sqlRows(routes), run, dialect), total, page, summary }
}
