/**
 * Typed helpers for the aggregate-stats queries the commerce package uses
 * heavily. The bun-query-builder `eb` expression-builder callback is
 * effectively `any` from the consumer side (its return type is the
 * builder's internal `SelectExpressionList`, not exported), so without a
 * thin wrapper every call site has to `as any` both the callback param
 * and the awaited result. That dropped *all* type safety for column
 * names, bindings, and result shapes — fields like `averageSize` could
 * be renamed in one place and silently break another.
 *
 * These helpers give us a typed result shape (caller declares the keys)
 * and a single localized `as any` at the bun-query-builder boundary.
 */

import { db } from '@stacksjs/database'

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

  query = query.select((eb: any) => Object.entries(descriptors).map(([alias, d]) => {
    const col = (d as { column?: string }).column ?? 'id'
    let expr = eb.fn[(d as StatsDescriptor).kind](col)
    if ((d as { filter?: unknown }).filter) {
      const f = (d as StatsDescriptor & { filter: NonNullable<StatsDescriptor['filter']> }).filter
      expr = expr.filterWhere(f.column, f.op, f.value)
    }
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
