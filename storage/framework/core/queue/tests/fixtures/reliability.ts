import assert from 'node:assert/strict'

assert.equal(process.env.DB_CONNECTION, 'sqlite')
assert(process.env.DB_DATABASE_PATH)
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: 'sqlite', connections: { sqlite: { database: process.env.DB_DATABASE_PATH } }, queryLogging: { enabled: false },
} })
const scenario = process.env.QUEUE_RELIABILITY_SCENARIO
try {
  if (scenario === 'concurrency-worker') {
    const { recordCircuitSuccess } = await import('../../src/circuit-breaker')
    const { recordFailureForPoison } = await import('../../src/poison')
    const { retryDeadLetterJob } = await import('../../src/dead-letter')
    const { storeScheduledRun } = await import('../../src/scheduler-persistence')
    await retryDeadLetterJob(Number(process.env.QUEUE_RETRY_ID))
    await storeScheduledRun('CrossProcess', new Date(0), {})
    for (let index = 0; index < 10; index++) {
      await recordCircuitSuccess('CrossProcess')
      await recordFailureForPoison('CrossProcess', { b: 2, a: 1 }, { maxFailures: 100 })
    }
    console.log('worker OK')
  }
  else {
    await db.unsafe('CREATE TABLE jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, queue TEXT CHECK (queue != \'blocked\'), payload TEXT, attempts INTEGER, reserved_at INTEGER, available_at INTEGER, created_at TEXT)').execute()
    await db.unsafe('CREATE TABLE dead_letter_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, connection TEXT, queue TEXT, payload TEXT, exception TEXT, reason TEXT, total_failures INTEGER, first_failed_at TEXT, last_failed_at TEXT, dead_lettered_at TEXT)').execute()
    await db.unsafe('CREATE TABLE queue_circuit_state (queue_name TEXT PRIMARY KEY, success_count INTEGER, failure_count INTEGER, window_start TEXT, paused_at TEXT, resume_at TEXT)').execute()
    await db.unsafe('CREATE TABLE job_quarantine (id INTEGER PRIMARY KEY AUTOINCREMENT, job_name TEXT, payload_hash TEXT, failure_count INTEGER, window_start TEXT, quarantined_at TEXT, UNIQUE(job_name, payload_hash))').execute()

    if (scenario === 'process-concurrency') {
      const { moveToDeadLetter, listDeadLetterJobs } = await import('../../src/dead-letter')
      const { loadPersistedLastRun } = await import('../../src/scheduler-persistence')
      await loadPersistedLastRun('CrossProcess')
      await moveToDeadLetter({ uuid: 'process-retry', payload: '{"jobName":"Retry"}' }, 'manual')
      const [retry] = await listDeadLetterJobs()
      assert(retry)
      const children = Array.from({ length: 6 }, () => Bun.spawn([process.execPath, import.meta.filename], {
        env: { ...process.env, QUEUE_RELIABILITY_SCENARIO: 'concurrency-worker', QUEUE_RETRY_ID: String(retry.id) },
        stdout: 'pipe', stderr: 'pipe',
      }))
      try {
        await Promise.all(children.map(async (child) => {
          const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
          assert.equal(code, 0, `${stdout}\n${stderr}`)
          assert(stdout.includes('worker OK'))
        }))
        assert.equal((await listDeadLetterJobs()).length, 0)
        const jobs = await db.selectFrom('jobs').selectAll().execute()
        assert.equal(jobs.length, 2, 'independent processes retry once and dispatch once')
        assert.equal((await loadPersistedLastRun('CrossProcess'))?.getTime(), 0, 'the epoch minute is a valid first dispatch')
        assert.equal((await db.selectFrom('queue_circuit_state').selectAll().executeTakeFirst())?.success_count, 60)
        assert.equal((await db.selectFrom('job_quarantine').selectAll().executeTakeFirst())?.failure_count, 60)
      }
      finally { children.forEach(child => child.kill()) }
    }
    else if (scenario === 'dead-letter') {
      const { moveToDeadLetter, listDeadLetterJobs, retryDeadLetterJob } = await import('../../src/dead-letter')
      await moveToDeadLetter({ uuid: 'retry-me', payload: '{"jobName":"Example"}' }, 'manual')
      const [original] = await listDeadLetterJobs()
      assert(original)
      const results = await Promise.all(Array.from({ length: 10 }, () => retryDeadLetterJob(original.id)))
      assert.equal(results.filter(Boolean).length, 1, 'one caller owns the retry')
      assert.equal((await db.selectFrom('jobs').selectAll().execute()).length, 1, 'one active copy')
      assert.equal((await db.selectFrom('jobs').selectAll().execute())[0]?.payload, original.payload, 'operator retry preserves the stored payload')
      assert.equal((await listDeadLetterJobs()).length, 0)

      await moveToDeadLetter({ uuid: 'blocked', queue: 'blocked' }, 'manual')
      const [blocked] = await listDeadLetterJobs()
      assert(blocked)
      await assert.rejects(retryDeadLetterJob(blocked.id))
      assert.equal((await listDeadLetterJobs())[0]?.uuid, 'blocked', 'enqueue failure preserves the DLQ entry')
      for (let index = 0; index < 104; index++) await moveToDeadLetter({ uuid: `page-${index}` }, 'manual')
      assert.equal((await listDeadLetterJobs()).length, 100, 'default listing is bounded')
      assert.equal((await listDeadLetterJobs({ limit: 200 })).length, 105)
      await assert.rejects(listDeadLetterJobs({ limit: 0 }), RangeError)
    }
    else if (scenario === 'quarantine-hashes') {
      const { hashPayload, recordFailureForPoison, quarantineJob, isQuarantined, listQuarantined } = await import('../../src/poison')
      await quarantineJob('Ordered', { a: 1, nested: { b: 2, c: 3 } })
      assert.equal(await isQuarantined('Ordered', { nested: { c: 3, b: 2 }, a: 1 }), true)
      await Promise.all([
        recordFailureForPoison('Mixed', { a: 1, b: 2 }, { maxFailures: 2 }),
        recordFailureForPoison('Mixed', { b: 2, a: 1 }, { maxFailures: 2 }),
      ])
      assert.equal(await isQuarantined('Mixed', { a: 1, b: 2 }), true)
      assert.equal((await listQuarantined()).filter(row => row.job_name === 'Mixed').length, 1)
      await db.insertInto('job_quarantine').values({ job_name: 'Legacy', payload_hash: hashPayload({ b: 2, a: 1 }), failure_count: 2, window_start: new Date().toISOString(), quarantined_at: new Date().toISOString() }).execute()
      assert.equal(await isQuarantined('Legacy', { b: 2, a: 1 }), true, 'persisted v1 quarantine remains effective')
      assert.equal(await isQuarantined('Legacy', { a: 1, b: 2 }), true, 'a matched v1 row is upgraded for subsequent order-independent reads')
    }
    else if (scenario === 'poison') {
      const { recordFailureForPoison, quarantineJob, isQuarantined } = await import('../../src/poison')
      await Promise.all(Array.from({ length: 20 }, () => recordFailureForPoison('Concurrent', { id: 1 }, { maxFailures: 100 })))
      const row = await db.selectFrom('job_quarantine').where('job_name', '=', 'Concurrent').selectAll().executeTakeFirst()
      assert.equal(row?.failure_count, 20, 'every concurrent first failure is recorded')
      assert.equal(await recordFailureForPoison('First', {}, { maxFailures: 1 }), true)
      assert.equal(await isQuarantined('First', {}), true)
      await recordFailureForPoison('Reset', {}, { maxFailures: 100 })
      await db.updateTable('job_quarantine').set({ window_start: '2000-01-01 00:00:00' }).where('job_name', '=', 'Reset').execute()
      assert.equal(await recordFailureForPoison('Reset', {}, { maxFailures: 1 }), true, 'a reset window applies its threshold too')
      await Promise.all(Array.from({ length: 10 }, () => quarantineJob('Manual')))
      assert.equal(await isQuarantined('Manual', { anything: true }), true)
    }
    else if (scenario === 'circuit') {
      const { recordCircuitSuccess, recordCircuitFailure, listCircuitState, pauseQueue, resumeQueue, isCircuitOpen } = await import('../../src/circuit-breaker')
      await recordCircuitSuccess('success')
      await Promise.all(Array.from({ length: 20 }, () => recordCircuitSuccess('success')))
      assert.equal((await listCircuitState()).find(row => row.queue_name === 'success')?.success_count, 21)
      await Promise.all(Array.from({ length: 20 }, () => recordCircuitSuccess('new')))
      assert.equal((await listCircuitState()).find(row => row.queue_name === 'new')?.success_count, 20)
      const trips = await Promise.all(Array.from({ length: 20 }, () => recordCircuitFailure('failed', { minObservations: 10, failureRateThreshold: 1 })))
      assert.equal(trips.filter(Boolean).length, 1, 'one observation trips the breaker')
      assert.equal((await listCircuitState()).find(row => row.queue_name === 'failed')?.failure_count, 20)
      assert.equal(await isCircuitOpen('failed'), true)
      await resumeQueue('failed')
      assert.equal(await isCircuitOpen('failed'), false)
      await pauseQueue('failed', 0)
      assert.equal(await isCircuitOpen('failed'), false)
      await db.updateTable('queue_circuit_state').set({ window_start: '2000-01-01 00:00:00' }).where('queue_name', '=', 'success').execute()
      await recordCircuitSuccess('success')
      assert.equal((await listCircuitState()).find(row => row.queue_name === 'success')?.success_count, 1)
    }
    else if (scenario === 'scheduled-dispatch') {
      const { freezeTime, useRealTime } = await import('@stacksjs/testing/time')
      const { jobRegistry } = await import('../../src/discovery')
      const { startScheduler, stopScheduler } = await import('../../src/scheduler')
      // Another due job must not change which fixture envelope is inspected.
      // Keep all restarts in one cron minute, including on a busy CI host.
      jobRegistry.register({
        name: 'OtherDueJob', path: '', config: { rate: '* * * * *', queue: 'default' }, type: 'function', module: { handle() {} },
      })
      const register = (queue: string) => jobRegistry.register({
        name: 'AuditScheduled', path: '', config: { rate: '* * * * *', queue }, type: 'function', module: { handle() {} },
      })
      freezeTime('2026-11-06T12:34:59.950Z')
      try {
        register('blocked')
        await startScheduler({ checkInterval: 60_000, preventOverlapping: false })
        assert.equal(await db.selectFrom('scheduled_job_runs').where('job_name', '=', 'AuditScheduled').selectAll().executeTakeFirst(), undefined, 'failed enqueue must not record a run')
        await stopScheduler()
        // A real wall-clock boundary must not invalidate the same-minute case.
        await Bun.sleep(100)
        register('default')
        await startScheduler({ checkInterval: 60_000, preventOverlapping: false })
        const jobs = await db.selectFrom('jobs').selectAll().execute()
        const scheduled = jobs.filter(row => JSON.parse(String(row.payload)).jobName === 'AuditScheduled')
        assert.equal(scheduled.length, 1, 'retry in the same minute is allowed')
        assert.equal(jobs.filter(row => JSON.parse(String(row.payload)).jobName === 'OtherDueJob').length, 1, 'another due job is independently queued')
        const envelope = JSON.parse(String(scheduled[0]?.payload))
        assert.equal(envelope.envelopeVersion, 1)
        assert.equal(envelope.jobName, 'AuditScheduled')
        assert(Number.isFinite(Date.parse(envelope.dispatchedAt)), 'transactional dispatch uses the canonical envelope')
        assert(await db.selectFrom('scheduled_job_runs').where('job_name', '=', 'AuditScheduled').selectAll().executeTakeFirst())
        await stopScheduler()
        register('default')
        await startScheduler({ checkInterval: 60_000, preventOverlapping: false })
        assert.equal((await db.selectFrom('jobs').selectAll().execute()).filter(row => JSON.parse(String(row.payload)).jobName === 'AuditScheduled').length, 1, 'successful dispatch remains deduplicated across restart')
        assert.equal((await db.selectFrom('jobs').selectAll().execute()).filter(row => JSON.parse(String(row.payload)).jobName === 'OtherDueJob').length, 1, 'the other due job also stays deduplicated across restart')
      }
      finally {
        try { await stopScheduler() }
        finally { useRealTime() }
      }
    }
    else throw new Error(`Unknown reliability scenario: ${scenario}`)
    console.log(`${scenario} OK`)
  }
}
finally { resetDatabaseConnection() }
