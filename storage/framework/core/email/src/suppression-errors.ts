/**
 * What a database's error means to the suppression list, on every dialect.
 *
 * Kept apart from `suppression.ts` so these can be read, and tested, without
 * a database behind them: they decide whether a send proceeds, and each one
 * was wrong on Postgres once.
 */

/**
 * Does this error mean the backing table simply hasn't been migrated yet?
 * Exported for direct unit coverage across dialects.
 *
 * Each supported database phrases "missing table" differently, and the
 * suppression layer is fail-open — so a matcher that only knows sqlite/mysql
 * would let Postgres's wording slip through and hard-fail every send on an
 * un-migrated Postgres DB (stacksjs/stacks#1976). We scope the Postgres check
 * to `undefined_table` specifically (SQLSTATE 42P01 / `relation "..." does not
 * exist`) rather than a bare `does not exist`, so a genuine `column ... does
 * not exist` schema bug still surfaces instead of being silently swallowed.
 */
export function isMissingTableError(err: unknown): boolean {
  const e = err as { message?: string, code?: string } | null
  const msg = e?.message ?? ''
  return e?.code === '42P01' // postgres SQLSTATE: undefined_table
    || msg.includes('no such table') // sqlite
    || msg.includes("doesn't exist") // mysql: Table '...' doesn't exist
    || /relation "[^"]*" does not exist/i.test(msg) // postgres wording
}

/**
 * Does this error mean the (email, type) pair is already on the list?
 * Exported for direct unit coverage across dialects.
 *
 * Suppressing is idempotent, and each database says "already there" in its
 * own words. Matching only SQLite's and MySQL's made a second bounce for the
 * same address throw on Postgres (`duplicate key value violates unique
 * constraint`, SQLSTATE 23505), out of a webhook handler that had every
 * reason to expect a no-op.
 */
export function isDuplicateSuppressionError(err: unknown): boolean {
  const e = err as { message?: string, code?: unknown, errno?: unknown } | null
  const msg = e?.message ?? ''
  return e?.code === '23505' // postgres SQLSTATE: unique_violation
    || e?.errno === 1062 // mysql ER_DUP_ENTRY
    || msg.includes('UNIQUE constraint') // sqlite
    || msg.includes('Duplicate entry') // mysql
    || msg.includes('duplicate key value violates unique constraint') // postgres wording
}
