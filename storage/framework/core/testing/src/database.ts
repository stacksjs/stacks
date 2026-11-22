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

type Guarantee = readonly [string, () => Promise<{ success: boolean, error?: string }>]

/**
 * Auth/oauth, notification, RBAC, and polymorphic-trait tables live outside the generated
 * model migrations (stacksjs/stacks#1948). Test databases need the same
 * guarantees as `buddy migrate`, in the same order, or feature tests hit
 * "no such table: oauth_access_tokens" / "no such column: email_verified_at".
 *
 * The order is `buddy migrate`'s: auth BEFORE the numbered migrations,
 * because 0000000098-revoke-legacy-long-lived-tokens.sql deletes from
 * oauth_access_tokens and fails on a database that has none. That failure
 * stopped the run there, so every app table after it was missing, and the
 * fast path snapshotted the half-built schema for every later test. Auth runs
 * again afterwards for its `users` ALTERs, which need the table the numbered
 * migrations create; the rest run after so a model-owned table stays
 * authoritative over the framework's fallback.
 *
 * All the migrators are CREATE TABLE IF NOT EXISTS plus defensive ALTERs, so
 * reruns are no-ops. Their failures surface on stderr but don't throw,
 * matching `buddy migrate`, so tests that never touch these tables aren't
 * broken by one failed guarantee.
 */
// Built per call, not once at load: the imports are live bindings, and a list
// made at module evaluation keeps whatever they were then, so a later
// `mock.module('@stacksjs/database')` never reached the migrators.
function guaranteesBefore(): Guarantee[] {
  return [['auth', migrateAuthTables]]
}

function guaranteesAfter(): Guarantee[] {
  return [
    ['auth', migrateAuthTables],
    ['notification', migrateNotificationTables],
    ['RBAC', migrateRbacTables],
    ['trait', migrateTraitTables],
    ['utc-datetime', ensureUtcDatetimeColumns],
    ['utc-defaults', ensureUtcTimestampDefaults],
  ]
}

/**
 * Migrate a test database: the framework guarantees around the app's
 * migrations. A failed model migration throws. Reporting it and carrying on
 * left a database without the app's tables, which every test then failed
 * against with "no such table" far from the cause.
 */
async function migrateTestDatabase(): Promise<void> {
  await runGuarantees(guaranteesBefore())
  const result = await runDatabaseMigration()
  await runGuarantees(guaranteesAfter())
  if (result?.isErr)
    throw new Error(`[testing] Database migration failed: ${result.error instanceof Error ? result.error.message : String(result.error)}`)
}

async function runGuarantees(steps: Guarantee[]): Promise<void> {
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
  const driver = currentDriver()

  if (driver === 'mysql') {
    const dbName = `${config.database?.connections?.mysql?.name ?? 'stacks'}_testing`
    await db.unsafe(`CREATE DATABASE IF NOT EXISTS ${dbName}`).execute()
    await migrateTestDatabase()
  }
  // Postgres used to fall through here, so a fresh test database never got
  // its tables and every feature test failed with `relation "..." does not
  // exist` (stacksjs/stacks#3355).
  if (driver === 'postgres') {
    await assertPostgresTestDatabase()
    await migrateTestDatabase()
  }
}

export async function refreshDatabase(): Promise<void> {
  await setupDatabase()

  const driver = currentDriver()
  if (driver === 'mysql')
    await truncateMysql()
  if (driver === 'sqlite')
    await truncateSqliteFast()
  if (driver === 'postgres')
    await truncatePostgres()
}

interface PostgresTable {
  tablename: string
}

function quotePostgresIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`
}

/**
 * Refuse to migrate or empty a Postgres database whose name does not say it
 * is for tests. `truncatePostgres()` empties every table in the schema, so
 * pointing a test run at the development database by mistake would wipe it.
 * Disposable databases (`withDisposableDatabase('postgres')`) are named
 * `stacks_test_...` and pass.
 */
export async function assertPostgresTestDatabase(): Promise<void> {
  const rows = await db.unsafe('SELECT current_database() AS name').execute() as unknown as Array<{ name: string }>
  const name = rows[0]?.name ?? ''
  if (!name.toLowerCase().includes('test'))
    throw new Error(`[testing] Refusing to reset Postgres database "${name}": its name does not contain "test". Point DB_DATABASE at a test database.`)
}

/**
 * Empty every table in the current Postgres schema except the migration
 * ledger, in one statement.
 *
 * The tables come from the live schema, not from `fetchTables()`: that globs
 * every model file, framework defaults included, while an app's generated
 * Postgres corpus only creates tables for the models it uses, so a list built
 * from the models names tables that do not exist and the TRUNCATE fails.
 *
 * One statement naming every table satisfies the foreign keys between them,
 * so there is no CASCADE: that would also empty, without a word, any table
 * outside this list that references one of them. RESTART IDENTITY resets the
 * ids, so a test that expects the first row to be id 1 sees it again.
 */
export async function truncatePostgres(): Promise<void> {
  await assertPostgresTestDatabase()
  const rows = await db.unsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> 'migrations' ORDER BY tablename`,
  ).execute() as unknown as PostgresTable[]
  if (rows.length === 0)
    return
  const tables = rows.map(row => quotePostgresIdentifier(row.tablename)).join(', ')
  await db.unsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY`).execute()
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

  const modelFiles = globSync([path.userModelsPath('*.ts'), path.defaultsPath('app/Models/**/*.ts')], { absolute: true })

  for (const file of modelFiles) {
    await copyModelFiles(file)
  }

  // Runs before `truncateSqliteFast()` snapshots the schema, so the
  // fast-restore path keeps the framework tables too.
  await migrateTestDatabase()
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
    // Migrations are generated as `.sql`. Watching only `*.ts` meant a newly
    // generated migration never invalidated the snapshot, so its table was
    // missing from every test until a model file happened to change. The
    // directory itself is watched for a removed or renamed migration.
    const watched = [
      path.userMigrationsPath(),
      ...globSync(
        [
          path.userModelsPath('*.ts'),
          path.defaultsPath('app/Models/**/*.ts'),
          path.userMigrationsPath('**/*.ts'),
          path.userMigrationsPath('**/*.sql'),
        ],
        { absolute: true },
      ),
    ]
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

/**
 * Rows built from a model's own declared attribute factories.
 *
 * `docs/` documented a `Factory` class in four places, with four mutually
 * incompatible signatures - `new Factory(User, attrs)`, `new Factory({
 * definition() })`, `new Factory<User>({ definition() })` and
 * `Factory.define(fn)` - and none of them ever existed. That is a fair sign
 * nobody had one, and a fifth invented shape would not help.
 *
 * What DOES exist is the factory a model already declares:
 *
 * ```ts
 * attributes: {
 *   email: { factory: faker => faker.internet.email() },
 * }
 * ```
 *
 * so this exposes that, rather than asking a test to restate it. The rows come
 * out of the same generator `buddy seed` uses, which is the point: password
 * columns are hashed, unique columns are disambiguated across the batch, and
 * relation columns are filled. A test factory that reimplemented this would
 * differ from the seeder in exactly the ways that are invisible until a test
 * passes for the wrong reason.
 *
 * @example
 * ```ts
 * const attrs = await factory('User').make()                 // not persisted
 * const user = await factory('User').create()                // one row
 * const admins = await factory('User').createMany(3, { role: 'admin' })
 * ```
 */
export interface ModelFactory {
  /** Attributes for one row, without writing anything. */
  make: (overrides?: RowCriteria) => Promise<Record<string, unknown>>
  /** Attributes for `count` rows, without writing anything. */
  makeMany: (count: number, overrides?: RowCriteria) => Promise<Record<string, unknown>[]>
  /** Insert one row and return it as inserted. */
  create: (overrides?: RowCriteria) => Promise<Record<string, unknown>>
  /** Insert `count` rows and return them as inserted. */
  createMany: (count: number, overrides?: RowCriteria) => Promise<Record<string, unknown>[]>
}

/**
 * A factory for `modelName`, e.g. `factory('User')`.
 *
 * There is deliberately no singular/plural mode switch: `make` and `create`
 * always return one row, `makeMany` and `createMany` always return an array.
 * A helper whose return type depends on whether `.count()` was called earlier
 * in the chain cannot be typed honestly, and the caller always knows which
 * one they want.
 */
export function factory(modelName: string): ModelFactory {
  async function tableFor(): Promise<string> {
    // The table name follows the model name by the framework's own convention,
    // which `assertDatabaseHas` and friends already rely on.
    const { plural, snakeCase } = await import('@stacksjs/strings')
    return plural(snakeCase(modelName))
  }

  async function build(count: number, overrides: RowCriteria): Promise<Record<string, unknown>[]> {
    const { makeModelRecords } = await import('@stacksjs/database')
    return makeModelRecords(modelName, count, overrides)
  }

  async function insert(rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
    const { db } = await import('@stacksjs/database')
    const table = await tableFor()
    const inserted: Record<string, unknown>[] = []
    for (const row of rows) {
      // One at a time, returning each row: a batch insert gives back a count,
      // and a test that just created a user needs its id.
      const result = await db.insertInto(table).values(row).returningAll().executeTakeFirst()
      inserted.push((result ?? row) as Record<string, unknown>)
    }
    return inserted
  }

  return {
    async make(overrides = {}) {
      return (await build(1, overrides))[0]!
    },
    async makeMany(count, overrides = {}) {
      return build(count, overrides)
    },
    async create(overrides = {}) {
      return (await insert(await build(1, overrides)))[0]!
    },
    async createMany(count, overrides = {}) {
      return insert(await build(count, overrides))
    },
  }
}
