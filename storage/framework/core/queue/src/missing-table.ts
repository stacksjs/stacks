/**
 * Recognise "this table has not been migrated yet" across every SQL dialect.
 *
 * The queue's optional tables (job_quarantine, dead-letter, idempotency,
 * circuit-breaker state) are created by migrations a project may not have run.
 * Every consumer treats a missing table as "the feature is inert" and carries
 * on; anything else is rethrown.
 *
 * That degradation only worked on SQLite and MySQL. Four byte-identical copies
 * of this predicate matched `no such table` and `doesn't exist`, and Postgres
 * says `relation "job_quarantine" does not exist` (SQLSTATE 42P01). "does not
 * exist" is not "doesn't exist", so on Postgres the predicate returned false,
 * the error was rethrown, and because `Job.dispatch()` calls `isQuarantined()`
 * unconditionally, EVERY dispatch threw. It stayed invisible because the same
 * path degrades correctly on SQLite, which is what the shipped migrations
 * target.
 *
 * Matching on SQLSTATE first because it is stable across server versions and
 * locales; the message checks are the fallback for drivers that do not surface
 * a code.
 */

/** Postgres invalid_table / undefined_table. */
const PG_UNDEFINED_TABLE = '42P01'

/** MySQL ER_NO_SUCH_TABLE. */
const MYSQL_NO_SUCH_TABLE = 1146

export function isMissingTableError(err: unknown): boolean {
  const e = err as { message?: string, errno?: unknown, code?: unknown } | null

  const errno = e?.errno
  if (typeof errno === 'string' && errno.toUpperCase() === PG_UNDEFINED_TABLE)
    return true
  if (typeof errno === 'number' && errno === MYSQL_NO_SUCH_TABLE)
    return true

  const code = typeof e?.code === 'string' ? e.code.toUpperCase() : ''
  if (code === PG_UNDEFINED_TABLE)
    return true

  const msg = e?.message ?? ''

  return msg.includes('no such table') // SQLite
    || msg.includes('doesn\'t exist') // MySQL / MariaDB
    || msg.includes('does not exist') // Postgres, SingleStore
}
