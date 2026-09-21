import { expect, test } from 'bun:test'
import { SQL } from 'bun'

// TEMPORARY soak for #2619. Not for merge: runs the transaction-scope fixture repeatedly on the hosted runner,
// with the single-connection admin (the fix) and the old default-pool admin (control), several at a time.
const FIXTURE = `${import.meta.dir}/fixtures/postgres-transaction-scope.ts`
const ROUNDS = 60
const CONCURRENCY = 6

test.skipIf(!process.env.STACKS_TEST_POSTGRES_URL)('soak: transaction-scope fixture exits naturally', async () => {
  const url = new URL(process.env.STACKS_TEST_POSTGRES_URL!)
  const admin = new SQL(url.href)
  const tally: Record<string, Record<string, number>> = { single: {}, pooled: {} }
  const jobs = Array.from({ length: ROUNDS * 2 }, (_, i) => (i % 2 === 0 ? 'single' : 'pooled'))
  let next = 0
  async function run(variant: string): Promise<void> {
    const name = `stacks_transaction_test_${crypto.randomUUID().replaceAll('-', '')}`
    await admin.unsafe(`CREATE DATABASE "${name}"`)
    try {
      const child = Bun.spawn([process.execPath, FIXTURE], {
        env: {
          ...process.env,
          APP_ENV: 'test', DB_CONNECTION: 'postgres', DB_DATABASE_PATH: ':memory:',
          DB_HOST: url.hostname, DB_PORT: url.port || '5432', DB_DATABASE: name,
          DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
          SOAK_ADMIN_POOL: variant,
        },
        stdout: 'pipe', stderr: 'pipe',
      })
      const watchdog = setTimeout(() => child.kill(), 12_000)
      const [code, stdout] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      clearTimeout(watchdog)
      const key = `${code}${stdout.includes('PASS') ? '+PASS' : ''}`
      tally[variant][key] = (tally[variant][key] ?? 0) + 1
    }
    finally {
      await admin.unsafe(`DROP DATABASE "${name}" WITH (FORCE)`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < jobs.length)
      await run(jobs[next++])
  }))
  await admin.close()
  console.log(`SOAK ${JSON.stringify(tally)}`)
  expect(tally.single).toEqual({ '0+PASS': ROUNDS })
}, 600_000)
