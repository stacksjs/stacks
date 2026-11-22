/**
 * A diff that mixes safe and destructive changes is split, not refused.
 *
 * The case this exists for: an app whose database still holds tables from a
 * feature it removed. Adding one column to another table proposed dropping
 * all of them, and declining (or running where nobody can be asked) cancelled
 * the whole migration, column included.
 */
import type { MigrationOperation, MigrationPlan } from '@stacksjs/query-builder'
import { describe, expect, test } from 'bun:test'
import { describeHeldBackChange, holdBackDestructiveChanges, planKeepingHeldBackChanges } from '../src/held-back-changes'

function op(kind: MigrationOperation['kind'], table: string, sql: string, extra: Partial<MigrationOperation> = {}): MigrationOperation {
  return { kind, table, sql, destructive: kind === 'drop_table' || kind === 'drop_column', ...extra }
}

function column(name: string): MigrationPlan['tables'][number]['columns'][number] {
  return { name, type: 'string', isPrimaryKey: false, isUnique: false, isNullable: true, hasDefault: false } as MigrationPlan['tables'][number]['columns'][number]
}

function table(name: string, columns: string[]): MigrationPlan['tables'][number] {
  return { table: name, columns: columns.map(column), indexes: [] }
}

const ADD_COLUMN = 'ALTER TABLE "post_targets" ADD COLUMN "attempts" INTEGER default 0;'
const DROP_TABLE = 'DROP TABLE IF EXISTS "publications"'
const DROP_COLUMN = 'ALTER TABLE "blog_posts" DROP COLUMN "access";'

describe('holdBackDestructiveChanges', () => {
  test('keeps the safe statements and removes the destructive ones', () => {
    const operations = [
      op('add_column', 'post_targets', ADD_COLUMN, { column: 'attempts' }),
      op('drop_table', 'publications', DROP_TABLE),
      op('drop_column', 'blog_posts', DROP_COLUMN, { column: 'access' }),
    ]

    const split = holdBackDestructiveChanges([ADD_COLUMN, DROP_TABLE, DROP_COLUMN], operations)

    expect(split.statements).toEqual([ADD_COLUMN])
    expect(split.held.map(held => `${held.kind}:${held.table}`)).toEqual(['drop_table:publications', 'drop_column:blog_posts'])
  })

  test('changes nothing when nothing is destructive', () => {
    const statements = [ADD_COLUMN, 'CREATE TABLE "notes" ("id" INTEGER PRIMARY KEY)']
    const split = holdBackDestructiveChanges(statements, [
      op('add_column', 'post_targets', ADD_COLUMN, { column: 'attempts' }),
      op('create_table', 'notes', statements[1]!),
    ])

    expect(split.statements).toEqual(statements)
    expect(split.held).toEqual([])
  })

  test('matches a statement the dialect wrote differently from the operation', () => {
    const operations = [
      op('drop_table', 'publications', 'DROP TABLE "publications"'),
      op('drop_column', 'blog_posts', 'ALTER TABLE "blog_posts" DROP COLUMN "access"', { column: 'access' }),
    ]
    const emitted = ['DROP TABLE IF EXISTS "publications" CASCADE;', 'ALTER TABLE `blog_posts` DROP COLUMN `access`;', ADD_COLUMN]

    expect(holdBackDestructiveChanges(emitted, operations).statements).toEqual([ADD_COLUMN])
  })

  test('does not hold back a drop on a table that merely shares a prefix', () => {
    const keep = 'DROP TABLE IF EXISTS "publications_archive"'
    const split = holdBackDestructiveChanges([DROP_TABLE, keep], [op('drop_table', 'publications', DROP_TABLE)])

    expect(split.statements).toEqual([keep])
  })

  test('holds back a rebuild of a table that has a held-back column drop', () => {
    // SQLite recreates the table from the model, which no longer has the
    // column: running the rebuild would drop it after all.
    const rebuild = 'PRAGMA foreign_keys=OFF; BEGIN; CREATE TABLE "_qb_tmp_blog_posts" ("id" INTEGER); COMMIT;'
    const operations = [
      op('drop_column', 'blog_posts', DROP_COLUMN, { column: 'access' }),
      op('rebuild_table', 'blog_posts', rebuild),
    ]

    const split = holdBackDestructiveChanges([DROP_COLUMN, rebuild, ADD_COLUMN], operations)

    expect(split.statements).toEqual([ADD_COLUMN])
    expect(split.held.map(held => held.kind)).toEqual(['drop_column', 'rebuild_table'])
  })

  test('lets a rebuild through when its table loses nothing', () => {
    const rebuild = 'PRAGMA foreign_keys=OFF; BEGIN; CREATE TABLE "_qb_tmp_post_targets" ("id" INTEGER); COMMIT;'
    const split = holdBackDestructiveChanges([rebuild, DROP_TABLE], [
      op('rebuild_table', 'post_targets', rebuild),
      op('drop_table', 'publications', DROP_TABLE),
    ])

    expect(split.statements).toEqual([rebuild])
  })
})

