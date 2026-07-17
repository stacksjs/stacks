/**
 * Typed helpers for the aggregate-stats queries the commerce package uses
 * heavily. Built on `aggregateFunctions` (`db.fn`), which render plain
 * SQL fragments the select pipeline consumes directly - no expression-
 * builder callback needed, so the result keeps full type safety for
 * column names, bindings, and result shapes.
 */

import { aggregateFunctions, db } from '@stacksjs/database'
import type { AggregateExpression } from '@stacksjs/database'

/**
 * Stats descriptors map: each key is the result-row alias; each value is
 * a `{ kind, column, where? }` triple describing the aggregate to emit.
 */
export type StatsDescriptor =
  | { kind: 'count', column?: string, filter?: { column: string, op: string, value: unknown } }
  | { kind: 'sum', column: string, filter?: { column: string, op: string, value: unknown } }
  | { kind: 'avg', column: string, filter?: { column: string, op: string, value: unknown } }
  | { kind: 'min', column: string, filter?: { column: string, op: string, value: unknown } }
  | { kind: 'max', column: string, filter?: { column: string, op: string, value: unknown } }

/**
 * Run a typed aggregate query against a table.
 *
 * @example
 * ```ts
 * const stats = await aggregateStats('receipts', {
 *   total: { kind: 'count' },
 *   success: { kind: 'count', filter: { column: 'status', op: '=', value: 'success' } },
 *   averageSize: { kind: 'avg', column: 'size' },
 * }, qb => qb.where('timestamp', '>=', start).where('timestamp', '<=', end))
 * // typeof stats: { total: number; success: number; averageSize: number }
 * ```
 */
export async function aggregateStats<TKeys extends string>(
  table: string,
  descriptors: Record<TKeys, StatsDescriptor>,
  applyWhere?: (qb: any) => any,
): Promise<Record<TKeys, number>> {
  let query: any = (db as any).selectFrom(table)
  if (applyWhere) query = applyWhere(query)

  query = query.select((Object.entries(descriptors) as [TKeys, StatsDescriptor][]).map(([alias, d]) => {
    const col = (d as { column?: string }).column ?? 'id'
    let expr: AggregateExpression = aggregateFunctions[d.kind](col)
    if (d.filter)
      expr = expr.filterWhere(d.filter.column, d.filter.op, d.filter.value)
    return expr.as(alias)
  }))

  const row = await query.executeTakeFirst()
  const out = {} as Record<TKeys, number>
  for (const alias of Object.keys(descriptors) as TKeys[]) {
    const v = row?.[alias]
    out[alias] = typeof v === 'number' ? v : Number(v ?? 0) || 0
  }
  return out
}
