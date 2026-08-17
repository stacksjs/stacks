// Columns a rooted table gains must still reach the database.
//
// `migrate:regenerate` omits the full CREATE it generates for a table whose
// original CREATE is preserved history — re-creating the table would sit after
// authored backfills that already ran against the old shape. That is right for
// a table whose columns have not changed, and silently wrong for one that
// gained some: the new columns lived only in the omitted CREATE, so no
// database could ever reach the declared schema while the model snapshot was
// written as though the whole corpus had been emitted.
//
// Observed on a real app (CampusHQ): after a full migrate from an empty
// database, `posts`, `campaigns` and `campaign_sends` were short 20 columns
// between them, with both the models and the snapshot insisting otherwise.

import { describe, expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { columnsDefinedByCreate, columnsProducedByMigrations, rootedTableCatchUpStatements } from '../src/migrations'

function corpus(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rooted-'))
  for (const [name, body] of Object.entries(files))
    writeFileSync(join(dir, name), body)
  return dir
}

describe('columnsDefinedByCreate', () => {
  test('reads the column names', () => {
    expect(columnsDefinedByCreate('CREATE TABLE "posts" (\n "id" INTEGER,\n "title" TEXT\n)')).toEqual(['id', 'title'])
  })

  test('does not split inside a type', () => {
    // `DECIMAL(10, 2)` has a comma that is not a column boundary.
    const sql = 'CREATE TABLE "orders" (\n "id" INTEGER,\n "total" DECIMAL(10, 2),\n "note" TEXT\n)'
    expect(columnsDefinedByCreate(sql)).toEqual(['id', 'total', 'note'])
  })

  test('skips table constraints, which name no column', () => {
    const sql = 'CREATE TABLE "t" (\n "a" INTEGER,\n "b" INTEGER,\n PRIMARY KEY ("a", "b"),\n UNIQUE ("b")\n)'
    expect(columnsDefinedByCreate(sql)).toEqual(['a', 'b'])
  })

  test('names nothing for a statement that is not a create', () => {
    expect(columnsDefinedByCreate('ALTER TABLE "t" ADD COLUMN "x" INTEGER')).toEqual([])
  })
})

describe('columnsProducedByMigrations', () => {
  test('reports what the corpus actually builds, not what a model declares', () => {
    const dir = corpus({
      '0000000001-create-posts-table.sql': 'CREATE TABLE "posts" ("id" INTEGER, "title" TEXT);',
      '0000000002-alter-posts-columns.sql': 'ALTER TABLE "posts" ADD COLUMN "body" TEXT;',
    })

    expect(columnsProducedByMigrations(dir, ['0000000001-create-posts-table.sql', '0000000002-alter-posts-columns.sql'], 'posts'))
      .toEqual(new Set(['id', 'title', 'body']))
  })

  test('forgets a dropped column', () => {
    const dir = corpus({
      '0000000001-create-posts-table.sql': 'CREATE TABLE "posts" ("id" INTEGER, "legacy" TEXT);',
      '0000000002-alter-posts-columns.sql': 'ALTER TABLE "posts" DROP COLUMN "legacy";',
    })

    expect(columnsProducedByMigrations(dir, ['0000000001-create-posts-table.sql', '0000000002-alter-posts-columns.sql'], 'posts'))
      .toEqual(new Set(['id']))
  })

  test('takes a SQLite rebuild as the whole new shape', () => {
    // The copy-to-temp dance replaces the table wholesale, so whatever the
    // temp table defines is what survives — including columns it drops.
    const dir = corpus({
      '0000000001-create-posts-table.sql': 'CREATE TABLE "posts" ("id" INTEGER, "old" TEXT);',
      '0000000002-auto-misc.sql': [
        'CREATE TABLE "_qb_tmp_posts" ("id" INTEGER, "title" TEXT);',
        'INSERT INTO "_qb_tmp_posts" ("id") SELECT "id" FROM "posts";',
        'DROP TABLE "posts";',
        'ALTER TABLE "_qb_tmp_posts" RENAME TO "posts";',
      ].join('\n'),
    })

    expect(columnsProducedByMigrations(dir, ['0000000001-create-posts-table.sql', '0000000002-auto-misc.sql'], 'posts'))
      .toEqual(new Set(['id', 'title']))
  })

  test('ignores other tables', () => {
    const dir = corpus({
      '0000000001-create-posts-table.sql': 'CREATE TABLE "posts" ("id" INTEGER);\nCREATE TABLE "pages" ("id" INTEGER, "slug" TEXT);',
    })

    expect(columnsProducedByMigrations(dir, ['0000000001-create-posts-table.sql'], 'posts')).toEqual(new Set(['id']))
  })
})

describe('rootedTableCatchUpStatements', () => {
  const create = [
    'CREATE TABLE "campaign_sends" (',
    '  "id" INTEGER PRIMARY KEY AUTOINCREMENT,',
    '  "status" TEXT,',
    '  "channel" TEXT,',
    '  "segments" INTEGER,',
    '  "cost" INTEGER',
    ')',
  ].join('\n')

  test('emits ADD COLUMN for exactly the gap', () => {
    const statements = rootedTableCatchUpStatements(create, new Set(['id', 'status']))

    expect(statements).toHaveLength(3)
    expect(statements[0]).toContain('ALTER TABLE "campaign_sends" ADD COLUMN "channel" TEXT')
    expect(statements[1]).toContain('"segments" INTEGER')
    expect(statements[2]).toContain('"cost" INTEGER')
  })

  test('is silent when the corpus already produces every column', () => {
    expect(rootedTableCatchUpStatements(create, new Set(['id', 'status', 'channel', 'segments', 'cost']))).toEqual([])
  })

  test('leaves out what SQLite cannot add after the fact', () => {
    // ADD COLUMN refuses PRIMARY KEY, UNIQUE and AUTOINCREMENT. Emitting them
    // would fail mid-run, which is worse than the column staying absent.
    const statements = rootedTableCatchUpStatements(create, new Set(['status', 'channel', 'segments', 'cost']))
    expect(statements).toEqual([])
  })

  test('names nothing for a statement that is not a create', () => {
    expect(rootedTableCatchUpStatements('ALTER TABLE "t" ADD COLUMN "x" INTEGER', new Set())).toEqual([])
  })

  test('drops NOT NULL when the column has no default', () => {
    // SQLite ACCEPTS this against an empty table and REJECTS it against a
    // populated one, so emitting it as written passes in CI - where every
    // table starts empty - and fails on the production database it was
    // written for. The column matters more than the constraint: a missing one
    // breaks every query that names it.
    const create = 'CREATE TABLE "campaign_sends" (\n "id" INTEGER,\n "recipient" TEXT not null\n)'
    const statements = rootedTableCatchUpStatements(create, new Set(['id']))

    expect(statements).toHaveLength(1)
    expect(statements[0]).toBe('ALTER TABLE "campaign_sends" ADD COLUMN "recipient" TEXT')
    expect(statements[0]).not.toContain('not null')
  })

  test('keeps NOT NULL when a default makes it addable', () => {
    const create = 'CREATE TABLE "campaigns" (\n "id" INTEGER,\n "timezone" TEXT not null default \'UTC\'\n)'
    const statements = rootedTableCatchUpStatements(create, new Set(['id']))

    expect(statements[0]).toContain('not null')
    expect(statements[0]).toContain('default \'UTC\'')
  })
})
