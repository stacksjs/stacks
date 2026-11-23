import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { sqliteFilePath } from '../../database/src/drivers/sqlite-path'
import { assertSqliteTestDatabase } from '../src/database'
import { isolateTestDatabase } from '../src/feature'

// stacksjs/stacks#3362. An app's test run used whatever database `.env`
// named, and refreshDatabase() on SQLite dropped every table of
// `database/stacks.sqlite` - the developer's real data - whatever
// DB_DATABASE_PATH said. A test run now gets a throwaway SQLite file, and the
// SQLite reset refuses a file the run did not create.

describe('the SQLite file a connection uses', () => {
  test('follows the configured path, resolved against the project', () => {
    expect(sqliteFilePath('database/app.sqlite', '/apps/shop')).toBe('/apps/shop/database/app.sqlite')
    expect(sqliteFilePath('/var/data/app.sqlite', '/apps/shop')).toBe('/var/data/app.sqlite')
    expect(sqliteFilePath(undefined, '/apps/shop')).toBe('/apps/shop/database/stacks.sqlite')
    expect(sqliteFilePath('', '/apps/shop')).toBe('/apps/shop/database/stacks.sqlite')
  })
})

describe('the SQLite reset guard', () => {
  test('refuses a database the run did not create', () => {
    expect(() => assertSqliteTestDatabase('/apps/shop/database/stacks.sqlite', undefined)).toThrow('Refusing to reset')
    expect(() => assertSqliteTestDatabase('/apps/shop/database/latest.sqlite', undefined)).toThrow('Refusing to reset')
  })

  test('accepts the run\'s own file, a temporary file, and a file named for tests', () => {
    expect(() => assertSqliteTestDatabase('/apps/shop/database/stacks.sqlite', '/apps/shop/database/stacks.sqlite')).not.toThrow()
    expect(() => assertSqliteTestDatabase(join(tmpdir(), 'x', 'app.sqlite'), undefined)).not.toThrow()
    expect(() => assertSqliteTestDatabase('/apps/shop/database/stacks_testing.sqlite', undefined)).not.toThrow()
    expect(() => assertSqliteTestDatabase('/apps/shop/database/app-test.sqlite', undefined)).not.toThrow()
  })
})

describe('isolating a test run', () => {
  const saved = { ...process.env }
  afterEach(() => {
    for (const key of ['DB_CONNECTION', 'DB_DATABASE_PATH', 'STACKS_TEST_DATABASE_PATH', 'STACKS_TEST_DATABASE']) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  test('points SQLite at a throwaway file and removes it afterwards', async () => {
    process.env.DB_CONNECTION = 'sqlite'
    process.env.DB_DATABASE_PATH = 'database/stacks.sqlite'
    const release = await isolateTestDatabase()
    const file = process.env.DB_DATABASE_PATH!
    expect(release).toBeDefined()
    expect(file.startsWith(tmpdir()) || file.startsWith('/private' + tmpdir())).toBe(true)
    expect(process.env.STACKS_TEST_DATABASE_PATH).toBe(file)
    await release!()
    expect(existsSync(join(file, '..'))).toBe(false)
  })

  test('leaves a run that asked for its configured database alone', async () => {
    process.env.DB_CONNECTION = 'sqlite'
    process.env.DB_DATABASE_PATH = 'database/ci_test.sqlite'
    process.env.STACKS_TEST_DATABASE = 'configured'
    expect(await isolateTestDatabase()).toBeUndefined()
    expect(process.env.DB_DATABASE_PATH).toBe('database/ci_test.sqlite')
  })

  test('leaves Postgres and MySQL to their own test-name guards', async () => {
    process.env.DB_CONNECTION = 'postgres'
    expect(await isolateTestDatabase()).toBeUndefined()
  })

  test('an app\'s boot isolates the database before it loads the app', () => {
    const source = readFileSync(join(import.meta.dir, '../src/feature.ts'), 'utf8')
    const boot = source.slice(source.indexOf('export async function bootTestEnvironment'))
    const isolate = boot.indexOf('isolateTestDatabase(')
    expect(isolate).toBeGreaterThan(-1)
    expect(isolate).toBeLessThan(boot.indexOf('injectGlobalAutoImports'))
    expect(boot.indexOf('isFrameworkSuite()')).toBeLessThan(isolate)
  })
})
