import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { BENCH_ROOT, benchmarkQueryLoggingEnabled, serverCommand, serverEnvironment } from './runtime'
import { DEFAULT_TARGETS, targetById } from './targets'

describe('benchmark server isolation', () => {
  it('boots targets without the application bunfig preloads', () => {
    expect(serverCommand('bun-raw.ts')).toEqual([
      process.execPath,
      `--config=${BENCH_ROOT}bunfig.toml`,
      `${BENCH_ROOT}servers/bun-raw.ts`,
    ])
  })

  it('boots every framework in production mode', () => {
    const env = serverEnvironment({
      id: 'test',
      label: 'test',
      server: 'bun-raw.ts',
      env: { BENCH_MODE: 'minimal' },
    }, false, 'static-json')

    expect(env.APP_ENV).toBe('production')
    expect(env.NODE_ENV).toBe('production')
    expect(env.BENCH_MODE).toBe('minimal')
    expect(env.BENCH_SCENARIO).toBe('static-json')
  })

  it('treats persistent query logging as an explicit benchmark profile', () => {
    const previous = process.env.DB_QUERY_LOGGING_ENABLED
    try {
      delete process.env.DB_QUERY_LOGGING_ENABLED
      expect(benchmarkQueryLoggingEnabled()).toBe(false)
      process.env.DB_QUERY_LOGGING_ENABLED = 'true'
      expect(benchmarkQueryLoggingEnabled()).toBe(true)
      process.env.DB_QUERY_LOGGING_ENABLED = '1'
      expect(benchmarkQueryLoggingEnabled()).toBe(true)
      process.env.DB_QUERY_LOGGING_ENABLED = 'false'
      expect(benchmarkQueryLoggingEnabled()).toBe(false)
    }
    finally {
      if (previous === undefined) delete process.env.DB_QUERY_LOGGING_ENABLED
      else process.env.DB_QUERY_LOGGING_ENABLED = previous
    }
  })

  it('keeps tuned settings opt-in and prevents shell settings from changing stock profiles', () => {
    const keys = ['BENCH_MODE', 'BENCH_SQLITE_PROFILE', 'STACKS_SECURITY_HEADERS_DISABLE', 'BENCH_SCENARIO', 'DB_CONNECTION'] as const
    const previous = keys.map(key => process.env[key])
    try {
      process.env.BENCH_MODE = 'minimal'
      process.env.BENCH_SQLITE_PROFILE = 'wal-full'
      process.env.STACKS_SECURITY_HEADERS_DISABLE = 'true'
      process.env.BENCH_SCENARIO = 'db-roundtrip'
      process.env.DB_CONNECTION = 'postgres'

      const stock = serverEnvironment(targetById('stacks-warm')!, true)
      expect(stock.BENCH_MODE).toBe('secure')
      expect(stock.BENCH_SQLITE_PROFILE).toBe('stock')
      expect(stock.STACKS_SECURITY_HEADERS_DISABLE).toBe('false')
      expect(stock.BENCH_SCENARIO).toBe('')
      expect(stock.DB_CONNECTION).toBe('sqlite')

      const tuned = serverEnvironment(targetById('stacks-wal-full')!, true)
      expect(tuned.BENCH_MODE).toBe('secure')
      expect(tuned.BENCH_SQLITE_PROFILE).toBe('wal-full')
      expect(tuned.STACKS_SECURITY_HEADERS_DISABLE).toBe('false')
      expect(DEFAULT_TARGETS.map(target => target.id)).not.toContain('stacks-wal-full')
      expect(serverEnvironment(targetById('stacks-minimal')!, true).STACKS_SECURITY_HEADERS_DISABLE).toBe('true')
    }
    finally {
      keys.forEach((key, index) => {
        const value = previous[index]
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      })
    }
  })
})

describe('benchmark server readiness', () => {
  it.each(['post-validate', 'static-json', 'all'])('boots %s with its real request', async (scenario) => {
    const { exitCode, stdout, stderr } = await runServerFixture('readiness.ts', scenario)
    expect(exitCode, stderr).toBe(0)
    expect(stdout).toContain('benchmark-readiness-ok')
  }, 15_000)

  it.each(['hang-headers', 'hang-body', 'unavailable', 'config-exit'])('cleans up failed startup: %s', async (scenario) => {
    const { exitCode, stdout, stderr } = await runServerFixture('startup-failure.ts', scenario)
    expect(exitCode, stderr).toBe(0)
    expect(stdout).toContain('benchmark-startup-cleanup-ok')
  }, 15_000)
})

async function runServerFixture(fixture: string, scenario: string) {
  const reservation = Bun.serve({ port: 0, fetch: () => new Response() })
  const port = reservation.port
  await reservation.stop(true)
  const child = Bun.spawn([
    process.execPath,
    `--config=${join(import.meta.dir, 'bunfig.toml')}`,
    join(import.meta.dir, 'fixtures', fixture),
    'check',
    scenario,
  ], {
    env: { ...process.env, BENCH_PORT: String(port) },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  try {
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    return { exitCode, stdout, stderr }
  }
  finally {
    if (child.exitCode == null) child.kill()
    await child.exited
  }
}
