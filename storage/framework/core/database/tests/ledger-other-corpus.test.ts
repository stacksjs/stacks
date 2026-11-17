import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { auditMigrationLedger, planLedgerRemap, reconcileMigrationLedger } from '../src/migration-ledger'

/**
 * A database that moved from the flat `database/migrations` onto a corpus of
 * its own (`database/migrations/postgres`, stacksjs/stacks#3228) keeps a row
 * for every file it ran from the old one. Measured on a long-lived Postgres
 * dev database (stacksjs/stacks#3163): 168 rows for a 51-file corpus, 110 of
 * them naming files that are still in the flat corpus.
 *
 * Those rows used to be matched to the new corpus by logical name. A flat
 * `create-database-types` row was repointed at the Postgres corpus's own
 * `create-database-types`, recording a migration that never ran there, and
 * every other one was reported as "migration deleted?" drift no repair could
 * clear.
 */
describe('ledger rows from another corpus', () => {
  let root: string
  let flat: string
  let corpus: string
  let db: Database

  const run = async (sql: string): Promise<any[]> => db.query(sql).all() as any[]
  const ledger = (): string[] =>
    (db.query('SELECT migration FROM migrations ORDER BY migration').all() as any[]).map(r => r.migration)
  const record = (...files: string[]): void => {
    for (const file of files) db.run(`INSERT INTO migrations (migration) VALUES ('${file}')`)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ledger-corpora-'))
    flat = join(root, 'migrations')
    corpus = join(flat, 'postgres')
    mkdirSync(corpus, { recursive: true })
    // The old corpus, which this database ran first.
    writeFileSync(join(flat, '0000000001-create-database-types.sql'), '-- qb:generated\nSELECT 1;')
    writeFileSync(join(flat, '0000000002-create-posts-table.sql'), 'CREATE TABLE IF NOT EXISTS "posts" ("id" INTEGER PRIMARY KEY AUTOINCREMENT);')
    // Its own corpus, generated beside it, with the same logical names.
    writeFileSync(join(corpus, '0000000171-create-database-types.sql'), '-- qb:generated\nSELECT 1;')
    writeFileSync(join(corpus, '0000000172-create-posts-table.sql'), 'CREATE TABLE IF NOT EXISTS "posts" ("id" INTEGER PRIMARY KEY);')

    db = new Database(':memory:')
    db.run('CREATE TABLE posts (id INTEGER PRIMARY KEY)')
    db.run('CREATE TABLE migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, migration VARCHAR(255) NOT NULL UNIQUE, executed_at DATETIME DEFAULT CURRENT_TIMESTAMP)')
  })

  afterEach(() => {
    db.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('keeps them as history: not orphans, not drift', async () => {
    record('0000000001-create-database-types.sql', '0000000002-create-posts-table.sql', '0000000171-create-database-types.sql', '0000000172-create-posts-table.sql')

    const audit = await auditMigrationLedger({ dir: corpus, dialect: 'sqlite', run })

    expect(audit.foreign).toEqual([
      { migration: '0000000001-create-database-types.sql', corpus: flat },
      { migration: '0000000002-create-posts-table.sql', corpus: flat },
    ])
    expect(audit.orphans).toEqual([])
    expect(audit.remapPlan.superseded).toEqual([])
    expect(audit.drift).toBe(false)
  })

  it('never repoints one at a file of this corpus that has not run', async () => {
    // The new corpus's `create-database-types` has not run here. Matching the
    // old row to it by name would record it as applied.
    record('0000000001-create-database-types.sql', '0000000002-create-posts-table.sql', '0000000172-create-posts-table.sql')

    const audit = await auditMigrationLedger({ dir: corpus, dialect: 'sqlite', run })
    expect(audit.remapPlan.remap).toEqual([])

    const result = await reconcileMigrationLedger({ dir: corpus, dialect: 'sqlite', run })
    expect(result.remapped).toEqual([])
    expect(ledger()).toEqual(['0000000001-create-database-types.sql', '0000000002-create-posts-table.sql', '0000000172-create-posts-table.sql'])
  })

  it('leaves every one of them in place when reconciling', async () => {
    record('0000000001-create-database-types.sql', '0000000002-create-posts-table.sql', '0000000171-create-database-types.sql', '0000000172-create-posts-table.sql')
    const before = ledger()

    const result = await reconcileMigrationLedger({ dir: corpus, dialect: 'sqlite', run })

    expect(result.pruned).toEqual([])
    expect(ledger()).toEqual(before)
  })
})

describe('a duplicate whose current file is gated', () => {
  let dir: string
  let db: Database

  const run = async (sql: string): Promise<any[]> => db.query(sql).all() as any[]
  const ledger = (): string[] =>
    (db.query('SELECT migration FROM migrations ORDER BY migration').all() as any[]).map(r => r.migration)

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ledger-gated-'))
    writeFileSync(join(dir, '0000000202-create-redirects-table.sql'), 'CREATE TABLE IF NOT EXISTS "redirects" ("id" INTEGER PRIMARY KEY);')
    db = new Database(':memory:')
    db.run('CREATE TABLE migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, migration VARCHAR(255) NOT NULL UNIQUE, executed_at DATETIME DEFAULT CURRENT_TIMESTAMP)')
    db.run(`INSERT INTO migrations (migration) VALUES ('0000000202-create-redirects-table.sql')`)
    db.run(`INSERT INTO migrations (migration) VALUES ('1785502251846-create-redirects-table.sql')`)
  })

  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  // The CMS feature is off, so its file is gated. The dry run used to promise
  // the prune and the real run skipped it without a word.
  const gate = { exclude: new Set(['0000000202-create-redirects-table.sql']), rewrite: (sql: string) => sql }

  it('is pruned by the real run exactly as the dry run says', async () => {
    const dry = await reconcileMigrationLedger({ dir, dialect: 'sqlite', run, gate, dryRun: true })
    expect(dry.pruned).toEqual(['1785502251846-create-redirects-table.sql'])
    expect(ledger()).toHaveLength(2)

    const real = await reconcileMigrationLedger({ dir, dialect: 'sqlite', run, gate })
    expect(real.pruned).toEqual(dry.pruned)
    expect(ledger()).toEqual(['0000000202-create-redirects-table.sql'])
  })
})

describe('a logical name several files share', () => {
  it('makes a row ambiguous rather than a duplicate', () => {
    // `auto-misc` is the generator's catch-all name. Two recorded files carry
    // it, and they are different migrations, so a third row with that name is
    // not provably either of them.
    const plan = planLedgerRemap(
      ['0000000209-auto-misc.sql', '0000000221-auto-misc.sql', '0000000072-auto-misc.sql'],
      ['0000000209-auto-misc.sql', '0000000221-auto-misc.sql'],
    )
    expect(plan.superseded).toEqual([])
    expect(plan.ambiguous).toEqual(['0000000072-auto-misc.sql'])
  })
})
