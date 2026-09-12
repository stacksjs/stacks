import assert from 'node:assert/strict'
import { SQL } from 'bun'

const { DB_HOST: host, DB_DATABASE: name, DB_USERNAME: username, DB_PASSWORD: password, DB_PORT: port } = process.env
assert.equal(process.env.DB_CONNECTION, 'postgres')
assert(name?.startsWith('stacks_transaction_test_'))
assert(host && ['127.0.0.1', 'localhost', '[::1]'].includes(host))
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, resetDatabaseConnection, enqueueAfterCommit, isInTransaction } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: {
    default: 'postgres',
    connections: { postgres: { name, host, port: Number(port || 5432), username, password, pool: { max: 4 } } },
  },
})
const admin = new SQL({ adapter: 'postgres', hostname: host, port: Number(port || 5432), username, password, database: name })

try {
  await db.unsafe('CREATE TABLE scope_probe (id INTEGER PRIMARY KEY)').execute()
  for (const method of ['transaction', 'savepoint'] as const) {
    const effects: string[] = []
    await db.transaction(async (outer) => {
      assert(isInTransaction())
      enqueueAfterCommit(() => { effects.push('outer') })
      await assert.rejects(outer[method](async (inner) => {
        await inner.unsafe('INSERT INTO scope_probe (id) VALUES (1)').execute()
        enqueueAfterCommit(() => { effects.push('rolled-back') })
        throw new Error('fixture nested rollback')
      }), /fixture nested rollback/)
      assert.deepEqual(effects, [])
    })
    assert.equal((await db.unsafe('SELECT id FROM scope_probe').execute()).length, 0)
    assert.deepEqual(effects, ['outer'], `${method} must discard only rolled-back work`)
  }

  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const concurrent: string[] = []
  const failing = db.transaction(async (tx) => {
    await tx.unsafe('INSERT INTO scope_probe (id) VALUES (1)').execute()
    enqueueAfterCommit(() => { concurrent.push('failed') })
    entered.resolve()
    await release.promise
    throw new Error('fixture concurrent rollback')
  })
  const rejected = failing.catch(error => error)
  await entered.promise
  try {
    await db.transaction(async (tx) => {
      await tx.unsafe('INSERT INTO scope_probe (id) VALUES (2)').execute()
      enqueueAfterCommit(() => { concurrent.push('committed') })
    })
  }
  finally {
    release.resolve()
  }
  assert.match((await rejected as Error).message, /fixture concurrent rollback/)
  assert.deepEqual(Array.from(await db.unsafe('SELECT id FROM scope_probe').execute(), row => row.id), [2])
  assert.deepEqual(concurrent, ['committed'])

  // A deferred trigger raises a real PostgreSQL serialization error at COMMIT,
  // after the callback returned. A sequence survives rollback, so retry works.
  await db.unsafe('CREATE TABLE scope_commit_retry (id INTEGER PRIMARY KEY)').execute()
  await db.unsafe('CREATE SEQUENCE scope_commit_retry_count').execute()
  await db.unsafe(`CREATE FUNCTION scope_fail_first_commit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF nextval('scope_commit_retry_count') = 1 THEN
        RAISE EXCEPTION 'fixture commit serialization failure' USING ERRCODE = '40001';
      END IF;
      RETURN NULL;
    END;
  $$`).execute()
  await db.unsafe('CREATE CONSTRAINT TRIGGER scope_commit_retry_trigger AFTER INSERT ON scope_commit_retry DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION scope_fail_first_commit()').execute()
  const effects: number[] = []
  let attempts = 0
  const releaseOldAttempt = Promise.withResolvers<void>()
  let oldContinuation: Promise<boolean> | undefined
  await db.transaction(async (tx) => {
    const attempt = ++attempts
    if (attempt === 1)
      oldContinuation = releaseOldAttempt.promise.then(() => enqueueAfterCommit(() => { effects.push(0) }))
    else {
      releaseOldAttempt.resolve()
      assert.equal(await oldContinuation, true)
    }
    await tx.unsafe('INSERT INTO scope_commit_retry (id) VALUES (1)').execute()
    enqueueAfterCommit(() => { effects.push(attempt) })
  }, { retries: 1 })
  assert.equal(attempts, 2)
  assert.equal((await db.unsafe('SELECT id FROM scope_commit_retry').execute()).length, 1)
  assert.deepEqual(effects, [2], 'only the committed attempt may dispatch side effects')

  // Kill only this disposable database's client connections, not the server.
  await admin.unsafe('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [name])
  let recovered = false
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const rows = await db.unsafe('SELECT id FROM scope_commit_retry').execute()
      assert.equal(rows.length, 1)
      recovered = true
      break
    }
    catch {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
  assert(recovered, 'read connection must recover after its backend is terminated')
  resetDatabaseConnection()
  assert.equal((await db.unsafe('SELECT id FROM scope_commit_retry').execute()).length, 1)
  assert.equal(isInTransaction(), false)
  console.log('PASS PostgreSQL nested rollback, concurrent isolation, commit retry, backend recovery and reset')
}
finally {
  resetDatabaseConnection()
  await admin.close()
}
