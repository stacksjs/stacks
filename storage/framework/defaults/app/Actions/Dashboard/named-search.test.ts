import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import type { NamedSearchRunner, NamedSearchTable } from './named-search'
import { searchNamedRows } from './named-search'

/**
 * The shared picker search. kanban-users.test.ts runs it against users on
 * SQLite, PostgreSQL and MySQL; this pins what that does not: the table name
 * is SQL, so only the fixed list is accepted, and customers search the same way.
 */
function sqlite(): { database: Database, run: NamedSearchRunner } {
  const database = new Database(':memory:')
  return { database, run: { unsafe: (sql, values = []) => ({ execute: async () => database.query(sql).all(...(values as string[])) }) } }
}

describe('searchNamedRows', () => {
  test('searches customers by name or email, bounded, with the full count', async () => {
    const { database, run } = sqlite()
    database.run('CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, email TEXT)')
    for (let index = 1; index <= 40; index++)
      database.query('INSERT INTO customers (name, email) VALUES (?, ?)').run(`Customer ${String(index).padStart(2, '0')}`, `c${index}@example.com`)
    database.query('INSERT INTO customers (name, email) VALUES (?, ?)').run('Zed Ortiz', 'ZED@shop.test')

    const page = await searchNamedRows('customers', { search: 'customer', limit: 25 }, run, 'sqlite')
    expect(page.rows).toHaveLength(25)
    expect(page.total).toBe(40)
    expect((await searchNamedRows('customers', { search: 'zed@SHOP', limit: 25 }, run, 'sqlite')).rows.map(row => row.name)).toEqual(['Zed Ortiz'])
  })

  test('refuses a table that is not on the list, before running anything', async () => {
    let ran = false
    const run: NamedSearchRunner = { unsafe: () => ({ execute: async () => { ran = true; return [] } }) }
    await expect(searchNamedRows('users; DROP TABLE users' as NamedSearchTable, { search: '', limit: 5 }, run, 'sqlite')).rejects.toThrow('is not a searchable table')
    expect(ran).toBeFalse()
  })
})
