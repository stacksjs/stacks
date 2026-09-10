import { afterEach, beforeEach } from 'bun:test'
import { config } from '@stacksjs/config'
import {
  copyModelFiles,
  db,
  deleteFrameworkModels,
  dropSqliteTables,
  fetchSqliteFile,
  fetchTables,
  migrateAuthTables,
  migrateNotificationTables,
  migrateRbacTables,
  migrateTraitTables,
  ensureUtcDatetimeColumns,
  ensureUtcTimestampDefaults,
  runDatabaseMigration,
} from '@stacksjs/database'
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'

/**
 * Resolve the driver at call time off the live `config` proxy.
 *
 * The previous module-level `const driver = database.default || ''`
 * snapshot raced the async config-override loader: `import { database }`
 * is reassigned only when `overridesReady` resolves, so a helper module
 * that evaluates early froze whatever driver happened to be merged at
 * import time. Reading the proxy per call always reflects the merged
 * (and any test-pinned) value.
 */
function currentDriver(): string {
  return config.database?.default || ''
}

// Snapshot path used by the fast SQLite reset path. Initialized lazily
// the first time `refreshDatabase()` runs so test suites that never
// call setup() don't pay any cost. We deliberately co-locate it next
// to the live SQLite file (same directory) so `dropSqliteTables` can't
// accidentally pick it up via a `.sqlite` glob — `.snapshot` extension
// keeps it inert.
let snapshotPath: string | null = null

function getSnapshotPath(): string {
  if (snapshotPath) return snapshotPath
  snapshotPath = `${fetchSqliteFile()}.snapshot`
  return snapshotPath
}

/**
 * Auth/oauth, notification, RBAC, and polymorphic-trait tables live outside the generated
 * model migrations — `buddy migrate` guarantees them as a separate step
 * after `runDatabaseMigration()` (stacksjs/stacks#1948). Test databases
 * need the identical guarantee, or feature tests hit "no such table:
 * oauth_access_tokens" / "no such column: email_verified_at" against a
 * freshly migrated schema. All four migrators are CREATE TABLE IF NOT
 * EXISTS plus defensive ALTERs, so reruns are no-ops. Failures surface
 * on stderr but don't throw — matching `buddy migrate` semantics, so
 * tests that never touch these tables aren't broken by one failed
 * guarantee.
 */
async function migrateFrameworkTables(): Promise<void> {
  const steps = [
    ['auth', migrateAuthTables],
    ['notification', migrateNotificationTables],
    ['RBAC', migrateRbacTables],
    ['trait', migrateTraitTables],
    ['utc-datetime', ensureUtcDatetimeColumns],
    ['utc-defaults', ensureUtcTimestampDefaults],
  ] as const

  for (const [name, migrateTables] of steps) {
    try {
      const result = await migrateTables()
      if (!result.success)
        console.error(`[testing] Failed to migrate ${name} tables: ${result.error}`)
    }
    catch (error) {
      console.error(`[testing] Failed to migrate ${name} tables:`, error)
    }
  }
}

export async function setupDatabase(): Promise<void> {
  const dbName = `${config.database?.connections?.mysql?.name ?? 'stacks'}_testing`

  if (currentDriver() === 'mysql') {
    await db.unsafe(`CREATE DATABASE IF NOT EXISTS ${dbName}`).execute()
    await runDatabaseMigration()
    await migrateFrameworkTables()
  }
}

export async function refreshDatabase(): Promise<void> {
  await setupDatabase()

  const driver = currentDriver()
  if (driver === 'mysql')
    await truncateMysql()
  if (driver === 'sqlite')
    await truncateSqliteFast()
}

export async function truncateMysql(): Promise<void> {
  const tables = await fetchTables()

  // MySQL refuses TRUNCATE on tables referenced by other tables' foreign
  // keys, so a child→parent table sequence used to fail with a
  // "cannot truncate" error and leave half the schema seeded with stale
  // rows. Disabling FK checks for the duration of the truncate is the
  // standard test-fixture pattern.
  await db.unsafe('SET FOREIGN_KEY_CHECKS = 0').execute()
  try {
    for (const table of tables) {
      await db.unsafe(`TRUNCATE TABLE ${table}`).execute()
    }
  }
  finally {
    await db.unsafe('SET FOREIGN_KEY_CHECKS = 1').execute()
  }
}

