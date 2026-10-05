/**
 * Runs one step of a real `buddy migrate` against a disposable SQLite
 * database, for `migrate-ledger-repair.test.ts` (stacksjs/stacks#2860).
 *
 * A subprocess because the runner configures process-wide state (the query
 * builder's config, the connection) that must not leak into other test files.
 *
 *   FIXTURE_STEP=migrate          run the migrations
 *   FIXTURE_STEP=migrate-skipping run them with a runner that applies nothing,
 *                                 the state a database 49 tables short was in
 *   FIXTURE_STEP=requeue          `migrate:status --reconcile --requeue-reverted`
 *
 * Prints one JSON line on stdout.
 */
import process from 'node:process'

const step = process.env.FIXTURE_STEP

if (step === 'migrate-skipping') {
  // Swap the runner for one that records nothing, before anything imports it.
  const real = await import('@stacksjs/query-builder')
  Bun.plugin({
    setup(build) {
      build.module('@stacksjs/query-builder', () => ({
        exports: { ...real, executeMigration: async () => true },
        loader: 'object',
      }))
    },
  })
}

const database = await import('../../src')

if (step === 'migrate' || step === 'migrate-skipping') {
  const result = await database.runDatabaseMigration()
  console.log(JSON.stringify(result.isOk ? { ok: true, message: result.value } : { ok: false, message: result.error.message }))
}
else if (step === 'requeue') {
  const result = await database.reconcileMigrationLedger({ requeueReverted: true, dialect: 'sqlite' })
  console.log(JSON.stringify({ ok: true, requeued: result.requeued, skipped: result.skipped }))
}
else {
  console.log(JSON.stringify({ ok: false, message: `unknown FIXTURE_STEP ${step}` }))
}

process.exit(0)
