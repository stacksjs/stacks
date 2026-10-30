interface UniqueViolation { code?: string, errno?: number, message?: string }

/**
 * True when the error is a unique-constraint violation, across SQLite,
 * MySQL, and Postgres:
 *
 * - SQLite: `SQLITE_CONSTRAINT_UNIQUE` / `SQLITE_CONSTRAINT`
 * - MySQL: `errno: 1062` (ER_DUP_ENTRY)
 * - Postgres: `code: '23505'` (unique_violation)
 * - Generic fallback: message text match — covers wrapped errors from drivers
 *   that lose the structured code.
 *
 * Lives here, in a package everything already depends on, because every
 * write path that inserts behind a unique index needs it: the ORM's auto-CRUD
 * routes and commerce writes (through `@stacksjs/orm`, which re-exports it),
 * auth's `register()`, and the queue's idempotency and circuit-breaker tables.
 * The queue had its own check that matched SQLite's and MySQL's wording only,
 * so on Postgres a duplicate `dispatchOnce()` key threw instead of skipping.
 *
 * Exported for direct unit testing and for callers that map duplicates to
 * their own error (e.g. `register()`'s 409) instead of swallowing them.
 */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as UniqueViolation
  return e?.code === 'SQLITE_CONSTRAINT_UNIQUE'
    || e?.code === 'SQLITE_CONSTRAINT'
    || e?.code === '23505'
    || e?.errno === 1062
    || /unique|duplicate/i.test(e?.message ?? '')
}

/**
 * True when the error is a NOT NULL violation, across SQLite, MySQL and Postgres:
 *
 * - SQLite: `SQLITE_CONSTRAINT_NOTNULL`, or "NOT NULL constraint failed"
 * - MySQL: `errno: 1048` (ER_BAD_NULL_ERROR) and `1364` (ER_NO_DEFAULT_FOR_FIELD)
 * - Postgres: `code: '23502'` (not_null_violation)
 *
 * A required column that a request left out is the caller's mistake, not a
 * server fault, so write paths answer it with a 422 instead of a 500.
 */
export function isNotNullViolation(err: unknown): boolean {
  const e = err as UniqueViolation
  return e?.code === 'SQLITE_CONSTRAINT_NOTNULL'
    || e?.code === '23502'
    || e?.errno === 1048
    || e?.errno === 1364
    || /not null constraint failed|cannot be null|null value in column|doesn't have a default value/i.test(e?.message ?? '')
}
