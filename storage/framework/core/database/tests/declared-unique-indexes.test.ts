// Unique indexes a later table rebuild dropped, put back in the same migrate.
//
// SQLite changes a table by rebuilding it (`_qb_tmp_<table>`, copy, drop,
// rename), and `DROP TABLE` takes every index with it. The rebuild re-creates
// only the model's own indexes, under the generator's names. So on a fresh
// database `0000000147` created `categorizable_models_owner_unique` and
// `taggable_models_owner_unique`, and the rebuilds in `1785502251816-auto-misc`
// and `1789486698554-repair-categorizable-models-category-fk` then dropped
// them. The preprocessor noticed on the NEXT migrate and re-queued the file, so
// a fresh database needed two runs to reach its schema - and CI runs one.
//
// These tests run the corpus the way the runner does (in order, each file
// once), then the post-batch pass, and assert one pass is enough.

import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  corpusUniqueIndexes,
  hasIndex,
  parseUniqueIndex,
  restoreDroppedUniqueIndexes,
  uniqueIndexOnlyFile,
} from '../src/declared-unique-indexes'

const CORPUS = join(import.meta.dir, '../../../../../database/migrations')

/** Run each file once, in order - what the migration runner does. */
function runCorpus(db: Database, dir: string): void {
  for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    // A handful of committed files fail on prerequisites this harness does not
    // stand up (print_devices, notifications), exactly as in
    // categorizable-pivot-fk.test.ts. None of them touches the tables below.
    try {
      db.exec(readFileSync(join(dir, file), 'utf8'))
    }
    catch {}
  }
}

const REBUILD_T = `PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_t" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "a" INTEGER not null, "b" TEXT not null);
INSERT INTO "_qb_tmp_t" ("id", "a", "b") SELECT "id", "a", "b" FROM "t";
DROP TABLE "t";
ALTER TABLE "_qb_tmp_t" RENAME TO "t";
CREATE UNIQUE INDEX IF NOT EXISTS "t_a_b_unique" ON "t" ("a", "b");
COMMIT;
PRAGMA foreign_keys=ON;`

describe('parsing what a file declares', () => {
  it('reads the name, table and plain columns, quoted or not', () => {
    const index = parseUniqueIndex('CREATE UNIQUE INDEX IF NOT EXISTS "x_owner_unique" ON "x" ("a", b COLLATE NOCASE, "c" DESC)', 'f.sql')
    expect(index).toMatchObject({ name: 'x_owner_unique', table: 'x', columns: ['a', 'b', 'c'], file: 'f.sql' })
  })

  it('leaves an expression term out of the columns rather than guessing', () => {
    expect(parseUniqueIndex('CREATE UNIQUE INDEX x_lower ON x (lower(email), site_id)', 'f.sql')?.columns).toEqual(['site_id'])
  })

  it('is not a unique index: a plain index, or anything else', () => {
    expect(parseUniqueIndex('CREATE INDEX x_a ON x (a)', 'f.sql')).toBeNull()
    expect(parseUniqueIndex('ALTER TABLE x ADD COLUMN a INTEGER', 'f.sql')).toBeNull()
  })

  it('only counts a file made entirely of unique indexes', () => {
    expect(uniqueIndexOnlyFile('CREATE UNIQUE INDEX a ON t (a);\nCREATE UNIQUE INDEX b ON t (b);', 'f.sql')).toHaveLength(2)
    expect(uniqueIndexOnlyFile('CREATE TABLE t (a INTEGER);\nCREATE UNIQUE INDEX a ON t (a);', 'f.sql')).toBeNull()
    expect(uniqueIndexOnlyFile('-- nothing\n', 'f.sql')).toBeNull()
  })

  it('drops an index a later file retires by name', () => {
    const declared = corpusUniqueIndexes([
      { file: '0002-drop.sql', content: 'DROP INDEX IF EXISTS "t_a_unique";' },
      { file: '0001-index.sql', content: 'CREATE UNIQUE INDEX "t_a_unique" ON "t" ("a");' },
    ])
    // Still recognised as a unique-index file, just with nothing left to assert.
    expect(declared.get('0001-index.sql')).toEqual([])
  })

  it('keeps an index a later file drops and then creates again', () => {
    const declared = corpusUniqueIndexes([
      { file: '0001-index.sql', content: 'CREATE UNIQUE INDEX "t_a_unique" ON "t" ("a");' },
      { file: '0002-redo.sql', content: 'DROP INDEX "t_a_unique";\nCREATE UNIQUE INDEX "t_a_unique" ON "t" ("a");' },
    ])
    expect(declared.get('0001-index.sql')?.map(index => index.name)).toEqual(['t_a_unique'])
  })
})

