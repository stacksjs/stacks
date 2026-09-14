import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_TRANSACTION_FACADE_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-transaction-facade-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_transaction_facade_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection, enqueueAfterCommit, sqlHelpers } = await import('../../src')
await ensureDatabaseConfigLoaded()
const { transactional, ormReady } = await import('@stacksjs/orm')
await ormReady
const connection = dialect === 'sqlite' ? { database: process.env.DB_DATABASE_PATH } : {
  name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
}
initializeDbConfig({ app: { env: 'test' }, database: { default: dialect, connections: { [dialect]: connection }, queryLogging: { enabled: false } } })
const failures: string[] = []
async function ids() { return (await db.selectFrom('scope_probe').select('id').orderBy('id').get()).map(row => Number(row.id)) }
async function check(name: string, run: () => Promise<void>) {
  await db.deleteFrom('scope_probe').execute()
  try { await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
try {
  await db.unsafe('CREATE TABLE scope_probe (id INTEGER PRIMARY KEY)').execute()
  await check('facade writes and nested transactions roll back with their caller', async () => {
    await assert.rejects(db.transaction(async () => {
      await db.insertInto('scope_probe').values({ id: 1 }).execute()
      await db.transaction(async () => { await db.unsafe('INSERT INTO scope_probe (id) VALUES (2)').execute() })
      assert.deepEqual(await ids(), [1, 2])
      throw new Error('fixture outer rollback')
    }), /fixture outer rollback/)
    assert.deepEqual(await ids(), [])
  })
  await check('retained methods and pre-created decorators resolve the active connection', async () => {
    const retained = db.transaction
    const createMany = db.createMany
    const decorated = db.transactional(async (tx, id: number) => { await tx.insertInto('scope_probe').values({ id }).execute() })
    const ormDecorated = transactional(async (tx, id: number) => { await tx.insertInto('scope_probe').values({ id }).execute() })
    await assert.rejects(db.transaction(async () => {
      await retained(async () => { await db.insertInto('scope_probe').values({ id: 1 }).execute() })
      await decorated(2)
      await ormDecorated(3)
      await createMany('scope_probe', [{ id: 4 }])
      assert.deepEqual(await ids(), [1, 2, 3, 4])
      throw new Error('fixture decorated rollback')
    }), /fixture decorated rollback/)
    assert.deepEqual(await ids(), [])
  })
  await check('decorators created in callbacks resolve a fresh transaction after commit', async () => {
    let later: (() => Promise<void>) | undefined
    await db.transaction(async () => {
      later = db.transactional(async tx => { await tx.insertInto('scope_probe').values({ id: 1 }).execute() })
      enqueueAfterCommit(db.transactional(async tx => { await tx.insertInto('scope_probe').values({ id: 2 }).execute() }))
      enqueueAfterCommit(transactional(async tx => { await tx.insertInto('scope_probe').values({ id: 3 }).execute() }))
    })
    await later!()
    assert.deepEqual(await ids(), [1, 2, 3])
  })
  for (const method of ['transaction', 'savepoint'] as const) {
    await check(`caught ${method} failure discards only its own facade writes and effects`, async () => {
      const effects: number[] = []
      await db.transaction(async () => {
        await db.insertInto('scope_probe').values({ id: 1 }).execute()
        enqueueAfterCommit(() => { effects.push(1) })
        await assert.rejects(db[method](async () => {
          await db.insertInto('scope_probe').values({ id: 2 }).execute()
          enqueueAfterCommit(() => { effects.push(2) })
          throw new Error('fixture inner rollback')
        }), /fixture inner rollback/)
        await db.insertInto('scope_probe').values({ id: 3 }).execute()
        enqueueAfterCommit(async () => { assert.deepEqual(await ids(), [1, 3]); effects.push(3) })
        assert.deepEqual(await ids(), [1, 3])
      })
      assert.deepEqual(await ids(), [1, 3])
      assert.deepEqual(effects, [1, 3])
    })
  }
  await check('concurrent facade transactions never enroll in another request', async () => {
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, id) => db.transaction(async () => {
      await db.insertInto('scope_probe').values({ id }).execute()
      await Promise.resolve()
      if (id % 2 === 0) throw new Error('fixture concurrent rollback')
      assert(await db.selectFrom('scope_probe').where('id', '=', id).executeTakeFirst())
    })))
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 4)
    assert.deepEqual(await ids(), [1, 3, 5, 7])
  })
  await check('nested rollback and retry observers can read the surviving parent', async () => {
    await db.transaction(async () => {
      await db.insertInto('scope_probe').values({ id: 1 }).execute()
      const observations: Promise<number[]>[] = []
      await assert.rejects(db.transaction(async () => {
        await db.insertInto('scope_probe').values({ id: 2 }).execute()
        throw new Error('fixture rollback observers')
      }, { onRollback: () => { observations.push(ids()) }, afterRollback: () => { observations.push(ids()) } }), /fixture rollback observers/)
      assert.deepEqual(await Promise.all(observations), [[1], [1]])
      let attempts = 0
      const retries: Promise<number[]>[] = []
      await db.transaction(async () => {
        attempts++
        if (attempts === 1) throw Object.assign(new Error('deadlock detected'), { code: '40P01' })
        await db.insertInto('scope_probe').values({ id: 3 }).execute()
      }, { retries: 1, onRetry: () => { retries.push(ids()) } })
      assert.equal(attempts, 2)
      assert.deepEqual(await Promise.all(retries), [[1]])
    })
    assert.deepEqual(await ids(), [1, 3])
  })
  for (const profile of ['test', 'production']) {
    await check(`retained statements reject closed ownership (${profile} query profile)`, async () => {
      initializeDbConfig({ app: { env: profile }, database: { default: dialect, connections: { [dialect]: connection }, queryLogging: { enabled: false } } })
      const delayed: Array<() => Promise<unknown>> = []
      try {
        await db.transaction(async () => {
          const read = db.selectFrom('scope_probe').select('id')
          const raw = db.unsafe('INSERT INTO scope_probe (id) VALUES (1)')
          const insert = db.insertInto('scope_probe').values({ id: 2 })
          const insertGetId = db.insertGetId
          delayed.push(() => read.execute(), () => raw.execute(), () => insert.execute(), () => insertGetId('scope_probe', { id: 3 }))
          for (const method of ['$call', 'tap', 'pipe'] as const) {
            db.selectFrom('scope_probe')[method]((query) => {
              delayed.push(() => query.execute())
              return query
            })
          }
          db.selectFrom('scope_probe').when(true, (query) => {
            delayed.push(() => query.execute())
            return query
          })
        })
        for (const execute of delayed)
          await assert.rejects(async () => execute(), /closed transaction callback/)
        assert.deepEqual(await ids(), [])
      }
      finally { initializeDbConfig({ app: { env: 'test' }, database: { default: dialect, connections: { [dialect]: connection }, queryLogging: { enabled: false } } }) }
    })
  }
  await check('closed transaction continuations cannot silently autocommit', async () => {
    const release = Promise.withResolvers<void>()
    let delayed: Promise<void> | undefined
    await db.transaction(async () => {
      await db.insertInto('scope_probe').values({ id: 1 }).execute()
      delayed = release.promise.then(async () => { await db.insertInto('scope_probe').values({ id: 2 }).execute() })
    })
    release.resolve()
    await assert.rejects(delayed!, /closed transaction callback/)
    assert.deepEqual(await ids(), [1])
  })
  await check('late work from a rolled-back child cannot enter its surviving parent', async () => {
    const release = Promise.withResolvers<void>()
    let delayed: Promise<void> | undefined
    await db.transaction(async () => {
      await assert.rejects(db.transaction(async () => {
        delayed = release.promise.then(async () => { await db.insertInto('scope_probe').values({ id: 2 }).execute() })
        throw new Error('fixture child rollback')
      }), /fixture child rollback/)
      release.resolve()
      await assert.rejects(delayed!, /closed transaction callback/)
      await db.insertInto('scope_probe').values({ id: 1 }).execute()
    })
    assert.deepEqual(await ids(), [1])
  })
  await check('overlapping siblings are rejected without damaging the active savepoint', async () => {
    await db.transaction(async () => {
      const retained = db.selectFrom('scope_probe').select('id')
      const entered = Promise.withResolvers<void>()
      const release = Promise.withResolvers<void>()
      const first = db.transaction(async () => {
        await db.insertInto('scope_probe').values({ id: 1 }).execute()
        entered.resolve()
        await release.promise
      })
      await entered.promise
      try {
        await assert.rejects(async () => db.transaction(async () => { await db.insertInto('scope_probe').values({ id: 2 }).execute() }), /active nested transaction/)
        assert.throws(() => db.selectFrom('scope_probe'), /active nested transaction/)
        await assert.rejects(async () => retained.execute(), /active nested transaction/)
      }
      finally { release.resolve(); await first }
      await db.insertInto('scope_probe').values({ id: 3 }).execute()
    })
    assert.deepEqual(await ids(), [1, 3])
  })
  // bun-query-builder#1145: 0.2.69 omits network query hooks even outside a
  // transaction. SQLite exercises deferred persistence independently of that.
  if (dialect === 'sqlite') await check('deferred query diagnostics survive the transaction callback closing', async () => {
    await db.unsafe(`CREATE TABLE query_logs (
      ${sqlHelpers(dialect).pkColumn}, query TEXT, normalized_query TEXT, duration REAL,
      connection TEXT, status TEXT, error TEXT, executed_at TEXT, bindings TEXT,
      trace TEXT, model TEXT, method TEXT, file TEXT, line INTEGER, memory_usage REAL,
      affected_tables TEXT, tags TEXT
    )`).execute()
    const previous = config.database.queryLogging
    config.database.queryLogging = { ...previous, enabled: true, excludedQueries: ['query_logs'], analysis: { enabled: false } }
    const { registerPersistentQueryHooks } = await import('@stacksjs/query-builder')
    let delivered = 0
    const stop = registerPersistentQueryHooks({ onQueryEnd: event => { if (event.sql.includes('transaction_facade_')) delivered++ } })
    try {
      const marker = 'transaction_facade_log'
      await db.transaction(async () => { await db.selectFrom('scope_probe').select([`id as ${marker}`]).execute() })
      const deadline = Date.now() + 2000
      let matches = 0
      do {
        const rows = await db.unsafe('SELECT query FROM query_logs').execute()
        matches = rows.filter(row => String(row.query).includes(marker)).length
        if (matches) break
        await Bun.sleep(5)
      } while (Date.now() < deadline)
      assert.equal(matches, 1, `diagnostic delivery must not inherit a closed transaction connection; hooks: ${delivered}`)
    }
    finally { stop(); config.database.queryLogging = previous }
  })
  if (dialect !== 'sqlite') {
    await check('automatic and explicit replica reads use the active transaction', async () => {
      let attempts = 0
      const replica = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: {
        open(socket) { attempts++; socket.end() }, data() {},
      } })
      try {
        initializeDbConfig({ app: { env: 'test' }, database: {
          default: dialect, connections: { [dialect]: { ...connection, replicas: [{ host: '127.0.0.1', port: replica.port }], pool: { acquireTimeoutMs: 1000 } } },
          reads: { autoRoute: true }, queryLogging: { enabled: false },
        } })
        let queuedRead = false
        let observerRead = false
        await db.transaction(async () => {
          await db.insertInto('scope_probe').values({ id: 8 }).execute()
          assert.deepEqual(await ids(), [8])
          assert.equal(Number((await db.read.selectFrom('scope_probe').where('id', '=', 8).executeTakeFirst())!.id), 8)
          enqueueAfterCommit(async () => { assert.deepEqual(await ids(), [8]); queuedRead = true })
        }, { afterCommit: async () => { assert.deepEqual(await ids(), [8]); observerRead = true } })
        assert(queuedRead && observerRead, 'both completion channels must read the committed primary outside HTTP context')
        assert.equal(attempts, 0)
      }
      finally {
        replica.stop(true)
        initializeDbConfig({ app: { env: 'test' }, database: { default: dialect, connections: { [dialect]: connection }, queryLogging: { enabled: false } } })
      }
    })
  }
  assert.deepEqual(failures, [], failures.join('\n'))
  console.log('transaction facade atomicity OK')
}
finally { resetDatabaseConnection() }
