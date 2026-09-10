/**
 * The database assertions (stacksjs/stacks#2581).
 *
 * Documented across four pages for a long time and never implemented, so every
 * sample teaching them imported a name that did not exist. These exercise them
 * against a real SQLite file rather than a mocked `db`, because what they
 * assert IS the database - a mock would only prove the helpers call the query
 * builder the way the test expects them to.
 *
 * Harness follows `core/sites/tests/setup.ts`: pin the env to a throwaway file
 * BEFORE anything resolves `@stacksjs/database`, since the `db` proxy is lazy
 * and captures whatever the config says at first use.
 */

import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'

const DB_PATH = join(tmpdir(), `stacks-testing-assertions-${process.pid}.sqlite`)
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = DB_PATH
process.env.APP_ENV = 'testing'

// A recycled pid would otherwise leak a previous run's rows.
for (const suffix of ['', '-wal', '-shm']) {
  if (existsSync(`${DB_PATH}${suffix}`))
    unlinkSync(`${DB_PATH}${suffix}`)
}

const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')

const release = await acquireDbConfigLock()
try {
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({
    app: { env: 'testing' },
    database: { default: 'sqlite', connections: { sqlite: { database: DB_PATH, prefix: '' } } },
  })
}
finally {
  release()
}

const {
  assertDatabaseCount,
  assertDatabaseHas,
  assertDatabaseMissing,
  assertNotSoftDeleted,
  assertSoftDeleted,
  factory,
} = await import('../src/database')

await db.unsafe(`
  CREATE TABLE IF NOT EXISTS widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255),
    kind VARCHAR(255),
    deleted_at TIMESTAMP
  )
`).execute()

beforeEach(async () => {
  await db.unsafe('DELETE FROM widgets').execute()
})

afterAll(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(`${DB_PATH}${suffix}`))
      unlinkSync(`${DB_PATH}${suffix}`)
  }
})

async function insert(row: { name: string, kind?: string, deleted_at?: string | null }): Promise<void> {
  await db.insertInto('widgets').values({
    name: row.name,
    kind: row.kind ?? 'standard',
    deleted_at: row.deleted_at ?? null,
  }).execute()
}

describe('assertDatabaseHas', () => {
  it('passes when a row matches', async () => {
    await insert({ name: 'anvil' })
    await assertDatabaseHas('widgets', { name: 'anvil' })
  })

  it('ANDs every criterion', async () => {
    await insert({ name: 'anvil', kind: 'heavy' })
    await assertDatabaseHas('widgets', { name: 'anvil', kind: 'heavy' })
    // The row exists and the name matches, but the pair does not.
    expect(assertDatabaseHas('widgets', { name: 'anvil', kind: 'light' })).rejects.toThrow()
  })

  it('says how many rows the table held, which separates two different bugs', async () => {
    // Zero means the write never happened; non-zero means it happened
    // differently. The message has to distinguish them or it is useless.
    expect(assertDatabaseHas('widgets', { name: 'ghost' })).rejects.toThrow(/0 row\(s\) in the table/)

    await insert({ name: 'anvil' })
    expect(assertDatabaseHas('widgets', { name: 'ghost' })).rejects.toThrow(/1 row\(s\) in the table/)
  })

  it('names the table and the criteria it looked for', async () => {
    expect(assertDatabaseHas('widgets', { name: 'ghost' })).rejects.toThrow(/widgets.*name="ghost"/)
  })
})

describe('assertDatabaseMissing', () => {
  it('passes when nothing matches', async () => {
    await insert({ name: 'anvil' })
    await assertDatabaseMissing('widgets', { name: 'ghost' })
  })

  it('fails when something does, and shows it', async () => {
    await insert({ name: 'anvil' })
    expect(assertDatabaseMissing('widgets', { name: 'anvil' })).rejects.toThrow(/found 1.*anvil/s)
  })
})

