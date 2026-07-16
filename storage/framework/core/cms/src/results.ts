/**
 * Helpers for reading write results across drivers.
 *
 * The SQLite driver ignores RETURNING and resolves to
 * `{ changes, lastInsertRowid }`, while drivers such as Postgres return the
 * affected row(s). These normalize both shapes.
 */

interface WriteResult {
  changes?: number
  lastInsertRowid?: number | bigint
  numDeletedRows?: number | bigint | WriteResult
  numUpdatedRows?: number | bigint | WriteResult
}

/**
 * True when the driver honoured RETURNING and gave back an actual row.
 */
export function isRow<T extends object>(value: unknown): value is T {
  return !!value
    && typeof value === 'object'
    && 'id' in (value as Record<string, unknown>)
}

/**
 * The id of a freshly inserted row, or undefined if the driver reported none.
 */
export function insertedId(result: unknown): number | undefined {
  if (isRow<{ id: unknown }>(result) && typeof result.id === 'number')
    return result.id

  const rowid = (result as WriteResult | undefined)?.lastInsertRowid

  if (rowid === undefined || rowid === null)
    return undefined

  const id = Number(rowid)

  return Number.isSafeInteger(id) && id > 0 ? id : undefined
}

/**
 * The row a write actually produced.
 *
 * Returns the driver's RETURNING row when there is one, otherwise re-selects
 * the row by the id it reported.
 */
export async function resolveWrittenRow<T extends object>(
  db: { selectFrom: (table: string) => any },
  table: string,
  result: unknown,
): Promise<T | undefined> {
  if (isRow<T>(result))
    return result

  const id = insertedId(result)

  if (id === undefined)
    return undefined

  return await db
    .selectFrom(table)
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst() as T | undefined
}

/**
 * The number of rows affected by a delete/update.
 *
 * The count arrives as a bare number on some drivers and nested under
 * `{ changes }` on SQLite.
 */
export function affectedRows(result: unknown, key: 'numDeletedRows' | 'numUpdatedRows'): number {
  const raw = (result as WriteResult | undefined)?.[key] ?? (result as WriteResult | undefined)?.changes

  if (typeof raw === 'number' || typeof raw === 'bigint')
    return Number(raw)

  const changes = (raw as WriteResult | undefined)?.changes

  return typeof changes === 'number' || typeof changes === 'bigint' ? Number(changes) : 0
}
