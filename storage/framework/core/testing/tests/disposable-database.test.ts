import { describe, expect, test } from 'bun:test'
import process from 'node:process'
import { Database } from 'bun:sqlite'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SQL } from 'bun'
import { assertLocalPostgres, createDisposableDatabase, disposablePostgresUrl, withDisposableDatabase } from '../src/disposable-database'

describe('withDisposableDatabase (sqlite)', () => {
  test('hands out a fresh file and removes it afterwards', async () => {
    let seen = ''
    const count = await withDisposableDatabase('sqlite', (database) => {
      seen = database.directory
      expect(database.env).toEqual({ DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: database.path! })
      const db = new Database(database.path!)
      db.run('CREATE TABLE t (id INTEGER)')
      db.run('INSERT INTO t VALUES (1), (2)')
      const row = db.query('SELECT COUNT(*) AS n FROM t').get() as { n: number }
      db.close()
      writeFileSync(join(database.directory, 'fixture.json'), '{}')
      return row.n
    })
    expect(count).toBe(2)
    expect(existsSync(seen)).toBe(false)
  })

  test('removes it when the test throws, and keeps the test error', async () => {
    let seen = ''
    await expect((async () => withDisposableDatabase('sqlite', (database) => {
      seen = database.directory
      throw new Error('the test failed')
    }))()).rejects.toThrow('the test failed')
    expect(existsSync(seen)).toBe(false)
  })

  test('names are unique and clean', async () => {
    const a = await createDisposableDatabase('sqlite', { prefix: 'My-App Tests!' })
    const b = await createDisposableDatabase('sqlite', { prefix: 'My-App Tests!' })
    try {
      expect(a.name).not.toBe(b.name)
      expect(a.name).toMatch(/^my_app_tests__[0-9a-f]{24}$/)
    }
    finally {
      await a.drop()
      await b.drop()
      await a.drop()
    }
  })
})

describe('the local-server guard', () => {
  test('accepts only this machine', () => {
    expect(assertLocalPostgres('postgres://postgres@127.0.0.1:5432/postgres').hostname).toBe('127.0.0.1')
    expect(assertLocalPostgres('postgresql://u:p@localhost/db').hostname).toBe('localhost')
    expect(assertLocalPostgres('postgres://u@[::1]:5432/db').hostname).toBe('[::1]')
    expect(() => assertLocalPostgres('postgres://u@db.example.com/db')).toThrow(/local PostgreSQL/)
    expect(() => assertLocalPostgres('mysql://u@127.0.0.1/db')).toThrow(/postgres:\/\//)
    expect(() => assertLocalPostgres('not a url')).toThrow(/postgres:\/\//)
  })

  test('a remote or missing server is refused before anything is created', async () => {
    await expect((async () => createDisposableDatabase('postgres', { url: 'postgres://u@db.example.com/db' }))()).rejects.toThrow(/local PostgreSQL/)
    const saved = process.env.STACKS_TEST_POSTGRES_URL
    delete process.env.STACKS_TEST_POSTGRES_URL
    try {
      await expect(createDisposableDatabase('postgres')).rejects.toThrow(/STACKS_TEST_POSTGRES_URL/)
    }
    finally {
      if (saved !== undefined) process.env.STACKS_TEST_POSTGRES_URL = saved
    }
    await expect(createDisposableDatabase('mysql' as never)).rejects.toThrow(/sqlite or postgres/)
  })
})

// Runs where a local server is configured: STACKS_TEST_POSTGRES_URL=postgres://postgres@127.0.0.1:5432/postgres
describe.skipIf(!disposablePostgresUrl())('withDisposableDatabase (postgres)', () => {
  const exists = async (name: string) => {
    const sql = new SQL(disposablePostgresUrl()!)
    try {
      const rows = await sql`SELECT 1 FROM pg_database WHERE datname = ${name}`
      return rows.length > 0
    }
    finally {
      await sql.close()
    }
  }

  test('creates a database, connects to it, and drops it', async () => {
    let name = ''
    await withDisposableDatabase('postgres', async (database) => {
      name = database.name
      expect(database.env.DB_DATABASE).toBe(name)
      expect(await exists(name)).toBe(true)
      expect(database.sqlOptions).toBeDefined()
      if (!database.sqlOptions) throw new Error('Missing disposable PostgreSQL connection options')
      const sql = new SQL(database.sqlOptions)
      try {
        expect((await sql`SELECT current_database() AS name`)[0].name).toBe(name)
        await sql`CREATE TABLE t (id int)`
        await sql`INSERT INTO t VALUES (1)`
        // Left open on purpose: the drop must end it (WITH (FORCE)).
        expect((await sql`SELECT count(*)::int AS n FROM t`)[0].n).toBe(1)
      }
      finally {
        await sql.close()
      }
    })
    expect(await exists(name)).toBe(false)
  })

  test('isolates a child SQL client from inherited PostgreSQL environment', async () => {
    await withDisposableDatabase('postgres', async (database) => {
      const child = Bun.spawn([process.execPath, '--no-env-file', '-e', `
        import { SQL } from 'bun'
        const sql = new SQL(process.env.POSTGRES_URL)
        try { console.log((await sql\`SELECT current_database() AS name\`)[0].name) }
        finally { await sql.close() }
      `], {
        env: { ...process.env, PGDATABASE: new URL(disposablePostgresUrl()!).pathname.slice(1), POSTGRES_URL: database.url, ...database.env },
        stdout: 'pipe', stderr: 'pipe',
      })
      const [output, error, status] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      expect(error).toBe('')
      expect(status).toBe(0)
      expect(output.trim()).toBe(database.name)
    })
  })

  test('drops it when the test throws', async () => {
    let name = ''
    await expect((async () => withDisposableDatabase('postgres', (database) => {
      name = database.name
      throw new Error('boom')
    }))()).rejects.toThrow('boom')
    expect(await exists(name)).toBe(false)
  })
})
