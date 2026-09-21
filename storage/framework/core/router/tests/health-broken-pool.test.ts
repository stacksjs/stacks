/**
 * `/api/health` on a database pool broken by oven-sh/bun#42804.
 *
 * Such a pool can keep failing queries until the process restarts, so the
 * endpoint has to answer 503 and say why, where "the database is down" would
 * send someone to the wrong place. It must not say which pool: the endpoint is
 * public, so the host, port and database stay in the server log. The child
 * serves the endpoint from the real router against a real Bun pool that
 * core/database's bun-42804-server.ts breaks, so the error comes from Bun, not
 * from a stub. That makes this test depend on Bun still breaking the pool,
 * and it says what to do when that stops. See core/database/src/broken-pool.ts.
 */

import { join } from 'node:path'
import process from 'node:process'
import { expect, it } from 'bun:test'
import { BUN_BROKEN_POSTGRES_POOL_MESSAGE } from '../../database/src/broken-pool'
import { BUN_42804_NO_LONGER_REPRODUCES } from '../../database/tests/fixtures/bun-42804-server'

/** The public response, pinned word for word: the cause and the remedy, and no pool. */
const BROKEN_POOL_HEALTH_MESSAGE = 'Database pool broken by oven-sh/bun#42804 until the process restarts. The server log names the pool.'

interface HealthResponse {
  status: number
  body: { status: string, checks: { database: { ok: boolean, message?: string } } }
}

it('/api/health answers 503 naming oven-sh/bun#42804 but not the pool, and keeps answering it after the probe succeeds again', async () => {
  const child = Bun.spawn([process.execPath, '--no-env-file', join(import.meta.dir, 'fixtures/health-broken-pool.ts')], {
    cwd: join(import.meta.dir, '..'),
    env: {
      ...process.env,
      APP_ENV: 'production',
      DB_CONNECTION: 'sqlite',
      DB_DATABASE_PATH: ':memory:',
      DB_QUERY_LOGGING_ENABLED: 'false',
      DB_HOST: '',
      DB_PORT: '',
      DB_DATABASE: '',
      DB_USERNAME: '',
      DB_PASSWORD: '',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  // Every request in the child gives up after 5s, so this only fires when the
  // child itself stops making progress.
  let timedOut = false
  const watchdog = setTimeout(() => {
    timedOut = true
    child.kill('SIGKILL')
  }, 20_000)
  try {
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(timedOut, `the fixture was killed after 20s. ${BUN_42804_NO_LONGER_REPRODUCES}\n${stdout}\n${stderr}`).toBe(false)
    expect(code, `${stdout}\n${stderr}`).toBe(0)

    const result = JSON.parse(stdout.trim().split('\n').pop()!) as {
      port: number
      healthy: HealthResponse
      refused: HealthResponse
      broken: HealthResponse[]
      brokenPoolsRecorded: number
      brokenPoolError: unknown
      probe: string
      afterRecovery: HealthResponse
    }
    const pool = `postgres 127.0.0.1:${result.port}/stacks_health`

    // The condition the rest depends on. A Bun that carries oven-sh/bun#40913
    // is expected to fail here.
    expect(result.brokenPoolError, BUN_42804_NO_LONGER_REPRODUCES).toBe(BUN_BROKEN_POSTGRES_POOL_MESSAGE)
    expect(result.brokenPoolsRecorded, 'the health probe records the pool it found broken').toBe(1)

    // Healthy before anything broke, so the 503s below come from the database.
    expect(result.healthy, JSON.stringify(result.healthy)).toMatchObject({ status: 200, body: { status: 'healthy' } })

    // An ordinary database failure is unhealthy too, but not this.
    expect(result.refused.status).toBe(503)
    expect(result.refused.body.checks.database.message).toContain('password authentication failed')
    expect(result.refused.body.checks.database.message).not.toContain('oven-sh/bun#42804')

    // The probe succeeds again, and the recorded pool still fails the check.
    expect(result.probe).toBe('ok')
    for (const response of [...result.broken, result.afterRecovery]) {
      expect(response.status).toBe(503)
      expect(response.body.status).toBe('degraded')
      // The whole message is fixed text, so it cannot carry the pool's port.
      expect(response.body.checks.database).toMatchObject({ ok: false, message: BROKEN_POOL_HEALTH_MESSAGE })
      for (const identity of ['127.0.0.1', 'stacks_health'])
        expect(JSON.stringify(response.body), `the public response must not name the pool (${identity})`).not.toContain(identity)
    }

    // Logged once for the pool, with its address, not once per health check.
    const reports = stderr.split('\n').filter(line => line.startsWith('[database] oven-sh/bun#42804:'))
    expect(reports, stderr).toHaveLength(1)
    expect(reports[0]).toContain(pool)
    expect(`${stdout}${stderr}`).not.toContain('fixture-secret')
  }
  finally {
    clearTimeout(watchdog)
    child.kill('SIGKILL')
  }
}, 30_000)
