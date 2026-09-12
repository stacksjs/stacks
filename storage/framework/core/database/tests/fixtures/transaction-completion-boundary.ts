import assert from 'node:assert/strict'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'mysql' || dialect === 'postgres')
assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
if (dialect !== 'sqlite') {
  assert(process.env.DB_DATABASE?.startsWith('stacks_completion_'))
  assert(['localhost', '127.0.0.1', '[::1]'].includes(process.env.DB_HOST!))
}
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('../../src/utils')
const { enqueueAfterCommit } = await import('../../src/transaction-context')
type TransactionHandle = Parameters<Parameters<typeof db.transaction>[0]>[0]
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: ':memory:' } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  },
  queryLogging: { enabled: false },
} })
try {
  await db.unsafe('CREATE TABLE completion_probe (id INTEGER PRIMARY KEY)').execute()
  const events: string[] = []
  const failure = new Error('post-commit observer failed')
  await assert.rejects(db.transaction(async (tx) => {
    await tx.insertInto('completion_probe').values({ id: 1 }).execute()
    assert.equal(enqueueAfterCommit(() => { events.push('committed-side-effect') }), true)
  }, { retries: 0, afterCommit: () => { throw failure } }), error => error === failure)
  assert.deepEqual(Array.from(await db.selectFrom('completion_probe').select('id').get(), row => Number(row.id)), [1])
  assert.deepEqual(events, ['committed-side-effect'], 'Committed work must not lose queued effects')
  events.length = 0
  db.setTransactionDefaults({ afterCommit: () => { throw failure } })
  try {
    await assert.rejects(db.transaction(async (tx) => {
      await tx.insertInto('completion_probe').values({ id: 2 }).execute()
      enqueueAfterCommit(() => { events.push('default-observer-effect') })
    }), error => error === failure)
    assert.deepEqual(events, ['default-observer-effect'])
  }
  finally { db.setTransactionDefaults({ afterCommit: undefined }) }
  const { transaction } = await import('@stacksjs/orm')
  events.length = 0
  db.setTransactionDefaults({ afterCommit: () => { throw failure } })
  try {
    await assert.rejects(transaction(async (tx) => {
      await tx.insertInto('completion_probe').values({ id: 3 }).execute()
      enqueueAfterCommit(() => { events.push('orm-committed-effect') })
    }), error => error === failure)
    assert.deepEqual(events, ['orm-committed-effect'])
  }
  finally { db.setTransactionDefaults({ afterCommit: undefined }) }
  // Async observers are awaited outside the driver's retry/rollback handling.
  for (const [wrapped, asyncObserver, id] of [[false, false, 11], [true, false, 12], [false, true, 4], [true, true, 5]] as const) {
    events.length = 0
    let bodies = 0
    let rollbackCalls = 0
    let retries = 0
    const observerError = new Error('database is locked: observer only')
    const work = async (tx: TransactionHandle) => {
      bodies++
      await tx.insertInto('completion_probe').values({ id }).execute()
      enqueueAfterCommit(() => { events.push('async-observer-effect') })
    }
    const options = {
      retries: 1,
      afterCommit: asyncObserver
        ? async () => { await Promise.resolve(); throw observerError }
        : () => { throw observerError },
      onRollback: () => { rollbackCalls++ },
      afterRollback: () => { rollbackCalls++ },
      onRetry: () => { retries++ },
    }
    await assert.rejects(wrapped ? db.transactional(work, options)() : db.transaction(work, options), error => error === observerError)
    assert.deepEqual({ bodies, rollbackCalls, retries }, { bodies: 1, rollbackCalls: 0, retries: 0 })
    assert.deepEqual(events, ['async-observer-effect'])
  }
  // Default options merge, explicit overrides and explicit undefined retain
  // their public semantics without swallowing observer errors.
  let defaultCalls = 0
  let overrideCalls = 0
  db.setTransactionDefaults({ afterCommit: () => { defaultCalls++ } })
  db.setTransactionDefaults({ retries: 0 })
  assert.equal(await db.transaction(async () => 'result'), 'result')
  await db.transaction(async () => {}, { afterCommit: () => { overrideCalls++ } })
  await db.transaction(async () => {}, { afterCommit: undefined })
  assert.deepEqual({ defaultCalls, overrideCalls }, { defaultCalls: 1, overrideCalls: 1 })
  db.setTransactionDefaults({ afterCommit: undefined })

  events.length = 0
  let ormBodies = 0
  let ormRollbacks = 0
  let ormRetries = 0
  const ormObserverError = new Error('database is locked: ORM default observer')
  db.setTransactionDefaults({
    retries: 1,
    afterCommit: async () => { await Promise.resolve(); throw ormObserverError },
    onRollback: () => { ormRollbacks++ },
    afterRollback: () => { ormRollbacks++ },
    onRetry: () => { ormRetries++ },
  })
  try {
    await assert.rejects(transaction(async (tx) => {
      ormBodies++
      await tx.insertInto('completion_probe').values({ id: 13 }).execute()
      enqueueAfterCommit(() => { events.push('async-orm-effect') })
    }), error => error === ormObserverError)
    assert.deepEqual({ ormBodies, ormRollbacks, ormRetries }, { ormBodies: 1, ormRollbacks: 0, ormRetries: 0 })
    assert.deepEqual(events, ['async-orm-effect'])
  }
  finally { db.setTransactionDefaults({ afterCommit: undefined, onRollback: undefined, afterRollback: undefined, onRetry: undefined }) }

  // A caught observer failure after a nested savepoint release must not erase
  // the inner writes' effects if their outer transaction ultimately commits.
  events.length = 0
  await transaction(async (outer) => {
    await assert.rejects(outer.transaction(async (inner) => {
      await inner.insertInto('completion_probe').values({ id: 6 }).execute()
      enqueueAfterCommit(() => { events.push('inner-survived') })
    }, { afterCommit: () => { throw failure } }), error => error === failure)
    assert.equal(events.length, 0)
    enqueueAfterCommit(() => { events.push('outer-survived') })
  })
  assert.deepEqual(events, ['inner-survived', 'outer-survived'])

  events.length = 0
  await assert.rejects(transaction(async (outer) => {
    enqueueAfterCommit(() => { events.push('outer-rolled-back') })
    await outer.transaction(async (inner) => {
      await inner.insertInto('completion_probe').values({ id: 7 }).execute()
      enqueueAfterCommit(() => { events.push('inner-rolled-back') })
    }, { afterCommit: () => { throw failure } })
  }), error => error === failure)
  assert.equal(events.length, 0)
  assert.deepEqual(Array.from(await db.selectFrom('completion_probe').select('id').orderBy('id').get(), row => Number(row.id)), [1, 2, 3, 4, 5, 6, 11, 12, 13])
  if (dialect === 'sqlite') {
    for (const useObserver of [false, true]) {
      const rolledBackId = useObserver ? 16 : 14
      const survivedId = useObserver ? 17 : 15
      let outcomes: PromiseSettledResult<void>[] | undefined
      const parallelTransactions = async () => {
        const firstReady = Promise.withResolvers<void>()
        const releaseFirst = Promise.withResolvers<void>()
        const first = db.transaction(async (tx) => {
          await tx.insertInto('completion_probe').values({ id: rolledBackId }).execute()
          firstReady.resolve()
          await releaseFirst.promise
          throw failure
        })
        await firstReady.promise
        const second = db.transaction(async (tx) => {
          await tx.insertInto('completion_probe').values({ id: survivedId }).execute()
        })
        const finished = Promise.allSettled([first, second])
        await new Promise<void>(resolve => setImmediate(resolve))
        releaseFirst.resolve()
        outcomes = await finished
      }
      await db.transaction(async () => {
        if (!useObserver) enqueueAfterCommit(parallelTransactions)
      }, { afterCommit: useObserver ? parallelTransactions : undefined })
      assert.deepEqual(outcomes?.map(result => result.status), ['rejected', 'fulfilled'])
      assert.equal(await db.selectFrom('completion_probe').where('id', '=', survivedId).exists(), true, 'Completion-launched sibling transactions must commit independently')
      assert.equal(await db.selectFrom('completion_probe').where('id', '=', rolledBackId).exists(), false)
    }
    const observerReady = Promise.withResolvers<void>()
    const releaseObserver = Promise.withResolvers<void>()
    const releaseRollback = Promise.withResolvers<void>()
    let secondEntered = false
    const first = db.transaction(async (tx) => {
      await tx.insertInto('completion_probe').values({ id: 8 }).execute()
    }, { afterCommit: async () => {
      observerReady.resolve()
      await releaseObserver.promise
      await db.insertInto('completion_probe').values({ id: 9 }).execute()
    } })
    await observerReady.promise
    const second = db.transaction(async (tx) => {
      secondEntered = true
      await tx.insertInto('completion_probe').values({ id: 10 }).execute()
      await releaseRollback.promise
      throw failure
    }).then(() => undefined, error => error)
    try {
      // Drain ready microtasks; both SQLite callbacks use synchronous local
      // storage, with the explicit promises above controlling their progress.
      await new Promise<void>(resolve => setImmediate(resolve))
      const overlapped = secondEntered
      releaseObserver.resolve()
      await first
      releaseRollback.resolve()
      assert.equal(await second, failure)
      assert.equal(await db.selectFrom('completion_probe').where('id', '=', 9).exists(), true, 'Observer writes must not roll back with another transaction')
      assert.equal(overlapped, false, 'SQLite transaction lock must include observer completion')
    }
    finally {
      releaseObserver.resolve()
      releaseRollback.resolve()
      await Promise.allSettled([first, second])
    }
    const releaseLate = Promise.withResolvers<void>()
    let late: Promise<void> | undefined
    const parent = db.transaction(async () => {}, { afterCommit: async () => {
      await db.transaction(async () => {}, { afterCommit: () => {
        late = releaseLate.promise.then(() => db.transaction(async (tx) => {
          await tx.insertInto('completion_probe').values({ id: 18 }).execute()
        }))
      } })
      releaseLate.resolve()
      await late
    } })
    let watchdog: ReturnType<typeof setTimeout> | undefined
    try {
      const deadline = Promise.withResolvers<never>()
      watchdog = setTimeout(() => deadline.reject(new Error('Late child continuation deadlocked behind its parent completion')), 2000)
      await Promise.race([parent, deadline.promise])
      assert.equal(await db.selectFrom('completion_probe').where('id', '=', 18).exists(), true)
    }
    finally { clearTimeout(watchdog) }
  }
  console.log('transaction completion boundary OK')
}
finally { resetDatabaseConnection() }
