import { describe, expect, it } from 'bun:test'
import { BENCH_ROOT, serverCommand, serverEnvironment } from './runtime'

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
})
