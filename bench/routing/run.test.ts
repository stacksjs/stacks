import { describe, expect, it } from 'bun:test'
import { parseArgs } from './run'
import { DEFAULT_TARGETS } from './targets'

describe('routing benchmark options', () => {
  it('preserves the default matrix and accepts fractional timing windows', () => {
    expect(parseArgs([])).toMatchObject({
      targets: DEFAULT_TARGETS.map(target => target.id),
      connections: 50,
      warmupSeconds: 5,
      durationSeconds: 30,
      runs: 3,
      db: true,
    })
    expect(parseArgs(['-c', '2', '-d', '0.5', '--warmup', '0.25', '--runs', '1'])).toMatchObject({
      connections: 2, durationSeconds: 0.5, warmupSeconds: 0.25, runs: 1,
    })
    expect(parseArgs(['--warmup', '0']).warmupSeconds).toBe(0)
  })

  it.each(['--connections', '--runs'])('requires a positive safe integer for %s', (flag) => {
    for (const value of ['0', '-1', '1.5', 'NaN', 'Infinity', '9007199254740992', ''])
      expect(() => parseArgs([flag, value]), `${flag} ${value}`).toThrow()
  })

  it.each(['0', '-1', 'NaN', 'Infinity', ''])('rejects invalid measured duration %s', (value) => {
    expect(() => parseArgs(['--duration', value])).toThrow()
  })

  it.each(['-1', 'NaN', 'Infinity', ''])('rejects invalid warmup %s', (value) => {
    expect(() => parseArgs(['--warmup', value])).toThrow()
  })

  it.each(['missing', 'stacks,missing', '', 'stacks,'])('rejects unknown or empty target selections: %s', (value) => {
    expect(() => parseArgs(['--targets', value])).toThrow()
  })

  it.each(['missing', 'static-json,missing', '', 'static-json,'])('rejects unknown or empty scenario selections: %s', (value) => {
    expect(() => parseArgs(['--scenarios', value])).toThrow()
  })

  it('rejects a matrix emptied by --no-db', () => {
    expect(() => parseArgs(['--scenarios', 'db-roundtrip', '--no-db'])).toThrow('No scenarios')
  })

  it('accepts explicit tuned targets and a mixed matrix with --no-db', () => {
    expect(parseArgs(['--targets', 'stacks-wal-full,bun-raw', '--scenarios', 'static-json,db-roundtrip', '--no-db'])).toMatchObject({
      targets: ['stacks-wal-full', 'bun-raw'], scenarios: ['static-json', 'db-roundtrip'], db: false,
    })
  })

  it('rejects missing values and unknown flags', () => {
    expect(() => parseArgs(['--runs'])).toThrow('--runs needs a value')
    expect(() => parseArgs(['--mystery'])).toThrow('Unknown flag')
  })
})
