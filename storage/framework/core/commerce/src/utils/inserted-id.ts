/**
 * The id of the row an INSERT just created, or `undefined` when the driver did
 * not report one.
 *
 * Every driver spells it differently, and one of them does not answer at all:
 * SQLite reports `lastInsertRowid`, MySQL reports `insertId`, and Postgres
 * reports neither without a `RETURNING` clause. A caller that only reads one
 * spelling silently loses the row it just wrote on every other dialect.
 *
 * **Row counts are deliberately not consulted.** `numInsertedOrUpdatedRows` and
 * its siblings say how MANY rows changed, not WHICH one. Reading a count as an
 * id is worse than reading nothing: a successful single-row insert reports `1`,
 * so the caller fetches id 1 and returns the FIRST row of the table as though
 * it were the new one. Use {@link mutationCount} when the count is what you
 * want.
 *
 * @param result Whatever `executeTakeFirst()` resolved to.
 * @returns A positive integer id, or `undefined` when the driver reported none.
 */
export function insertedId(result: unknown): number | undefined {
  if (typeof result === 'bigint')
    return normalize(result)
  if (typeof result === 'number')
    return normalize(result)
  if (!result || typeof result !== 'object')
    return undefined

  // Some drivers answer with an array of result objects rather than one.
  if (Array.isArray(result)) {
    for (const item of result) {
      const found = insertedId(item)
      if (found !== undefined)
        return found
    }
    return undefined
  }

  const record = result as Record<string, unknown>
  for (const key of ['lastInsertRowid', 'insertId', 'lastInsertId']) {
    const value = record[key]
    if (value === undefined || value === null)
      continue
    const id = normalize(value)
    if (id !== undefined)
      return id
  }

  return undefined
}

function normalize(value: unknown): number | undefined {
  const id = typeof value === 'bigint' ? Number(value) : Number(value)
  // A driver that reports `0` is saying "no row", not "row zero".
  if (!Number.isSafeInteger(id) || id <= 0)
    return undefined
  return id
}
