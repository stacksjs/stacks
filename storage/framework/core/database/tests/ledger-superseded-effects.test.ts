import { Database } from 'bun:sqlite'
import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { auditMigrationLedger, migrationRemovals } from '../src/migration-ledger'

/**
 * Widening an index is ordinary history: create `(country, state)`, drop it,
 * create `(country, state, state_name)` in its place. Checked in isolation the
 * first migration's effect is missing from the schema — because the second one
 * removed it on purpose — and it reported as REVERTED, "the effects are gone",
 * permanently and with no command able to clear it.
 *
 * Found on a 593k-row trails catalog whose index was widened to make a region
 * breakdown covering (4.7s -> 0.1s).
 */
describe('removals a migration performs', () => {
  it('parses DROP INDEX', () => {
    expect(migrationRemovals('DROP INDEX IF EXISTS "trails_trails_country_state_index";'))
      .toEqual([{ kind: 'index', name: 'trails_trails_country_state_index' }])
  })

  it('parses DROP TABLE and DROP TYPE', () => {
    expect(migrationRemovals('DROP TABLE IF EXISTS "old_thing";'))
      .toEqual([{ kind: 'table', name: 'old_thing' }])
    expect(migrationRemovals('DROP TYPE IF EXISTS "status_enum";'))
      .toEqual([{ kind: 'enum', name: 'status_enum' }])
  })

  it('parses dropped columns and constraints with their owning table', () => {
    expect(migrationRemovals('ALTER TABLE "users" DROP COLUMN "legacy_flag";'))
      .toEqual([{ kind: 'column', table: 'users', name: 'legacy_flag' }])
    expect(migrationRemovals('ALTER TABLE "users" DROP CONSTRAINT "users_old_check";'))
      .toEqual([{ kind: 'constraint', table: 'users', name: 'users_old_check' }])
  })

  it('ignores CREATE statements entirely', () => {
    expect(migrationRemovals('CREATE INDEX "a_idx" ON "a" ("b");')).toEqual([])
    expect(migrationRemovals('CREATE TABLE "a" ("id" INTEGER);')).toEqual([])
  })

  it('deduplicates a repeated drop', () => {
    expect(migrationRemovals('DROP INDEX "x"; DROP INDEX IF EXISTS "x";')).toHaveLength(1)
  })

  it('does not confuse a dropped index with a table of the same name', () => {
    // The audit keys removals by kind AND name, so this must not report a
    // table removal that would excuse a genuinely missing table.
    const removals = migrationRemovals('DROP INDEX "trails";')
    expect(removals).toEqual([{ kind: 'index', name: 'trails' }])
    expect(removals.some(r => r.kind === 'table')).toBe(false)
  })
})

/**
 * End-to-end through `auditMigrationLedger`, because the parser being right is
 * not the same as the audit USING it right.
 *
 * The first version of this fix parsed removals correctly and still reported
 * the migration as REVERTED: created indexes carry their owning table and
 * `DROP INDEX` names none, so the two keys could never match. Unit tests over
 * the parser alone passed the whole time.
 */
describe('a migration whose effect a later migration drops', () => {
  const build = async (files: Record<string, string>, ledgerRows: string[]) => {
    const dir = mkdtempSync(join(tmpdir(), 'ledger-drop-'))
    for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql)

    const db = new Database(':memory:')
    db.run('CREATE TABLE trails (id INTEGER PRIMARY KEY AUTOINCREMENT, country TEXT, state TEXT, state_name TEXT)')
    db.run('CREATE TABLE migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, migration VARCHAR(255) NOT NULL UNIQUE)')
    for (const row of ledgerRows) db.run(`INSERT INTO migrations (migration) VALUES ('${row}')`)

    const run = async (sql: string): Promise<any[]> => db.query(sql).all() as any[]
    const audit = await auditMigrationLedger({ dir, dialect: 'sqlite', run })
    db.close()
    rmSync(dir, { recursive: true, force: true })
    return audit
  }

  const CREATE = '0000000072-create-trails_country_state_index-index-in-trails.sql'
  const DROP = '0000000074-auto-misc.sql'

  it('is applied, not reverted', async () => {
    const audit = await build(
      {
        [CREATE]: 'CREATE INDEX IF NOT EXISTS "trails_country_state_index" ON "trails" ("country", "state");',
        [DROP]: 'DROP INDEX IF EXISTS "trails_country_state_index";',
      },
      [CREATE, DROP],
    )
    expect(audit.entries.find(e => e.file === CREATE)?.status).toBe('applied')
    expect(audit.counts.reverted).toBe(0)
    expect(audit.drift).toBe(false)
  })

  it('is still reverted when the drop comes EARLIER', async () => {
    // An earlier drop is unrelated history and cannot excuse a later CREATE
    // whose index is missing from the schema.
    const early = '0000000010-auto-misc.sql'
    const audit = await build(
      {
        [early]: 'DROP INDEX IF EXISTS "trails_country_state_index";',
        [CREATE]: 'CREATE INDEX IF NOT EXISTS "trails_country_state_index" ON "trails" ("country", "state");',
      },
      [early, CREATE],
    )
    expect(audit.entries.find(e => e.file === CREATE)?.status).toBe('reverted')
  })

  it('is still reverted when nothing drops it', async () => {
    const audit = await build(
      { [CREATE]: 'CREATE INDEX IF NOT EXISTS "trails_country_state_index" ON "trails" ("country", "state");' },
      [CREATE],
    )
    expect(audit.entries.find(e => e.file === CREATE)?.status).toBe('reverted')
  })

  it('does not let a dropped INDEX excuse a missing TABLE of the same name', async () => {
    const createTable = '0000000072-create-widgets-table.sql'
    const dropIndex = '0000000074-auto-misc.sql'
    const audit = await build(
      {
        [createTable]: 'CREATE TABLE IF NOT EXISTS "widgets" ("id" INTEGER PRIMARY KEY AUTOINCREMENT);',
        [dropIndex]: 'DROP INDEX IF EXISTS "widgets";',
      },
      [createTable, dropIndex],
    )
    // The `widgets` TABLE is absent from the schema and only an index of that
    // name was dropped, so this must still report as reverted.
    expect(audit.entries.find(e => e.file === createTable)?.status).toBe('reverted')
  })
})
