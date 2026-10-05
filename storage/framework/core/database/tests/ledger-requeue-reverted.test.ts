import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { auditMigrationLedger, auditMissingTables, planRequeue, reconcileMigrationLedger } from '../src/migration-ledger'

/**
 * stacksjs/stacks#2860: a table whose create migration is in the ledger, but
 * which is not in the database. `buddy migrate` skips the file because it is
 * recorded, the drift probe warns, and the only way back used to be
 * `migrate:fresh` - which drops every other table to recreate one.
 *
 * `--requeue-reverted` un-records exactly the files that can only rebuild what
 * is missing, so the next migrate puts the table back and touches nothing else.
 */
const FILES: Record<string, string> = {
  '0000000001-create-teams-table.sql':
    'CREATE TABLE IF NOT EXISTS "teams" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT);',
  '0000000002-create-repair_settings-table.sql':
    'CREATE TABLE IF NOT EXISTS "repair_settings" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "team_id" INTEGER);\n'
    + 'CREATE INDEX IF NOT EXISTS "repair_settings_team_id_index" ON "repair_settings" ("team_id");',
  '0000000003-alter-repair_settings-add-mode.sql':
    'ALTER TABLE "repair_settings" ADD COLUMN "mode" TEXT;',
  // A SQLite table rebuild: its INSERT writes only to its own scaffold.
  '0000000004-rebuild-repair_settings.sql': [
    'CREATE TABLE "_qb_tmp_repair_settings" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "team_id" INTEGER, "mode" TEXT NOT NULL DEFAULT \'auto\')',
    'INSERT INTO "_qb_tmp_repair_settings" ("id", "team_id", "mode") SELECT "id", "team_id", COALESCE("mode", \'auto\') FROM "repair_settings"',
    'DROP TABLE "repair_settings"',
    'ALTER TABLE "_qb_tmp_repair_settings" RENAME TO "repair_settings"',
  ].join(';\n') + ';',
  // Writes data somewhere else: must never re-run.
  '0000000006-create-audits-table.sql':
    'CREATE TABLE IF NOT EXISTS "audits" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "note" TEXT);\n'
    + 'UPDATE "teams" SET "name" = \'renamed\';',
}

