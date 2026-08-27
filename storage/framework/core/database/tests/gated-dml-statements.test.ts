import { describe, expect, it } from 'bun:test'
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