describe('restoreDroppedUniqueIndexes', () => {
  let dir: string
  let db: Database

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'declared-unique-indexes-'))
    db = new Database(':memory:')
  })

  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  const write = (file: string, sql: string) => writeFileSync(join(dir, file), sql)

  it('puts back an index a later rebuild of its table dropped', () => {
    write('0001-create-t-table.sql', 'CREATE TABLE "t" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "a" INTEGER not null, "b" TEXT not null);')
    write('0002-create-t_owner_unique-index-in-t.sql', 'CREATE UNIQUE INDEX IF NOT EXISTS "t_owner_unique" ON "t" ("a", "b");')
    write('0003-auto-misc.sql', REBUILD_T)
    runCorpus(db, dir)
    expect(hasIndex(db, 't_owner_unique')).toBe(false)

    expect(restoreDroppedUniqueIndexes(db, dir).map(index => index.name)).toEqual(['t_owner_unique'])
    expect(hasIndex(db, 't_owner_unique')).toBe(true)
    // A second migrate has nothing left to do.
    expect(restoreDroppedUniqueIndexes(db, dir)).toEqual([])
  })

  it('leaves it gone when a later migration dropped the index by name', () => {
    write('0001-create-t-table.sql', 'CREATE TABLE "t" ("id" INTEGER PRIMARY KEY, "a" INTEGER);')
    write('0002-index.sql', 'CREATE UNIQUE INDEX "t_a_unique" ON "t" ("a");')
    write('0003-drop.sql', 'DROP INDEX "t_a_unique";')
    runCorpus(db, dir)

    expect(restoreDroppedUniqueIndexes(db, dir)).toEqual([])
    expect(hasIndex(db, 't_a_unique')).toBe(false)
  })

  it('leaves it gone when the rebuild removed a column it covered', () => {
    write('0001-create-t-table.sql', 'CREATE TABLE "t" ("id" INTEGER PRIMARY KEY, "a" INTEGER, "c" TEXT);')
    write('0002-index.sql', 'CREATE UNIQUE INDEX "t_a_c_unique" ON "t" ("a", "c");')
    write('0003-rebuild.sql', `CREATE TABLE "_qb_tmp_t" ("id" INTEGER PRIMARY KEY, "a" INTEGER);
INSERT INTO "_qb_tmp_t" ("id", "a") SELECT "id", "a" FROM "t";
DROP TABLE "t";
ALTER TABLE "_qb_tmp_t" RENAME TO "t";`)
    runCorpus(db, dir)

    expect(() => restoreDroppedUniqueIndexes(db, dir)).not.toThrow()
    expect(hasIndex(db, 't_a_c_unique')).toBe(false)
  })

  it('leaves it gone when its table no longer exists', () => {
    write('0001-create-t-table.sql', 'CREATE TABLE "t" ("id" INTEGER PRIMARY KEY, "a" INTEGER);')
    write('0002-index.sql', 'CREATE UNIQUE INDEX "t_a_unique" ON "t" ("a");')
    write('0003-drop-t-table.sql', 'DROP TABLE "t";')
    runCorpus(db, dir)

    expect(restoreDroppedUniqueIndexes(db, dir)).toEqual([])
  })

  it('does not replay a unique index that lives inside a larger migration', () => {
    // Nothing says the later rebuild did not mean to remove it.
    write('0001-create-t-table.sql', 'CREATE TABLE "t" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "a" INTEGER not null, "b" TEXT not null);\nCREATE UNIQUE INDEX "t_b_unique" ON "t" ("b");')
    write('0002-auto-misc.sql', REBUILD_T)
    runCorpus(db, dir)

    expect(restoreDroppedUniqueIndexes(db, dir)).toEqual([])
    expect(hasIndex(db, 't_b_unique')).toBe(false)
  })

  it('surfaces duplicate rows instead of finishing green without the index', () => {
    write('0001-create-t-table.sql', 'CREATE TABLE "t" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "a" INTEGER not null, "b" TEXT not null);')
    write('0002-index.sql', 'CREATE UNIQUE INDEX "t_b_unique" ON "t" ("b");')
    write('0003-auto-misc.sql', REBUILD_T)
    runCorpus(db, dir)
    db.exec(`INSERT INTO t (a, b) VALUES (1, 'x'), (2, 'x')`)

    expect(() => restoreDroppedUniqueIndexes(db, dir)).toThrow(/t_b_unique.*0002-index\.sql.*UNIQUE constraint failed/)
  })
})

describe('the committed corpus, migrated once', () => {
  const OWNER_UNIQUES = ['categorizable_models_owner_unique', 'taggable_models_owner_unique']

  it('ends with both trait pivot owner indexes after a single pass', () => {
    const db = new Database(':memory:')
    runCorpus(db, CORPUS)
    restoreDroppedUniqueIndexes(db, CORPUS)

    for (const name of OWNER_UNIQUES)
      expect(hasIndex(db, name), name).toBe(true)

    // And a second migrate is a no-op.
    expect(restoreDroppedUniqueIndexes(db, CORPUS)).toEqual([])
    db.close()
  })

  it('ends with every unique-index-only file applied', () => {
    const db = new Database(':memory:')
    runCorpus(db, CORPUS)
    restoreDroppedUniqueIndexes(db, CORPUS)

    const corpus = readdirSync(CORPUS).filter(f => f.endsWith('.sql')).map(file => ({ file, content: readFileSync(join(CORPUS, file), 'utf8') }))
    const missing = [...corpusUniqueIndexes(corpus).values()].flat()
      .filter(index => db.query(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(index.table))
      .filter(index => !hasIndex(db, index.name))
      .map(index => `${index.name} (${index.file})`)

    expect(missing).toEqual([])
    db.close()
  })
})
