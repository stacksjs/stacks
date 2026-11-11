// `buddy migrate` on a new app must not call a disabled feature's tables missing.
//
// A fresh `buddy new` app has commerce and cms off, so their tables are absent
// by design. Its first `./buddy migrate` still ended on "39 tables the
// migrations table says were created are missing from the database: authors,
// cart_items, carts, ..." and "the database is still not in the state its
// migrations and models describe". The audit applies the runner's feature gate
// only when it picks the corpus itself; `missingRecordedTables` names the
// directory, so it has to hand the gate over, and did not.

import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { auditMissingTables } from '../src/migration-ledger'
import { withoutGatedStatements } from '../src/migrations'

// What a new app has recorded: a file of its own, and a "mixed" file that
// also touches a table belonging to a feature that is off.
const RECORDED: Record<string, string> = {
  '0000000001-create-users-table.sql':
    'CREATE TABLE IF NOT EXISTS "users" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT);',
  '0000000002-create-carts-table.sql':
    'CREATE TABLE IF NOT EXISTS "carts" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "user_id" INTEGER);',
}

describe('auditMissingTables with a named directory', () => {
  let dir: string
  let db: Database
  const run = async (sql: string): Promise<any[]> => db.query(sql).all() as any[]

  // The gate the runner builds while commerce is disabled.
  const gate = {
    exclude: new Set<string>(),
    rewrite: (sql: string) => withoutGatedStatements(sql, new Set(['carts'])),
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'missing-gated-'))
    db = new Database(':memory:')
    db.run('CREATE TABLE migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, migration VARCHAR(255) NOT NULL UNIQUE)')
    for (const [file, sql] of Object.entries(RECORDED)) {
      writeFileSync(join(dir, file), sql)
      db.run(`INSERT INTO migrations (migration) VALUES ('${file}')`)
    }
    // The runner created only what the gate let through.
    db.run(RECORDED['0000000001-create-users-table.sql']!)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('applies no gate of its own, so the caller must pass one', async () => {
    const { missing } = await auditMissingTables({ dir, dialect: 'sqlite', run })
    expect(missing).toEqual(['carts'])
  })

  it('does not report a disabled feature\'s table once the gate is passed', async () => {
    const { missing } = await auditMissingTables({ dir, dialect: 'sqlite', run, gate })
    expect(missing).toEqual([])
  })

  it('still reports a table of an enabled feature that is gone', async () => {
    db.run('DROP TABLE users')
    const { missing } = await auditMissingTables({ dir, dialect: 'sqlite', run, gate })
    expect(missing).toEqual(['users'])
  })
})

describe('missingRecordedTables', () => {
  it('hands the audit the runner\'s feature gate along with the directory', () => {
    const source = readFileSync(join(import.meta.dir, '../src/migrations.ts'), 'utf8')
    const body = source.slice(source.indexOf('export async function missingRecordedTables'))
    const call = /auditMissingTables\(\{([^}]*)\}\)/.exec(body)?.[1] ?? ''

    expect(call).toContain('dir')
    expect(call).toContain('gate: await featureGateForLedger(dir)')
  })
})
