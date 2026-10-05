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
