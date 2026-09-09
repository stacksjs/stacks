import { config as queryBuilderConfig, setConfig } from '@stacksjs/query-builder'
import assert from 'node:assert/strict'
import { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } from '../../src/utils'

const databasePath = process.argv[2]
assert.ok(databasePath, 'Expected an isolated SQLite path')
await ensureDatabaseConfigLoaded()
resetDatabaseConnection()
initializeDbConfig({
  app: { env: 'production' },
  database: {
    default: 'sqlite',
    connections: { sqlite: { database: databasePath } },
    queryLogging: { enabled: false },
  },
})
assert.equal(queryBuilderConfig.hooks, undefined)

function query() {
  return db.selectFrom('membership_items').select('id').orderBy('id')
}

// Exercise the runtime boundary too: upstream accepts scalar membership values
// and rejects unsupported identifiers/operators independently of TypeScript.
function membership(column: unknown, operator: unknown, value: unknown) {
  const builder = query()
  const where = builder.where as unknown as (column: unknown, operator: unknown, value: unknown) => typeof builder
  return where.call(builder, column, operator, value)
}

async function outcome(action: () => unknown) {
  try {
    return { result: await action() }
  }
  catch (error) {
    assert.ok(error instanceof Error)
    return { error: { name: error.name, message: error.message } }
  }
}

