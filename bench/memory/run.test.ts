import { describe, expect, it } from 'bun:test'
import { parseArgs } from './run'

describe('memory benchmark counts', () => {
  it.each(['--connections', '-c', '--runs'])('requires a positive safe integer for %s', (flag) => {
    for (const value of ['9007199254740992', '1.5', '0', '-1', 'Infinity', 'NaN', ''])
      expect(() => parseArgs([flag, value]), `${flag} ${value}`).toThrow()
  })

  it('preserves defaults and accepts fractional timing windows and rates', () => {
    expect(parseArgs([])).toMatchObject({ connections: 64, runs: 1, loadSeconds: 60, idleSeconds: 180 })
    expect(parseArgs(['-c', '2', '--runs', '3', '--load', '0.5', '--idle', '0.75', '--interval', '10.5', '--settle', '0.25', '--rate', '100.5'])).toMatchObject({
      connections: 2, runs: 3, loadSeconds: 0.5, idleSeconds: 0.75, sampleIntervalMs: 10.5, settleSeconds: 0.25, requestRate: 100.5,
    })
  })

  it('still caps the settling window at the idle duration', () => {
    expect(parseArgs(['--idle', '0.5', '--settle', '2']).settleSeconds).toBe(0.5)
  })
})
