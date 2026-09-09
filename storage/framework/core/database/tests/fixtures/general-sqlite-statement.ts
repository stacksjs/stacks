import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } from '../../src/utils'

await ensureDatabaseConfigLoaded()
const directory = mkdtempSync(join(tmpdir(), 'stacks-statement-'))
function configure(name: string) {
  initializeDbConfig({
    app: { env: 'production' },
    database: {
      default: 'sqlite',
      connections: { sqlite: { database: join(directory, name) } },
      queryLogging: { enabled: false },
    },
  })
}
function query(values: number[]) {
  return db.selectFrom('statement_items').select('id').where('value', 'in', values).orderBy('id')
}
try {
  resetDatabaseConnection()
  configure('first.sqlite')
  await db.unsafe('CREATE TABLE statement_items (id INTEGER PRIMARY KEY, value INTEGER)').execute()
  await db.unsafe('INSERT INTO statement_items VALUES (1, 10), (2, 20)').execute()
  for (let repeat = 0; repeat < 3; repeat++) {
    assert.deepEqual(await query([10]).execute(), [{ id: 1 }])
    assert.deepEqual(await query([20]).execute(), [{ id: 2 }])
    assert.deepEqual(await query([10, 20]).execute(), [{ id: 1 }, { id: 2 }])
    assert.deepEqual(await query([]).execute(), [])
    assert.deepEqual(await query([10, 20]).limit(1).execute(), [{ id: 1 }])
    assert.deepEqual(await query([10, 20]).limit(1).offset(1).execute(), [{ id: 2 }])
  }
  for (const [firstLength, secondLength] of [[0, 3], [1, 0], [2, 8], [64, 1], [3, 2], [1, 64]]) {
    const rows = await query(Array(firstLength).fill(10)).where('id', 'in', Array(secondLength).fill(1)).execute()
    assert.deepEqual(rows, firstLength && secondLength ? [{ id: 1 }] : [])
  }
  // Compound predicates: every additional-predicate kind, and shapes that
  // change arity and kind between executions. The rendering walks the predicate
  // list in one bounded traversal and shares a single-entry placeholder cache,
  // so alternating shapes is the case that would show a leak between them.
  await db.unsafe('CREATE TABLE statement_facets (id INTEGER PRIMARY KEY, value INTEGER, label TEXT)').execute()
  await db.unsafe(`INSERT INTO statement_facets VALUES (1, 10, 'alpha'), (2, 20, 'beta'), (3, 30, NULL)`).execute()
  const facets = () => db.selectFrom('statement_facets').select('id')
  for (let repeat = 0; repeat < 3; repeat++) {
    assert.deepEqual(await facets().whereIn('value', [10, 20]).whereLike('label', 'a%').orderBy('id').execute(), [{ id: 1 }])
    assert.deepEqual(await facets().whereIn('value', [10, 20, 30]).whereNotLike('label', 'a%').orderBy('id').execute(), [{ id: 2 }])
    assert.deepEqual(await facets().whereIn('value', [10, 20, 30]).whereNull('label').orderBy('id').execute(), [{ id: 3 }])
    assert.deepEqual(await facets().whereIn('value', [10, 20, 30]).whereNotNull('label').orderBy('id').execute(), [{ id: 1 }, { id: 2 }])
    assert.deepEqual(await facets().whereIn('value', [10, 20, 30]).whereNotIn('value', [20]).orderBy('id').execute(), [{ id: 1 }, { id: 3 }])
    // Three predicates from two calls: whereBetween pushes both bounds.
    assert.deepEqual(await facets().whereIn('value', [10, 20, 30]).whereBetween('id', [1, 2]).orderBy('id').execute(), [{ id: 1 }, { id: 2 }])
    // Mixed arity in one statement, then the same shape at a different arity.
    assert.deepEqual(await facets().whereIn('value', [10]).whereIn('id', [1, 2, 3]).orderBy('id').execute(), [{ id: 1 }])
    assert.deepEqual(await facets().whereIn('value', [10, 20, 30]).whereIn('id', [2]).orderBy('id').execute(), [{ id: 2 }])
    // An empty membership renders zero placeholders on either side.
    assert.deepEqual(await facets().whereIn('value', []).whereIn('id', [1]).orderBy('id').execute(), [])
    assert.deepEqual(await facets().whereIn('value', [10]).whereIn('id', []).orderBy('id').execute(), [])
  }
  await db.unsafe('DROP TABLE statement_facets').execute()
  const invalidLengths = [0.5, -1, Number.NaN, Number.POSITIVE_INFINITY, 0x100000000]
  const opaqueLength = { [Symbol.toPrimitive]() { throw new Error('Custom slice length must not be coerced') } }
  for (const length of [0, 1, '0', undefined, false, opaqueLength, 2, ...invalidLengths]) {
    const values = [10]
    values.slice = () => ({ length, *[Symbol.iterator]() { yield 10 } }) as unknown as number[]
    const read = db.selectFrom('statement_items').select('id').whereIn('value', values).execute()
    if (invalidLengths.includes(length as number))
      await assert.rejects(read, RangeError)
    else if (length === 2)
      await assert.rejects(read)
    else
      assert.deepEqual(await read, length === 0 ? [] : [{ id: 1 }])
  }
  const retained = query([10])
  assert.deepEqual(await retained.execute(), [{ id: 1 }])
  for (let index = 0; index < 100; index++)
    await db.unsafe(`SELECT ${index} AS churn`).execute()
  await db.unsafe('UPDATE statement_items SET value = 30 WHERE id = 1').execute()
  assert.deepEqual(await retained.execute(), [])
  const rollback = new Error('rollback statement check')
  await assert.rejects(db.transaction(async () => {
    await db.unsafe('UPDATE statement_items SET value = 10 WHERE id = 1').execute()
    assert.deepEqual(await retained.execute(), [{ id: 1 }])
    throw rollback
  }), error => error === rollback)
  assert.deepEqual(await retained.execute(), [])
  await db.transaction(async () => {
    await db.unsafe('UPDATE statement_items SET value = 10 WHERE id = 1').execute()
  })
  assert.deepEqual(await retained.execute(), [{ id: 1 }])
  await assert.rejects(db.selectFrom('missing_statement_items').where('id', 'in', [1]).execute())
  assert.deepEqual(await query([10]).execute(), [{ id: 1 }])
  await db.unsafe('DROP TABLE statement_items').execute()
  await assert.rejects(query([10]).execute())
  await db.unsafe('CREATE TABLE statement_items (id INTEGER PRIMARY KEY, value INTEGER)').execute()
  await db.unsafe('INSERT INTO statement_items VALUES (3, 10)').execute()
  assert.deepEqual(await query([10]).execute(), [{ id: 3 }])
  configure('second.sqlite')
  await db.unsafe('CREATE TABLE statement_items (id INTEGER PRIMARY KEY, value INTEGER)').execute()
  await db.unsafe('INSERT INTO statement_items VALUES (4, 10)').execute()
  assert.deepEqual(await query([10]).execute(), [{ id: 4 }])
  configure('first.sqlite')
  assert.deepEqual(await query([10]).execute(), [{ id: 3 }])
  resetDatabaseConnection()
  assert.deepEqual(await query([10]).execute(), [{ id: 3 }])
  console.log('general-sqlite-statement-ok')
}
finally {
  resetDatabaseConnection()
  rmSync(directory, { recursive: true, force: true })
}
