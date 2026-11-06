import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect } from '@stacksjs/database/runtime'
import { countOf } from '../Content/content-list'
import type { DeliveryOverviewResult } from './commerce-delivery'
import { buildDeliveryOverview } from './commerce-delivery'
import { referencedIds } from './commerce-record'
import type { CommerceSqlRunner } from './commerce-sql'
import { asText, binder, idPlaceholders, sqlRows } from './commerce-sql'

/**
 * The delivery overview, read from every record (stacksjs/stacks#3218).
 *
 * It used to read the first 500 shipping methods, routes, zones and couriers
 * by id and work everything out from those, so a route, zone or courier past
 * the 500th was left out of every count, and the active routes were whichever
 * of the first 500 happened to be recent.
 *
 * Now the database counts the couriers, picks the five methods and zones the
 * overview lists, and narrows the routes to those that can have been active
 * in the last day; buildDeliveryOverview does the rest, as before, on rows
 * that are bounded by what the overview shows.
 */
const DAY_MS = 24 * 60 * 60 * 1000

/** Active first, then by name, the order the overview lists methods and zones in. */
function activeFirst(dialect: QueryBuilderDialect): string {
  return `ORDER BY CASE WHEN ${asText('status', dialect)} = 'active' THEN 0 ELSE 1 END, LOWER(name), id`
}

/**
 * Routes whose `last_active` can be within a day of `now`. The model stores it
 * as text holding Unix milliseconds, and the overview also reads Unix seconds
 * and ISO dates. Digit strings of one length compare as text exactly as they
 * do as numbers, so milliseconds and seconds are narrowed exactly; anything
 * else is kept from the day before the cutoff on, and buildDeliveryOverview
 * makes the exact cut.
 */
function recentRoutes(dialect: QueryBuilderDialect, now: Date): { where: string, values: unknown[] } {
  const { bind, values } = binder(dialect)
  const cutoff = now.getTime() - DAY_MS
  const column = asText('last_active', dialect)
  const length = `LENGTH(${column})`
  const milliseconds = `(${length} = 13 AND ${column} >= ${bind(String(cutoff))} AND ${column} <= ${bind(String(now.getTime()))})`
  const seconds = `(${length} = 10 AND ${column} >= ${bind(String(Math.floor(cutoff / 1000)))} AND ${column} <= ${bind(String(Math.ceil(now.getTime() / 1000)))})`
  const dates = `(${length} NOT IN (10, 13) AND ${column} >= ${bind(new Date(cutoff - DAY_MS).toISOString().slice(0, 10))})`
  return { where: ` WHERE ${milliseconds} OR ${seconds} OR ${dates}`, values }
}

export async function readDeliveryOverview(
  currency: string | undefined,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
  now: Date = new Date(),
): Promise<DeliveryOverviewResult> {
  const recent = recentRoutes(dialect, now)
  const status = asText('status', dialect)
  const [methods, topZones, activeZones, routes, couriers] = await Promise.all([
    run.unsafe(`SELECT * FROM shipping_methods ${activeFirst(dialect)} LIMIT 5`).execute(),
    run.unsafe(`SELECT * FROM shipping_zones ${activeFirst(dialect)} LIMIT 5`).execute(),
    // Every active zone, for the count and its country assignments.
    run.unsafe(`SELECT * FROM shipping_zones WHERE ${status} = 'active'`).execute(),
    run.unsafe(`SELECT * FROM delivery_routes${recent.where}`, recent.values).execute(),
    run.unsafe(`SELECT ${status} AS value, COUNT(*) AS item_count FROM couriers GROUP BY ${status}`).execute(),
  ])

  const routeRows = sqlRows(routes)
  const courierIds = referencedIds(routeRows, 'courier_id')
  const linked = courierIds.length > 0
    ? sqlRows(await run.unsafe(`SELECT * FROM couriers WHERE id IN (${idPlaceholders(courierIds, dialect)})`, courierIds).execute())
    : []

  const byStatus = new Map(sqlRows(couriers).map(row => [String(row.value ?? ''), countOf(row.item_count)]))
  const courierCounts = {
    total: [...byStatus.values()].reduce((sum, count) => sum + count, 0),
    active: byStatus.get('active') ?? 0,
    onDelivery: byStatus.get('on_delivery') ?? 0,
    onBreak: byStatus.get('on_break') ?? 0,
  }

  const zones = new Map<string, Record<string, unknown>>()
  for (const zone of [...sqlRows(topZones), ...sqlRows(activeZones)])
    zones.set(String(zone.id), zone)

  return buildDeliveryOverview(sqlRows(methods), routeRows, [...zones.values()], linked, currency, now, courierCounts)
}
