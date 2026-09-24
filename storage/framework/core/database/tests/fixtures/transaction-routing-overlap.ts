import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_ROUTING_OVERLAP_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-routing-overlap-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_routing_overlap_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, closeDatabaseConnection } = await import('../../src/runtime')
const { enqueueAfterCommit } = await import('../../src/transaction-context')
const { withRoutingContext, contextInTransaction, contextHasWritten, shouldRouteToReplica } = await import('../../src/replicas')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect, connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, pool: { max: 4 } },
  }, queryLogging: { enabled: false },
} })
try {
  const request = new AsyncLocalStorage<string>()
  await Promise.all(['request-a', 'request-b'].map(name => request.run(name, () => withRoutingContext(async () => {
    await db.transaction(async (trx) => {
      assert.equal(request.getStore(), name)
      assert.equal(contextInTransaction(), true)
      await trx.unsafe('SELECT 1 AS value')
      await trx.savepoint(async (nested) => {
        assert.equal(request.getStore(), name)
        assert.equal(contextInTransaction(), true)
        await nested.unsafe('SELECT 2 AS value')
        assert.equal(request.getStore(), name)
      })
      assert.equal(request.getStore(), name)
    })
    assert.equal(request.getStore(), name)
    assert.equal(contextInTransaction(), false)
    const observers: Array<[string, string | undefined, boolean]> = []
    await assert.rejects(db.transaction(async () => { throw new Error('fixture observer rollback') }, {
      onRollback() { observers.push(['onRollback', request.getStore(), contextInTransaction()]) },
      afterRollback() { observers.push(['afterRollback', request.getStore(), contextInTransaction()]) },
    }), /fixture observer rollback/)
    assert.deepEqual(observers, [['onRollback', name, true], ['afterRollback', name, true]])
  }))))
  for (const rollback of [false, true]) {
    await withRoutingContext(async () => {
      const entered = Promise.withResolvers<void>()
      const firstRelease = Promise.withResolvers<void>()
      const secondRelease = Promise.withResolvers<void>()
      const effects: string[] = []
      const first = db.transaction(async (trx) => {
        assert.equal(contextInTransaction(), true)
        await trx.unsafe('SELECT 1 AS value')
        entered.resolve()
        await firstRelease.promise
        if (rollback) throw new Error('fixture first rollback')
        enqueueAfterCommit(() => { assert.equal(contextInTransaction(), true); effects.push('first') })
      })
      const firstResult = first.catch(error => error)
      await Promise.race([entered.promise, firstResult.then(error => { throw error ?? new Error('Transaction exited before entering its callback') })])
      const second = db.transaction(async (trx) => {
        await secondRelease.promise
        assert.equal(contextInTransaction(), true, 'a sibling finishing must not clear this transaction flag')
        await trx.unsafe('SELECT 2 AS value')
        enqueueAfterCommit(() => { assert.equal(contextInTransaction(), true); effects.push('second') })
      })
      try {
        assert.equal(contextInTransaction(), false, 'the caller is not inside either sibling transaction')
        firstRelease.resolve()
        const firstValue = await firstResult
        if (rollback) assert.match(firstValue.message, /fixture first rollback/)
        else assert.equal(firstValue, undefined)
        secondRelease.resolve()
        await second
        assert.equal(contextInTransaction(), false)
        assert.equal(contextHasWritten(), false)
        assert.equal(shouldRouteToReplica({ policy: { autoRoute: true }, replicas: [{ host: 'unused.test' }] }), true)
        assert.deepEqual(effects, rollback ? ['second'] : ['first', 'second'])
      }
      finally {
        firstRelease.resolve(); secondRelease.resolve()
        await Promise.allSettled([firstResult, second])
      }
    })
  }
  console.log('transaction routing overlap OK')
}
finally { await closeDatabaseConnection() }
