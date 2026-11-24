/**
 * The migration runner a compiled app uses on its own database
 * (stacksjs/stacks#3369): a desktop build ships its migrations as strings and
 * applies the pending ones to the user's file at launch, before any framework
 * module loads. Every case here runs against a real SQLite file.
 */
import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  databaseVersion,
  managesOwnTransaction,
  MigrationRestoredError,
  migrateCompiledDatabase,
  NewerSchemaError,
  pendingMigrations,
} from '../src/compiled-migrations'

const scratch: string[] = []
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function dir(): string {
  const made = mkdtempSync(join(tmpdir(), 'stacks-compiled-migrations-'))
  scratch.push(made)
  return made
}

const V1 = {
  '0000000001-create-posts-table.sql': 'CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN (\'draft\', \'live\')));',
  '0000000002-create-tags-table.sql': 'CREATE TABLE tags (id INTEGER PRIMARY KEY, post_id INTEGER REFERENCES posts(id), name TEXT);',
}

/** What the framework's generator writes to change a CHECK constraint in SQLite: a rebuild. */
const REBUILD = `PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE posts_new (id INTEGER PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('draft', 'live', 'queued')));
INSERT INTO posts_new (id, title, status) SELECT id, title, status FROM posts;
DROP TABLE posts;
ALTER TABLE posts_new RENAME TO posts;
COMMIT;
PRAGMA foreign_keys=ON;`

const V2 = {
  ...V1,
  '0000000003-alter-posts-status.sql': REBUILD,
  '0000000004-create-media-table.sql': 'CREATE TABLE media (id INTEGER PRIMARY KEY, path TEXT);',
}

function rows(path: string, sql: string): any[] {
  const db = new Database(path, { readonly: true })
  try { return db.query(sql).all() }
  finally { db.close() }
}

function ledger(path: string): string[] {
  return rows(path, 'SELECT migration FROM migrations ORDER BY migration').map(row => row.migration)
}

