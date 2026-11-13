// A `db` call returns its value where it is written.
//
// `const rows = db.selectFrom('users').where(...).get()` used to be a pending
// promise, and so was `db.transaction(fn)`: the lines after it ran before it
// had committed unless it was awaited. bun-query-builder 0.5 answers in place,
// and everything this package wraps around it has to as well:
//
// - the SQLite fast path, which built its own statement and then wrapped the
//   rows in `Promise.resolve()`;
// - the three layers around `db.transaction()`: the after-commit scope, the
//   SQLite transaction queue and the replica routing context, each of which
//   was an `async` function.
//
// The awaited form keeps working, because `await` on a value is that value.

const originalDbConnection = process.env.DB_CONNECTION
const originalDbDatabasePath = process.env.DB_DATABASE_PATH
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = ':memory:'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'

let releaseDbConfigLock: () => void

afterAll(() => {
  if (originalDbConnection === undefined) delete process.env.DB_CONNECTION
  else process.env.DB_CONNECTION = originalDbConnection
  if (originalDbDatabasePath === undefined) delete process.env.DB_DATABASE_PATH
  else process.env.DB_DATABASE_PATH = originalDbDatabasePath
  releaseDbConfigLock?.()
})

const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('../src/utils')
const { enqueueAfterCommit, isInTransaction } = await import('../src/transaction-context')
const { contextInTransaction } = await import('../src/replicas')

const isPromise = (value: unknown): boolean => Boolean(value) && typeof (value as { then?: unknown }).then === 'function'
// The tables here are this file's own, so the schema-typed `db` does not know them.
const loose = db as any

beforeAll(async () => {
  releaseDbConfigLock = await acquireDbConfigLock()
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({
    database: {
      default: 'sqlite',
      connections: { sqlite: { database: ':memory:' } },
    },
  })
  await db.unsafe('CREATE TABLE IF NOT EXISTS in_place_items (id INTEGER PRIMARY KEY, name TEXT, qty INTEGER DEFAULT 0)').execute()
})

beforeEach(() => {
  db.unsafe('DELETE FROM in_place_items').execute()
  db.unsafe(`INSERT INTO in_place_items (id, name, qty) VALUES (1, 'bolt', 10), (2, 'nut', 25), (3, 'washer', 4)`).execute()
})

const names = (): string[] => (db.unsafe('SELECT name FROM in_place_items ORDER BY id').execute() as Array<{ name: string }>).map(row => row.name)

describe('a db read is its rows', () => {
  it('the un-awaited chain is the value, and the awaited chain is the same value', async () => {
    const bare = loose.selectFrom('in_place_items').where('qty', '>', 5).orderBy('qty', 'desc').get()
    expect(isPromise(bare)).toBe(false)
    expect(bare.map((row: any) => row.name)).toEqual(['nut', 'bolt'])
    expect(await loose.selectFrom('in_place_items').where('qty', '>', 5).orderBy('qty', 'desc').get()).toEqual(bare)
  })

  it('every terminal answers in place, on the fast path and off it', () => {
    const items = () => loose.selectFrom('in_place_items')
    const terminals: Record<string, unknown> = {
      'get': items().get(),
      'execute': items().execute(),
      'first': items().orderBy('id').first(),
      'executeTakeFirst': items().where('id', '=', 2).executeTakeFirst(),
      'executeTakeFirstOrThrow': items().where('id', '=', 2).executeTakeFirstOrThrow(),
      'firstOrFail': items().firstOrFail(),
      'count': items().count(),
      'sum': items().sum('qty'),
      'max': items().max('qty'),
      'exists': items().where('name', '=', 'nut').exists(),
      'doesntExist': items().where('name', '=', 'screw').doesntExist(),
      'value': items().where('id', '=', 1).value('name'),
      'pluck': items().orderBy('id').pluck('name'),
      // Not a shape the fast path builds: these go to the full builder.
      'paginate': items().orderBy('id').paginate(2, 1),
      'a grouped read': items().select(['name']).groupBy('name').get(),
      'find': items().find(3),
    }
    for (const [name, value] of Object.entries(terminals))
      expect(isPromise(value), `${name} returned a promise`).toBe(false)
    expect(terminals.count).toBe(3)
    expect(terminals.sum).toBe(39)
    expect(terminals.first).toMatchObject({ name: 'bolt' })
    expect(terminals.pluck).toEqual(['bolt', 'nut', 'washer'])
    expect(terminals.exists).toBe(true)
    expect(terminals.doesntExist).toBe(true)
    expect((terminals.paginate as any).data).toHaveLength(2)
  })

  it('a failure is thrown where the call stands', () => {
    expect(() => loose.selectFrom('in_place_missing').get()).toThrow(/in_place_missing/)
    expect(() => loose.selectFrom('in_place_items').where('id', '=', 99).firstOrFail()).toThrow()
  })
})

