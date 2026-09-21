/**
 * Loud detection of Bun SQL pools broken by oven-sh/bun#42804 (src/broken-pool.ts).
 *
 * The unit cases drive the detector with the error Bun really rejects with: a
 * plain Error, that exact message, no code. In the last case
 * fixtures/bun-42804-server.ts breaks a real Bun pool, and the child queries
 * it through the `db` facade, so the error comes from Bun and reaches the
 * detector through bun-query-builder's own hook dispatch. That case depends
 * on Bun still breaking the pool, and says what to do when it stops.
 */

import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'bun:test'
import { BUN_BROKEN_MYSQL_POOL_MESSAGE, BUN_BROKEN_POSTGRES_POOL_MESSAGE, createBrokenPoolDetector, isBrokenBunPoolError } from '../src/broken-pool'
import { BUN_42804_NO_LONGER_REPRODUCES } from './fixtures/bun-42804-server'

const PRIMARY = { driver: 'postgres', host: '10.0.0.5', port: 5432, database: 'stacks' }
const REPLICA = { driver: 'postgres', host: '10.0.0.6', port: 5432, database: 'stacks' }
const MYSQL = { driver: 'mysql', host: '10.0.0.7', port: 3306, database: 'stacks' }

/** What Bun 1.4.1 rejects with on a broken slot, captured from a real pool. */
function brokenSlotError(): Error {
  return new Error(BUN_BROKEN_POSTGRES_POOL_MESSAGE)
}

function ordinaryErrors(): unknown[] {
  const closed = Object.assign(new Error('Connection closed'), { code: 'ERR_POSTGRES_CONNECTION_CLOSED' })
  const terminated = Object.assign(new Error('terminating connection due to administrator command'), { code: 'ERR_POSTGRES_SERVER_ERROR', errno: '57P01' })
  return [
    closed,
    terminated,
    new Error(`query failed: ${BUN_BROKEN_POSTGRES_POOL_MESSAGE}`),
    new Error(`query failed: ${BUN_BROKEN_MYSQL_POOL_MESSAGE}`),
    BUN_BROKEN_POSTGRES_POOL_MESSAGE,
    BUN_BROKEN_MYSQL_POOL_MESSAGE,
    null,
    undefined,
  ]
}

function detectorWithLog() {
  const lines: string[] = []
  const detector = createBrokenPoolDetector({ log: line => lines.push(line), now: () => Date.UTC(2026, 8, 21, 12) })
  return { detector, lines }
}

describe('isBrokenBunPoolError', () => {
  it('matches the error Bun rejects with on a broken Postgres pool slot', () => {
    expect(isBrokenBunPoolError(brokenSlotError())).toBe(true)
  })

  it('matches the same guard in Bun\'s MySQL adapter, taken from Bun\'s source', () => {
    // Not reproduced locally: see the MySQL note in src/broken-pool.ts.
    expect(isBrokenBunPoolError(new Error(BUN_BROKEN_MYSQL_POOL_MESSAGE))).toBe(true)
  })

  it('ignores ordinary failures and anything that only quotes a guard message', () => {
    for (const error of ordinaryErrors())
      expect(isBrokenBunPoolError(error)).toBe(false)
  })
})

