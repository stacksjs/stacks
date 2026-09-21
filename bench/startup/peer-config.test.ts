import { describe, expect, test } from 'bun:test'
import { DEFAULT_PEER_STARTUP_TARGET_IDS, parsePeerStartupOptions, peerStartupSchedule } from './peer-config'

describe('peer startup benchmark configuration', () => {
  test('uses the complete default comparison set', () => {
    const options = parsePeerStartupOptions([])
    expect(options.runs).toBe(15)
    expect(options.output).toBe('bench/startup/results/peers-latest.json')
    expect(options.targets.map(target => target.id)).toEqual([...DEFAULT_PEER_STARTUP_TARGET_IDS])
  })

  test('requires a unique target set with the Bun baseline', () => {
    expect(parsePeerStartupOptions(['--runs=30', '--targets=stacks,bun-raw', '--output=/tmp/peers.json'])).toMatchObject({
      runs: 30,
      output: '/tmp/peers.json',
    })
    expect(() => parsePeerStartupOptions(['--runs=14'])).toThrow('at least 15')
    expect(() => parsePeerStartupOptions(['--targets=stacks,hono'])).toThrow('must include bun-raw')
    expect(() => parsePeerStartupOptions(['--targets=stacks,stacks,bun-raw'])).toThrow('must not contain duplicates')
    expect(() => parsePeerStartupOptions(['--targets=unknown,bun-raw'])).toThrow('Unknown peer startup target')
  })

  test('balances every target across process positions', () => {
    const targets = parsePeerStartupOptions([]).targets
    const schedule = peerStartupSchedule(targets, 15)
    expect(schedule).toHaveLength(targets.length * 15)
    const totals = Object.fromEntries(targets.map(target => [target.id, 0]))
    for (const sample of schedule)
      totals[sample.target.id]! += sample.order
    expect(new Set(Object.values(totals))).toEqual(new Set([45]))
  })
})