describe('assertDatabaseCount', () => {
  it('counts the whole table when given no criteria', async () => {
    await insert({ name: 'a' })
    await insert({ name: 'b' })
    await assertDatabaseCount('widgets', 2)
  })

  it('counts only what matches when given criteria', async () => {
    await insert({ name: 'a', kind: 'heavy' })
    await insert({ name: 'b', kind: 'heavy' })
    await insert({ name: 'c', kind: 'light' })
    await assertDatabaseCount('widgets', 2, { kind: 'heavy' })
  })

  it('accepts zero, which is a real expectation', async () => {
    await assertDatabaseCount('widgets', 0)
  })

  it('reports both numbers when it fails', async () => {
    await insert({ name: 'a' })
    expect(assertDatabaseCount('widgets', 3)).rejects.toThrow(/Expected 3 row\(s\).*found 1/s)
  })

  it('rejects a count that is not a non-negative integer', async () => {
    // Otherwise `assertDatabaseCount('widgets', -1)` passes vacuously for a
    // query that can never return -1 rows.
    expect(assertDatabaseCount('widgets', -1)).rejects.toThrow(TypeError)
    expect(assertDatabaseCount('widgets', 1.5)).rejects.toThrow(TypeError)
  })
})

describe('assertSoftDeleted', () => {
  it('passes for a row with deleted_at set', async () => {
    await insert({ name: 'anvil', deleted_at: '2026-01-01 00:00:00' })
    await assertSoftDeleted('widgets', { name: 'anvil' })
  })

  it('fails differently for a row that is gone than for one that is live', async () => {
    // These are different bugs: the first means the delete removed the row
    // outright, the second that it did nothing.
    expect(assertSoftDeleted('widgets', { name: 'ghost' })).rejects.toThrow(/no row matched at all/)

    await insert({ name: 'anvil' })
    expect(assertSoftDeleted('widgets', { name: 'anvil' })).rejects.toThrow(/still has a null deleted_at/)
  })
})

describe('assertNotSoftDeleted', () => {
  it('passes for a live row', async () => {
    await insert({ name: 'anvil' })
    await assertNotSoftDeleted('widgets', { name: 'anvil' })
  })

  it('fails when the row is soft-deleted', async () => {
    await insert({ name: 'anvil', deleted_at: '2026-01-01 00:00:00' })
    expect(assertNotSoftDeleted('widgets', { name: 'anvil' })).rejects.toThrow(/has a deleted_at set/)
  })

  it('fails when there is no row at all', async () => {
    // "Not soft-deleted" is not satisfied by absence - a missing row is a
    // different failure from a live one, and silently passing would hide it.
    expect(assertNotSoftDeleted('widgets', { name: 'ghost' })).rejects.toThrow(/but none did/)
  })
})

describe('factory', () => {
  it('exposes make/makeMany/create/createMany and nothing else', () => {
    // The absent member is the point: there is no `.count()` / `.state()`
    // chain, because a return type that depends on an earlier call in the
    // chain cannot be typed honestly.
    expect(Object.keys(factory('User')).sort()).toEqual(['create', 'createMany', 'make', 'makeMany'])
  })

  it('builds a fresh builder per call, so two models never share state', () => {
    expect(factory('User')).not.toBe(factory('Post'))
  })

  it('rejects a non-positive count before touching the database', async () => {
    // The guard lives in `makeModelRecords`; this asserts the testing package
    // routes through it rather than silently producing an empty array.
    await expect(factory('User').makeMany(0)).rejects.toThrow(/positive integer count/)
    await expect(factory('User').makeMany(-1)).rejects.toThrow(/positive integer count/)
    await expect(factory('User').makeMany(1.5)).rejects.toThrow(/positive integer count/)
  })

  it('names the models it knows when asked for one that does not exist', async () => {
    await expect(factory('NotARealModel').make()).rejects.toThrow(/Model not found: NotARealModel/)
  })
})
