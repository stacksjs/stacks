import { describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { statementReferencesTable, statementTable, withoutGatedStatements } from '../src/migrations'

// Verbatim from `0000000133-normalize-tag-uniques.sql`, the statement that
// failed a `migrate:fresh` on a `--minimal` scaffold with `no such table: tags`.
const CTE_UPDATE = `WITH duplicate_names AS (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS duplicate_rank
    FROM tags
  )
  WHERE duplicate_rank > 1
)
UPDATE tags
SET name = SUBSTR(name, 1, 40) || '-' || id
WHERE id IN (SELECT id FROM duplicate_names)`

describe('statementTable', () => {
  it('still reads the DDL forms it always did', () => {
    expect(statementTable('ALTER TABLE tags ADD COLUMN color TEXT')).toBe('tags')
    expect(statementTable('CREATE TABLE IF NOT EXISTS "tags" (id INTEGER)')).toBe('tags')
    expect(statementTable('DROP TABLE IF EXISTS tags')).toBe('tags')
    expect(statementTable('CREATE UNIQUE INDEX tags_slug ON tags (slug)')).toBe('tags')
  })

  it('reads data statements, which it used to call untabled', () => {
    // These returned null, so every caller filtering on this kept them.
    expect(statementTable('UPDATE coupons SET is_active = 1')).toBe('coupons')
    expect(statementTable('INSERT INTO tags (name) VALUES (\'x\')')).toBe('tags')
    expect(statementTable('INSERT OR IGNORE INTO tags (name) VALUES (\'x\')')).toBe('tags')
    expect(statementTable('DELETE FROM tags WHERE id = 1')).toBe('tags')
  })

  it('sees past a common table expression to the verb', () => {
    expect(statementTable(CTE_UPDATE)).toBe('tags')
  })

  it('sees past several chained common table expressions', () => {
    const chained = `WITH a AS (SELECT 1), b AS (SELECT 2) UPDATE tags SET name = 'x'`
    expect(statementTable(chained)).toBe('tags')
  })

  it('returns null for a statement naming no table it can identify', () => {
    expect(statementTable('PRAGMA foreign_keys = ON')).toBeNull()
  })
})

describe('statementReferencesTable', () => {
  it('finds a table read inside a subquery, not just the target', () => {
    expect(statementReferencesTable(CTE_UPDATE, 'tags')).toBe(true)
  })

  it('does not match a table whose name merely contains another', () => {
    expect(statementReferencesTable('SELECT 1 FROM taggables', 'tags')).toBe(false)
    expect(statementReferencesTable('UPDATE tag_groups SET x = 1', 'tags')).toBe(false)
  })
})

describe('withoutGatedStatements', () => {
  it('gates the documented errors backfill without turning its comment into SQL', () => {
    const sql = readFileSync(new URL('../../../../../database/migrations/1789486698564-backfill-errors-resolution.sql', import.meta.url), 'utf8')
    expect(withoutGatedStatements(sql, new Set(['errors']))).toBe('')
  })

  it('preserves quoted semicolons when a documented mixed migration is filtered', () => {
    const sql = `-- Triage changed; keep application data intact.
UPDATE errors SET resolution = 'resolved';
-- The disabled errors table does not own this statement.
UPDATE users SET name = 'a; -- b';`
    const out = withoutGatedStatements(sql, new Set(['errors']))
    const database = new Database(':memory:')
    try {
      database.exec("CREATE TABLE users (name TEXT); INSERT INTO users VALUES ('before');")
      database.exec(out)
      expect(database.query('SELECT name FROM users').get()).toEqual({ name: 'a; -- b' })
    }
    finally {
      database.close()
    }
  })

  it('drops a CTE-led UPDATE against a gated table', () => {
    // The #2323 failure. CMS off means `0000000100-create-tags-table.sql` is
    // hidden and `tags` never exists, but this statement was kept and ran,
    // so `migrate:fresh` exited 1 on a freshly scaffolded app.
    const out = withoutGatedStatements(`${CTE_UPDATE};`, new Set(['tags']))

    expect(out).toBe('')
  })

  it('keeps the statements whose tables are not gated', () => {
    const sql = `UPDATE tags SET name = 'a';\nUPDATE users SET name = 'b';`
    const out = withoutGatedStatements(sql, new Set(['tags']))

    expect(out).toContain('UPDATE users')
    expect(out).not.toContain('UPDATE tags')
  })

  it('leaves a file alone when nothing in it is gated', () => {
    const sql = `UPDATE users SET name = 'b';`
    expect(withoutGatedStatements(sql, new Set(['tags']))).toBe(sql)
  })

  it('is a no-op when nothing is gated at all', () => {
    const sql = `UPDATE tags SET name = 'a';`
    expect(withoutGatedStatements(sql, new Set())).toBe(sql)
  })
})

describe('temporary backfill tables and disabled features', () => {
  const productBackfill = readFileSync(new URL('../../../../../database/migrations/1789486698569-backfill-products-slug.sql', import.meta.url), 'utf8')

  it('removes the complete product-slug temporary-table lifecycle when commerce is disabled', () => {
    const gated = new Set(['products'])
    const sql = withoutGatedStatements(`${productBackfill}\nCREATE TABLE application_audit (id INTEGER);`, gated)
    const db = new Database(':memory:')
    try {
      expect(() => db.exec(sql)).not.toThrow()
      expect(withoutGatedStatements(productBackfill, gated)).toBe('')
      expect(db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all()).toEqual([{ name: 'application_audit' }])
      expect(db.query('SELECT name FROM sqlite_temp_master').all()).toEqual([])
    }
    finally { db.close() }
  })

  it('preserves and executes the original backfill when its feature is enabled', () => {
    const sql = withoutGatedStatements(productBackfill, new Set(['posts']))
    expect(sql).toBe(productBackfill)
    const db = new Database(':memory:')
    try {
      db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, slug TEXT UNIQUE);
INSERT INTO products (name) VALUES ('Trail Runner'), ('Trail Runner'), ('Café & Bar'), ('!!!');`)
      db.exec(sql)
      expect(db.query('SELECT slug FROM products ORDER BY id').all()).toEqual([{ slug: 'trail-runner-1' }, { slug: 'trail-runner-2' }, { slug: 'café-bar' }, { slug: 'product-4' }])
      expect(db.query('SELECT name FROM sqlite_temp_master').all()).toEqual([])
    }
    finally { db.close() }
  })

  it('follows chained temporary dependencies and keeps independent work', () => {
    const sql = `CREATE TEMP TABLE first_stage (id INTEGER);
INSERT INTO first_stage SELECT id FROM products;
CREATE TEMPORARY TABLE second_stage AS SELECT id FROM first_stage;
UPDATE users SET name = 'gated' WHERE id IN (SELECT id FROM second_stage);
DROP TABLE second_stage; DROP TABLE first_stage;
CREATE TEMP TABLE allowed_stage AS SELECT id FROM users;
UPDATE users SET name = 'kept' WHERE id IN (SELECT id FROM allowed_stage);
DROP TABLE allowed_stage;`
    const filtered = withoutGatedStatements(sql, new Set(['products']))
    const db = new Database(':memory:')
    try {
      db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO users VALUES (1, 'before');")
      db.exec(filtered)
      expect(db.query('SELECT name FROM users').all()).toEqual([{ name: 'kept' }])
      expect(db.query('SELECT name FROM sqlite_temp_master').all()).toEqual([])
      expect(filtered).not.toContain('first_stage')
      expect(filtered).not.toContain('second_stage')
    }
    finally { db.close() }
  })
})