describe('reconcileMigrationLedger --requeue-reverted (stacksjs/stacks#2860)', () => {
  let dir: string
  let db: Database

  const run = async (sql: string): Promise<any[]> => db.query(sql).all() as any[]
  const ledger = (): string[] =>
    (db.query('SELECT migration FROM migrations ORDER BY migration').all() as any[]).map(r => r.migration)
  const tables = (): string[] =>
    (db.query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as any[]).map(r => r.name)

  /** What `buddy migrate` does with the ledger: run every unrecorded file, in order. */
  const migrate = (): void => {
    const recorded = new Set(ledger())
    for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
      if (recorded.has(file))
        continue
      db.run(readFileSync(join(dir, file), 'utf8'))
      db.run(`INSERT INTO migrations (migration) VALUES ('${file}')`)
    }
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ledger-requeue-'))
    for (const [file, sql] of Object.entries(FILES))
      writeFileSync(join(dir, file), sql)

    db = new Database(':memory:')
    db.run('CREATE TABLE migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, migration VARCHAR(255) NOT NULL UNIQUE, executed_at DATETIME DEFAULT CURRENT_TIMESTAMP)')
    migrate()
    db.run(`INSERT INTO teams (name) VALUES ('Core')`)
  })

  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('reports the drift the requeue repairs', async () => {
    db.run('DROP TABLE repair_settings')

    const audit = await auditMigrationLedger({ dir, dialect: 'sqlite', run })

    // The rebuild is what the audit can see is missing: the create is excused
    // by the rebuild's own DROP, which is exactly why a requeue has to replay
    // the table's whole history rather than the files the audit names.
    expect(audit.entries.find(entry => entry.file === '0000000004-rebuild-repair_settings.sql')?.status).toBe('reverted')
    expect(audit.drift).toBe(true)
  })

  it('requeues the whole history of the missing table, and nothing else', async () => {
    db.run('DROP TABLE repair_settings')

    const result = await reconcileMigrationLedger({ dir, dialect: 'sqlite', run, requeueReverted: true })

    expect(result.requeued).toEqual([
      '0000000002-create-repair_settings-table.sql',
      '0000000003-alter-repair_settings-add-mode.sql',
      '0000000004-rebuild-repair_settings.sql',
    ])
    expect(ledger()).toEqual([
      '0000000001-create-teams-table.sql',
      '0000000006-create-audits-table.sql',
    ])
  })

  it('lets the next migrate put the table back without touching anything else', async () => {
    db.run('DROP TABLE repair_settings')

    await reconcileMigrationLedger({ dir, dialect: 'sqlite', run, requeueReverted: true })
    migrate()

    expect(tables()).toContain('repair_settings')
    const columns = (db.query('PRAGMA table_info(repair_settings)').all() as any[]).map(c => c.name)
    expect(columns).toEqual(['id', 'team_id', 'mode'])
    // The other table's rows were not touched.
    expect((db.query('SELECT name FROM teams').all() as any[]).map(r => r.name)).toEqual(['Core'])
  })

  it('refuses a table whose history also writes data to a table that still exists', async () => {
    db.run('DROP TABLE audits')

    const result = await reconcileMigrationLedger({ dir, dialect: 'sqlite', run, requeueReverted: true })

    expect(result.requeued).toEqual([])
    expect(result.skipped.find(entry => entry.file === 'audits')?.reason).toContain('also changes teams')
    expect(ledger()).toContain('0000000006-create-audits-table.sql')
  })

  it('refuses the whole table, not part of its history, when one file is unsafe', async () => {
    writeFileSync(
      join(dir, '0000000005-alter-teams-and-repair_settings.sql'),
      'ALTER TABLE "repair_settings" ADD COLUMN "notes" TEXT;\nALTER TABLE "teams" ADD COLUMN "slug" TEXT;',
    )
    migrate()
    db.run('DROP TABLE repair_settings')

    const result = await reconcileMigrationLedger({ dir, dialect: 'sqlite', run, requeueReverted: true })

    // Re-running 2-4 without 5 would bring back a table still missing `notes`
    // and report the drift fixed.
    expect(result.requeued).toEqual([])
    expect(result.skipped.find(entry => entry.file === 'repair_settings')?.reason).toContain('also changes teams')
  })

  it('changes nothing on a dry run', async () => {
    db.run('DROP TABLE repair_settings')
    const before = ledger()

    const result = await reconcileMigrationLedger({ dir, dialect: 'sqlite', run, requeueReverted: true, dryRun: true })

    expect(result.requeued).toHaveLength(3)
    expect(ledger()).toEqual(before)
  })

  it('leaves reverted files alone unless asked', async () => {
    db.run('DROP TABLE repair_settings')
    const before = ledger()

    const result = await reconcileMigrationLedger({ dir, dialect: 'sqlite', run })

    expect(result.requeued).toEqual([])
    expect(result.skipped.find(entry => entry.file === '0000000004-rebuild-repair_settings.sql')?.reason).toContain('--requeue-reverted')
    expect(ledger()).toEqual(before)
  })
})

describe('planRequeue', () => {
  const file = (name: string, sql: string, recorded = true) => ({ file: name, sql, recorded })

  it('does nothing when every table the corpus leaves in place exists', () => {
    const plan = planRequeue([file('0001-create-a.sql', 'CREATE TABLE a (id INTEGER)')], new Set(['a']))
    expect(plan).toEqual({ missing: [], requeue: [], refused: [] })
  })

  it('does not resurrect a table the corpus itself dropped', () => {
    const plan = planRequeue([
      file('0001-create-a.sql', 'CREATE TABLE a (id INTEGER)'),
      file('0002-drop-a.sql', 'DROP TABLE a'),
    ], new Set())
    expect(plan.missing).toEqual([])
  })

  it('follows a rename to the table the corpus ends with', () => {
    const plan = planRequeue([
      file('0001-create-a.sql', 'CREATE TABLE a (id INTEGER)'),
      file('0002-rename-a.sql', 'ALTER TABLE a RENAME TO b'),
    ], new Set())
    expect(plan.missing).toEqual(['b'])
    expect(plan.requeue).toEqual(['0001-create-a.sql', '0002-rename-a.sql'])
  })

  it('only un-records files that are recorded', () => {
    const plan = planRequeue([
      file('0001-create-a.sql', 'CREATE TABLE a (id INTEGER)'),
      file('0002-alter-a.sql', 'ALTER TABLE a ADD COLUMN b TEXT', false),
    ], new Set())
    expect(plan.requeue).toEqual(['0001-create-a.sql'])
  })

  it('treats a guarded Postgres enum as harmless to re-run', () => {
    const sql = 'DO $stacks$ BEGIN CREATE TYPE "a_status" AS ENUM (\'on\', \'off\'); EXCEPTION WHEN duplicate_object THEN null; END $stacks$;\n'
      + 'CREATE TABLE IF NOT EXISTS "a" ("id" SERIAL PRIMARY KEY, "status" "a_status");'
    const plan = planRequeue([file('0001-create-a.sql', sql)], new Set())
    expect(plan.refused).toEqual([])
    expect(plan.requeue).toEqual(['0001-create-a.sql'])
  })

  it('refuses a statement it cannot classify', () => {
    const plan = planRequeue([
      file('0001-create-a.sql', 'CREATE TABLE a (id INTEGER); CREATE TRIGGER t AFTER INSERT ON a BEGIN SELECT 1; END'),
    ], new Set())
    expect(plan.requeue).toEqual([])
    expect(plan.refused[0]?.reason).toContain('cannot classify')
  })

  it('refuses a table that shares a file with one that cannot be rebuilt', () => {
    const plan = planRequeue([
      file('0001-create-a-b.sql', 'CREATE TABLE a (id INTEGER); CREATE TABLE b (id INTEGER)'),
      file('0002-alter-b.sql', 'ALTER TABLE b ADD COLUMN x TEXT; ALTER TABLE c ADD COLUMN y TEXT'),
      file('0003-create-c.sql', 'CREATE TABLE c (id INTEGER)'),
    ], new Set(['c']))
    expect(plan.missing).toEqual(['a', 'b'])
    expect(plan.requeue).toEqual([])
    expect(plan.refused.map(entry => entry.table).sort()).toEqual(['a', 'b'])
  })
})

