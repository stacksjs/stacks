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