export async function truncateSqlite(): Promise<void> {
  const sqlitePath = fetchSqliteFile()

  if (!fs.existsSync(sqlitePath))
    await Bun.$`touch ${sqlitePath}`

  await dropSqliteTables()
  await deleteFrameworkModels()

  const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/app/Models/**/*.ts')], { absolute: true })

  for (const file of modelFiles) {
    await copyModelFiles(file)
  }

  await runDatabaseMigration()
  // Runs before `truncateSqliteFast()` snapshots the schema, so the
  // fast-restore path keeps the framework tables too.
  await migrateFrameworkTables()
}

/**
 * Snapshot-based SQLite reset. The very first call falls through to the
 * legacy `truncateSqlite()` path (drop, recopy models, migrate) AND
 * captures the resulting empty-but-migrated DB to a `.snapshot` file.
 * Every subsequent call just copies that snapshot back over the live
 * file — orders of magnitude faster than running migrations end to end
 * for each test, and dramatically cheaper than the per-test model file
 * recopy.
 *
 * The snapshot is invalidated automatically when:
 *   - any model file is newer than the snapshot
 *   - any migration file is newer than the snapshot
 *
 * — re-capturing in those cases keeps schema changes correct without
 * the user remembering to clear it.
 */
export async function truncateSqliteFast(): Promise<void> {
  const sqlitePath = fetchSqliteFile()
  const snapPath = getSnapshotPath()

  const snapshotIsStale = (() => {
    if (!fs.existsSync(snapPath)) return true
    const snapMtime = fs.statSync(snapPath).mtimeMs
    const watched = globSync(
      [
        path.userModelsPath('*.ts'),
        path.storagePath('framework/defaults/app/Models/**/*.ts'),
        path.userMigrationsPath('*.ts'),
      ],
      { absolute: true },
    )
    for (const f of watched) {
      try {
        if (fs.statSync(f).mtimeMs > snapMtime) return true
      }
      catch { /* file vanished — ignore */ }
    }
    return false
  })()

  if (snapshotIsStale) {
    // Slow path — same as before, then capture.
    await truncateSqlite()
    try {
      // In WAL mode the freshly migrated schema may still live in the
      // `-wal` sidecar; `copyFileSync` only copies the main DB file, so
      // an un-checkpointed snapshot captures an empty/partial schema
      // that poisons every fast-path restore. Checkpoint first so the
      // main file is complete.
      await db.unsafe('PRAGMA wal_checkpoint(TRUNCATE)').execute()
      fs.copyFileSync(sqlitePath, snapPath)
    }
    catch {
      // If we can't write the snapshot (permissions, full disk, etc.)
      // just continue — the slow path still produced a usable DB.
    }
    return
  }

  // Fast path — restore from snapshot. Copy is single-syscall on every
  // supported OS, so the cost is dominated by the disk size of the empty
  // schema (single-digit ms in practice).
  fs.copyFileSync(snapPath, sqlitePath)
}

/**
 * Wrap each test in a database transaction that rolls back on completion.
 *
 * The fastest possible test isolation: instead of dropping/recopying
 * the schema between tests, every test runs inside `BEGIN; … ROLLBACK;`
 * so the row state at the end of one test is invisible to the next
 * (and to the `--fresh` snapshot path entirely).
 *
 * Caveats — read these before reaching for this helper:
 *   1. Code under test that issues its own `BEGIN`/`COMMIT` will commit
 *      against the outer transaction and the rollback won't undo it
 *      (Postgres doesn't support nested transactions natively).
 *   2. Multi-statement tests that test "commit visibility across
 *      connections" need the slower `refreshDatabase()` path because
 *      the rolled-back transaction never reached the disk.
 *   3. SQLite WAL mode is required for concurrent connections to see
 *      each other within the same DB file; the framework configures
 *      this by default.
 *
 * Use as a `beforeEach`/`afterEach` pair from your test setup:
 *
 * @example
 * ```ts
 * import { beforeEach, afterEach } from 'bun:test'
 * import { useTransactionalTests } from '@stacksjs/testing/database'
 *
 * const tx = useTransactionalTests()
 * beforeEach(tx.begin)
 * afterEach(tx.rollback)
 * ```
 */
