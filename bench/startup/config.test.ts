import { describe, expect, test } from 'bun:test'
import { MIN_STARTUP_PAIRS, parseStartupOptions, startupSampleCommand, startupSchedule } from './config'

describe('startup benchmark configuration', () => {
  test('defaults to a diagnostic-sized paired run', () => {
    expect(parseStartupOptions([])).toEqual({
      output: 'bench/startup/results/latest.json',
      pairs: MIN_STARTUP_PAIRS,
    })
    expect(parseStartupOptions([], 'bench/startup/results/ready.json').output).toBe('bench/startup/results/ready.json')
  })

  test('parses explicit options and rejects invalid values', () => {
    expect(parseStartupOptions(['--pairs=30', '--output=/tmp/startup.json'])).toEqual({
      output: '/tmp/startup.json',
      pairs: 30,
    })
    expect(() => parseStartupOptions(['--pairs=14'])).toThrow('at least 15')
    expect(() => parseStartupOptions(['--output='])).toThrow('must not be empty')
    expect(() => parseStartupOptions(['--warmup=2'])).toThrow('Unknown startup benchmark option')
  })

  test('alternates process order within complete pairs', () => {
    const schedule = startupSchedule(15)
    expect(schedule).toHaveLength(30)
    expect(schedule.slice(0, 6)).toEqual([
      { order: 0, pair: 0, variant: 'root' },
      { order: 1, pair: 0, variant: 'runtime' },
      { order: 0, pair: 1, variant: 'runtime' },
      { order: 1, pair: 1, variant: 'root' },
      { order: 0, pair: 2, variant: 'root' },
      { order: 1, pair: 2, variant: 'runtime' },
    ])
  })

  test('passes the isolated Bun config as one CLI option', () => {
    expect(startupSampleCommand('/bun', '/bench/bunfig.toml', '/bench/sample.ts', '/dist/runtime.js')).toEqual([
      '/bun',
      '--no-env-file',
      '--config=/bench/bunfig.toml',
      '/bench/sample.ts',
      '/dist/runtime.js',
    ])
  })
})