describe('the feature gate in the ledger tools (stacksjs/stacks#2860)', () => {
  let dir: string
  let db: Database

  const run = async (sql: string): Promise<any[]> => db.query(sql).all() as any[]
  // What `featureGateForLedger` builds for a disabled feature owning `carts`.
  const gate = {
    exclude: new Set(['0000000002-create-carts-table.sql']),
    rewrite: (sql: string) => sql.split(';').filter(statement => !/"carts"/.test(statement)).join(';'),
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ledger-gate-'))
    writeFileSync(join(dir, '0000000001-create-teams-table.sql'), 'CREATE TABLE IF NOT EXISTS "teams" ("id" INTEGER PRIMARY KEY);')
    writeFileSync(join(dir, '0000000002-create-carts-table.sql'), 'CREATE TABLE IF NOT EXISTS "carts" ("id" INTEGER PRIMARY KEY);')
    // A catch-all: the runner strips the carts statement and records the file.
    writeFileSync(join(dir, '0000000003-auto-misc.sql'), 'ALTER TABLE "teams" ADD COLUMN "slug" TEXT;\nCREATE INDEX "carts_id_index" ON "carts" ("id");')

    db = new Database(':memory:')
    db.run('CREATE TABLE migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, migration VARCHAR(255) NOT NULL UNIQUE, executed_at DATETIME DEFAULT CURRENT_TIMESTAMP)')
    db.run('CREATE TABLE teams (id INTEGER PRIMARY KEY, slug TEXT)')
    db.run(`INSERT INTO migrations (migration) VALUES ('0000000001-create-teams-table.sql'), ('0000000003-auto-misc.sql')`)
  })

  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('does not call a gated file pending, or a stripped statement reverted', async () => {
    const ungated = await auditMigrationLedger({ dir, dialect: 'sqlite', run })
    expect(ungated.drift).toBe(true)

    const audit = await auditMigrationLedger({ dir, dialect: 'sqlite', run, gate })
    expect(audit.gated).toEqual(['0000000002-create-carts-table.sql'])
    expect(audit.counts.pending).toBe(0)
    expect(audit.counts.reverted).toBe(0)
    expect(audit.orphans).toEqual([])
    expect(audit.drift).toBe(false)
  })

  it('does not expect a table only a gated file creates', async () => {
    expect((await auditMissingTables({ dir, dialect: 'sqlite', run, gate })).missing).toEqual([])
  })

  it('reports a recorded table that is gone', async () => {
    db.run('DROP TABLE teams')
    expect((await auditMissingTables({ dir, dialect: 'sqlite', run, gate })).missing).toEqual(['teams'])
  })

  it('never lists a file it requeued as left alone', async () => {
    writeFileSync(join(dir, '0000000004-create-labels-table.sql'), 'CREATE TABLE IF NOT EXISTS "labels" ("id" INTEGER PRIMARY KEY);')
    db.run(`INSERT INTO migrations (migration) VALUES ('0000000004-create-labels-table.sql')`)

    const result = await reconcileMigrationLedger({ dir, dialect: 'sqlite', run, gate, requeueReverted: true })

    expect(result.requeued).toEqual(['0000000004-create-labels-table.sql'])
    expect(result.skipped.map(entry => entry.file)).not.toContain('0000000004-create-labels-table.sql')
  })
})