export function useTransactionalTests(): {
  begin: () => Promise<void>
  rollback: () => Promise<void>
} {
  let active: { rollback: () => Promise<void> } | null = null
  return {
    begin: async () => {
      // We deliberately don't reuse `db.transaction(fn)` because that
      // closes the transaction synchronously when `fn` returns, but
      // `beforeEach` returns immediately before the test body runs.
      // Instead, run the transaction via raw SQL and stash a rollback
      // callback that the matching `afterEach` calls.
      //
      // Behind the scenes bun-query-builder wraps each statement in
      // its own connection by default; we use a savepoint here to
      // make the rollback safe even when the underlying driver is
      // already inside a transaction (some drivers wrap CLI commands
      // in implicit transactions on connect).
      const savepoint = `stacks_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
      await db.unsafe(`SAVEPOINT ${savepoint}`).execute()
      active = {
        rollback: async () => {
          await db.unsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`).execute()
          await db.unsafe(`RELEASE SAVEPOINT ${savepoint}`).execute()
        },
      }
    },
    rollback: async () => {
      if (!active) return
      try {
        await active.rollback()
      }
      finally {
        active = null
      }
    },
  }
}

/**
 * Database assertions (stacksjs/stacks#2581).
 *
 * Documented for a long time and never implemented, so every sample teaching
 * them imported from `@stacksjs/testing` and failed. They live HERE rather than
 * at the package root for the reason the file header gives: the root
 * deliberately does not import `@stacksjs/database`, because doing so eagerly
 * deadlocks bun's module loader outside the framework's preloader.
 *
 * Each throws rather than returning a boolean. A test asserting on a database
 * wants the row it was expecting in the failure message - `expect(true).toBe(
 * true)` on a helper that returned false tells nobody anything - so the message
 * carries the table, the criteria, and what was actually there.
 */

/** Column/value pairs a row must match. Every pair is ANDed. */
export type RowCriteria = Record<string, unknown>

function describeCriteria(criteria: RowCriteria): string {
  const pairs = Object.entries(criteria).map(([column, value]) => `${column}=${JSON.stringify(value)}`)
  return pairs.length > 0 ? pairs.join(', ') : '(no criteria)'
}

/** Rows in `table` matching every pair in `criteria`. */
async function matching(table: string, criteria: RowCriteria): Promise<Record<string, unknown>[]> {
  let query = db.selectFrom(table).selectAll()
  for (const [column, value] of Object.entries(criteria))
    query = query.where(column, '=', value as never)
  return await query.execute() as unknown as Record<string, unknown>[]
}

/**
 * Assert at least one row in `table` matches `criteria`.
 *
 * @example
 * ```ts
 * await assertDatabaseHas('users', { email: 'john@example.com' })
 * ```
 */
export async function assertDatabaseHas(table: string, criteria: RowCriteria): Promise<void> {
  const rows = await matching(table, criteria)
  if (rows.length > 0)
    return

  // The count of rows in the table is the useful second fact: zero means the
  // write never happened, and non-zero means it happened differently.
  const total = await matching(table, {})
  throw new Error(
    `Expected ${table} to have a row matching ${describeCriteria(criteria)}, but none did `
    + `(${total.length} row(s) in the table).`,
  )
}

/**
 * Assert no row in `table` matches `criteria`.
 *
 * @example
 * ```ts
 * await assertDatabaseMissing('users', { id: user.id })
 * ```
 */
