import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import {
  categorizablesTableSql,
  commentablesTableSql,
  commentableUpvotesTableSql,
  indexSqlForDialect,
  migrateTraitTables,
  taggablesTableSql,
  traitTableColumnGuarantees,
  traitTableIndexSql,
  traitTableNames,
  taggableModelsTableSql,
  categorizableModelsTableSql,
  likesTableSql,
  UNSCOPED_OWNER_ID,
} from '../src/trait-tables'
import { commonTableNames } from '../src/drivers/defaults/traits'
import { sqlHelpers } from '../src/sql-helpers'

/**
 * Polymorphic trait tables.
 *
 * `commentable`/`taggable`/`categorizable` are model traits with no backing
 * model, so bun-query-builder — which derives every migration from
 * `app/Models` — never created their tables. The driver-specific
 * `generate{Mysql,Postgres}TraitMigrations()` helpers meant to cover that gap
 * had no caller, had no sqlite equivalent, and emitted `.ts` migration files
 * that the runner cannot execute (it reads only `.sql`). Setting
 * `commentable: true` therefore did nothing on every driver.
 *
 * The DDL builders are pure, so dialect assertions need no connection. The
 * usability tests below run the real DDL through bun:sqlite and replay the
 * exact statements `orm/src/traits/*.ts` and the CMS modules issue.
 */

const TRAIT_TABLES = [
  'commentables', 'taggables', 'categorizables', 'commentable_upvotes',
  'taggable_models', 'categorizable_models',
] as const

function ddlFor(driver: string): { tables: string[], indexes: string[] } {
  const sql = sqlHelpers(driver)
  return {
    tables: [
      commentablesTableSql(sql),
      taggablesTableSql(sql),
      categorizablesTableSql(sql),
      commentableUpvotesTableSql(sql),
      taggableModelsTableSql(sql),
      categorizableModelsTableSql(sql),
    ],
    indexes: traitTableIndexSql().map(s => indexSqlForDialect(s, driver)),
  }
}

/** A sqlite database with the trait tables applied exactly as `buddy migrate` would. */
function migratedSqlite(): Database {
  const db = new Database(':memory:')
  const { tables, indexes } = ddlFor('sqlite')
  for (const statement of [...tables, ...indexes]) db.run(statement)
  return db
}

