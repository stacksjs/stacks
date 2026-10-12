import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * What `migrate:fresh` is allowed to create before the model corpus runs.
 *
 * This file used to assert the opposite of what it asserts now. It required an
 * unconditional `migrateNotificationTables({ tables: [...] })` in `fresh.ts`
 * ahead of the migration run, which is precisely the bug in
 * stacksjs/stacks#2894: in an app that overrides `NotificationDelivery` to add
 * columns, the framework's narrower table was already standing when the corpus
 * reached its own create, that statement succeeded as a silent no-op, and the
 * first index on an app-only column failed with "column does not exist".
 *
 * The dependency the old test protected is real - this checkout's own corpus
 * updates and rebuilds `notification_deliveries` at migrations 133 and 134
 * without ever creating it - but `runDatabaseMigration()` already satisfies it,
 * and satisfies it corpus-aware: it pre-creates only the notification tables
 * the committed migrations do not declare themselves. So the ordering
 * requirement moves here rather than disappearing.
 *
 * Sources are read with comments stripped. Measured, not assumed: the regex
 * below does not match the raw source either, so stripping is not what makes
 * that one assertion work. What it protects is the obvious needle. The comment
 * in `fresh.ts` explaining why the unconditional bootstrap is gone contains
 * `notification_deliveries`, `CREATE TABLE IF NOT EXISTS` and
 * `REQUIRED_COLUMNS`, all of which are present in the raw file and absent once
 * stripped, so any assertion phrased against those names would be satisfied by
 * the explanation of the fix rather than by the fix.
 */
const transpiler = new Bun.Transpiler({ loader: 'ts' })

function code(...segments: string[]): string {
  return transpiler.transformSync(readFileSync(join(import.meta.dir, ...segments), 'utf8'))
}

/**
 * The index of `needle`, asserting it is there. A missing needle is -1, and -1
 * is less than everything, so an ordering check on one passes vacuously.
 */
function indexOfExisting(source: string, needle: string): number {
  const index = source.indexOf(needle)
  expect(index, `missing: ${needle}`).toBeGreaterThan(-1)
  return index
}

const FRESH = ['..', 'src', 'migrate', 'fresh.ts'] as const
const MIGRATIONS = ['..', '..', 'database', 'src', 'migrations.ts'] as const

describe('migrate:fresh bootstrap order', () => {
  it('pre-creates no notification table ahead of the corpus', () => {
    // Any named-table call is the shape that caused #2894, whichever tables it
    // names: the point is that `fresh.ts` is not the place that decides.
    expect(code(...FRESH)).not.toMatch(/migrateNotificationTables\(\s*\{\s*tables:/)
  })

  it('still runs the notification guarantee after the model migrations', () => {
    // Deleting the bootstrap must not take the post-migration guarantee with
    // it. That one is safe once the corpus has had its say, and is what repairs
    // a partial or legacy database.
    const fresh = code(...FRESH)
    const migrate = indexOfExisting(fresh, 'await runDatabaseMigration()')
    const guarantee = indexOfExisting(fresh, 'await migrateNotificationTables()')

    expect(guarantee).toBeGreaterThan(migrate)
  })

  it('pre-creates the historical dependencies inside the migration run, gated on the corpus', () => {
    // Where the old assertion's intent now lives. Gated, so a model-owned
    // create stays authoritative, and before the batch, so a corpus that reads
    // one of these tables without creating it can still replay from empty.
    const migrations = code(...MIGRATIONS)
    const gate = indexOfExisting(migrations, 'notificationTablesMissingCreateStatements(migrationSql)')
    const batch = indexOfExisting(migrations, 'await countAppliedMigrations()')

    expect(gate).toBeLessThan(batch)
  })

  it('invalidates the Stacks client whenever migrations reset the query-builder connection', () => {
    const source = code(...MIGRATIONS)

    expect(source).toContain('resetDatabaseConnection()')
    expect(source).not.toMatch(/\bresetConnection\(\)/)
  })
})
