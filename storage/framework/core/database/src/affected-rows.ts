/**
 * How many rows a write statement affected, whichever driver ran it.
 *
 * Every entry point spells this differently, and the spellings are not
 * interchangeable. Measured through Stacks' own `db` against SQLite,
 * PostgreSQL 16 and MySQL 8.4 on Bun 1.4:
 *
 * | entry point                        | SQLite           | PostgreSQL                    | MySQL                          |
 * | ---------------------------------- | ---------------- | ----------------------------- | ------------------------------ |
 * | `db.unsafe` / `trx.unsafe` write   | `{ changes: N }` | `{ count: N, affectedRows: null }` | `{ count: 0, affectedRows: N }` |
 * | fluent `.execute()`                | `N`              | `N`                           | `N`                            |
 * | fluent `.executeTakeFirst()`       | `{ numUpdatedRows: N }` or `{ numDeletedRows: N }`, on all three |
 *
 * Two traps follow from that table, and each has shipped:
 *
 * - `rowCount` is node-postgres's name. Bun's PostgreSQL client never sets it,
 *   so `result.changes ?? result.rowCount` reads 0 on PostgreSQL AND MySQL.
 * - On MySQL `count` is always 0 for a write. Reading `count` before
 *   `affectedRows` returns 0 there, so the order below is load-bearing, and
 *   `affectedRows` is skipped only when it is `null` (PostgreSQL), never when it
 *   is `0`.
 *
 * One difference no field can hide: MySQL counts rows a statement CHANGED,
 * PostgreSQL and SQLite count rows it MATCHED. An UPDATE that writes a value a
 * row already holds reports 0 on MySQL. Do not use this count to decide whether
 * a row exists after an UPDATE; check existence directly.
 *
 * The count is also lost if a raw `unsafe` result is returned OUT of
 * `db.transaction(...)` on PostgreSQL or MySQL: the transaction resolves to a
 * plain array with none of these fields. Read it inside the callback.
 *
 * Formerly `commerce/src/utils/mutation-count.ts`, where it only served commerce.
 */
export function mutationCount(result: unknown): number {
  if (typeof result === 'number')
    return Number.isFinite(result) ? result : 0
  if (typeof result === 'bigint')
    return Number(result)
  if (!result || typeof result !== 'object')
    return 0

  const record = result as Record<string, unknown>
  for (const key of ['changes', 'affectedRows', 'count', 'numAffectedRows', 'numDeletedRows', 'numInsertedOrUpdatedRows', 'numUpdatedRows']) {
    if (record[key] !== undefined && record[key] !== null)
      return mutationCount(record[key])
  }
  if (Array.isArray(result))
    return result.reduce((total, item) => total + mutationCount(item), 0)
  return 0
}