describe('trait table DDL — cross-dialect', () => {
  test('exports the migrator + pure builders', () => {
    expect(typeof migrateTraitTables).toBe('function')
    expect(typeof commentablesTableSql).toBe('function')
    expect(typeof taggablesTableSql).toBe('function')
    expect(typeof categorizablesTableSql).toBe('function')
    expect(typeof commentableUpvotesTableSql).toBe('function')
  })

  for (const driver of ['sqlite', 'mysql', 'postgres'] as const) {
    describe(driver, () => {
      const sql = sqlHelpers(driver)

      test('every trait table is created IF NOT EXISTS, so migrate is replayable', () => {
        for (const ddl of ddlFor(driver).tables)
          expect(ddl).toContain('CREATE TABLE IF NOT EXISTS')
      })

      test('every trait table uses the dialect primary key', () => {
        const tables = ddlFor(driver).tables
        for (const ddl of tables.slice(0, 4))
          expect(ddl).toContain(sql.pkColumn)
        for (const ddl of tables.slice(4))
          expect(ddl).toContain(sql.bigPkColumn)
      })

      test('commentables carries the polymorphic owner columns the trait filters on', () => {
        const ddl = commentablesTableSql(sql)
        expect(ddl).toContain('CREATE TABLE IF NOT EXISTS commentables')
        for (const col of ['title', 'body', 'status', 'commentables_id', 'commentables_type', 'user_id'])
          expect(ddl).toContain(col)
      })

      test('taggables and categorizables are type-scoped catalogues', () => {
        expect(taggablesTableSql(sql)).toContain('taggable_type VARCHAR(255) NOT NULL')
        expect(categorizablesTableSql(sql)).toContain('categorizable_type VARCHAR(255) NOT NULL')
      })

      test('commentable_upvotes carries the polymorphic target', () => {
        const ddl = commentableUpvotesTableSql(sql)
        for (const col of ['user_id', 'upvoteable_id', 'upvoteable_type'])
          expect(ddl).toContain(col)
      })

      test('approved_at/rejected_at are BIGINT — epoch ms overflows a 32-bit INTEGER', () => {
        const ddl = commentablesTableSql(sql)
        expect(ddl).toContain('approved_at BIGINT')
        expect(ddl).toContain('rejected_at BIGINT')
      })

      test('timestamps use the same column type as every other framework table', () => {
        // These were briefly VARCHAR, to dodge MySQL rejecting the ISO `Z`.
        // `sqlDateTime()` fixed the literal instead, so they line up with
        // auth/RBAC/notifications now — DATETIME on MySQL, TIMESTAMP elsewhere.
        expect(commentablesTableSql(sql)).toContain(`created_at ${sql.datetime}`)
        expect(commentablesTableSql(sql)).toContain(`updated_at ${sql.nullableTimestamp}`)
        for (const ddl of ddlFor(driver).tables)
          expect(ddl).not.toContain('VARCHAR(64)')
      })

      test('carries no DEFAULT CURRENT_TIMESTAMP — the DB clock is a different format', () => {
        // The database clock renders space-separated while the app writes the
        // canonical `T` form; on SQLite these hold text and mixing the two
        // breaks ordering. Every writer sets the value explicitly.
        // The two model-owned pivots deliberately match generated model DDL,
        // whose created_at column carries the framework default.
        for (const ddl of [
          commentablesTableSql(sql),
          taggablesTableSql(sql),
          categorizablesTableSql(sql),
          commentableUpvotesTableSql(sql),
        ])
          expect(ddl).not.toContain('DEFAULT CURRENT_TIMESTAMP')
      })

      test('is_active default uses the dialect boolean literal', () => {
        expect(taggablesTableSql(sql)).toContain(`is_active BOOLEAN NOT NULL DEFAULT ${sql.boolTrue}`)
      })
    })
  }

  test('index DDL keeps IF NOT EXISTS only where the dialect accepts it', () => {
    // MySQL has no `CREATE INDEX IF NOT EXISTS`; migrateTraitTables() drops the
    // clause there and swallows the duplicate-index error on replay instead.
    for (const statement of traitTableIndexSql()) {
      expect(indexSqlForDialect(statement, 'sqlite')).toContain('IF NOT EXISTS')
      expect(indexSqlForDialect(statement, 'postgres')).toContain('IF NOT EXISTS')
      expect(indexSqlForDialect(statement, 'mysql')).not.toContain('IF NOT EXISTS')
      expect(indexSqlForDialect(statement, 'singlestore')).not.toContain('IF NOT EXISTS')
      // stripping the clause must not damage the rest of the statement
      expect(indexSqlForDialect(statement, 'mysql')).toMatch(/^CREATE (UNIQUE )?INDEX \w+ ON \w+ \(/)
    }
  })

  test('model-owned pivots match the generator\'s 64-bit relation keys', () => {
    for (const ddl of [taggableModelsTableSql(sqlHelpers('mysql')), categorizableModelsTableSql(sqlHelpers('mysql'))]) {
      expect(ddl).toContain('id BIGINT PRIMARY KEY AUTO_INCREMENT')
      expect(ddl).not.toMatch(/(?:tag_id|taggable_id|category_id|categorizable_id) INTEGER/)
      expect(ddl).toContain("NOT NULL DEFAULT 'posts'")
    }
  })
})

describe('what migrate creates, migrate:fresh drops', () => {
  test('traitTableNames() lists exactly the tables the builders create', () => {
    const created = ddlFor('sqlite').tables.map((ddl) => {
      const match = /CREATE TABLE IF NOT EXISTS (\w+)/.exec(ddl)
      return match![1]
    })
    expect(created.sort()).toEqual([...traitTableNames()].sort())
  })

  test('every trait table is in the reset drop list', () => {
    // The drop list used to be duplicated per driver and had drifted; a trait
    // table missing from it survives `migrate:fresh` with stale rows.
    for (const table of traitTableNames())
      expect(commonTableNames()).toContain(table)
  })

  test('the drop list still covers the non-trait framework tables', () => {
    // Regression guard for the MySQL/SQLite vs Postgres drift: the Postgres
    // copy never dropped these three.
    for (const table of ['categorizable_models', 'categories_models', 'activities'])
      expect(commonTableNames()).toContain(table)
  })

  test('the drop list has no duplicates', () => {
    const names = commonTableNames()
    expect(names).toHaveLength(new Set(names).size)
  })
})

describe('a model with commentable: true ends up with a usable commentables table', () => {
  test('the table exists after migrate', () => {
    const db = migratedSqlite()
    const names = db.query(`SELECT name FROM sqlite_master WHERE type='table'`).all().map((r: any) => r.name)
    for (const table of TRAIT_TABLES) expect(names).toContain(table)
    db.close()
  })

  test('PRAGMA table_info(commentables) reports the columns the trait writes', () => {
    const db = migratedSqlite()
    const columns = db.query(`PRAGMA table_info(commentables)`).all().map((r: any) => r.name)
    for (const col of ['id', 'title', 'body', 'status', 'commentables_id', 'commentables_type', 'created_at', 'updated_at'])
      expect(columns).toContain(col)
    db.close()
  })

  test('addComment() then comments() round-trips — the exact statements the trait issues', () => {
    const db = migratedSqlite()
    const now = new Date().toISOString()

    // orm/src/traits/commentable.ts -> addComment()
    db.run(
      `INSERT INTO commentables (title, body, commentables_id, commentables_type, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`,
      ['Nice post', 'Body text', 1, 'posts', 'pending', now, now],
    )

    // -> comments()
    const rows = db.query(
      `SELECT * FROM commentables WHERE commentables_id = ? AND commentables_type = ?`,
    ).all(1, 'posts') as any[]
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe('Nice post')
    // the ISO string survives the round-trip unchanged
    expect(rows[0].created_at).toBe(now)

    // -> commentCount()
    const count = db.query(
      `SELECT count(*) as count FROM commentables WHERE commentables_id = ? AND commentables_type = ?`,
    ).get(1, 'posts') as any
    expect(Number(count.count)).toBe(1)

    // -> pendingComments() / approvedComments()
    const pending = db.query(
      `SELECT * FROM commentables WHERE commentables_id=? AND commentables_type=? AND status=?`,
    ).all(1, 'posts', 'pending') as any[]
    expect(pending).toHaveLength(1)
    const approved = db.query(
      `SELECT * FROM commentables WHERE commentables_id=? AND commentables_type=? AND status=?`,
    ).all(1, 'posts', 'approved') as any[]
    expect(approved).toHaveLength(0)

    db.close()
  })

  test('each owner gets its own comment row — nothing collides across ids or types', () => {
    const db = migratedSqlite()
    const now = new Date().toISOString()
    const insert = (id: number, type: string) => db.run(
      `INSERT INTO commentables (title, body, commentables_id, commentables_type, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`,
      ['Same title', 'Same body', id, type, 'pending', now, now],
    )
    insert(1, 'posts')
    insert(2, 'posts')
    insert(1, 'products')

    const posts = db.query(`SELECT * FROM commentables WHERE commentables_type='posts'`).all()
    expect(posts).toHaveLength(2)
    const products = db.query(`SELECT * FROM commentables WHERE commentables_type='products'`).all()
    expect(products).toHaveLength(1)
    db.close()
  })

  test('migrate is idempotent — a second run changes nothing', () => {
    const db = migratedSqlite()
    const now = new Date().toISOString()
    db.run(
      `INSERT INTO commentables (title, body, commentables_id, commentables_type, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`,
      ['Kept', 'Body', 1, 'posts', 'pending', now, now],
    )

    const { tables, indexes } = ddlFor('sqlite')
    expect(() => {
      for (const statement of [...tables, ...indexes]) db.run(statement)
    }).not.toThrow()

    // the replay must not have dropped or recreated anything
    expect(db.query(`SELECT * FROM commentables`).all()).toHaveLength(1)
    db.close()
  })
})

describe('taggable and categorizable tables are usable', () => {
  test('addTag() writes the flat row the trait selects back', () => {
    const db = migratedSqlite()
    const now = new Date().toISOString()
    db.run(
      `INSERT INTO taggables (name, slug, description, taggable_id, taggable_type, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
      ['news', 'news', 'desc', 1, 'posts', 1, now, now],
    )
    const rows = db.query(
      `SELECT * FROM taggables WHERE taggable_id=? AND taggable_type=?`,
    ).all(1, 'posts') as any[]
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('news')
    db.close()
  })

  test('addCategory() writes categorizables and links through categorizable_models', () => {
    // categorizable_models no longer has to be stood up by hand: the trait
    // needs it whenever `categorizable: true` is set, so migrate guarantees it.
    const db = migratedSqlite()
    const now = new Date().toISOString()
    db.run(
      `INSERT INTO categorizables (name, slug, description, categorizable_type, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`,
      ['News', 'news', 'desc', 'posts', 1, now, now],
    )
    const category = db.query(`SELECT * FROM categorizables WHERE name=? AND categorizable_type=?`).get('News', 'posts') as any
    expect(category).toBeTruthy()
    db.run(
      `INSERT INTO categorizable_models (category_id, categorizable_id, categorizable_type) VALUES (?,?,?)`,
      [category.id, 1, 'posts'],
    )

    // orm/src/traits/categorizable.ts -> categories()
    const links = db.query(`SELECT * FROM categorizable_models WHERE categorizable_id=? AND categorizable_type=?`).all(1, 'posts') as any[]
    expect(links).toHaveLength(1)
    const categories = db.query(`SELECT * FROM categorizables WHERE id IN (${links.map(l => l.category_id).join(',')})`).all()
    expect(categories).toHaveLength(1)
    db.close()
  })

  test('two owners can carry the same tag — the per-owner write no longer collides', () => {
    // The index used to be UNIQUE (taggable_type, slug), which meant the
    // second record given a tag hit a constraint violation. It is now scoped
    // by owner as well.
    const db = migratedSqlite()
    const now = new Date().toISOString()
    const addTag = (ownerId: number, type: string) => db.run(
      `INSERT INTO taggables (name, slug, taggable_id, taggable_type, is_active, created_at) VALUES (?,?,?,?,?,?)`,
      ['news', 'news', ownerId, type, 1, now],
    )
    addTag(1, 'posts')
    expect(() => addTag(2, 'posts')).not.toThrow()
    expect(() => addTag(1, 'products')).not.toThrow()
    // the same tag twice on the SAME owner is still a duplicate
    expect(() => addTag(1, 'posts')).toThrow()
    db.close()
  })

  test('catalogue rows stay unique per model type', () => {
    // A CMS write omits the owner id, so it lands on UNSCOPED_OWNER_ID and
    // "one 'news' tag per type" still holds — the property NULL could not give
    // us on SQLite or MySQL.
    const db = migratedSqlite()
    const now = new Date().toISOString()
    const catalogue = (type: string) => db.run(
      `INSERT INTO taggables (name, slug, taggable_type, is_active, created_at) VALUES (?,?,?,?,?)`,
      ['news', 'news', type, 1, now],
    )
    catalogue('posts')
    expect(() => catalogue('products')).not.toThrow()
    expect(() => catalogue('posts')).toThrow()

    const unscoped = db.query(`SELECT taggable_id FROM taggables WHERE taggable_type='posts'`).get() as any
    expect(unscoped.taggable_id).toBe(UNSCOPED_OWNER_ID)
    db.close()
  })

  test('categorizables is scoped the same way', () => {
    const db = migratedSqlite()
    const now = new Date().toISOString()
    const add = (ownerId: number) => db.run(
      `INSERT INTO categorizables (name, slug, categorizable_id, categorizable_type, is_active, created_at) VALUES (?,?,?,?,?,?)`,
      ['News', 'news', ownerId, 'posts', 1, now],
    )
    add(1)
    expect(() => add(2)).not.toThrow()
    expect(() => add(1)).toThrow()
    db.close()
  })
})

describe('likeable gets its per-model table', () => {
  test('the like table carries the trait-derived foreign key', () => {
    const sql = sqlHelpers('sqlite')
    const ddl = likesTableSql(sql, 'posts_likes', 'post_id')
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS posts_likes')
    expect(ddl).toContain('post_id INTEGER NOT NULL')
    expect(ddl).toContain('user_id INTEGER NOT NULL')
    // like() catches this collision to stay idempotent
    expect(ddl).toContain('UNIQUE (post_id, user_id)')
  })

  test('like/unlike/isLiked round-trip, and a duplicate like is caught', () => {
    const db = new Database(':memory:')
    db.run(likesTableSql(sqlHelpers('sqlite'), 'posts_likes', 'post_id'))
    const now = new Date().toISOString()
    const like = (postId: number, userId: number) => db.run(
      `INSERT INTO posts_likes (post_id, user_id, created_at, updated_at) VALUES (?,?,?,?)`,
      [postId, userId, now, now],
    )
    like(1, 7)
    expect(db.query(`SELECT * FROM posts_likes WHERE post_id=? AND user_id=?`).all(1, 7)).toHaveLength(1)
    // the unique index is what makes like() idempotent rather than stacking rows
    expect(() => like(1, 7)).toThrow()
    // different user, and different post, are both fine
    expect(() => like(1, 8)).not.toThrow()
    expect(() => like(2, 7)).not.toThrow()

    db.run(`DELETE FROM posts_likes WHERE post_id=? AND user_id=?`, [1, 7])
    expect(db.query(`SELECT * FROM posts_likes WHERE post_id=? AND user_id=?`).all(1, 7)).toHaveLength(0)
    db.close()
  })

  test('a custom likeable table/foreignKey is honoured', () => {
    const ddl = likesTableSql(sqlHelpers('sqlite'), 'article_hearts', 'article_id')
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS article_hearts')
    expect(ddl).toContain('UNIQUE (article_id, user_id)')
  })
})

describe('comment upvotes are usable', () => {
  test('one upvote per user per comment, and the count reflects it', () => {
    const db = migratedSqlite()
    const now = new Date().toISOString()
    const upvote = (commentId: number, userId: number) => db.run(
      `INSERT INTO commentable_upvotes (upvoteable_id, upvoteable_type, user_id, created_at) VALUES (?,?,?,?)`,
      [commentId, 'commentables', userId, now],
    )
    upvote(1, 7)
    // upvoteComment() catches this and returns the existing row
    expect(() => upvote(1, 7)).toThrow()
    expect(() => upvote(1, 8)).not.toThrow()
    expect(() => upvote(2, 7)).not.toThrow()

    const count = db.query(
      `SELECT count(*) as count FROM commentable_upvotes WHERE upvoteable_id=? AND upvoteable_type=?`,
    ).get(1, 'commentables') as any
    expect(Number(count.count)).toBe(2)
    db.close()
  })
})

describe('the trait pivots exist without a model declaring them', () => {
  test('taggable_models and categorizable_models are created and de-duplicated', () => {
    const db = migratedSqlite()
    const link = (table: string, cols: string, vals: any[]) => db.run(`INSERT INTO ${table} (${cols}) VALUES (?,?,?)`, vals)

    link('taggable_models', 'tag_id, taggable_id, taggable_type', [1, 1, 'posts'])
    expect(() => link('taggable_models', 'tag_id, taggable_id, taggable_type', [1, 1, 'posts'])).toThrow()
    expect(() => link('taggable_models', 'tag_id, taggable_id, taggable_type', [1, 2, 'posts'])).not.toThrow()

    link('categorizable_models', 'category_id, categorizable_id, categorizable_type', [1, 1, 'posts'])
    expect(() => link('categorizable_models', 'category_id, categorizable_id, categorizable_type', [1, 1, 'posts'])).toThrow()
    db.close()
  })
})

describe('drifted catalogue tables', () => {
  /**
   * `CREATE TABLE IF NOT EXISTS` guarantees a table by that NAME, not a table
   * with these columns. A database whose `categorizables` predates the
   * owner-scoping column kept its old shape, the create was skipped in
   * silence, and the unique index then failed with "no such column:
   * categorizable_id" on every single migrate of every app.
   */
  test('adds an owner column a pre-existing table is missing', () => {
    const db = new Database(':memory:')
    const sql = sqlHelpers('sqlite')

    // The old shape: no categorizable_id.
    db.run(`CREATE TABLE categorizables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      categorizable_type VARCHAR(255) NOT NULL
    )`)

    // The create is a no-op against it, which is the trap.
    db.run(categorizablesTableSql(sql))
    const before = db.query('PRAGMA table_info(categorizables)').all() as { name: string }[]
    expect(before.some(column => column.name === 'categorizable_id')).toBe(false)

    // The reconciliation pass is what closes the gap.
    for (const { table, column, definition } of traitTableColumnGuarantees(sql)) {
      if (table !== 'categorizables')
        continue

      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    }

    const after = db.query('PRAGMA table_info(categorizables)').all() as { name: string }[]
    expect(after.some(column => column.name === 'categorizable_id')).toBe(true)

    // And the index that had been failing now applies.
    const index = traitTableIndexSql().find(statement => statement.includes('categorizables_owner_slug_unique'))
    expect(() => db.run(indexSqlForDialect(index as string, 'sqlite'))).not.toThrow()

    db.close()
  })

  test('is a no-op against a table that already has the column', () => {
    const db = new Database(':memory:')
    const sql = sqlHelpers('sqlite')

    db.run(categorizablesTableSql(sql))
    db.run(taggablesTableSql(sql))

    for (const { table, column, definition } of traitTableColumnGuarantees(sql)) {
      // Adding a column that exists throws, and the caller tolerates exactly
      // that error rather than treating a healthy database as broken.
      expect(() => db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`))
        .toThrow(/duplicate column/i)
    }

    db.close()
  })

  test('guarantees the owner column on both catalogues', () => {
    const guarantees = traitTableColumnGuarantees(sqlHelpers('sqlite'))

    expect(guarantees.map(g => `${g.table}.${g.column}`).sort())
      .toEqual(['categorizables.categorizable_id', 'taggables.taggable_id'])
  })
})
