import { Database } from 'bun:sqlite'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import type { TableCatalogRunner } from '../src/table-exists'
import { tableExists, tableExistsSql } from '../src/table-exists'

/**
 * `tableExists` against each dialect's real catalog. The dashboard uses it to
 * tell a table that was never migrated apart from any other failed query, so a
 * wrong "no" would hide a real error behind a "run ./buddy migrate" hint.
 */
function sqliteRunner(database: Database): TableCatalogRunner {
  return { unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as string[])) }) }
}

function sqlRunner(connection: SQL): TableCatalogRunner {
  return { unsafe: (sql, values = []) => ({ execute: async () => await connection.unsafe(sql, values) }) }
}

describe('tableExists on SQLite', () => {
  test('answers from sqlite_master', async () => {
    const database = new Database(':memory:')
    database.run('CREATE TABLE widgets (id INTEGER PRIMARY KEY)')
    database.run('CREATE VIEW widget_view AS SELECT id FROM widgets')
    const run = sqliteRunner(database)

    expect(await tableExists('widgets', run, 'sqlite')).toBeTrue()
    expect(await tableExists('gadgets', run, 'sqlite')).toBeFalse()
    expect(await tableExists('widget_view', run, 'sqlite')).toBeFalse()
    expect(await tableExists('widgets\'; DROP TABLE widgets; --', run, 'sqlite')).toBeFalse()
    expect(await tableExists('widgets', run, 'sqlite')).toBeTrue()
  })
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL

  test.skipIf(!connection)(`tableExists on ${dialect} answers from the catalog`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('tableExists tests require a local disposable database server')

    const name = `stacks_table_exists_${crypto.randomUUID().replaceAll('-', '')}`
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    const admin = new SQL(url.href)
    await admin.unsafe(`CREATE DATABASE ${quoted}`)
    const scoped = new URL(url.href)
    scoped.pathname = `/${name}`
    const database = new SQL(scoped.href)

    try {
      await database.unsafe('CREATE TABLE widgets (id INTEGER PRIMARY KEY)')
      const run = sqlRunner(database)

      expect(await tableExists('widgets', run, dialect)).toBeTrue()
      expect(await tableExists('gadgets', run, dialect)).toBeFalse()
      expect(await tableExists('widgets\'; DROP TABLE widgets; --', run, dialect)).toBeFalse()
      expect(await tableExists('widgets', run, dialect)).toBeTrue()

      if (dialect === 'postgres') {
        // Outside search_path, an unqualified query cannot reach it either.
        await database.unsafe('CREATE SCHEMA elsewhere')
        await database.unsafe('CREATE TABLE elsewhere.hidden (id INTEGER)')
        expect(await tableExists('hidden', run, dialect)).toBeFalse()
      }
    }
    finally {
      await database.close()
      try { await admin.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`) }
      finally { await admin.close() }
    }
  }, 30_000)
}

test('the name is always a bound value', () => {
  for (const dialect of ['sqlite', 'postgres', 'mysql', 'singlestore', 'vitess'] as const) {
    const sql = tableExistsSql(dialect)
    expect(sql).toMatch(dialect === 'postgres' ? /\$1/ : /\?/)
    expect(sql).not.toContain('widgets')
  }
})