export async function assertDatabaseMissing(table: string, criteria: RowCriteria): Promise<void> {
  const rows = await matching(table, criteria)
  if (rows.length === 0)
    return

  throw new Error(
    `Expected ${table} to have no row matching ${describeCriteria(criteria)}, but found ${rows.length}: `
    + `${JSON.stringify(rows.slice(0, 3))}${rows.length > 3 ? ' …' : ''}`,
  )
}

/**
 * Assert exactly `count` rows in `table` match `criteria`.
 *
 * Omit `criteria` to count the whole table.
 *
 * @example
 * ```ts
 * await assertDatabaseCount('orders', 3)
 * await assertDatabaseCount('orders', 2, { product_id: 1 })
 * ```
 */
export async function assertDatabaseCount(table: string, count: number, criteria: RowCriteria = {}): Promise<void> {
  if (!Number.isInteger(count) || count < 0)
    throw new TypeError(`assertDatabaseCount expects a non-negative integer, got ${count}`)

  const rows = await matching(table, criteria)
  if (rows.length === count)
    return

  throw new Error(
    `Expected ${count} row(s) in ${table} matching ${describeCriteria(criteria)}, found ${rows.length}.`,
  )
}

/**
 * Assert a matching row exists and is soft-deleted.
 *
 * Soft deletion is `deleted_at` being set - the column the `useSoftDeletes`
 * trait adds. A row that is not there at all fails differently from one that is
 * there and not deleted, because those are different bugs: the first means the
 * delete removed the row outright, the second that it did nothing.
 *
 * @example
 * ```ts
 * await assertSoftDeleted('users', { id: user.id })
 * ```
 */
export async function assertSoftDeleted(table: string, criteria: RowCriteria): Promise<void> {
  const rows = await matching(table, criteria)
  if (rows.length === 0) {
    throw new Error(
      `Expected ${table} to have a soft-deleted row matching ${describeCriteria(criteria)}, but no row matched at all `
      + '- a hard delete removes the row rather than setting deleted_at.',
    )
  }

  const live = rows.filter(row => row.deleted_at === null || row.deleted_at === undefined)
  if (live.length === 0)
    return

  throw new Error(
    `Expected every ${table} row matching ${describeCriteria(criteria)} to be soft-deleted, `
    + `but ${live.length} of ${rows.length} still has a null deleted_at.`,
  )
}

/**
 * Assert a matching row exists and is NOT soft-deleted.
 *
 * @example
 * ```ts
 * await assertNotSoftDeleted('users', { id: user.id })
 * ```
 */
export async function assertNotSoftDeleted(table: string, criteria: RowCriteria): Promise<void> {
  const rows = await matching(table, criteria)
  if (rows.length === 0)
    throw new Error(`Expected ${table} to have a row matching ${describeCriteria(criteria)}, but none did.`)

  const deleted = rows.filter(row => row.deleted_at !== null && row.deleted_at !== undefined)
  if (deleted.length === 0)
    return

  throw new Error(
    `Expected no ${table} row matching ${describeCriteria(criteria)} to be soft-deleted, `
    + `but ${deleted.length} of ${rows.length} has a deleted_at set.`,
  )
}

/**
 * Wrap every test in this file in a transaction that is rolled back after it
 * (stacksjs/stacks#2581).
 *
 * The self-wiring form of {@link useTransactionalTests}, and the one six
 * documentation pages have always shown. It registers its own `beforeEach` and
 * `afterEach`, so a suite says what it wants once:
 *
 * ```ts
 * import { useTransaction } from '@stacksjs/testing/database'
 *
 * describe('Order', () => {
 *   useTransaction()
 *
 *   it('creates an order', async () => {
 *     // ...rolled back when this returns
 *   })
 * })
 * ```
 *
 * Call it at the top of a `describe`, or at the top of the file for every test
 * in it - `beforeEach` is scoped by where it is registered, and so is this.
 *
 * Prefer {@link useTransactionalTests} when the hooks need to interleave with
 * others in a particular order; this is the common case, not the only one.
 */
export function useTransaction(): void {
  const tx = useTransactionalTests()
  beforeEach(tx.begin)
  afterEach(tx.rollback)
}
