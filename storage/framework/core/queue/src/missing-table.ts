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

/**
 * The error a dispatch throws when the queue's own table is not there.
 *
 * A database's "relation \"jobs\" does not exist" is true and useless: it
 * names a table nobody remembers creating, from inside a dispatch whose caller
 * often swallows it on purpose (a password reset must answer the same whether
 * or not the mail went). So the log line is the only place the cause is ever
 * read, and it has to carry the fix. In production the database queue is the
 * default, which is how an app that never asked for a queue comes to need one.
 */
export function missingJobsTableError(jobName: string, cause: unknown): Error {
  return new Error(
    `[queue] ${jobName} was not queued: the "jobs" table does not exist. `
    + 'Jobs are queued to the database (the default in production), and this app has not created the queue\'s tables. '
    + 'Run `buddy queue:table`, add it after `migrate` in the deploy\'s preStart, '
    + 'and declare a worker for the site (`queues` in config/cloud.ts): a queued job with no worker never runs.',
    { cause },
  )
}
