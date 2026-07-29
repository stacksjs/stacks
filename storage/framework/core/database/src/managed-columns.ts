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
 * The same shape covers a second, larger source of phantom drops: foreign key
 * columns a model gets from `belongsTo` rather than from `attributes` (see
 * `relation-columns.ts`). `Farm.belongsTo: ['User']` puts `farms.user_id` on
 * the table without declaring it, so the differ proposes dropping it on every
 * run — the column that decides who owns the row.
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

/**
 * A minimal view of a migration operation — all these helpers need.
 *
 * `sql` is optional because the pairing check below degrades to a no-op
 * without it, and several callers only have the classified operation.
 */
type ColumnOp = Pick<MigrationOperation, 'kind' | 'table' | 'column'> & { sql?: string }

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

  const add = (table: string, column: string): void => {
    const columns = managed.get(table) ?? new Set<string>()
    columns.add(column)
    managed.set(table, columns)
  }

  try {
    const { findUuidTables } = await import('./uuid-columns')
    for (const table of await findUuidTables())
      add(table, 'uuid')
  }
  catch {
    // Model-file resolution failed; keep the users guard rather than none.
  }

  try {
    const { findRelationForeignKeys } = await import('./relation-columns')
    for (const [table, columns] of await findRelationForeignKeys()) {
      for (const column of columns)
        add(table, column)
    }
  }
  catch {
    // Same tolerance: partial protection beats none.
  }

  return managed
}

/** True when `op` would drop a column the framework guarantees at runtime. */
export function isManagedColumnDrop(op: ColumnOp, managed: Map<string, Set<string>>): boolean {
  return op.kind === 'drop_column' && op.column != null && (managed.get(op.table)?.has(op.column) ?? false)
}

/**
 * Return `operations` without any drop of a framework-managed column, and
 * without the operation that would have carried it out.
 *
 * SQLite has no `DROP COLUMN` before 3.35, so the differ drops one by
 * rebuilding the table without it — and emits that single rebuild statement as
 * TWO operations: a `drop_column` naming the casualty, and a `rebuild_table`
 * whose `sql` is the very same statement. Filtering only the `drop_column`
 * left the rebuild in the list, which is the worst of both: the confirmation
 * gate still warns on every run, and answering yes still drops the column the
 * guard exists to protect.
 *
 * So a rebuild that IS a suppressed drop goes with it. That can cost an
 * unrelated constraint change riding along in the same rebuild, which is the
 * right trade: a skipped constraint tweak is visible and repeatable, a
 * silently dropped ownership column is neither. `withoutManagedColumnDropSql`
 * has always removed this statement from the generated migration — this is the
 * preview finally agreeing with what actually runs.
 */
export function withoutManagedColumnDrops<T extends ColumnOp>(operations: T[], managed: Map<string, Set<string>>): T[] {
  const suppressed = new Set(
    operations
      .filter(op => isManagedColumnDrop(op, managed))
      .map(op => (op.sql ? normalizeSql(op.sql) : ''))
      .filter(sql => sql.length > 0),
  )

  return operations.filter((op) => {
    if (isManagedColumnDrop(op, managed))
      return false
    // Only the statement that performs a suppressed drop, never a rebuild
    // that merely touches the same table for its own reasons.
    return !(op.sql && suppressed.has(normalizeSql(op.sql)))
  })
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