describe('a db write is done when it returns', () => {
  it('insert, update and delete', () => {
    expect(isPromise(loose.insertInto('in_place_items').values({ id: 4, name: 'screw', qty: 1 }).execute())).toBe(false)
    expect(names()).toEqual(['bolt', 'nut', 'washer', 'screw'])
    expect(loose.updateTable('in_place_items').set({ name: 'screw M4' }).where('id', '=', 4).execute()).toBe(1)
    expect(names()).toEqual(['bolt', 'nut', 'washer', 'screw M4'])
    expect(loose.deleteFrom('in_place_items').where('id', '=', 4).execute()).toBe(1)
    expect(names()).toEqual(['bolt', 'nut', 'washer'])
  })

  it('a raw statement runs when it is executed, and is still awaitable', async () => {
    const statement = db.unsafe('SELECT name FROM in_place_items WHERE qty > ? ORDER BY id', [5])
    const rows = statement.execute()
    expect(isPromise(rows)).toBe(false)
    expect(rows).toEqual([{ name: 'bolt' }, { name: 'nut' }])
    expect(await db.unsafe('SELECT name FROM in_place_items WHERE qty > ? ORDER BY id', [5])).toEqual(rows)
    // Nothing runs until one of the two happens.
    db.unsafe('DELETE FROM in_place_items')
    expect(names()).toEqual(['bolt', 'nut', 'washer'])
  })
})

describe('a transaction is done when it returns', () => {
  it('commits in place and returns what the callback returned', () => {
    const result = loose.transaction((tx: any) => {
      tx.insertInto('in_place_items').values({ id: 10, name: 'in-tx' }).execute()
      return tx.selectFrom('in_place_items').count()
    })
    expect(isPromise(result)).toBe(false)
    expect(result).toBe(4)
    expect(names()).toEqual(['bolt', 'nut', 'washer', 'in-tx'])
  })

  it('rolls back and rethrows where the call stands', () => {
    expect(() => loose.transaction((tx: any) => {
      tx.deleteFrom('in_place_items').where('id', '=', 1).execute()
      throw new Error('changed my mind')
    })).toThrow('changed my mind')
    expect(names()).toEqual(['bolt', 'nut', 'washer'])
  })

  it('is a transaction to the code inside it, and not after it', () => {
    const inside: boolean[] = []
    loose.transaction(() => { inside.push(isInTransaction(), contextInTransaction()) })
    expect(inside).toEqual([true, true])
    expect(isInTransaction()).toBe(false)
    expect(contextInTransaction()).toBe(false)
  })

  it('db inside the callback is the transaction', () => {
    expect(() => loose.transaction(() => {
      // Not through `tx`: `db` resolves to the open transaction all the same.
      loose.deleteFrom('in_place_items').where('id', '=', 2).execute()
      expect(loose.selectFrom('in_place_items').count()).toBe(2)
      throw new Error('undo it')
    })).toThrow('undo it')
    expect(names()).toEqual(['bolt', 'nut', 'washer'])
  })

  it('after-commit work has run by the next line, in order, and not on rollback', () => {
    const order: string[] = []
    loose.transaction((tx: any) => {
      tx.insertInto('in_place_items').values({ id: 11, name: 'queued' }).execute()
      enqueueAfterCommit(() => { order.push(`committed with ${names().length} rows`) })
      order.push('body')
    }, { afterCommit: () => { order.push('afterCommit') } })
    order.push('next line')
    expect(order).toEqual(['body', 'committed with 4 rows', 'afterCommit', 'next line'])

    const dropped: string[] = []
    expect(() => loose.transaction(() => {
      enqueueAfterCommit(() => { dropped.push('must not run') })
      throw new Error('rolled back')
    })).toThrow('rolled back')
    expect(dropped).toEqual([])
  })

  it('a nested transaction is a savepoint that rolls back alone', () => {
    loose.transaction((tx: any) => {
      tx.insertInto('in_place_items').values({ id: 12, name: 'outer' }).execute()
      expect(() => tx.transaction((inner: any) => {
        inner.insertInto('in_place_items').values({ id: 13, name: 'inner' }).execute()
        throw new Error('inner only')
      })).toThrow('inner only')
    })
    expect(names()).toEqual(['bolt', 'nut', 'washer', 'outer'])
  })

  it('transactional() wraps a function the same way', () => {
    const add = loose.transactional((tx: any, name: string) => {
      tx.insertInto('in_place_items').values({ name }).execute()
      return tx.selectFrom('in_place_items').count()
    })
    expect(add('wrapped')).toBe(4)
  })

  it('a callback that has to wait makes it a promise, which commits when it resolves', async () => {
    const pending = loose.transaction(async (tx: any) => {
      await Bun.sleep(2)
      await tx.insertInto('in_place_items').values({ id: 14, name: 'waited' }).execute()
      return 'waited'
    })
    expect(isPromise(pending)).toBe(true)
    expect(await pending).toBe('waited')
    expect(names()).toEqual(['bolt', 'nut', 'washer', 'waited'])
  })

  it('on SQLite a transaction that starts while another is still open waits for it', async () => {
    // One connection: the open transaction has it until its callback is done.
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const order: string[] = []
    const first = loose.transaction(async (tx: any) => {
      await gate
      await tx.insertInto('in_place_items').values({ id: 15, name: 'first' }).execute()
      order.push('first')
    })
    const second = loose.transaction((tx: any) => {
      tx.insertInto('in_place_items').values({ id: 16, name: 'second' }).execute()
      order.push('second')
      return 'second'
    })
    // Queued behind the open one, so a promise whatever its own callback does.
    expect(isPromise(second)).toBe(true)
    release()
    await first
    expect(await second).toBe('second')
    expect(order).toEqual(['first', 'second'])
    // The connection is free again: the next one runs where it is called.
    expect(isPromise(loose.transaction((tx: any) => tx.selectFrom('in_place_items').count()))).toBe(false)
  })
})