describe('planKeepingHeldBackChanges', () => {
  const previous: MigrationPlan = {
    dialect: 'sqlite',
    tables: [table('posts', ['id', 'body']), table('publications', ['id', 'name']), table('blog_posts', ['id', 'title', 'access'])],
  }
  const models: MigrationPlan = {
    dialect: 'sqlite',
    tables: [table('posts', ['id', 'body', 'attempts']), table('blog_posts', ['id', 'title'])],
  }

  test('keeps a held-back table in the snapshot, so it is proposed again', () => {
    const plan = planKeepingHeldBackChanges(models, previous, [op('drop_table', 'publications', DROP_TABLE)])

    expect(plan.tables.map(entry => entry.table)).toEqual(['posts', 'blog_posts', 'publications'])
  })

  test('keeps a held-back column in the snapshot', () => {
    const plan = planKeepingHeldBackChanges(models, previous, [op('drop_column', 'blog_posts', DROP_COLUMN, { column: 'access' })])

    expect(plan.tables.find(entry => entry.table === 'blog_posts')?.columns.map(entry => entry.name)).toEqual(['id', 'title', 'access'])
  })

  test('still records what was generated', () => {
    const plan = planKeepingHeldBackChanges(models, previous, [op('drop_table', 'publications', DROP_TABLE)])

    expect(plan.tables.find(entry => entry.table === 'posts')?.columns.map(entry => entry.name)).toEqual(['id', 'body', 'attempts'])
  })

  test('keeps a held-back rebuild as the previous snapshot describes the table', () => {
    const plan = planKeepingHeldBackChanges(models, previous, [op('rebuild_table', 'blog_posts', 'BEGIN; COMMIT;')])

    expect(plan.tables.find(entry => entry.table === 'blog_posts')?.columns.map(entry => entry.name)).toEqual(['id', 'title', 'access'])
  })

  test('does not change the plans it was given', () => {
    const before = JSON.stringify([models, previous])
    planKeepingHeldBackChanges(models, previous, [
      op('drop_table', 'publications', DROP_TABLE),
      op('drop_column', 'blog_posts', DROP_COLUMN, { column: 'access' }),
    ])

    expect(JSON.stringify([models, previous])).toBe(before)
  })

  test('returns the plan as it is when nothing was held back or there is no previous snapshot', () => {
    expect(planKeepingHeldBackChanges(models, previous, [])).toBe(models)
    expect(planKeepingHeldBackChanges(models, undefined, [op('drop_table', 'publications', DROP_TABLE)])).toBe(models)
  })

  test('applying the held-back change later removes it for good', () => {
    // The next run is approved: nothing is held back, so the stored plan
    // becomes the models' plan and the table is gone from it.
    const held = planKeepingHeldBackChanges(models, previous, [op('drop_table', 'publications', DROP_TABLE)])
    const approved = planKeepingHeldBackChanges(models, held, [])

    expect(approved.tables.map(entry => entry.table)).toEqual(['posts', 'blog_posts'])
  })
})

describe('describeHeldBackChange', () => {
  test('says what was not done, and that the data is untouched', () => {
    expect(describeHeldBackChange(op('drop_table', 'publications', DROP_TABLE))).toContain('not dropped')
    expect(describeHeldBackChange(op('drop_column', 'blog_posts', DROP_COLUMN, { column: 'access' }))).toContain('"blog_posts"."access"')
  })
})
