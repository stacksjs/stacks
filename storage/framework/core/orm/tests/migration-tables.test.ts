import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deriveMigrationTables } from '../src/migration-tables'

/**
 * Tests for typing the tables a migration corpus creates that no model owns
 * (stacksjs/stacks#2409).
 */

function corpus(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'stacks-migration-tables-'))
  for (const [name, sql] of Object.entries(files))
    writeFileSync(join(dir, name), sql, 'utf-8')
  return dir
}

function cleanup(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}

describe('deriveMigrationTables', () => {
  test('data-only cleanup of model-owned tables does not report schema failure', () => {
    const dir = corpus({
      '001-create.sql': 'CREATE TABLE survivors (id INTEGER PRIMARY KEY, label TEXT);',
      '002-revoke-tokens.sql': `-- A data cleanup, not a table declaration.
DELETE FROM oauth_refresh_tokens WHERE expires_at IS NULL;
DELETE FROM oauth_access_tokens WHERE expires_at IS NULL;`,
    })
    try {
      expect(deriveMigrationTables(dir)).toEqual({
        tables: [{ table: 'survivors', columns: { id: 'number', label: 'string | null' } }],
        errors: [],
      })
    }
    finally { cleanup(dir) }
  })

  test('types a table the corpus creates', () => {
    const dir = corpus({
      '001-create-roles.sql': `CREATE TABLE roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`,
    })

    try {
      const { tables } = deriveMigrationTables(dir)
      const roles = tables.find(t => t.table === 'roles')

      expect(roles?.columns).toEqual({
        id: 'number',
        name: 'string',
        // Nullable in the DDL, so nullable in the type.
        description: 'string | null',
        created_at: 'string | null',
      })
    }
    finally {
      cleanup(dir)
    }
  })

  test('data cleanup transaction wrappers and quoted SQL leave later schema transactions usable', () => {
    const dir = corpus({
      '001-cleanup.sql': `/* CREATE TABLE is a comment. */
BEGIN;
DELETE FROM missing_tokens WHERE note = 'CREATE TRIGGER fake; it''s data';
UPDATE missing_tokens SET "value;name" = 'ALTER TABLE ignored;';
COMMIT;`,
      '002-schema.sql': 'BEGIN; CREATE TABLE later (id INTEGER PRIMARY KEY); COMMIT;',
    })
    try {
      expect(deriveMigrationTables(dir)).toEqual({ tables: [{ table: 'later', columns: { id: 'number' } }], errors: [] })
    }
    finally { cleanup(dir) }
  })

  test('a data statement cannot hide same-line schema declarations', () => {
    const dir = corpus({ '001-mixed.sql': "DELETE FROM missing_tokens WHERE note = 'CREATE TRIGGER fake; it''s data'; CREATE TABLE recovered (id INTEGER PRIMARY KEY);" })
    try {
      expect(deriveMigrationTables(dir).tables).toEqual([{ table: 'recovered', columns: { id: 'number' } }])
    }
    finally { cleanup(dir) }
  })

  test('transaction-only files retain their effect on schema across the corpus', () => {
    const dir = corpus({
      '001-begin.sql': 'BEGIN;',
      '002-create.sql': 'CREATE TABLE rolled_back (id INTEGER PRIMARY KEY);',
      '003-rollback.sql': 'ROLLBACK;',
    })
    try {
      expect(deriveMigrationTables(dir)).toEqual({ tables: [], errors: [] })
    }
    finally { cleanup(dir) }
  })

  test.each([
    'DELETE FROM existing; CREATE TABLE broken (id INTEGER,);',
    'DELETE FROM existing; ALTER TABLE existing ADD COLUMN;',
    'BEGIN; CREATE TABLE broken (id INTEGER,); COMMIT;',
    'DELETE FROM existing; UNKNOWN_SCHEMA;',
    'SELECT 1; ALTER TABLE missing ADD COLUMN x TEXT;',
    'PRAGMA foreign_keys; ALTER TABLE missing ADD COLUMN x TEXT;',
  ])('successful data or control statements cannot hide schema failure: %s', (sql) => {
    const dir = corpus({ '001-existing.sql': 'CREATE TABLE existing (id INTEGER PRIMARY KEY);', '002-mixed.sql': sql })
    try {
      const result = deriveMigrationTables(dir)
      expect(result.tables).toEqual([{ table: 'existing', columns: { id: 'number' } }])
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.file).toEndWith('002-mixed.sql')
    }
    finally { cleanup(dir) }
  })

  test.each(['no such table', 'duplicate column name'])('constraint diagnostics mentioning %s remain errors', (name) => {
    const dir = corpus({
      '001-create.sql': `CREATE TABLE checks (n INTEGER CONSTRAINT "${name}" CHECK (n > 0));`,
      '002-data.sql': 'INSERT INTO checks VALUES (-1);',
    })
    try {
      const result = deriveMigrationTables(dir)
      expect(result.tables.map(table => table.table)).toEqual(['checks'])
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.error).toBe(`CHECK constraint failed: ${name}`)
    }
    finally { cleanup(dir) }
  })

  test.each(['no such table: fake', 'duplicate column name: fake'])('trigger failures cannot impersonate %s', (message) => {
    const dir = corpus({
      '001-create.sql': `CREATE TABLE checks (n INTEGER);
CREATE TRIGGER reject_insert BEFORE INSERT ON checks BEGIN SELECT RAISE(ABORT, '${message}'); END;`,
      '002-data.sql': 'INSERT INTO checks VALUES (1);',
    })
    try {
      const result = deriveMigrationTables(dir)
      expect(result.tables.map(table => table.table)).toEqual(['checks'])
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.error).toBe(message)
    }
    finally { cleanup(dir) }
  })

  test.each([
    'CREATE TABLE broken (id INTEGER,);',
    'ALTER TABLE missing ADD COLUMN value TEXT;',
    'CREATE TRIGGER broken AFTER INSERT ON missing BEGIN DELETE FROM missing; END;',
    'CREATE TEMP TRIGGER broken AFTER INSERT ON missing BEGIN SELECT 1; SELECT 2; END;',
    'CREATE /* retained keyword boundary */ TRIGGER broken AFTER INSERT ON missing BEGIN SELECT 1; SELECT 2; END;',
    'unrecognized schema instruction;',
    'DELETE_TABLE;',
    'UPDATE1;',
    'DELETE FROM;',
  ])('schema and unknown SQL failures remain visible: %s', (sql) => {
    const dir = corpus({ '001-broken.sql': sql })
    try {
      const result = deriveMigrationTables(dir)
      expect(result.tables).toEqual([])
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.file).toEndWith('001-broken.sql')
    }
    finally { cleanup(dir) }
  })

  test('applies ALTER TABLE, so a column added later is typed', () => {
    /*
     * The reason this replays SQL instead of parsing `CREATE TABLE`: the
     * framework's corpus carries 161 `ADD COLUMN` statements, so a table's
     * final shape is not the shape it was created with.
     */
    const dir = corpus({
      '001-create.sql': `CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT NOT NULL);`,
      '002-alter.sql': `ALTER TABLE widgets ADD COLUMN slug TEXT;`,
    })

    try {
      const { tables } = deriveMigrationTables(dir)
      expect(tables.find(t => t.table === 'widgets')?.columns.slug).toBe('string | null')
    }
    finally {
      cleanup(dir)
    }
  })

  test('reflects the final state, so a dropped table is not typed', () => {
    // `taggable` and `categorizable` are created and later dropped in the
    // framework's own corpus (stacksjs/stacks#2410). Grepping `CREATE TABLE`
    // reports them as live tables; replaying the corpus does not.
    const dir = corpus({
      '001-create.sql': `CREATE TABLE taggable (id INTEGER PRIMARY KEY);`,
      '002-drop.sql': `DROP TABLE IF EXISTS taggable;`,
    })

    try {
      const { tables } = deriveMigrationTables(dir)
      expect(tables.find(t => t.table === 'taggable')).toBeUndefined()
    }
    finally {
      cleanup(dir)
    }
  })

  test('keeps going when one file fails, and reports it', () => {
    const dir = corpus({
      '001-broken.sql': `ALTER TABLE table_that_does_not_exist ADD COLUMN x TEXT;`,
      '002-good.sql': `CREATE TABLE survivors (id INTEGER PRIMARY KEY);`,
    })

    try {
      const { tables, errors } = deriveMigrationTables(dir)
      expect(tables.find(t => t.table === 'survivors')).toBeDefined()
      expect(errors).toHaveLength(1)
      expect(errors[0]?.file).toContain('001-broken.sql')
    }
    finally {
      cleanup(dir)
    }
  })

  test('a column added a second time is not a failed file', () => {
    // A generated file restating an ADD COLUMN an earlier hand-written one made
    // leaves the table exactly as it asks. The runner applies it as a no-op,
    // and `generate:db-types` reported it as a broken migration on every run.
    const dir = corpus({
      '001-create-clubs.sql': `CREATE TABLE clubs (id INTEGER PRIMARY KEY);`,
      '002-add-join-policy.sql': `ALTER TABLE "clubs" ADD COLUMN "join_policy" TEXT NOT NULL DEFAULT 'open';`,
      '003-alter-clubs-columns.sql': `-- qb:generated\nALTER TABLE "clubs" ADD COLUMN "join_policy" TEXT not null;`,
    })

    try {
      const { tables, errors } = deriveMigrationTables(dir)
      expect(errors).toEqual([])
      expect(tables.find(t => t.table === 'clubs')?.columns.join_policy).toBe('string')
    }
    finally {
      cleanup(dir)
    }
  })

  test('recovers the rest of a file when one statement fails', () => {
    // One bad statement must not cost the 553 valid ones behind it.
    const dir = corpus({
      '001-mixed.sql': [
        `ALTER TABLE nope ADD COLUMN x TEXT;`,
        `CREATE TABLE recovered (id INTEGER PRIMARY KEY, label TEXT);`,
      ].join('\n'),
    })

    try {
      const { tables } = deriveMigrationTables(dir)
      expect(tables.find(t => t.table === 'recovered')?.columns.label).toBe('string | null')
    }
    finally {
      cleanup(dir)
    }
  })

  test('booleans follow the driver, not the declaration', () => {
    // Only Postgres answers a real boolean; sqlite stores 0/1 in an INTEGER.
    const dir = corpus({
      '001-flags.sql': `CREATE TABLE flags (id INTEGER PRIMARY KEY, is_active BOOLEAN NOT NULL);`,
    })

    try {
      expect(deriveMigrationTables(dir, 'sqlite').tables[0]?.columns.is_active).toBe('number')
      expect(deriveMigrationTables(dir, 'postgres').tables[0]?.columns.is_active).toBe('boolean')
    }
    finally {
      cleanup(dir)
    }
  })

  test('skips query-builder scratch tables', () => {
    const dir = corpus({
      '001-scratch.sql': `CREATE TABLE _qb_tmp_widgets (id INTEGER PRIMARY KEY);`,
    })

    try {
      expect(deriveMigrationTables(dir).tables).toHaveLength(0)
    }
    finally {
      cleanup(dir)
    }
  })

  test('a missing corpus is not an error', () => {
    const result = deriveMigrationTables(join(tmpdir(), 'stacks-no-such-corpus-dir'))
    expect(result.tables).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })
})
