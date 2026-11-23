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

/**
 * The suppression list is a best-effort compliance safeguard, not a hard
 * dependency of sending. When its backing store is simply unavailable — the
 * DB connection dropped, the file can't be opened, no database is configured —
 * we must NOT let that take down every outbound email. Treat those the same
 * way as a missing table: warn once, then proceed (fail-open).
 */
export function isSuppressionStoreUnavailable(err: unknown): boolean {
  if (isMissingTableError(err) || isMissingDatabaseError(err))
    return true
  const msg = ((err as { message?: string } | null)?.message ?? '').toLowerCase()
  return msg.includes('connection closed')
    || msg.includes('unable to open database')
    || msg.includes('econnrefused')
    || msg.includes('connection terminated')
    || msg.includes('no database')
    || msg.includes('database connection')
}

/**
 * Does this error mean the configured database itself does not exist?
 *
 * The Postgres and MySQL form of SQLite's "unable to open database": the
 * server answers, but the database the app names was never created. Scoped to
 * the database, so `column "x" does not exist` is not mistaken for it.
 */
export function isMissingDatabaseError(err: unknown): boolean {
  const e = err as { message?: string, code?: unknown, errno?: unknown } | null
  const msg = e?.message ?? ''
  return e?.code === '3D000' || e?.errno === '3D000' // postgres SQLSTATE: invalid_catalog_name
    || e?.errno === 1049 // mysql ER_BAD_DB_ERROR
    || /database "[^"]*" does not exist/i.test(msg) // postgres wording
    || /unknown database/i.test(msg) // mysql wording
}