describe('createBrokenPoolDetector', () => {
  it('logs one line per pool however many of its queries fail', () => {
    const { detector, lines } = detectorWithLog()

    expect(detector.record(brokenSlotError(), PRIMARY)).toBe(true)
    for (let query = 0; query < 20; query++)
      expect(detector.record(brokenSlotError(), PRIMARY)).toBe(false)

    expect(lines).toHaveLength(1)
    expect(detector.pools()).toEqual([{ ...PRIMARY, detectedAt: Date.UTC(2026, 8, 21, 12) }])
  })

  it('names the upstream bug, the pool, Bun\'s message and the remedy', () => {
    const { detector, lines } = detectorWithLog()
    detector.record(brokenSlotError(), PRIMARY)
    detector.record(new Error(BUN_BROKEN_MYSQL_POOL_MESSAGE), MYSQL)

    expect(lines[0]).toStartWith('[database] oven-sh/bun#42804:')
    expect(lines[0]).toContain('postgres 10.0.0.5:5432/stacks')
    expect(lines[0]).toContain(`"${BUN_BROKEN_POSTGRES_POOL_MESSAGE}"`)
    expect(lines[0]).toContain('until this process restarts')
    expect(lines[1]).toContain('mysql 10.0.0.7:3306/stacks')
    expect(lines[1]).toContain(`"${BUN_BROKEN_MYSQL_POOL_MESSAGE}"`)
    for (const line of lines)
      expect(line).not.toMatch(/[\u2013\u2014]/)
  })

  it('reports a second broken pool on its own line', () => {
    const { detector, lines } = detectorWithLog()
    detector.record(brokenSlotError(), PRIMARY)
    detector.record(brokenSlotError(), REPLICA)

    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('postgres 10.0.0.6:5432/stacks')
    expect(detector.pools().map(pool => pool.host)).toEqual(['10.0.0.5', '10.0.0.6'])
  })

  it('never records an unrelated error', () => {
    const { detector, lines } = detectorWithLog()
    for (const error of ordinaryErrors())
      expect(detector.record(error, PRIMARY)).toBe(false)

    expect(lines).toEqual([])
    expect(detector.pools()).toEqual([])
  })

  it('attributes one error to the first pool that reports it', () => {
    // A replica builder's hook records first, then forwards the same error to
    // the process-wide hook, which would otherwise file it under the primary.
    const { detector, lines } = detectorWithLog()
    const error = brokenSlotError()
    detector.record(error, REPLICA)
    detector.record(error, PRIMARY)

    expect(lines).toHaveLength(1)
    expect(detector.pools().map(pool => pool.host)).toEqual(['10.0.0.6'])
  })
})

describe('the query hook, on a real broken Bun pool', () => {
  it('reports each broken pool once, under its own address, and ignores an ordinary failure', async () => {
    const child = Bun.spawn([process.execPath, '--no-env-file', join(import.meta.dir, 'fixtures/broken-pool-detection.ts')], {
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
    // Every query in the child gives up after 5s, so this only fires when the
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

      const result = JSON.parse(stdout.trim().split('\n').pop()!)
      const reports = stderr.split('\n').filter(line => line.startsWith('[database] oven-sh/bun#42804:'))

      // The condition every other assertion depends on. A Bun that carries
      // oven-sh/bun#40913 is expected to fail here.
      expect(result.primaryErrors, BUN_42804_NO_LONGER_REPRODUCES).toEqual([BUN_BROKEN_POSTGRES_POOL_MESSAGE, BUN_BROKEN_POSTGRES_POOL_MESSAGE, BUN_BROKEN_POSTGRES_POOL_MESSAGE])
      expect(result.replicaErrors, BUN_42804_NO_LONGER_REPRODUCES).toEqual([BUN_BROKEN_POSTGRES_POOL_MESSAGE, BUN_BROKEN_POSTGRES_POOL_MESSAGE])

      expect(result.hooksOnPostgres, 'postgres with query logging off gets the detection hook and nothing else').toEqual(['onQueryError'])
      expect(result.hooksOnSqlite, 'SQLite keeps the hook-free production profile').toBeNull()

      expect(result.ordinary).toContain('password authentication failed')
      expect(result.poolsAfterOrdinary).toBe(0)

      expect(reports, stderr).toHaveLength(2)
      expect(reports[0]).toContain(`postgres 127.0.0.1:${result.ports.primary}/stacks_broken_pool`)
      expect(reports[1]).toContain(`postgres 127.0.0.1:${result.ports.replica}/stacks_broken_pool`)
      expect(stderr).not.toContain('fixture-secret')
      expect(result.pools).toEqual([
        { driver: 'postgres', host: '127.0.0.1', port: result.ports.primary, database: 'stacks_broken_pool' },
        { driver: 'postgres', host: '127.0.0.1', port: result.ports.replica, database: 'stacks_broken_pool' },
      ])
    }
    finally {
      clearTimeout(watchdog)
      child.kill('SIGKILL')
    }
  }, 30_000)
})
