interface UniqueViolation { code?: string, errno?: number | string, message?: string }

/**
 * Whether a driver error carries this Postgres SQLSTATE.
 *
 * node-postgres puts it in `code`. Bun's own client puts
 * `ERR_POSTGRES_SERVER_ERROR` there and the SQLSTATE in `errno`, as a string,
 * so a check on `code` alone only ever matched through the message text, and
 * the server writes that in whatever language `lc_messages` names.
 */
function hasSqlState(e: UniqueViolation | undefined, state: string): boolean {
  return e?.code === state || e?.errno === state
}

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
    || hasSqlState(e, '23505')
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
    || hasSqlState(e, '23502')
    || e?.errno === 1048
    || e?.errno === 1364
    || /not null constraint failed|cannot be null|null value in column|doesn't have a default value/i.test(e?.message ?? '')
}

/**
 * True when the database refused a write to keep a foreign key intact, across
 * SQLite, MySQL and Postgres:
 *
 * - SQLite: `SQLITE_CONSTRAINT_FOREIGNKEY`, or "FOREIGN KEY constraint failed"
 * - MySQL: `errno: 1451` / `1217` (a parent row something still points at) and
 *   `1452` / `1216` (a child naming a parent that is not there)
 * - Postgres: `code: '23503'` (foreign_key_violation) and `'23001'`
 *   (restrict_violation)
 *
 * Deleting a row other rows still point at is the case that matters to a
 * caller: the row is fine and the request was understood, so it is a 409 the
 * person can act on, not the 500 a generic catch turns it into.
 *
 * Checked by its own codes before the message, because SQLite reports a
 * foreign key failure under the same `SQLITE_CONSTRAINT` family
 * `isUniqueViolation` accepts as a whole.
 */
export function isForeignKeyViolation(err: unknown): boolean {
  const e = err as UniqueViolation
  return e?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY'
    || hasSqlState(e, '23503')
    || hasSqlState(e, '23001')
    || e?.errno === 1451
    || e?.errno === 1452
    || e?.errno === 1216
    || e?.errno === 1217
    || /foreign key constraint/i.test(e?.message ?? '')
}