describe('migrateCompiledDatabase', () => {
  it('makes a new database from every migration, with the framework\'s ledger and a schema version', () => {
    const databasePath = join(dir(), 'app.sqlite')
    const result = migrateCompiledDatabase({ databasePath, migrations: V1 })

    expect(result).toMatchObject({ created: true, applied: Object.keys(V1), version: 2 })
    expect(result.backup).toBeUndefined()
    expect(ledger(databasePath)).toEqual(Object.keys(V1))
    expect(databaseVersion(databasePath)).toBe(2)
    // The ledger is the one `buddy migrate` reads.
    expect(rows(databasePath, 'PRAGMA table_info(migrations)').map(c => c.name)).toEqual(['id', 'migration', 'executed_at'])
  })

  it('applies a table rebuild that opens its own transaction, next to plain files', () => {
    const databasePath = join(dir(), 'app.sqlite')
    migrateCompiledDatabase({ databasePath, migrations: V1 })
    const db = new Database(databasePath)
    db.exec('INSERT INTO posts (id, title, status) VALUES (1, \'hello\', \'live\'); INSERT INTO tags (post_id, name) VALUES (1, \'news\');')
    db.close()

    const result = migrateCompiledDatabase({ databasePath, migrations: V2 })

    expect(result.applied).toEqual(['0000000003-alter-posts-status.sql', '0000000004-create-media-table.sql'])
    expect(rows(databasePath, 'SELECT title FROM posts')).toEqual([{ title: 'hello' }])
    // The rebuilt CHECK takes the new value.
    const write = new Database(databasePath)
    write.exec('INSERT INTO posts (id, title, status) VALUES (2, \'later\', \'queued\')')
    write.close()
    expect(databaseVersion(databasePath)).toBe(4)
  })

  it('backs up first, consistently, even with writes still in the WAL', () => {
    const databasePath = join(dir(), 'app.sqlite')
    migrateCompiledDatabase({ databasePath, migrations: V1 })
    // A writer that never checkpoints: its rows live only in the -wal file.
    const writer = new Database(databasePath)
    writer.exec('PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0;')
    writer.exec('INSERT INTO posts (title, status) VALUES (\'in the wal\', \'draft\')')

    const result = migrateCompiledDatabase({ databasePath, migrations: V2 })
    writer.close()

    expect(result.backup).toBeDefined()
    expect(rows(result.backup!, 'SELECT title FROM posts')).toEqual([{ title: 'in the wal' }])
    // The backup is the database as it was: no rebuild, no media table.
    expect(ledger(result.backup!)).toEqual(Object.keys(V1))
  })

  it('puts the database back as it was when a migration fails, and says where the copy is', () => {
    const folder = dir()
    const databasePath = join(folder, 'app.sqlite')
    migrateCompiledDatabase({ databasePath, migrations: V1 })
    const db = new Database(databasePath)
    db.exec('INSERT INTO posts (title, status) VALUES (\'keep me\', \'live\')')
    db.close()
    const before = readFileSync(databasePath)

    const broken = { ...V2, '0000000004-create-media-table.sql': 'CREATE TABLE media (id INTEGER PRIMARY KEY, path TEXT); INSERT INTO nowhere VALUES (1);' }
    let error: unknown
    try { migrateCompiledDatabase({ databasePath, migrations: broken }) }
    catch (caught) { error = caught }

    expect(error).toBeInstanceOf(MigrationRestoredError)
    expect((error as MigrationRestoredError).migration).toBe('0000000004-create-media-table.sql')
    expect((error as Error).message).toContain('no such table: nowhere')
    expect(existsSync((error as MigrationRestoredError).backup)).toBe(true)
    // The rebuild that did go through is undone too: everything is as before.
    expect(ledger(databasePath)).toEqual(Object.keys(V1))
    expect(rows(databasePath, 'SELECT name FROM sqlite_master WHERE name = \'media\'')).toEqual([])
    expect(rows(databasePath, 'SELECT title FROM posts')).toEqual([{ title: 'keep me' }])
    expect(existsSync(`${databasePath}-wal`)).toBe(false)
    expect(readFileSync(databasePath).length).toBeGreaterThan(0)
    expect(before.length).toBeGreaterThan(0)
  })

  it('restores after a rebuild fails half way through its own transaction', () => {
    const databasePath = join(dir(), 'app.sqlite')
    migrateCompiledDatabase({ databasePath, migrations: V1 })
    const failing = { ...V1, '0000000003-alter-posts-status.sql': REBUILD.replace('DROP TABLE posts;', 'DROP TABLE posts; SELECT * FROM missing;') }

    expect(() => migrateCompiledDatabase({ databasePath, migrations: failing })).toThrow(MigrationRestoredError)
    expect(rows(databasePath, 'SELECT name FROM sqlite_master WHERE type = \'table\' AND name LIKE \'posts%\' ORDER BY name')).toEqual([{ name: 'posts' }])
    expect(ledger(databasePath)).toEqual(Object.keys(V1))
  })

  it('refuses a database a newer build has changed, and touches nothing', () => {
    const folder = dir()
    const databasePath = join(folder, 'app.sqlite')
    migrateCompiledDatabase({ databasePath, migrations: V2 })
    const before = readFileSync(databasePath)
    const filesBefore = readdirSync(folder).sort()

    expect(() => migrateCompiledDatabase({ databasePath, migrations: V1 })).toThrow(NewerSchemaError)
    try { migrateCompiledDatabase({ databasePath, migrations: V1 }) }
    catch (error) { expect(error).toMatchObject({ found: 4, supported: 2 }) }
    expect(readFileSync(databasePath).equals(before)).toBe(true)
    expect(readdirSync(folder).sort()).toEqual(filesBefore)
  })

  it('takes no backup when nothing is pending, and never lowers the version', () => {
    const folder = dir()
    const databasePath = join(folder, 'app.sqlite')
    migrateCompiledDatabase({ databasePath, migrations: V2 })
    const result = migrateCompiledDatabase({ databasePath, migrations: V2 })

    expect(result).toMatchObject({ created: false, applied: [], version: 4 })
    expect(result.backup).toBeUndefined()
    expect(readdirSync(folder).filter(name => name.includes('.before-'))).toEqual([])
  })

  it('keeps only the newest backups', () => {
    const folder = dir()
    const databasePath = join(folder, 'app.sqlite')
    const all: Record<string, string> = {}
    for (let n = 1; n <= 6; n++) {
      const name = `000000000${n}-create-t${n}-table.sql`
      all[name] = `CREATE TABLE t${n} (id INTEGER PRIMARY KEY);`
      migrateCompiledDatabase({ databasePath, migrations: { ...all }, keepBackups: 3 })
    }

    const backups = readdirSync(folder).filter(name => name.startsWith('app.before-')).sort()
    expect(backups).toEqual(['app.before-0000000004-create-t4-table.sqlite', 'app.before-0000000005-create-t5-table.sqlite', 'app.before-0000000006-create-t6-table.sqlite'])
  })

  it('writes backups where it is told to, private to the user', () => {
    const folder = dir()
    const databasePath = join(folder, 'app.sqlite')
    migrateCompiledDatabase({ databasePath, migrations: V1 })
    const backupDir = join(folder, 'backups')
    const { backup } = migrateCompiledDatabase({ databasePath, migrations: V2, backupDir })

    expect(backup!.startsWith(backupDir)).toBe(true)
    expect(statSync(backup!).mode & 0o777).toBe(0o600)
  })
})

describe('managesOwnTransaction', () => {
  it('knows a rebuild from a file the runner should wrap', () => {
    expect(managesOwnTransaction(REBUILD)).toBe(true)
    expect(managesOwnTransaction('-- BEGIN is mentioned here\nCREATE TABLE a (id INTEGER);')).toBe(false)
    expect(managesOwnTransaction('CREATE TRIGGER t AFTER INSERT ON a FOR EACH ROW BEGIN SELECT 1; END;')).toBe(false)
    expect(managesOwnTransaction('CREATE TABLE a (id INTEGER);\nBEGIN TRANSACTION;\nCOMMIT;')).toBe(true)
  })
})

describe('pendingMigrations', () => {
  it('is every file for a database with no ledger', () => {
    const databasePath = join(dir(), 'other.sqlite')
    new Database(databasePath).close()
    expect(pendingMigrations(databasePath, V1)).toEqual(Object.keys(V1))
  })
})