async function matrix() {
  const results: unknown[] = []
  const cases: Array<{ values: unknown, included: number[], excluded: number[] }> = [
    { values: [], included: [], excluded: [1, 2, 3, 4] },
    { values: [null], included: [], excluded: [] },
    { values: [1], included: [2], excluded: [3, 4] },
    { values: [1, null], included: [2], excluded: [] },
    { values: [1, '2', 1], included: [2, 3], excluded: [4] },
    { values: [undefined, 1], included: [2], excluded: [] },
    { values: 1, included: [2], excluded: [3, 4] },
    { values: null, included: [], excluded: [] },
    { values: undefined, included: [], excluded: [] },
    { values: '2', included: [3], excluded: [2, 4] },
  ]
  for (const { values, included, excluded } of cases) {
    for (const operator of ['in', 'IN', 'iN', 'not in', 'NOT IN', 'Not In']) {
      const rows = await membership('value', operator, values).execute()
      assert.deepEqual(rows, (operator.toLowerCase() === 'in' ? included : excluded).map(id => ({ id })))
      results.push(rows)
      // Apply generic membership before any convenience method is requested.
      for (const additional of [false, true]) {
        const bare = db.selectFrom('membership_items').select('id')
        if (additional)
          bare.where('id', '>', 1)
        const where = bare.where as unknown as (column: unknown, operator: unknown, value: unknown) => typeof bare
        const actual = await where.call(bare, 'value', operator, values).orderBy('id').execute()
        const expected = (operator.toLowerCase() === 'in' ? included : excluded).filter(id => !additional || id > 1)
        assert.deepEqual(actual, expected.map(id => ({ id })))
        results.push(actual)
      }
    }
  }

  for (const operator of ['in', 'not in']) {
    for (const fallback of [false, true]) {
      const values = [1, 2]
      const builder = query().where('id', '>', 1).where('value', operator, values).whereNotNull('value')
      values[0] = 3
      values.push(3)
      const rows = await (fallback ? builder.groupBy('id') : builder).execute()
      assert.deepEqual(rows, operator === 'in' ? [{ id: 2 }, { id: 3 }] : [{ id: 4 }])
      results.push(rows)
    }
  }

  const combined = await query().where('value', 'in', [1, 2, 3]).where('id', 'not in', [2]).where({ id: 3 }).execute()
  assert.deepEqual(combined, [{ id: 3 }])
  results.push(combined)
  const customValues = [1, 2]
  customValues[Symbol.iterator] = function* () { yield 2; yield 3 }
  const custom = await membership('value', 'in', customValues).execute()
  assert.deepEqual(custom, [{ id: 3 }, { id: 4 }])
  results.push(custom)
  const customSlice = [1, 2]
  customSlice.slice = () => [3]
  const sliced = await membership('value', 'in', customSlice).execute()
  assert.deepEqual(sliced, [{ id: 2 }, { id: 3 }])
  results.push(sliced)
  class SpeciesValues extends Array<number> {
    static get [Symbol.species]() { throw new Error('Species must not run') }
  }
  const species = await membership('value', 'in', new SpeciesValues(1, 2)).execute()
  assert.deepEqual(species, [{ id: 2 }, { id: 3 }])
  results.push(species)
  const sliceGetter = [1, 2]
  Object.defineProperty(sliceGetter, 'slice', { get() { throw new Error('Slice must not be read') } })
  assert.deepEqual(await membership('value', 'in', sliceGetter).execute(), [{ id: 2 }, { id: 3 }])
  for (const operator of ['in', 'not in']) {
    let getterReads = 0
    const accessor = [1, 2]
    Object.defineProperty(accessor, 0, { get() { getterReads++; accessor.push(3); return 1 } })
    results.push(await outcome(() => membership('value', operator, accessor).execute()))
    assert.equal(getterReads, 1)
    const differentlySized = [1, 2]
    differentlySized[Symbol.iterator] = function* () { yield 1 }
    results.push(await outcome(() => membership('value', operator, differentlySized).execute()))
    const traps: PropertyKey[] = []
    const proxied = new Proxy([1, 2], {
      get(target, property, receiver) { traps.push(property); return Reflect.get(target, property, receiver) },
      getOwnPropertyDescriptor() { throw new Error('Proxy descriptors must not be inspected') },
      getPrototypeOf() { throw new Error('Proxy prototype must not be inspected') },
    })
    results.push(await membership('value', operator, proxied).execute())
    results.push(traps)
  }
  const sparse: unknown[] = Array(2)
  sparse[1] = 1
  for (const operator of ['in', 'not in']) {
    for (const additional of [false, true]) {
      const builder = query()
      if (additional)
        builder.where('id', '>', 1)
      const rows = await builder.where('value', operator, sparse).execute()
      assert.deepEqual(rows, operator === 'in' ? [{ id: 2 }] : [])
      results.push(rows)
    }
  }
  const capturedBuilder = db.selectFrom('membership_items').select('id').where('id', '>', 1)
  const capturedWhere = capturedBuilder.where.bind(capturedBuilder)
  capturedBuilder.whereRaw('id < 4')
  capturedWhere('value', 'in', [2, 3])
  assert.deepEqual(await capturedBuilder.execute(), [{ id: 3 }])
  const retained = membership('value', 'in', [1, 2])
  retained.whereRaw('id = 3')
  assert.deepEqual(await retained.execute(), [{ id: 3 }])
  assert.deepEqual(await retained.executeTakeFirst(), { id: 3 })
  results.push(await membership('membership_items.value', 'in', [2]).execute())
  results.push(await membership('value', 'in', [1, 2, 3]).limit(1).offset(1).execute())
  results.push(await membership('value', 'in', [1, 2, 3]).limit(1).offset(1).executeTakeFirst())
  results.push(await membership('value', 'in', [1, 2, 3]).groupBy('id').limit(1).offset(1).executeTakeFirst())
  results.push(await membership('value', 'in', [1, 2, 3]).limit(0).execute())
  results.push(await membership('value', 'in', [1, 2, 3]).limit(0).executeTakeFirst())
  results.push(await membership('value', 'not in', []).execute())
  results.push(await membership('value', 'in', []).groupBy('id').execute())
  results.push(await membership('value', 'not in', []).groupBy('id').execute())
  for (const values of [[1, 2], []]) {
    for (const terminal of ['first', 'executeTakeFirst', 'firstOrFail', 'executeTakeFirstOrThrow', 'exists', 'doesntExist'] as const)
      results.push(await outcome(() => membership('value', 'in', values)[terminal]()))
  }
  results.push(await membership('value', 'in', [1, 2]).count())
  results.push(await membership('value', 'not in', [1]).pluck('id'))

  for (const [column, operator, value] of [
    ['value OR 1=1', 'in', [1]],
    ['value', 'in; DROP TABLE membership_items', [1]],
    ['value', ' in ', [1]],
    ['value', { toString: () => 'in' }, [1]],
    ['value', 'in', { invalid: true }],
  ]) {
    results.push(await outcome(() => membership(column, operator, value).execute()))
  }

  const live = membership('value', 'in', [9])
  assert.deepEqual(await live.execute(), [])
  await db.unsafe('INSERT INTO membership_items VALUES (5, 9)').execute()
  assert.deepEqual(await live.execute(), [{ id: 5 }])
  await db.unsafe('UPDATE membership_items SET value = 10 WHERE id = 5').execute()
  assert.deepEqual(await live.execute(), [])
  const rollback = new Error('membership rollback')
  await assert.rejects(db.transaction(async () => {
    await db.unsafe('UPDATE membership_items SET value = 9 WHERE id = 5').execute()
    assert.deepEqual(await live.execute(), [{ id: 5 }])
    assert.deepEqual(await membership('value', 'in', [9]).executeTakeFirst(), { id: 5 })
    throw rollback
  }), error => error === rollback)
  assert.deepEqual(await live.execute(), [])
  await db.transaction(async () => {
    await db.unsafe('UPDATE membership_items SET value = 9 WHERE id = 5').execute()
    assert.deepEqual(await live.execute(), [{ id: 5 }])
  })
  assert.deepEqual(await live.execute(), [{ id: 5 }])
  await db.unsafe('DELETE FROM membership_items WHERE id = 5').execute()
  assert.deepEqual(await live.execute(), [])
  assert.deepEqual(await query().where('value', '=', 1).execute(), [{ id: 2 }])
  return results
}

try {
  await db.unsafe('CREATE TABLE membership_items (id INTEGER PRIMARY KEY, value INTEGER)').execute()
  await db.unsafe('INSERT INTO membership_items VALUES (1, NULL), (2, 1), (3, 2), (4, 3)').execute()
  const lightweight = await matrix()
  let selectHooks = 0
  setConfig({ hooks: { onQueryEnd: (event) => { if (event.kind === 'select') selectHooks++ } } })
  const upstream = await matrix()
  assert.ok(selectHooks > 0, 'The reference matrix must exercise upstream query hooks')
  assert.deepEqual(lightweight, upstream)
  console.log('generic-sqlite-membership-ok')
}
finally {
  resetDatabaseConnection()
}
