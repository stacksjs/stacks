import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { reconcileMigrationLedger } from '../src/migration-ledger'

/**
 * Exercises the reconciler's WRITE path against a real database, because it
 * now issues DELETEs. Everything else it does adds or rewrites a row; a delete
 * is the only operation that can destroy the last record of a migration, and
 * doing that silently queues that migration to re-run against a live schema.
 */
describe('reconcileMigrationLedger pruning duplicates', () => {
  let dir: string
  let db: Database

  const run = async (sql: string): Promise<any[]> => db.query(sql).all() as any[]
  const ledger = (): string[] =>
    (db.query('SELECT migration FROM migrations ORDER BY migration').all() as any[]).map(r => r.migration)

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ledger-prune-'))
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, '0000000085-create-content_reports-table.sql'),
      'CREATE TABLE IF NOT EXISTS "content_reports" ("id" INTEGER PRIMARY KEY AUTOINCREMENT);',
    )

    db = new Database(':memory:')
    db.run('CREATE TABLE content_reports (id INTEGER PRIMARY KEY AUTOINCREMENT)')
    db.run('CREATE TABLE migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, migration VARCHAR(255) NOT NULL UNIQUE, executed_at DATETIME DEFAULT CURRENT_TIMESTAMP)')
  })

  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('deletes the stale row and keeps the current one', async () => {
    db.run(`INSERT INTO migrations (migration) VALUES ('0000000085-create-content_reports-table.sql')`)
    db.run(`INSERT INTO migrations (migration) VALUES ('0000000092-create-content_reports-table.sql')`)

    const result = await reconcileMigrationLedger({ dir, dialect: 'sqlite', run })

    expect(result.pruned).toEqual(['0000000092-create-content_reports-table.sql'])
    // The migration is STILL recorded — that is the whole safety property.
    expect(ledger()).toEqual(['0000000085-create-content_reports-table.sql'])
  })

  it('reports the deletion without performing it on a dry run', async () => {
    db.run(`INSERT INTO migrations (migration) VALUES ('0000000085-create-content_reports-table.sql')`)
    db.run(`INSERT INTO migrations (migration) VALUES ('0000000092-create-content_reports-table.sql')`)

    const result = await reconcileMigrationLedger({ dir, dialect: 'sqlite', dryRun: true, run })

    expect(result.pruned).toEqual(['0000000092-create-content_reports-table.sql'])
    expect(ledger()).toHaveLength(2)
  })

  it('remaps rather than deletes when only the stale spelling is recorded', async () => {
    // Deleting here would erase the only record that this migration ran.
    db.run(`INSERT INTO migrations (migration) VALUES ('0000000092-create-content_reports-table.sql')`)

    const result = await reconcileMigrationLedger({ dir, dialect: 'sqlite', run })

    expect(result.pruned).toEqual([])
    expect(result.remapped).toEqual([
      { from: '0000000092-create-content_reports-table.sql', to: '0000000085-create-content_reports-table.sql' },
    ])
    expect(ledger()).toEqual(['0000000085-create-content_reports-table.sql'])
  })

  it('never removes the last record of a migration', async () => {
    db.run(`INSERT INTO migrations (migration) VALUES ('0000000092-create-content_reports-table.sql')`)
    await reconcileMigrationLedger({ dir, dialect: 'sqlite', run })

    // Whatever route it took, exactly one row still records this migration.
    expect(ledger()).toHaveLength(1)
  })

  it('leaves a row whose migration is genuinely gone from disk', async () => {
    db.run(`INSERT INTO migrations (migration) VALUES ('0000000085-create-content_reports-table.sql')`)
    db.run(`INSERT INTO migrations (migration) VALUES ('0000000099-create-vanished-table.sql')`)

    const result = await reconcileMigrationLedger({ dir, dialect: 'sqlite', run })

    expect(result.pruned).toEqual([])
    expect(result.skipped.some(s => s.file === '0000000099-create-vanished-table.sql')).toBe(true)
    expect(ledger()).toContain('0000000099-create-vanished-table.sql')
  })
})
