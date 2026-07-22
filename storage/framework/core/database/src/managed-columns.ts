/**
 * Schema-diff guards for framework-managed columns (stacksjs/stacks#2075).
 *
 * Some columns are added at runtime by the framework's guarantee-ALTERs
 * (`ensureUsersAuthColumns` for `users.two_factor_*` / `email_verified_at` /
 * `password_changed_at` / `stripe_id`, `ensureUuidColumns` for `uuid` on every
 * `useUuid` table) rather than declared in a model's `attributes`. The
 * model-first schema differ (bun-query-builder) builds each table's expected
 * column set from `attributes` only, so those columns look like "in the DB but
 * not in the model" and get proposed for dropping on EVERY `buddy migrate` —
 * including the exact auth/billing columns the login (`getTwoFactorState`) and
 * checkout flows read. That never converges to "nothing to migrate", and one
 * careless `y` silently drops the columns and breaks auth.
 *
 * These helpers recognize framework-managed columns and drop the offending
 * `drop_column` operations (and their generated SQL) from the destructive side
 * of the diff, so the differ stops fighting the guarantee-ALTERs. Nothing else
 * about the diff changes; adds, renames, and non-managed drops are untouched.
 */

import type { MigrationOperation } from '@stacksjs/query-builder'

/**
 * The `users` columns the framework guarantees via `ensureUsersAuthColumns`'s
 * defensive ALTERs (auth-tables.ts) — created OUTSIDE any model's `attributes`.
 * Kept here (a dependency-light module) so the differ guard doesn't drag in the
 * ORM/query-builder graph. Keep in sync with `ensureUsersAuthColumns`.
 */
export const USERS_GUARANTEED_COLUMNS: readonly string[] = [
  'email_verified_at',
  'password_changed_at',
  'two_factor_secret',
  'two_factor_enabled',
  'two_factor_last_used_step',
  'stripe_id',
]

/** A minimal view of a migration operation — all these helpers need. */
type ColumnOp = Pick<MigrationOperation, 'kind' | 'table' | 'column'>

/**
 * Resolve `table -> protected column names`: the `users` auth/billing columns
 * plus `uuid` on every table backing a `useUuid` model. `findUuidTables` is
 * lazy-imported so this module stays free of the model-walking ORM graph until
 * actually resolving. Best-effort on the uuid side — if that walk fails we still
 * guard the hardcoded `users` columns rather than losing the protection.
 */
export async function frameworkManagedColumns(): Promise<Map<string, Set<string>>> {
  const managed = new Map<string, Set<string>>()
  managed.set('users', new Set(USERS_GUARANTEED_COLUMNS))

  try {
    const { findUuidTables } = await import('./uuid-columns')
    for (const table of await findUuidTables()) {
      const columns = managed.get(table) ?? new Set<string>()
      columns.add('uuid')
      managed.set(table, columns)
    }
  }
  catch {
    // Model-file resolution failed; keep the users guard rather than none.
  }

  return managed
}

/** True when `op` would drop a column the framework guarantees at runtime. */
export function isManagedColumnDrop(op: ColumnOp, managed: Map<string, Set<string>>): boolean {
  return op.kind === 'drop_column' && op.column != null && (managed.get(op.table)?.has(op.column) ?? false)
}

/** Return `operations` without any drop of a framework-managed column. */
export function withoutManagedColumnDrops<T extends ColumnOp>(operations: T[], managed: Map<string, Set<string>>): T[] {
  return operations.filter(op => !isManagedColumnDrop(op, managed))
}

function normalizeSql(sql: string): string {
  return sql.trim().replace(/\s+/g, ' ').replace(/;+\s*$/, '')
}

// `ALTER TABLE <t> DROP COLUMN [IF EXISTS] <c>` for postgres / mysql / sqlite>=3.35.
const DROP_COLUMN_RE = /ALTER\s+TABLE\s+["'`]?(\w+)["'`]?\s+DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?["'`]?(\w+)["'`]?/i

/**
 * Remove generated SQL statements that drop a framework-managed column, so the
 * drop is never written to a migration file. Catches both the direct
 * `ALTER TABLE ... DROP COLUMN` form and, by matching the structured
 * operations' own `sql`, the SQLite table-rebuild form (which drops a column by
 * recreating the table without it). Pass `operations` when available for the
 * rebuild case; the regex alone still covers the common direct form.
 */
export function withoutManagedColumnDropSql(
  statements: string[],
  managed: Map<string, Set<string>>,
  operations: MigrationOperation[] = [],
): { statements: string[], removed: string[] } {
  const protectedSql = new Set(
    operations.filter(op => isManagedColumnDrop(op, managed)).map(op => normalizeSql(op.sql)),
  )
  const removed: string[] = []

  const kept = statements.filter((statement) => {
    if (protectedSql.has(normalizeSql(statement))) {
      removed.push(statement)
      return false
    }
    const match = statement.match(DROP_COLUMN_RE)
    if (match?.[1] && match[2] && (managed.get(match[1])?.has(match[2]) ?? false)) {
      removed.push(statement)
      return false
    }
    return true
  })

  return { statements: kept, removed }
}
