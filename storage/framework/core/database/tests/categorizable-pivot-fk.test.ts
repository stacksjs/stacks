// The polymorphic pivots' foreign keys, as the committed corpus installs them.
//
// Background: `categorizable_models.category_id` shipped with
// `REFERENCES "categories"("id")` - the COMMERCE catalogue - while CMS
// allocates those ids in `categorizables`. Migration 0000000117 created the
// column with no foreign key and its comment records the intent
// (`category_id` -> categorizables.id); the generated `_qb_tmp_` rebuilds in
// 0000000151 and 1785502251816 introduced the wrong reference.
//
// With foreign keys enforced that made a CMS category impossible to link: the
// insert failed unless an identically numbered commerce category happened to
// exist, so coincidentally matching ids concealed it. See stacksjs/stacks#2593.
//
// The runtime is the ground truth: `createCategorizableMethods` in
// orm/src/traits/categorizable.ts reads `categorizable_models.category_id` and
// then looks those ids up with `selectFrom('categorizables')`.
//
// `taggable_models` is deliberately asserted the OTHER way. Its `tag_id` really
// does point at `tags`, not `taggables` - stacksjs/stacks#2579 established that
// and corrected migration 0000000119's comment, which had claimed `taggables`
// for the life of the table. The two pivots look symmetrical and are not, so
// both directions are pinned here to stop a future "consistency" fix from
// reintroducing #2579.

import { Database } from 'bun:sqlite'
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const CORPUS = join(import.meta.dir, '../../../../../database/migrations')

/** Apply the committed corpus to a throwaway in-memory database. */
function install(): Database {
  const db = new Database(':memory:')
  for (const file of readdirSync(CORPUS).filter(f => f.endsWith('.sql')).sort()) {
    // A handful of files fail on prerequisites this harness does not stand up
    // (print_devices, notifications). They are unrelated to the pivots and
    // pre-date this test; skipping keeps the failure surface here honest.
    try {
      db.exec(readFileSync(join(CORPUS, file), 'utf8'))
    }
    catch {}
  }
  return db
}

function references(db: Database, table: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const row of db.query(`PRAGMA foreign_key_list("${table}")`).all() as any[])
    out[row.from] = `${row.table}.${row.to}`
  return out
}

describe('polymorphic pivot foreign keys', () => {
  it('categorizable_models.category_id references the CMS categorizables table', () => {
    expect(references(install(), 'categorizable_models').category_id).toBe('categorizables.id')
  })

  it('never references the commerce catalogue', () => {
    expect(Object.values(references(install(), 'categorizable_models'))).not.toContain('categories.id')
  })

  it('leaves the polymorphic owner column unconstrained', () => {
    // `categorizable_type` selects the owning table, so no single table is
    // correct to reference. The installed schema had no owner FK either.
    expect(references(install(), 'categorizable_models').categorizable_id).toBeUndefined()
  })

  it('links a CMS category with foreign keys enforced', () => {
    const db = install()
    db.exec('PRAGMA foreign_keys = ON')
    db.exec(`INSERT INTO "categorizables" ("id","name","slug","categorizable_type") VALUES (7,'News','news','posts')`)
    db.exec(`INSERT INTO "posts" ("id") VALUES (1)`)

    expect(() => db.exec(`INSERT INTO "categorizable_models" ("category_id","categorizable_id","categorizable_type") VALUES (7,1,'posts')`)).not.toThrow()
  })

  it('rejects a category id that exists in neither table', () => {
    const db = install()
    db.exec('PRAGMA foreign_keys = ON')
    db.exec(`INSERT INTO "posts" ("id") VALUES (1)`)

    expect(() => db.exec(`INSERT INTO "categorizable_models" ("category_id","categorizable_id","categorizable_type") VALUES (9999,1,'posts')`)).toThrow()
  })

  it('links a CMS category with the commerce catalogue absent entirely', () => {
    const db = install()
    db.exec('PRAGMA foreign_keys = OFF')
    db.exec('DROP TABLE IF EXISTS "categories"')
    db.exec('PRAGMA foreign_keys = ON')
    db.exec(`INSERT INTO "categorizables" ("id","name","slug","categorizable_type") VALUES (7,'News','news','posts')`)
    db.exec(`INSERT INTO "posts" ("id") VALUES (1)`)

    expect(() => db.exec(`INSERT INTO "categorizable_models" ("category_id","categorizable_id","categorizable_type") VALUES (7,1,'posts')`)).not.toThrow()
  })

  // Not a copy-paste of the block above. See the header: tags point at `tags`.
  it('taggable_models.tag_id still references tags, not taggables (#2579)', () => {
    expect(references(install(), 'taggable_models').tag_id).toBe('tags.id')
  })
})
