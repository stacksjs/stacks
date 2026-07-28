// The committed migration corpus and the dialect guard.
//
// Background: `database/migrations/` is a flat, git-tracked directory of
// dialect-SPECIFIC DDL under a dialect-ANONYMOUS name. `buddy new` copies it
// verbatim into every project, so a user setting DB_CONNECTION=postgres got
// `syntax error at or near "AUTOINCREMENT"` on file 1 of 121 with nothing
// naming the real cause. Nothing in the suite would have caught that.
//
// Two jobs here:
//   1. unit-test the classifier, especially that it does NOT fire on comments
//      or on identifiers that merely look like dialect keywords
//   2. pin the real shipped corpus, so if it ever becomes portable (or drifts
//      to a different dialect) that is a deliberate, visible change

import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import {
  auditMigrationCorpus,
  classifyMigrationSql,
  formatMigrationDialectError,
  stripSqlNoise,
} from '../src/migration-dialect'

// The suite runs from the repo root; reach the real corpus the same way
// preprocess-sqlite.test.ts does.
const CORPUS = join(import.meta.dir, '../../../../../database/migrations')

describe('stripSqlNoise', () => {
  it('blanks line comments while preserving line numbers', () => {
    const sql = 'CREATE TABLE a (\n-- AUTOINCREMENT lives here\n  id INTEGER\n)'
    const out = stripSqlNoise(sql)

    expect(out).not.toContain('AUTOINCREMENT')
    expect(out.split('\n')).toHaveLength(sql.split('\n').length)
  })

  it('blanks block comments', () => {
    expect(stripSqlNoise('SELECT 1; /* AUTO_INCREMENT */ SELECT 2;')).not.toContain('AUTO_INCREMENT')
  })

  it('blanks quoted identifiers and string literals', () => {
    // A column genuinely named "serial" must not read as Postgres SERIAL.
    expect(stripSqlNoise('CREATE TABLE t ("serial" TEXT)')).not.toContain('serial')
    expect(stripSqlNoise('INSERT INTO t VALUES (\'AUTOINCREMENT\')')).not.toContain('AUTOINCREMENT')
  })
})

describe('classifyMigrationSql', () => {
  it('detects SQLite AUTOINCREMENT', () => {
    const found = classifyMigrationSql('CREATE TABLE t ("id" INTEGER PRIMARY KEY AUTOINCREMENT)', 't.sql')
    expect(found).toHaveLength(1)
    expect(found[0]!.dialect).toBe('sqlite')
    expect(found[0]!.marker).toBe('AUTOINCREMENT')
  })

  it('detects Postgres and MySQL markers', () => {
    expect(classifyMigrationSql('CREATE TABLE t ("id" BIGSERIAL)', 't.sql')[0]!.dialect).toBe('postgres')
    expect(classifyMigrationSql('CREATE TABLE t (id INT AUTO_INCREMENT)', 't.sql')[0]!.dialect).toBe('mysql')
  })

  it('does NOT fire on a marker that only appears inside a comment', () => {
    // This is the exact bug that made `migrate:switch` report 40 foreign-key
    // migrations that are all `SELECT 1;` no-ops.
    const sql = '-- Skipped: SQLite does not support ALTER TABLE ADD CONSTRAINT\nSELECT 1;'
    expect(classifyMigrationSql(sql, 'stub.sql')).toEqual([])
  })

  it('does NOT fire on an identifier that merely looks like a keyword', () => {
    expect(classifyMigrationSql('CREATE TABLE t ("serial" TEXT, "engine" TEXT)', 't.sql')).toEqual([])
  })

  it('reports the real source line, not the stripped one', () => {
    const sql = '-- header\n\nCREATE TABLE t ("id" INTEGER PRIMARY KEY AUTOINCREMENT)'
    const found = classifyMigrationSql(sql, 't.sql')
    expect(found[0]!.line).toBe(3)
    expect(found[0]!.snippet).toContain('AUTOINCREMENT')
  })
})

describe('auditMigrationCorpus against the real shipped corpus', () => {
  it('is SQLite-flavoured today, and says so', () => {
    // If this ever fails, the corpus changed dialect. That is fine, but it must
    // be deliberate: update this test in the same change.
    const audit = auditMigrationCorpus({ dir: CORPUS, target: 'sqlite' })

    expect(audit.empty).toBe(false)
    expect(audit.total).toBeGreaterThan(100)
    expect(audit.inferred).toBe('sqlite')
  })

  it('does not block SQLite, which is what the template ships for', () => {
    // The guard must never break the working default.
    expect(auditMigrationCorpus({ dir: CORPUS, target: 'sqlite' }).incompatible).toEqual([])
  })

  it.each(['postgres', 'mysql'] as const)('is detected as unrunnable on %s', (target) => {
    const audit = auditMigrationCorpus({ dir: CORPUS, target })
    expect(audit.incompatible.length).toBeGreaterThan(0)

    const files = new Set(audit.incompatible.map(m => m.file))
    expect(files.size).toBeGreaterThan(50)
  })

  it('treats a missing directory as nothing to check, not as a failure', () => {
    const audit = auditMigrationCorpus({ dir: join(CORPUS, 'does-not-exist'), target: 'postgres' })
    expect(audit.empty).toBe(true)
    expect(audit.incompatible).toEqual([])
  })
})

describe('formatMigrationDialectError', () => {
  it('names the cause, the counts, and a way forward', () => {
    const audit = auditMigrationCorpus({ dir: CORPUS, target: 'postgres' })
    const message = formatMigrationDialectError(audit, 'postgres', 'database/migrations')

    expect(message).toContain('cannot run on postgres')
    expect(message).toContain('sqlite-flavoured')
    // The user must know their database was not touched.
    expect(message).toContain('Nothing was migrated')
    expect(message).toContain('STACKS_ALLOW_DIALECT_MISMATCH=1')
    expect(message).not.toContain('—')
  })
})
