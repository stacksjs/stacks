import type { Model } from '@stacksjs/types'
import { Database } from 'bun:sqlite'
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getLikeableForeignKey, getUpvoteTableName } from '../src/drivers/helpers'

// stacksjs/stacks#1954 — likeable pivot generation. Three coupled defects:
//
//   1. The driver generators only built the `<table>_likes` pivot when
//      `traits.likeable` was a non-empty ARRAY, but the published type is
//      `boolean | LikeableOptions` — no typed model could ever pass the
//      gate, while the runtime trait enables like()/likeCount() for any
//      truthy value.
//   2. getUpvoteTableName() returned undefined for `likeable: true`, so
//      drop/truncate lifecycles never saw boolean-form pivot tables.
//   3. The generated pivot used a PLURAL FK (`${tableName}_id`) while the
//      runtime trait writes the singular `${tableName.replace(/s$/, '')}_id`,
//      and no composite UNIQUE (user_id, fk) existed — making the trait's
//      duplicate-recovery catch unreachable.

const makeModel = (likeable: unknown): Model => ({
  name: 'JudgeReview',
  table: 'judge_reviews',
  traits: { likeable } as Model['traits'],
  attributes: {},
} as unknown as Model)

describe('getUpvoteTableName (stacksjs/stacks#1954)', () => {
  it('returns the default pivot for likeable: true', () => {
    expect(getUpvoteTableName(makeModel(true), 'judge_reviews')).toBe('judge_reviews_likes')
  })

  it('returns the default pivot for an options object without table', () => {
    expect(getUpvoteTableName(makeModel({}), 'judge_reviews')).toBe('judge_reviews_likes')
  })

  it('honors a table override', () => {
    expect(getUpvoteTableName(makeModel({ table: 'custom_likes' }), 'judge_reviews')).toBe('custom_likes')
  })

  it('returns undefined when likeable is false or absent', () => {
    expect(getUpvoteTableName(makeModel(false), 'judge_reviews')).toBeUndefined()
    expect(getUpvoteTableName(makeModel(undefined), 'judge_reviews')).toBeUndefined()
    expect(getUpvoteTableName({ name: 'X', table: 'xs', attributes: {} } as unknown as Model, 'xs')).toBeUndefined()
  })

  it('keeps the default pivot for legacy array form', () => {
    expect(getUpvoteTableName(makeModel(['judge_reviews']), 'judge_reviews')).toBe('judge_reviews_likes')
  })
})

describe('getLikeableForeignKey (stacksjs/stacks#1954)', () => {
  it('defaults to the singular FK the runtime trait writes to', () => {
    // Must equal `${tableName.replace(/s$/, '')}_id` — the literal default
    // in orm/src/traits/likeable.ts (not imported here; its module graph
    // pulls the @stacksjs/database barrel).
    expect(getLikeableForeignKey(makeModel(true), 'judge_reviews')).toBe('judge_review_id')
  })

  it('honors a foreignKey override', () => {
    expect(getLikeableForeignKey(makeModel({ foreignKey: 'review_id' }), 'judge_reviews')).toBe('review_id')
  })

  it('ignores legacy array forms and falls back to the default', () => {
    expect(getLikeableForeignKey(makeModel(['judge_reviews']), 'judge_reviews')).toBe('judge_review_id')
  })
})

// The generator fix is a literal-string change in three driver files, so the
// regression guard is a literal-string check (pattern of
// postgres-pivot-timestamptz.test.ts).
describe.each(['sqlite', 'mysql', 'postgres'])('%s createTableMigration likeable pivot (stacksjs/stacks#1954)', (driver) => {
  const source = readFileSync(resolve(__dirname, `../src/drivers/${driver}.ts`), 'utf-8')
  const fnIdx = source.indexOf('async function createTableMigration')
  const after = source.slice(fnIdx)
  const nextFnRel = after.slice(1).search(/\n(?:export\s+)?(?:async\s+)?function\s/)
  const block = nextFnRel === -1 ? after : after.slice(0, nextFnRel + 1)

  it('gate no longer requires a non-empty likeable array', () => {
    expect(fnIdx).toBeGreaterThan(-1)
    expect(block).not.toMatch(/likeable && Array\.isArray\(model\.traits\.likeable\) && model\.traits\.likeable\.length > 0/)
    expect(block).toMatch(/Array\.isArray\(model\?\.traits\?\.likeable\) \? model\.traits\.likeable\.length > 0 : Boolean\(model\?\.traits\?\.likeable\)/)
  })

  it('pivot FK column uses the singular foreignKey, not the plural table name', () => {
    const upvoteIdx = block.indexOf('// Create upvote table')
    expect(upvoteIdx).toBeGreaterThan(-1)
    const upvoteBlock = block.slice(upvoteIdx)
    expect(upvoteBlock).toMatch(/addColumn\('\$\{foreignKey\}'/)
    expect(upvoteBlock).not.toMatch(/addColumn\('\$\{tableName\}_id'/)
  })

  it('emits the composite unique (user_id, fk) index and no plain user_id index', () => {
    const upvoteIdx = block.indexOf('// Create upvote table')
    const upvoteBlock = block.slice(upvoteIdx)
    expect(upvoteBlock).toMatch(/columns\(\['user_id', '\$\{foreignKey\}'\]\)\.unique\(\)/)
    expect(upvoteBlock).not.toMatch(/createIndex\('\$\{upvoteTable\}_user_id_index'\)/)
  })

  if (driver === 'mysql') {
    it('emitted migration body references the up(db) parameter, not undefined _db', () => {
      const upvoteIdx = block.indexOf('// Create upvote table')
      const upvoteBlock = block.slice(upvoteIdx)
      expect(upvoteBlock).not.toContain('(_db as any)')
    })
  }
})

// End-to-end: the table + composite unique a fixed generator emits actually
// backs the trait's duplicate-recovery contract. Driver-local bun:sqlite —
// the qb connection preload is unnecessary here.
describe('composite unique enforces like() idempotency (stacksjs/stacks#1954)', () => {
  it('rejects duplicate (user_id, fk) pairs and recovery select finds the row', () => {
    const db = new Database(':memory:')
    try {
      db.exec(`CREATE TABLE judge_reviews_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        judge_review_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )`)
      db.exec('CREATE UNIQUE INDEX judge_reviews_likes_user_judge_review_id_unique ON judge_reviews_likes (user_id, judge_review_id)')

      db.exec('INSERT INTO judge_reviews_likes (judge_review_id, user_id) VALUES (1, 7)')
      let code: string | undefined
      try {
        db.exec('INSERT INTO judge_reviews_likes (judge_review_id, user_id) VALUES (1, 7)')
      }
      catch (err) {
        code = (err as { code?: string }).code
      }
      expect(code).toBe('SQLITE_CONSTRAINT_UNIQUE')

      // createLikeableMethods-style recovery: the existing row is returned.
      const existing = db.prepare('SELECT * FROM judge_reviews_likes WHERE judge_review_id = ? AND user_id = ?').get(1, 7)
      expect(existing).not.toBeNull()

      // A different user liking the same row still succeeds.
      db.exec('INSERT INTO judge_reviews_likes (judge_review_id, user_id) VALUES (1, 8)')
      const count = db.prepare('SELECT COUNT(*) AS count FROM judge_reviews_likes WHERE judge_review_id = 1').get() as { count: number }
      expect(count.count).toBe(2)
    }
    finally {
      db.close()
    }
  })
})
